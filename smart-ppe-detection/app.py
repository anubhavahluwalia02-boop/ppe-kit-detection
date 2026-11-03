"""
Smart PPE Kit Detection System - Flask Web Application
Provides RESTful APIs for webcam frames, image uploads, compliance evaluation,
and violation history tracking using SQLite and YOLOv5.
"""
import os
import io
import base64
import uuid
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify, render_template, send_from_directory, url_for
from werkzeug.utils import secure_filename
import cv2
import numpy as np

import config
from src.detector import YoloV5Detector
from src.compliance import ComplianceAnalyzer
from src.database import DatabaseManager

app = Flask(
    __name__,
    template_folder="templates",
    static_folder="static"
)

# Initialize subsystems
db = DatabaseManager(str(config.DATABASE_PATH))
detector = YoloV5Detector()
analyzer = ComplianceAnalyzer()

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}

def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route("/")
def index():
    """Serves the main web dashboard."""
    return render_template("index.html")

@app.route("/api/model/status", methods=["GET"])
def model_status():
    """Returns the current YOLOv5 model status and configuration."""
    return jsonify({
        "is_loaded": detector.is_loaded,
        "model_path": str(detector.model_path),
        "model_exists": detector.model_path.exists(),
        "error": detector.load_error,
        "class_names": detector.class_names,
        "confidence_threshold": detector.conf_threshold,
        "iou_threshold": detector.iou_threshold,
        "required_ppe": analyzer.required_ppe
    })

@app.route("/api/detect/image", methods=["POST"])
def detect_image():
    """
    Handles image file upload (JPG, JPEG, PNG).
    Runs YOLOv5 object detection, runs compliance analysis,
    saves evidence if violations exist, and returns structured results.
    """
    if not detector.is_loaded:
        return jsonify({
            "success": False,
            "error": "YOLOv5 model is not loaded. " + (detector.load_error or "Please place 'best.pt' in the models/ directory.")
        }), 503

    if "image" not in request.files:
        return jsonify({"success": False, "error": "No image file provided in the request."}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"success": False, "error": "No file selected."}), 400

    if not allowed_file(file.filename):
        return jsonify({
            "success": False,
            "error": f"Unsupported file format. Please upload JPG, JPEG, or PNG images."
        }), 400

    # Read image into OpenCV format
    try:
        file_bytes = np.frombuffer(file.read(), np.uint8)
        image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        if image is None:
            return jsonify({"success": False, "error": "Could not decode uploaded image."}), 400
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to process image: {str(e)}"}), 400

    # Get optional runtime threshold from request
    conf_thresh = request.form.get("confidence", config.CONFIDENCE_THRESHOLD, type=float)

    # Save original image
    file_id = str(uuid.uuid4())[:8]
    orig_filename = f"orig_{file_id}_{secure_filename(file.filename)}"
    orig_filepath = config.UPLOADS_DIR / orig_filename
    cv2.imwrite(str(orig_filepath), image)

    try:
        # Run YOLOv5 detection
        detections, annotated_image = detector.detect(image, conf_threshold=conf_thresh)
        
        # Run Compliance analysis
        compliance = analyzer.analyze(detections)

        # Save annotated image
        annot_filename = f"annot_{file_id}_{secure_filename(file.filename)}"
        annot_filepath = config.UPLOADS_DIR / annot_filename
        cv2.imwrite(str(annot_filepath), annotated_image)

        # If violations detected, record in database with evidence image
        evidence_url = None
        if compliance["violation_workers"] > 0:
            evidence_filename = f"violation_{file_id}.jpg"
            evidence_filepath = config.EVIDENCE_DIR / evidence_filename
            cv2.imwrite(str(evidence_filepath), annotated_image)
            evidence_url = f"/api/evidence/{evidence_filename}"

            for worker in compliance["worker_evaluations"]:
                if worker["status"] == "VIOLATION":
                    db.record_violation(
                        violation_type="Missing Required PPE",
                        missing_ppe=worker["missing_ppe"],
                        confidence=worker.get("confidence", 0.9),
                        evidence_path=evidence_url,
                        source="image_upload",
                        details=f"Worker #{worker['worker_id']}: missing {', '.join(worker['missing_ppe'])}"
                    )

        return jsonify({
            "success": True,
            "original_image_url": f"/api/uploads/{orig_filename}",
            "annotated_image_url": f"/api/uploads/{annot_filename}",
            "detections": detections,
            "compliance": compliance,
            "evidence_saved": evidence_url is not None
        })

    except Exception as e:
        return jsonify({"success": False, "error": f"Inference error: {str(e)}"}), 500

