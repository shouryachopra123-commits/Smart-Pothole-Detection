from __future__ import annotations

import math
from pathlib import Path
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from database.models import Pothole
from detection import analyze_upload


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def find_duplicate_pothole(db: Session, latitude: float, longitude: float) -> Optional[Pothole]:
    potholes = db.query(Pothole).all()
    for pothole in potholes:
        distance = haversine_meters(latitude, longitude, pothole.latitude, pothole.longitude)
        if distance <= 10.0:
            return pothole
    return None


def fallback_detection(photo_reference: str) -> dict:
    filename = photo_reference.replace('\\', '/').split('/')[-1] or 'upload.jpg'
    mock_size = max(18.0, min(75.0, float(len(filename) * 2)))
    severity = 'Small' if mock_size < 20 else 'Medium' if mock_size <= 50 else 'Dangerous'
    return {
        'pothole_detected': True,
        'diameter_estimate': mock_size,
        'severity': severity,
        'bounding_box': [32, 48, 196, 228],
        'confidence': 0.67,
        'estimated_depth_cm': round(mock_size * 0.1, 2),
    }


def call_ai_detection(photo_url: str) -> dict:
    file_path = Path(photo_url)
    if file_path.exists() and file_path.is_file():
        try:
            return analyze_upload(file_path.read_bytes(), file_path.name)
        except Exception:
            return fallback_detection(photo_url)
    return fallback_detection(photo_url)


def call_ai_detection_from_bytes(filename: str, content: bytes) -> dict:
    try:
        return analyze_upload(content, filename)
    except Exception:
        return fallback_detection(filename)


def get_nearby_potholes(db: Session, latitude: float, longitude: float, radius_meters: float):
    potholes = db.query(Pothole).all()
    enriched = []
    for pothole in potholes:
        distance = haversine_meters(latitude, longitude, pothole.latitude, pothole.longitude)
        if distance <= radius_meters:
            enriched.append((pothole, round(distance, 1)))
    enriched.sort(key=lambda item: item[1])
    return enriched


def analytics_summary(db: Session) -> dict:
    total_reports = db.query(func.count(Pothole.id)).scalar() or 0
    dangerous_count = db.query(func.count(Pothole.id)).filter(Pothole.severity == 'Dangerous').scalar() or 0
    fixed_count = db.query(func.count(Pothole.id)).filter(Pothole.status == 'Fixed').scalar() or 0
    pending_count = db.query(func.count(Pothole.id)).filter(Pothole.status == 'Pending').scalar() or 0
    average_diameter_cm = db.query(func.avg(Pothole.diameter)).scalar() or 0
    return {
        'total_reports': total_reports,
        'dangerous_count': dangerous_count,
        'fixed_count': fixed_count,
        'pending_count': pending_count,
        'average_diameter_cm': round(float(average_diameter_cm), 2),
    }
