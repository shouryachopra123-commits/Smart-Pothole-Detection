from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from config import settings
from database.models import Pothole
from database.session import get_db
from schemas import PotholeResponse, PotholeStatusUpdate
from services import (
    analytics_summary,
    call_ai_detection,
    call_ai_detection_from_bytes,
    find_duplicate_pothole,
    get_nearby_potholes,
)


router = APIRouter(tags=['potholes'])
UPLOAD_DIR = Path('uploads')
UPLOAD_DIR.mkdir(exist_ok=True)


@router.post('/report', response_model=PotholeResponse)
async def create_report(
    latitude: float = Form(...),
    longitude: float = Form(...),
    description: str | None = Form(default=None),
    reporter_id: int | None = Form(default=None),
    photo_url: str | None = Form(default=None),
    image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
):
    stored_photo_reference = photo_url or 'demo/pothole.jpg'
    if image is not None:
        content = await image.read()
        filename = f'{uuid4()}-{image.filename or "upload.jpg"}'
        file_path = UPLOAD_DIR / filename
        file_path.write_bytes(content)
        stored_photo_reference = f'/uploads/{filename}'
        detection = call_ai_detection_from_bytes(filename, content)
    else:
        detection = call_ai_detection(stored_photo_reference)

    if not detection.get('pothole_detected'):
        raise HTTPException(status_code=400, detail='No pothole detected in image')

    duplicate = find_duplicate_pothole(db, latitude, longitude)
    if duplicate:
        duplicate.report_count += 1
        if description and not duplicate.description:
            duplicate.description = description
        db.commit()
        db.refresh(duplicate)
        return duplicate

    pothole = Pothole(
        latitude=latitude,
        longitude=longitude,
        photo_url=stored_photo_reference,
        description=description,
        severity=detection['severity'],
        diameter=detection['diameter_estimate'],
        status='Pending',
        confidence=detection.get('confidence', 0),
        estimated_depth_cm=detection.get('estimated_depth_cm'),
        bounding_box=str(detection.get('bounding_box')),
        reporter_id=reporter_id,
    )
    db.add(pothole)
    db.commit()
    db.refresh(pothole)
    return pothole


@router.get('/potholes', response_model=list[PotholeResponse])
def list_potholes(severity: str | None = None, status: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Pothole)
    if severity:
        query = query.filter(Pothole.severity == severity)
    if status:
        query = query.filter(Pothole.status == status)
    return query.order_by(Pothole.timestamp.desc()).all()


@router.get('/pothole/{pothole_id}', response_model=PotholeResponse)
def get_pothole(pothole_id: int, db: Session = Depends(get_db)):
    pothole = db.query(Pothole).filter(Pothole.id == pothole_id).first()
    if not pothole:
        raise HTTPException(status_code=404, detail='Pothole not found')
    return pothole


@router.put('/status-update', response_model=PotholeResponse)
def update_status(payload: PotholeStatusUpdate, db: Session = Depends(get_db)):
    pothole = db.query(Pothole).filter(Pothole.id == payload.pothole_id).first()
    if not pothole:
        raise HTTPException(status_code=404, detail='Pothole not found')
    pothole.status = payload.status
    db.commit()
    db.refresh(pothole)
    return pothole


@router.get('/nearby-potholes')
def nearby_potholes(
    latitude: float = Query(...),
    longitude: float = Query(...),
    radius: float = Query(default=settings.alert_distance_meters),
    db: Session = Depends(get_db),
):
    nearby = get_nearby_potholes(db, latitude, longitude, radius)
    return {
        'count': len(nearby),
        'alerts': [
            {
                'id': pothole.id,
                'latitude': pothole.latitude,
                'longitude': pothole.longitude,
                'severity': pothole.severity,
                'distance_meters': distance,
                'message': f'Warning: pothole ahead in {int(distance)} meters',
            }
            for pothole, distance in nearby
        ],
    }


@router.get('/analytics/summary')
def get_analytics(db: Session = Depends(get_db)):
    return analytics_summary(db)
