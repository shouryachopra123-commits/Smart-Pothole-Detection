# Dataset Format

The AI training pipeline expects a YOLO-style dataset:

```text
dataset/
  images/
    train/
    val/
  labels/
    train/
    val/
  data.yaml
```

## Label Format

Each label file contains:

```text
<class_id> <x_center> <y_center> <width> <height>
```

All coordinates are normalized between `0` and `1`.

## Classes

- `0`: pothole

## Example `data.yaml`

```yaml
path: ./dataset
train: images/train
val: images/val
names:
  0: pothole
```

## Suggested Metadata

Keep a CSV or JSON sidecar for evaluation with:

- source image id
- gps latitude / longitude
- camera height estimate
- optional real-world diameter in centimeters
- optional measured depth

This improves calibration of the diameter estimation heuristic.
