from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO


def main():
    parser = argparse.ArgumentParser(description="Train a pothole detector with YOLOv8")
    parser.add_argument("--data", default="dataset/data.yaml")
    parser.add_argument("--model", default="yolov8n.pt")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--project", default="runs/pothole")
    args = parser.parse_args()

    if not Path(args.data).exists():
        raise FileNotFoundError(f"Dataset config not found: {args.data}")

    model = YOLO(args.model)
    model.train(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        project=args.project,
        name="smart-pothole-detector",
    )


if __name__ == "__main__":
    main()
