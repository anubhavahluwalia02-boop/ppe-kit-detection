import JSZip from 'jszip';

export interface ProjectFile {
  path: string;
  content: string;
}

export const PYTHON_PROJECT_FILES: ProjectFile[] = [
  {
    path: 'app.py',
    content: `"""
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
from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename
import cv2
import numpy as np

import config
from src.detector import YoloV5Detector
from src.compliance import ComplianceAnalyzer
from src.database import DatabaseManager

app = Flask(__name__, template_folder="templates", static_folder="static")

db = DatabaseManager(str(config.DATABASE_PATH))
detector = YoloV5Detector()
analyzer = ComplianceAnalyzer()

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}

def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/model/status", methods=["GET"])
def model_status():
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
    if not detector.is_loaded:
        return jsonify({
            "success": False,
            "error": "YOLOv5 model is not loaded. " + (detector.load_error or "Please place 'best.pt' in models/.")
        }), 503

    if "image" not in request.files:
        return jsonify({"success": False, "error": "No image file provided."}), 400

    file = request.files["image"]
    if file.filename == "" or not allowed_file(file.filename):
        return jsonify({"success": False, "error": "Invalid or unsupported file format."}), 400

    try:
        file_bytes = np.frombuffer(file.read(), np.uint8)
        image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        if image is None:
            return jsonify({"success": False, "error": "Could not decode uploaded image."}), 400

        conf_thresh = request.form.get("confidence", config.CONFIDENCE_THRESHOLD, type=float)
        file_id = str(uuid.uuid4())[:8]

        orig_filename = f"orig_{file_id}_{secure_filename(file.filename)}"
        cv2.imwrite(str(config.UPLOADS_DIR / orig_filename), image)

        detections, annotated_image = detector.detect(image, conf_threshold=conf_thresh)
        compliance = analyzer.analyze(detections)

        annot_filename = f"annot_{file_id}_{secure_filename(file.filename)}"
        cv2.imwrite(str(config.UPLOADS_DIR / annot_filename), annotated_image)

        evidence_url = None
        if compliance["violation_workers"] > 0:
            evidence_filename = f"violation_{file_id}.jpg"
            cv2.imwrite(str(config.EVIDENCE_DIR / evidence_filename), annotated_image)
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
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/detect/frame", methods=["POST"])
def detect_frame():
    if not detector.is_loaded:
        return jsonify({
            "success": False,
            "error": "YOLOv5 model is not loaded. " + (detector.load_error or "Please place 'best.pt' in models/.")
        }), 503

    data = request.get_json(silent=True)
    if not data or "frame" not in data:
        return jsonify({"success": False, "error": "No frame data provided."}), 400

    try:
        frame_data = data["frame"]
        if "," in frame_data:
            frame_data = frame_data.split(",", 1)[1]
        decoded = base64.b64decode(frame_data)
        np_arr = np.frombuffer(decoded, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        conf = float(data.get("confidence", config.CONFIDENCE_THRESHOLD))
        detections, annotated = detector.detect(frame, conf_threshold=conf)
        compliance = analyzer.analyze(detections)

        ret, buffer = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        annot_b64 = "data:image/jpeg;base64," + base64.b64encode(buffer).decode("utf-8")

        return jsonify({
            "success": True,
            "annotated_frame": annot_b64,
            "detections": detections,
            "compliance": compliance
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/violations", methods=["GET"])
def get_violations():
    return jsonify({
        "success": True,
        "violations": db.get_violations(),
        "stats": db.get_stats()
    })

if __name__ == "__main__":
    app.run(host=config.HOST, port=config.PORT, debug=config.DEBUG)
`,
  },
  {
    path: 'config.py',
    content: `"""
Configuration settings for Smart PPE Kit Detection System.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
UPLOADS_DIR = BASE_DIR / "uploads"
EVIDENCE_DIR = BASE_DIR / "evidence"
DATABASE_PATH = BASE_DIR / "violations.db"

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)

MODEL_PATH = MODELS_DIR / "best.pt"
CONFIDENCE_THRESHOLD = 0.45
IOU_THRESHOLD = 0.45
IMAGE_SIZE = 640

PPE_CLASS_MAPPING = {
    "helmet": "Safety Helmet",
    "hard-hat": "Safety Helmet",
    "hard_hat": "Safety Helmet",
    "safety-helmet": "Safety Helmet",
    "vest": "Safety Vest",
    "safety-vest": "Safety Vest",
    "reflective-vest": "Safety Vest",
    "gloves": "Safety Gloves",
    "safety-gloves": "Safety Gloves",
    "goggles": "Safety Goggles",
    "safety-goggles": "Safety Goggles",
    "safety_goggles": "Safety Goggles",
    "glasses": "Safety Goggles",
    "safety-glasses": "Safety Goggles",
    "safety_glasses": "Safety Goggles",
    "eyewear": "Safety Goggles",
    "spectacles": "Safety Goggles",
    "sunglasses": "Safety Goggles",
    "eye-protection": "Safety Goggles",
    "eye_protection": "Safety Goggles",
    "protective-glasses": "Safety Goggles",
    "weird-glasses": "Safety Goggles",
    "boots": "Safety Boots",
    "safety-boots": "Safety Boots",
    "shoes": "Safety Boots",
    "person": "Person",
    "worker": "Person",
    "no-helmet": "Missing Helmet",
    "no-vest": "Missing Vest",
    "no-gloves": "Missing Gloves",
    "no-goggles": "Missing Goggles",
    "no-boots": "Missing Boots",
}

REQUIRED_PPE = [
    "Safety Helmet",
    "Safety Vest",
    "Safety Gloves",
    "Safety Goggles",
    "Safety Boots"
]

CLASS_COLORS = {
    "Safety Helmet": (0, 255, 0),
    "Safety Vest": (0, 200, 255),
    "Safety Gloves": (255, 191, 0),
    "Safety Goggles": (255, 105, 180),
    "Safety Boots": (144, 238, 144),
    "Person": (255, 255, 255),
    "Missing Helmet": (0, 0, 255),
    "Missing Vest": (0, 0, 255),
    "Missing Gloves": (0, 0, 255),
    "Missing Goggles": (0, 0, 255),
    "Missing Boots": (0, 0, 255),
}

DEFAULT_COLOR = (200, 200, 200)
HOST = "0.0.0.0"
PORT = 5000
DEBUG = True
`,
  },
  {
    path: 'src/detector.py',
    content: `"""
YOLOv5 Object Detection Pipeline.
Loads custom PyTorch YOLOv5 weights (best.pt), performs forward inference,
maps classes dynamically from model.names, and renders annotated bounding boxes.
"""
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
import cv2
import config

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

class YoloV5Detector:
    def __init__(self, model_path: str = str(config.MODEL_PATH), conf_threshold: float = config.CONFIDENCE_THRESHOLD):
        self.model_path = Path(model_path)
        self.conf_threshold = conf_threshold
        self.iou_threshold = config.IOU_THRESHOLD
        self.class_mapping = config.PPE_CLASS_MAPPING
        self.model = None
        self.class_names = {}
        self.load_error = None
        self.is_loaded = False
        self._load_model()

    def _load_model(self):
        if not TORCH_AVAILABLE:
            self.load_error = "PyTorch is not installed. Run: pip install -r requirements.txt"
            return
        if not self.model_path.exists():
            self.load_error = f"Model weights '{self.model_path.name}' missing. Place best.pt in models/ directory."
            return

        try:
            device = "cuda" if torch.cuda.is_available() else "cpu"
            self.model = torch.hub.load(
                "ultralytics/yolov5",
                "custom",
                path=str(self.model_path),
                device=device,
                force_reload=False
            )
            self.model.conf = self.conf_threshold
            self.model.iou = self.iou_threshold

            if hasattr(self.model, "names"):
                if isinstance(self.model.names, dict):
                    self.class_names = self.model.names
                else:
                    self.class_names = {i: n for i, n in enumerate(self.model.names)}
            self.is_loaded = True
        except Exception as e:
            self.load_error = f"Failed to load weights: {str(e)}"

    def standardize_class_name(self, raw: str) -> str:
        return self.class_mapping.get(raw.strip().lower().replace("_", "-"), raw.title())

    def detect(self, image: np.ndarray, conf_threshold: Optional[float] = None):
        if not self.is_loaded or self.model is None:
            raise RuntimeError(self.load_error or "Model is not loaded.")

        if conf_threshold is not None:
            self.model.conf = float(conf_threshold)

        img_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = self.model(img_rgb, size=config.IMAGE_SIZE)
        parsed = []
        raw_preds = results.xyxy[0].cpu().numpy()

        for pred in raw_preds:
            x1, y1, x2, y2, conf, cls_id = pred
            raw_class = self.class_names.get(int(cls_id), f"class_{int(cls_id)}")
            std_class = self.standardize_class_name(raw_class)
            parsed.append({
                "class": std_class,
                "raw_class": raw_class,
                "confidence": float(round(conf, 3)),
                "box": [float(round(x1, 1)), float(round(y1, 1)), float(round(x2, 1)), float(round(y2, 1))]
            })

        annotated = self.draw_annotations(image.copy(), parsed)
        return parsed, annotated

    def draw_annotations(self, image: np.ndarray, detections: List[Dict[str, Any]]) -> np.ndarray:
        for det in detections:
            x1, y1, x2, y2 = [int(v) for v in det["box"]]
            color = config.CLASS_COLORS.get(det["class"], config.DEFAULT_COLOR)
            cv2.rectangle(image, (x1, y1), (x2, y2), color, 2)
            label = f"{det['class']} {int(det['confidence'] * 100)}%"
            cv2.putText(image, label, (x1, max(20, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        return image
`,
  },
  {
    path: 'src/compliance.py',
    content: `"""
Compliance Engine: Associates PPE detections to workers via bounding-box overlap.
Flags NEEDS REVIEW if no worker silhouette is detected. Supports class synonyms for Safety Goggles
such as 'glasses', 'safety-glasses', 'goggles', 'spectacles', and 'eyewear'.
"""
from typing import List, Dict, Any, Optional
import config

PPE_SYNONYMS = {
    "Safety Goggles": [
        "Safety Goggles",
        "goggles",
        "glasses",
        "safety-glasses",
        "safety_glasses",
        "safety-goggles",
        "safety_goggles",
        "spectacles",
        "eyewear",
        "sunglasses",
        "eye-protection",
        "eye_protection",
        "protective-glasses",
        "weird-glasses",
    ],
    "Safety Helmet": [
        "Safety Helmet",
        "helmet",
        "hard-hat",
        "hard_hat",
        "safety-helmet",
        "hardhat",
        "cap",
    ],
    "Safety Vest": [
        "Safety Vest",
        "vest",
        "safety-vest",
        "reflective-vest",
        "hi-vis-vest",
    ],
    "Safety Gloves": [
        "Safety Gloves",
        "gloves",
        "safety-gloves",
        "work-gloves",
    ],
    "Safety Boots": [
        "Safety Boots",
        "boots",
        "safety-boots",
        "shoes",
        "safety-shoes",
    ],
}

def is_requirement_satisfied(requirement: str, detected_classes: List[str], raw_classes: Optional[List[str]] = None) -> bool:
    synonyms = [s.lower().replace("_", "-").replace(" ", "-") for s in PPE_SYNONYMS.get(requirement, [requirement])]
    for item in detected_classes:
        norm = item.lower().replace("_", "-").replace(" ", "-")
        if norm in synonyms or config.PPE_CLASS_MAPPING.get(item.lower().replace("_", "-"), item) == requirement:
            return True
    if raw_classes:
        for raw in raw_classes:
            norm = raw.lower().replace("_", "-").replace(" ", "-")
            if norm in synonyms or config.PPE_CLASS_MAPPING.get(raw.lower().replace("_", "-"), raw) == requirement:
                return True
    return False

def is_inside_person(item_box, person_box, thresh=0.25):
    center_x = (item_box[0] + item_box[2]) / 2.0
    center_y = (item_box[1] + item_box[3]) / 2.0
    p1, p2, p3, p4 = person_box
    pad_x = (p3 - p1) * 0.15
    pad_y = (p4 - p2) * 0.15
    return (p1 - pad_x <= center_x <= p3 + pad_x) and (p2 - pad_y <= center_y <= p4 + pad_y)

class ComplianceAnalyzer:
    def __init__(self, required_ppe: Optional[List[str]] = None):
        self.required_ppe = required_ppe or list(config.REQUIRED_PPE)

    def analyze(self, detections: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not detections:
            return {"status": "NO_DETECTIONS", "total_workers": 0, "compliant_workers": 0, "violation_workers": 0, "overall_compliance_rate": 0.0, "worker_evaluations": []}

        persons = [d for d in detections if d.get("class") == "Person"]
        items = [d for d in detections if d.get("class") != "Person"]

        if not persons:
            detected_items = list(set([i["class"] for i in items]))
            raw_items = [i.get("raw_class", "") for i in items if i.get("raw_class")]
            missing = [r for r in self.required_ppe if not is_requirement_satisfied(r, detected_items, raw_items)]
            return {
                "status": "NEEDS REVIEW",
                "message": "PPE items detected without unambiguous person silhouette. Association inconclusive.",
                "total_workers": 1 if items else 0,
                "compliant_workers": 0,
                "violation_workers": 0,
                "overall_compliance_rate": 0.0,
                "worker_evaluations": [{
                    "worker_id": 1,
                    "status": "NEEDS REVIEW",
                    "detected_ppe": detected_items,
                    "missing_ppe": missing,
                    "details": "Person bounding box missing. Manual review needed."
                }]
            }

        evaluations = []
        for idx, p in enumerate(persons, start=1):
            assoc = [i["class"] for i in items if is_inside_person(i["box"], p["box"])]
            raw_assoc = [i.get("raw_class", "") for i in items if is_inside_person(i["box"], p["box"]) and i.get("raw_class")]
            missing = [r for r in self.required_ppe if not is_requirement_satisfied(r, assoc, raw_assoc)]
            status = "SAFE" if len(missing) == 0 else "VIOLATION"
            evaluations.append({
                "worker_id": idx,
                "status": status,
                "detected_ppe": list(set(assoc)),
                "missing_ppe": missing,
                "details": "Full PPE verified." if status == "SAFE" else f"Missing: {', '.join(missing)}"
            })

        compliant = sum(1 for e in evaluations if e["status"] == "SAFE")
        total = len(evaluations)
        rate = round((compliant / total * 100), 1) if total > 0 else 0.0

        return {
            "status": "SAFE" if compliant == total and total > 0 else "VIOLATION",
            "total_workers": total,
            "compliant_workers": compliant,
            "violation_workers": total - compliant,
            "overall_compliance_rate": rate,
            "worker_evaluations": evaluations
        }
`,
  },
  {
    path: 'src/database.py',
    content: `"""
SQLite database manager for violation history.
"""
import sqlite3
from datetime import datetime
from typing import List, Dict, Any, Optional
import config

class DatabaseManager:
    def __init__(self, db_path: str = str(config.DATABASE_PATH)):
        self.db_path = db_path
        self._init_db()

    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self.get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS violations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    violation_type TEXT NOT NULL,
                    missing_ppe TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    evidence_path TEXT,
                    source TEXT DEFAULT 'image_upload',
                    details TEXT
                )
            """)
            conn.commit()

    def record_violation(self, violation_type, missing_ppe, confidence, evidence_path=None, source="image_upload", details=None):
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        missing_str = ", ".join(missing_ppe) if isinstance(missing_ppe, list) else str(missing_ppe)
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO violations (timestamp, violation_type, missing_ppe, confidence, evidence_path, source, details)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (ts, violation_type, missing_str, float(confidence), evidence_path, source, details))
            conn.commit()
            return cursor.lastrowid

    def get_violations(self, limit=100):
        with self.get_connection() as conn:
            rows = conn.execute("SELECT * FROM violations ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
            return [dict(r) for r in rows]

    def get_stats(self):
        with self.get_connection() as conn:
            total = conn.execute("SELECT COUNT(*) as c FROM violations").fetchone()["c"]
            return {"total_violations": total}
`,
  },
  {
    path: 'requirements.txt',
    content: `flask==3.0.3
torch>=2.0.0
torchvision>=0.15.0
opencv-python>=4.8.0
numpy>=1.24.0,<2.0.0
Pillow>=9.5.0
PyYAML>=6.0
requests>=2.31.0
tqdm>=4.65.0
pandas>=2.0.0
matplotlib>=3.7.0
scipy>=1.10.0
seaborn>=0.12.0
werkzeug>=3.0.0
`,
  },
  {
    path: 'README.md',
    content: `# Smart PPE Kit Detection System Using YOLOv5

An AI-powered industrial safety monitoring application that detects whether workers are wearing required Personal Protective Equipment (PPE).

## Execution Instructions (Windows & VS Code)

1. Create virtual environment:
   \`python -m venv venv\`

2. Activate:
   \`venv\\Scripts\\activate\`

3. Install dependencies:
   \`pip install -r requirements.txt\`

4. Place your trained YOLOv5 weights file in:
   \`models/best.pt\`

5. Run the server:
   \`python app.py\`

6. Open in browser:
   \`http://127.0.0.1:5000\`
`,
  },
  {
    path: 'run.bat',
    content: `@echo off
echo ========================================================
echo   Smart PPE Kit Detection System (YOLOv5 + Flask)
echo ========================================================
IF NOT EXIST "venv" (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\\Scripts\\activate.bat
pip install -r requirements.txt
python app.py
pause
`,
  },
  {
    path: 'run.sh',
    content: `#!/usr/bin/env bash
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
python3 app.py
`,
  },
  {
    path: 'models/README.md',
    content: `# Place your trained weights file best.pt here
Required filename: best.pt
Format: PyTorch YOLOv5 weights (.pt)
Classes: helmet, vest, gloves, goggles, boots, person, no-helmet, etc.
`,
  },
  {
    path: 'static/script.js',
    content: `// Frontend Client Logic for Smart PPE Kit Detection System
// Handles getUserMedia() video frames, inference error logging, and empty response canvas clearing
document.addEventListener("DOMContentLoaded", () => {
  const video = document.getElementById("live-video");
  const canvas = document.getElementById("live-canvas");
  const ctx = canvas ? canvas.getContext("2d") : null;
  const liveConfSlider = document.getElementById("live-conf-slider");
  let isStreaming = false;
  let isSendingFrame = false;
  let isModelLoaded = true;

  async function runLiveInferenceLoop() {
    if (!isStreaming || !canvas || !ctx || !video) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (isModelLoaded && !isSendingFrame) {
      isSendingFrame = true;
      const t0 = performance.now();
      const frameData = canvas.toDataURL("image/jpeg", 0.6);
      const conf = liveConfSlider ? parseFloat(liveConfSlider.value) / 100.0 : 0.45;

      try {
        const res = await fetch("/api/detect/frame", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ frame: frameData, confidence: conf, record_violation: true })
        });

        if (!res.ok) {
          console.error(\`[Camera Processing Error] Frame inference failed with HTTP status \${res.status}: \${res.statusText}\`, {
            status: res.status,
            statusText: res.statusText,
            frameLength: frameData ? frameData.length : 0,
            confidence: conf,
            timestamp: new Date().toISOString()
          });
          const errorBody = await res.text().catch(() => "");
          console.error("[Camera Processing Error] Server response details:", errorBody);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          return;
        }

        const data = await res.json();
        if (!data || !data.success) {
          console.error("[Camera Processing Error] Backend returned unsuccessful response:", data);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          return;
        }

        const hasDetections = Array.isArray(data.detections) && data.detections.length > 0;
        const hasAnnotatedFrame = Boolean(data.annotated_frame);

        if (!hasDetections && !hasAnnotatedFrame) {
          console.warn("[Camera Processing] Inference returned empty detections and empty annotated frame. Clearing canvas annotations.");
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } else if (data.annotated_frame) {
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          };
          img.src = data.annotated_frame;
        }
      } catch (err) {
        console.error("[Camera Processing Error] Exception during frame transmission:", err);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } finally {
        isSendingFrame = false;
      }
    }
    requestAnimationFrame(runLiveInferenceLoop);
  }
});
`,
  },
  {
    path: 'render.yaml',
    content: `# Render Infrastructure as Code Blueprint
# Specially optimized for Render Free Tier (500 MB Disk / 512 MB RAM)

services:
  # Option 1 (RECOMMENDED): Static Site - 0 MB Disk usage on Render, Instant CDN
  - type: web
    name: smart-ppe-detection-site
    env: static
    plan: free
    buildCommand: npm install && npm run build
    staticPublishPath: ./dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    headers:
      - path: /assets/*
        name: Cache-Control
        value: public, max-age=31536000, immutable

  # Option 2: Node.js Web Service (Express server, under 30MB disk footprint)
  # - type: web
  #   name: smart-ppe-detection-node
  #   env: node
  #   plan: free
  #   buildCommand: npm install && npm run render-prune
  #   startCommand: node server.js
  #   healthCheckPath: /health
  #   envVars:
  #     - key: NODE_ENV
  #       value: production
  #     - key: PORT
  #       value: 10000
`,
  },
  {
    path: 'requirements-render.txt',
    content: `# Lightweight Render-Optimized Requirements for Python YOLOv5 backend
# Keeps disk footprint under 350 MB on Render's 500 MB Free Tier limit
# Uses CPU-only PyTorch and headless OpenCV (saves over 1.8 GB compared to standard torch)

--extra-index-url https://download.pytorch.org/whl/cpu

torch==2.2.0+cpu
torchvision==0.17.0+cpu
opencv-python-headless>=4.8.0
numpy>=1.24.0,<2.0.0
flask==3.0.3
Pillow>=9.5.0
PyYAML>=6.0
requests>=2.31.0
tqdm>=4.65.0
werkzeug>=3.0.0
`,
  },
  {
    path: 'server.js',
    content: `import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  const mem = process.memoryUsage();
  res.status(200).json({
    status: 'healthy',
    platform: 'Render-optimized',
    rssMB: Math.round(mem.rss / (1024 * 1024)),
    heapUsedMB: Math.round(mem.heapUsed / (1024 * 1024)),
    uptimeSec: Math.round(process.uptime()),
  });
});

app.use(express.static(path.join(__dirname, 'dist'), { maxAge: '1d', etag: true }));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`Smart PPE Server listening on port \${PORT}\`);
});
`,
  },
  {
    path: '.renderignore',
    content: `node_modules/
.aistudio/
.git/
dist/
coverage/
*.log
.DS_Store
*.tmp
*.zip
smart-ppe-detection/uploads/
smart-ppe-detection/evidence/
smart-ppe-detection/runs/
smart-ppe-detection/models/*.pt
`,
  },
];

export async function generateProjectZip(): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder('smart-ppe-detection');
  if (!folder) throw new Error('Failed to create zip folder');

  for (const file of PYTHON_PROJECT_FILES) {
    folder.file(file.path, file.content);
  }

  folder.file('uploads/.gitkeep', '');
  folder.file('evidence/.gitkeep', '');

  return await zip.generateAsync({ type: 'blob' });
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
