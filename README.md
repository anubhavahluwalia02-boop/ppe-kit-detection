# Smart PPE Kit Detection System (YOLOv5)

AI-powered workplace safety monitoring application detecting whether workers are wearing required Personal Protective Equipment (Safety Helmets, Safety Vests, Gloves, Safety Goggles/Glasses, and Safety Boots).

---

## 🚀 Render Deployment (Free Tier 500 MB Disk Limit Optimized)

Render free tier instances enforce a strict **500 MB disk limit** and **512 MB RAM limit**.
This repository is engineered to stay well below these thresholds.

### Option 1 (Recommended): Deploy as a Render Static Site
- **Disk Usage on Render**: **0 MB** (Render serves static sites from its global CDN).
- **RAM Usage**: **0 MB** (No backend container needed).
- **Cold Starts**: None (Instant worldwide load).
- **Total compiled bundle**: **~983 KB** (< 1 MB).

**Steps on Render:**
1. Connect this GitHub repository on [render.com](https://render.com).
2. Click **New +** > **Static Site**.
3. Set **Build Command**: `npm install && npm run build`
4. Set **Publish Directory**: `dist`
5. In **Redirects / Rewrites**, set: `/*` -> `/index.html` (Rewrite).
6. Click **Deploy Static Site**.

---

### Option 2: Deploy as a Render Node.js Web Service
If you want an active Node/Express server serving the app and providing health check endpoints:
- **Disk Usage**: **~28 MB** (Pruned using `npm run render-prune`).
- **RAM Usage**: **~38 MB** (Peak heap usage).

**Steps on Render:**
1. Click **New +** > **Web Service**.
2. Environment: **Node**.
3. **Build Command**: `npm install && npm run render-prune`
4. **Start Command**: `node server.js`
5. **Health Check Path**: `/health`

---

### Option 3: Deploy the Python YOLOv5 Backend on Render
Standard `pip install torch` downloads GPU/CUDA wheels of 2.5 GB to 3.0 GB, which instantly breaches Render's 500 MB limit.
We provided `smart-ppe-detection/requirements-render.txt` which installs CPU-only PyTorch and headless OpenCV:
- **Disk Usage**: **~340 MB** (Within Render's 500 MB limit).

**Steps on Render:**
1. Click **New +** > **Web Service**.
2. Root Directory: `smart-ppe-detection`
3. **Build Command**: `pip install --no-cache-dir -r requirements-render.txt`
4. **Start Command**: `python app.py`

---

## 💻 Local Execution Guide (Windows & VS Code)

1. **Create Virtual Environment**:
   ```cmd
   python -m venv venv
   ```

2. **Activate Virtual Environment**:
   ```cmd
   venv\Scripts\activate
   ```

3. **Install Dependencies**:
   ```cmd
   pip install -r requirements.txt
   ```

4. **Place Trained YOLOv5 Weights**:
   Put your `best.pt` file into:
   ```
   models/best.pt
   ```

5. **Run the Application**:
   ```cmd
   python app.py
   ```

6. **Open in Browser**:
   Navigate to `http://127.0.0.1:5000`

---

## 📁 Project Architecture

- `src/` — React frontend with real-time browser vision detector, compliance engine, and violation tracking
- `smart-ppe-detection/` — Flask + PyTorch YOLOv5 backend
  - `src/detector.py` — YOLOv5 inference and dynamic class mapping
  - `src/compliance.py` — Spatial IoU worker-to-PPE association engine
  - `src/database.py` — SQLite violation logs
- `server.js` — Render-optimized Express production server
- `render.yaml` — Infrastructure as Code blueprint for Render
- `.renderignore` — Excludes build caches from Render containers
