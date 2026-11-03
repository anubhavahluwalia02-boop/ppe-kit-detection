"""
Configuration settings for Smart PPE Kit Detection System.
"""
import os
from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
UPLOADS_DIR = BASE_DIR / "uploads"
EVIDENCE_DIR = BASE_DIR / "evidence"
DATABASE_PATH = BASE_DIR / "violations.db"

# Ensure runtime directories exist
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# YOLOv5 Model settings
MODEL_PATH = MODELS_DIR / "best.pt"
CONFIDENCE_THRESHOLD = 0.45
IOU_THRESHOLD = 0.45
IMAGE_SIZE = 640

# Default standard PPE classes detected by custom YOLOv5 models
# Maps detected labels (normalized lowercase) to standardized categories
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

# Required PPE items for full compliance
REQUIRED_PPE = [
    "Safety Helmet",
    "Safety Vest",
    "Safety Gloves",
    "Safety Goggles",
    "Safety Boots"
]

# Color codes for visualization (BGR for OpenCV)
CLASS_COLORS = {
    "Safety Helmet": (0, 255, 0),       # Green
    "Safety Vest": (0, 200, 255),       # Amber / Yellow
    "Safety Gloves": (255, 191, 0),     # Deep Sky
    "Safety Goggles": (255, 105, 180),  # Pinkish / Violet
    "Safety Boots": (144, 238, 144),    # Light Green
    "Person": (255, 255, 255),          # White
    "Missing Helmet": (0, 0, 255),      # Red
    "Missing Vest": (0, 0, 255),        # Red
    "Missing Gloves": (0, 0, 255),      # Red
    "Missing Goggles": (0, 0, 255),     # Red
    "Missing Boots": (0, 0, 255),       # Red
}

DEFAULT_COLOR = (200, 200, 200)

# Server settings
HOST = "0.0.0.0"
PORT = 5000
DEBUG = True
