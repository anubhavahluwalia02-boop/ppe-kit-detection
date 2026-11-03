# Smart PPE Kit Detection System Using YOLOv5

An industrial safety monitoring application that uses a custom-trained **YOLOv5** deep learning model to detect Personal Protective Equipment (PPE) compliance in real time.

---

## 📌 Detected PPE Categories
- 🪖 **Safety Helmet** (`helmet`, `hard-hat`, `safety-helmet`)
- 🦺 **Safety Vest** (`vest`, `safety-vest`, `reflective-vest`)
- 🧤 **Safety Gloves** (`gloves`, `safety-gloves`)
- 🥽 **Safety Goggles** (`goggles`, `safety-goggles`, `glasses`)
- 🥾 **Safety Boots** (`boots`, `safety-boots`, `shoes`)
- 👤 **Person** (`person`, `worker`)
- ⚠️ **Explicit Negative Classes** (`no-helmet`, `no-vest`, `no-gloves`, `no-goggles`, `no-boots`)

---

## 🏗️ System Architecture
- **Inference Engine:** YOLOv5 (PyTorch `torch.hub`) with dynamic class discovery from `model.names`.
- **Compliance Evaluator:** Spatial IoU / bounding-box containment association connecting individual PPE items to detected workers. If a person bbox is missing, the system outputs **NEEDS REVIEW** instead of making unwarranted compliance assumptions.
- **Backend Server:** Flask REST API with endpoints for single image upload and browser webcam frames via `navigator.mediaDevices.getUserMedia()`.
- **Database:** SQLite for violation history persistence (timestamps, violation types, confidence scores, evidence frames).
- **Frontend:** Responsive dark industrial dashboard with live webcam canvas, compliance metrics, audio alarms, and violation logs.

---

## 🚀 Execution Instructions (Windows & VS Code)

### 1. Clone or Extract the Project
Open VS Code, press ``Ctrl + ` `` to open the terminal, and navigate to the project directory:
```bash
cd smart-ppe-detection
```

### 2. Create Python Virtual Environment
```bash
python -m venv venv
```

### 3. Activate Virtual Environment
```cmd
venv\Scripts\activate
```
*(On PowerShell: `.\venv\Scripts\Activate.ps1`, or on Linux/macOS: `source venv/bin/activate`)*

### 4. Install Dependencies
```bash
pip install -r requirements.txt
```

### 5. Place Your Trained YOLOv5 Weights
Place your trained YOLOv5 weights file in the `models/` directory:
```text
smart-ppe-detection/models/best.pt
```
> **Note:** If `best.pt` is missing, the dashboard launches in Standby mode with a status banner explaining that the model file is missing.

### 6. Run the Application
```bash
python app.py
```
Or double-click `run.bat` on Windows.

### 7. Open the Web Dashboard
Navigate to:
```text
http://127.0.0.1:5000
```

---

## 📂 Project Structure
```text
smart-ppe-detection/
├── app.py                  # Main Flask application with API endpoints
├── config.py               # Global settings, class mappings, and thresholds
├── requirements.txt        # Python package dependencies
├── README.md               # Documentation and execution guide
├── run.bat                 # Windows 1-click startup script
├── run.sh                  # Linux/Mac startup script
├── models/
│   ├── best.pt             # Trained YOLOv5 weights file
│   └── README.md           # Instructions for downloading weights
├── src/
│   ├── detector.py         # YOLOv5 PyTorch model loader & bounding box drawer
│   ├── compliance.py       # Spatial IoU PPE-to-worker association engine
│   └── database.py         # SQLite violation logger
├── templates/
│   └── index.html          # HTML dashboard template
├── static/
│   ├── style.css           # Industrial dark theme styling
│   └── script.js           # Live camera & frontend logic
├── uploads/                # Processed images directory
└── evidence/               # Violation snapshots directory
```

---

## 🔌 API Endpoints
- `GET /api/model/status` - Checks `best.pt` status, device, and class mappings.
- `POST /api/detect/image` - Uploads an image, returns detections, compliance state, and annotated URL.
- `POST /api/detect/frame` - Processes live browser webcam base64 frames.
- `GET /api/violations` - Retrieves historical violation records with evidence images.
- `DELETE /api/violations/<id>` - Removes a violation record.
- `POST /api/violations/clear` - Clears violation history.
