from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from config import settings
from database.session import Base, engine
from routes.auth import router as auth_router
from routes.potholes import router as pothole_router


Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

frontend_dist_dir = Path("../dashboard/react-dashboard/dist").resolve()
frontend_assets_dir = frontend_dist_dir / "assets"
if frontend_assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=frontend_assets_dir), name="assets")

app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(pothole_router, prefix=settings.api_prefix)


@app.get("/{full_path:path}")
def frontend(full_path: str):
    index_file = frontend_dist_dir / "index.html"
    if index_file.exists() and not full_path.startswith("api") and not full_path.startswith("uploads"):
        return FileResponse(index_file)
    return {"status": "ok", "message": "Frontend build not found. Run npm run build in dashboard/react-dashboard."}
