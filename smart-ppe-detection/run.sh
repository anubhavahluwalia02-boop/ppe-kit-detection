#!/usr/bin/env bash
echo "========================================================"
echo "  Smart PPE Kit Detection System (YOLOv5 + Flask)"
echo "========================================================"
echo ""

if [ ! -d "venv" ]; then
    echo "[1/3] Creating Python Virtual Environment..."
    python3 -m venv venv
fi

echo "[2/3] Activating Virtual Environment..."
source venv/bin/activate

echo "[3/3] Checking dependencies..."
pip install -r requirements.txt

if [ ! -f "models/best.pt" ]; then
    echo ""
    echo "[WARNING] 'models/best.pt' was not found!"
    echo "Detection will be labeled as unavailable until best.pt is placed in models/."
    echo "See models/README.md for instructions."
    echo ""
fi

echo ""
echo "Starting Flask Server at http://127.0.0.1:5000"
echo "Press Ctrl+C to stop."
echo ""
python3 app.py
