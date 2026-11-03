# YOLOv5 Trained Weights Directory

Place your trained YOLOv5 PyTorch model weights file named **`best.pt`** directly in this folder:

```text
smart-ppe-detection/
└── models/
    ├── best.pt            <-- Place your trained model file here
    └── README.md
```

## How to Get or Train a YOLOv5 PPE Model

### Option A: Using Roboflow PPE Pre-trained Dataset
1. Visit [Roboflow Universe PPE Dataset](https://universe.roboflow.com/search?q=ppe+detection) or [Kaggle Hardhat & PPE](https://www.kaggle.com/).
2. Train using YOLOv5:
   ```bash
   git clone https://github.com/ultralytics/yolov5
   cd yolov5
   pip install -r requirements.txt
   python train.py --img 640 --batch 16 --epochs 50 --data ppe.yaml --weights yolov5s.pt
   ```
3. Copy the resulting `runs/train/exp/weights/best.pt` file into `smart-ppe-detection/models/best.pt`.

### Option B: Expected Classes in `best.pt`
The model should detect:
- `helmet` / `safety-helmet` / `hard-hat`
- `vest` / `safety-vest`
- `gloves` / `safety-gloves`
- `goggles` / `safety-goggles`
- `boots` / `safety-boots`
- `person` / `worker`
- Optional negative classes: `no-helmet`, `no-vest`, `no-gloves`, `no-goggles`, `no-boots`

The detector will automatically query `model.names` and map these labels dynamically.