@app.route("/api/detect/frame", methods=["POST"])
def detect_frame():
    """
    Processes video frames sent from the browser client's webcam via getUserMedia().
    Accepts JSON payload: { "frame": "data:image/jpeg;base64,...", "confidence": 0.45 }
    """
    if not detector.is_loaded:
        return jsonify({
            "success": False,
            "error": "YOLOv5 model is not loaded. " + (detector.load_error or "Please place 'best.pt' in models/")
        }), 503

    data = request.get_json(silent=True)
    if not data or "frame" not in data:
        return jsonify({"success": False, "error": "No frame data provided."}), 400

    frame_data = data["frame"]
    conf_thresh = float(data.get("confidence", config.CONFIDENCE_THRESHOLD))

    try:
        if "," in frame_data:
            frame_data = frame_data.split(",", 1)[1]
        decoded_bytes = base64.b64decode(frame_data)
        np_arr = np.frombuffer(decoded_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if frame is None:
            return jsonify({"success": False, "error": "Invalid frame bytes."}), 400
    except Exception as e:
        return jsonify({"success": False, "error": f"Frame decoding failed: {str(e)}"}), 400

    try:
        # Run detection
        detections, annotated_frame = detector.detect(frame, conf_threshold=conf_thresh)
        compliance = analyzer.analyze(detections)

        # Encode annotated frame back to JPEG Base64 for rapid client display
        ret, buffer = cv2.imencode(".jpg", annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        annotated_b64 = "data:image/jpeg;base64," + base64.b64encode(buffer).decode("utf-8")

        # Save snapshot if explicitly flagged as violation snapshot
        if data.get("record_violation", False) and compliance["violation_workers"] > 0:
            evidence_id = str(uuid.uuid4())[:8]
            evidence_filename = f"live_violation_{evidence_id}.jpg"
            evidence_filepath = config.EVIDENCE_DIR / evidence_filename
            cv2.imwrite(str(evidence_filepath), annotated_frame)
            evidence_url = f"/api/evidence/{evidence_filename}"

            for worker in compliance["worker_evaluations"]:
                if worker["status"] == "VIOLATION":
                    db.record_violation(
                        violation_type="Live Feed Violation",
                        missing_ppe=worker["missing_ppe"],
                        confidence=worker.get("confidence", 0.85),
                        evidence_path=evidence_url,
                        source="live_camera",
                        details=f"Live camera alert: missing {', '.join(worker['missing_ppe'])}"
                    )

        return jsonify({
            "success": True,
            "annotated_frame": annotated_b64,
            "detections": detections,
            "compliance": compliance
        })
    except Exception as e:
        return jsonify({"success": False, "error": f"Frame analysis error: {str(e)}"}), 500

@app.route("/api/violations", methods=["GET"])
def get_violations():
    """Returns violation history stored in SQLite."""
    limit = request.args.get("limit", 100, type=int)
    offset = request.args.get("offset", 0, type=int)
    records = db.get_violations(limit=limit, offset=offset)
    stats = db.get_stats()
    return jsonify({
        "success": True,
        "violations": records,
        "stats": stats
    })

@app.route("/api/violations/<int:vid>", methods=["DELETE"])
def delete_violation(vid):
    """Deletes a specific violation record."""
    deleted = db.delete_violation(vid)
    return jsonify({"success": deleted})

@app.route("/api/violations/clear", methods=["POST"])
def clear_violations():
    """Clears all violation history."""
    db.clear_all()
    return jsonify({"success": True})

@app.route("/api/uploads/<path:filename>")
def serve_upload(filename):
    """Serves uploaded original and annotated images."""
    return send_from_directory(str(config.UPLOADS_DIR), filename)

@app.route("/api/evidence/<path:filename>")
def serve_evidence(filename):
    """Serves recorded violation evidence images."""
    return send_from_directory(str(config.EVIDENCE_DIR), filename)

if __name__ == "__main__":
    print(f"Starting Smart PPE Kit Detection Server at http://{config.HOST}:{config.PORT}")
    app.run(host=config.HOST, port=config.PORT, debug=config.DEBUG)
