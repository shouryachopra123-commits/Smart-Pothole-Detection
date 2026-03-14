from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.models import User
from database.session import get_db
from schemas import TokenResponse, UserCreate, UserLogin
from security import create_access_token, hash_password, verify_password


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse)
def signup(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(name=payload.name, email=payload.email, password=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user_id=user.id, name=user.name)


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user_id=user.id, name=user.name)
