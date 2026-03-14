from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from detect import analyze_upload

app = FastAPI(title="Smart Pothole AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/detect-pothole")
async def detect_pothole(image: UploadFile = File(...)) -> dict:
    contents = await image.read()
    return analyze_upload(contents, image.filename or "upload.jpg")
