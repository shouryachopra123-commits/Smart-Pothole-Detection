from __future__ import annotations

import io
import os
from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np
from PIL import Image

try:
    from ultralytics import YOLO
except Exception:
    YOLO = None


MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "../ai-model/weights/pothole.pt")
PIXEL_TO_CM = float(os.getenv("PIXEL_TO_CM", "0.35"))
_MODEL = None


@dataclass
class DetectionResult:
    pothole_detected: bool
    diameter_estimate: float
    severity: str
    bounding_box: Optional[list[int]]
    confidence: float
    estimated_depth_cm: Optional[float] = None

    def to_dict(self) -> dict:
        return {
            "pothole_detected": self.pothole_detected,
            "diameter_estimate": round(self.diameter_estimate, 2),
            "severity": self.severity,
            "bounding_box": self.bounding_box,
            "confidence": round(self.confidence, 3),
            "estimated_depth_cm": self.estimated_depth_cm,
        }


def load_model():
    global _MODEL
    if _MODEL is None and YOLO and os.path.exists(MODEL_PATH):
        _MODEL = YOLO(MODEL_PATH)
    return _MODEL


def classify_severity(diameter_cm: float) -> str:
    if diameter_cm < 20:
        return "Small"
    if diameter_cm <= 50:
        return "Medium"
    return "Dangerous"


def heuristic_detect(image_bgr: np.ndarray) -> dict:
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (9, 9), 0)
    edges = cv2.Canny(blur, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return DetectionResult(False, 0, "None", None, 0.0).to_dict()

    contour = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(contour)
    if area < 500:
        return DetectionResult(False, 0, "None", None, 0.1).to_dict()

    x, y, w, h = cv2.boundingRect(contour)
    diameter_px = max(w, h)
    diameter_cm = diameter_px * PIXEL_TO_CM
    severity = classify_severity(diameter_cm)
    estimated_depth = round(min(12.0, area / 5000.0), 2)
    return DetectionResult(True, diameter_cm, severity, [x, y, x + w, y + h], 0.45, estimated_depth).to_dict()


def yolo_detect(image_bgr: np.ndarray) -> Optional[dict]:
    model = load_model()
    if model is None:
        return None

    results = model.predict(image_bgr, conf=0.25, verbose=False)
    if not results or len(results[0].boxes) == 0:
        return DetectionResult(False, 0, "None", None, 0.0).to_dict()

    box = results[0].boxes[0]
    x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
    diameter_px = max(x2 - x1, y2 - y1)
    diameter_cm = diameter_px * PIXEL_TO_CM
    severity = classify_severity(diameter_cm)
    confidence = float(box.conf[0].item())
    estimated_depth = round(min(15.0, diameter_cm * 0.12), 2)
    return DetectionResult(True, diameter_cm, severity, [x1, y1, x2, y2], confidence, estimated_depth).to_dict()


def analyze_upload(file_bytes: bytes, filename: str) -> dict:
    image = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    image_bgr = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    result = yolo_detect(image_bgr)
    if result is None:
        result = heuristic_detect(image_bgr)
    result["filename"] = filename
    return result
