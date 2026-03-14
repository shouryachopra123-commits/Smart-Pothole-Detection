# Deployment Guide

## Local Development

Run the AI service and backend as separate FastAPI apps. For local demos, SQLite is supported by default. For production, switch `DATABASE_URL` to PostgreSQL.

## Production Recommendations

- AI service behind a GPU-enabled container or VM
- Backend behind `gunicorn` + `uvicorn` workers
- PostgreSQL with PostGIS if spatial queries need to scale
- Object storage for uploaded images
- Redis for alert queues and notification fan-out
- HTTPS termination via Nginx or a cloud load balancer

## Environment Variables

- `AI_SERVICE_URL`: backend -> AI service base URL
- `DATABASE_URL`: SQLAlchemy connection string
- `JWT_SECRET`: auth signing secret
- `MAPBOX_TOKEN`: frontend map token if using Mapbox

## Suggested Hosting Split

- `ai-model`: GPU VM or ML hosting
- `backend`: container app
- `dashboard`: static hosting
- `mobile`: Android/iOS release build

## Scale Path

1. Move image uploads to cloud storage
2. Replace local alert polling with WebSocket / push notifications
3. Add Kafka or Redis streams for high-volume ingestion
4. Enable PostGIS and spatial indexes for nearby search
