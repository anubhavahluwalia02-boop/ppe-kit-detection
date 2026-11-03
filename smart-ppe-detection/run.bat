@echo off
echo ========================================================
echo   Smart PPE Kit Detection System (YOLOv5 + Flask)
echo ========================================================
echo.

IF NOT EXIST "venv" (
    echo [1/3] Creating Python Virtual Environment...
    python -m venv venv
)

echo [2/3] Activating Virtual Environment...
call venv\Scripts\activate.bat

echo [3/3] Checking dependencies...
pip install -r requirements.txt

IF NOT EXIST "models\best.pt" (
    echo.
    echo [WARNING] 'models\best.pt' was not found!
    echo Detection will be labeled as unavailable until best.pt is placed in models\.
    echo See models\README.md for instructions.
    echo.
)

echo.
echo Starting Flask Server at http://127.0.0.1:5000
echo Press Ctrl+C to stop.
echo.
python app.py
pause
