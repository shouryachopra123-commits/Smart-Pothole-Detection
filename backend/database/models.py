from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from database.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    reports = relationship("Pothole", back_populates="reporter")


class Pothole(Base):
    __tablename__ = "potholes"

    id = Column(Integer, primary_key=True, index=True)
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    photo_url = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(50), nullable=False)
    diameter = Column(Float, nullable=False, default=0)
    status = Column(String(50), nullable=False, default="Pending")
    confidence = Column(Float, nullable=False, default=0)
    estimated_depth_cm = Column(Float, nullable=True)
    bounding_box = Column(String(100), nullable=True)
    report_count = Column(Integer, nullable=False, default=1)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    reporter = relationship("User", back_populates="reports")
