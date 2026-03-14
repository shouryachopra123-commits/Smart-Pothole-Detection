from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Smart Pothole Backend"
    api_prefix: str = "/api"
    database_url: str = "sqlite:///./smart_potholes.db"
    ai_service_url: str = "http://localhost:8001"
    jwt_secret: str = "change-me"
    access_token_expire_minutes: int = 60 * 24
    duplicate_distance_meters: float = 10.0
    alert_distance_meters: float = 50.0


settings = Settings()
