from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=4)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    name: str


class ReportCreate(BaseModel):
    latitude: float
    longitude: float
    photo_url: str
    description: Optional[str] = None
    reporter_id: Optional[int] = None


class PotholeStatusUpdate(BaseModel):
    pothole_id: int
    status: str


class PotholeResponse(BaseModel):
    id: int
    latitude: float
    longitude: float
    photo_url: str
    description: Optional[str]
    severity: str
    diameter: float
    status: str
    confidence: float
    estimated_depth_cm: Optional[float]
    bounding_box: Optional[str]
    report_count: int
    reporter_id: Optional[int]
    timestamp: datetime

    class Config:
        from_attributes = True


class AnalyticsResponse(BaseModel):
    total_reports: int
    dangerous_count: int
    fixed_count: int
    pending_count: int
    average_diameter_cm: float
