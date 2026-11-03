"""
YOLOv5 Object Detection Pipeline.
Loads custom PyTorch YOLOv5 weights (best.pt), performs forward inference,
maps classes to standardized PPE labels, and renders annotated bounding boxes.
"""
import os
import sys
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
import cv2
import config

# Try to import torch
try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


class YoloV5Detector:
    def __init__(
        self,
        model_path: str = str(config.MODEL_PATH),
        conf_threshold: float = config.CONFIDENCE_THRESHOLD,
        iou_threshold: float = config.IOU_THRESHOLD,
        class_mapping: Optional[Dict[str, str]] = None
    ):
        self.model_path = Path(model_path)
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        self.class_mapping = class_mapping or config.PPE_CLASS_MAPPING
        self.model = None
        self.class_names = {}
        self.load_error = None
        self.is_loaded = False

        self._load_model()

    def _load_model(self):
        """
        Attempts to load the YOLOv5 PyTorch model.
        Fails safely with clear instructions if model or torch is missing.
        """
        if not TORCH_AVAILABLE:
            self.load_error = (
                "PyTorch is not installed in the current environment. "
                "Install dependencies using: pip install -r requirements.txt"
            )
            self.is_loaded = False
            return

        if not self.model_path.exists():
            self.load_error = (
                f"Model file '{self.model_path.name}' was not found at '{self.model_path}'. "
                f"Please place your trained YOLOv5 weights file ('best.pt') in the 'models/' folder."
            )
            self.is_loaded = False
            return

        try:
            # Check device (CUDA if available, else CPU)
            device = "cuda" if torch.cuda.is_available() else "cpu"

            # Attempt standard YOLOv5 load via torch.hub (supports local ultralytics/yolov5 repo or github)
            try:
                self.model = torch.hub.load(
                    "ultralytics/yolov5",
                    "custom",
                    path=str(self.model_path),
                    device=device,
                    force_reload=False,
                    trust_repo=True
                )
            except Exception as hub_err:
                # Fallback to direct torch.load if hub fails or offline
                checkpoint = torch.load(str(self.model_path), map_location=device)
                if isinstance(checkpoint, dict) and "model" in checkpoint:
                    self.model = checkpoint["model"].float().fuse().eval()
                else:
                    self.model = checkpoint.float().eval()

            # Set inference configurations
            self.model.conf = self.conf_threshold
            self.model.iou = self.iou_threshold

            # Dynamically extract class names from model
            if hasattr(self.model, "names"):
                if isinstance(self.model.names, dict):
                    self.class_names = self.model.names
                elif isinstance(self.model.names, (list, tuple)):
                    self.class_names = {i: name for i, name in enumerate(self.model.names)}
            else:
                self.class_names = {0: "person", 1: "helmet", 2: "vest"}

            self.is_loaded = True
            self.load_error = None
            print(f"[YoloV5Detector] Model loaded successfully from {self.model_path} on {device}. Classes: {self.class_names}")

        except Exception as e:
            self.load_error = f"Failed to load YOLOv5 model from '{self.model_path}': {str(e)}"
            self.is_loaded = False
            print(f"[YoloV5Detector Error] {self.load_error}", file=sys.stderr)

    def standardize_class_name(self, raw_class_name: str) -> str:
        """Maps raw detected class name to standardized PPE class name."""
        cleaned = raw_class_name.strip().lower().replace("_", "-")
        return self.class_mapping.get(cleaned, raw_class_name.title())

    def detect(self, image: np.ndarray, conf_threshold: Optional[float] = None) -> Tuple[List[Dict[str, Any]], np.ndarray]:
        """
        Runs object detection on an OpenCV BGR image.
        Returns:
            detections: List of dicts containing class, raw_class, confidence, box [x1, y1, x2, y2]
            annotated_image: OpenCV BGR image with drawn bounding boxes and labels
        """
        if not self.is_loaded or self.model is None:
            raise RuntimeError(self.load_error or "Model is not loaded.")

        if conf_threshold is not None:
            self.model.conf = float(conf_threshold)

        # Convert BGR (OpenCV) to RGB for PyTorch YOLOv5
        img_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        # Perform forward inference
        results = self.model(img_rgb, size=config.IMAGE_SIZE)

        # Parse detections [x1, y1, x2, y2, confidence, class_id]
        parsed_detections: List[Dict[str, Any]] = []
        raw_preds = results.xyxy[0].cpu().numpy()

        for pred in raw_preds:
            x1, y1, x2, y2, conf, cls_id = pred
            raw_class = self.class_names.get(int(cls_id), f"class_{int(cls_id)}")
            std_class = self.standardize_class_name(raw_class)

            parsed_detections.append({
                "class": std_class,
                "raw_class": raw_class,
                "confidence": float(round(conf, 3)),
                "box": [float(round(x1, 1)), float(round(y1, 1)), float(round(x2, 1)), float(round(y2, 1))]
            })

        # Generate annotated image
        annotated_image = self.draw_annotations(image.copy(), parsed_detections)

        return parsed_detections, annotated_image

    def draw_annotations(self, image: np.ndarray, detections: List[Dict[str, Any]]) -> np.ndarray:
        """Renders bounding boxes and labeled tags on the OpenCV image."""
        img_h, img_w = image.shape[:2]

        for det in detections:
            x1, y1, x2, y2 = [int(v) for v in det["box"]]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(img_w, x2), min(img_h, y2)

            cls_name = det["class"]
            conf = det["confidence"]
            color = config.CLASS_COLORS.get(cls_name, config.DEFAULT_COLOR)

            # Box line thickness
            thickness = max(2, int(min(img_h, img_w) / 300))
            cv2.rectangle(image, (x1, y1), (x2, y2), color, thickness)

            # Label text
            label = f"{cls_name} {int(conf * 100)}%"
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = max(0.5, min(img_h, img_w) / 1000)
            (text_w, text_h), baseline = cv2.getTextSize(label, font, font_scale, 1)

            # Label badge background
            label_y1 = max(0, y1 - text_h - 8)
            label_y2 = y1
            cv2.rectangle(image, (x1, label_y1), (x1 + text_w + 10, label_y2), color, -1)

            # Label text color (dark text on bright background)
            text_color = (0, 0, 0) if (color[0] + color[1] + color[2]) > 380 else (255, 255, 255)
            cv2.putText(image, label, (x1 + 5, label_y2 - 4), font, font_scale, text_color, 1, cv2.LINE_AA)

        return image
