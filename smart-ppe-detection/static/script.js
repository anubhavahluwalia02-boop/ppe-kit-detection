/**
 * Smart PPE Kit Detection System - Frontend Client Logic
 * Handles WebRTC live stream, frame capture, inference API, and violations table.
 */
document.addEventListener("DOMContentLoaded", () => {
  // Navigation tabs
  const navItems = document.querySelectorAll(".nav-item");
  const tabPanes = document.querySelectorAll(".tab-pane");
  const viewTitle = document.getElementById("current-view-title");
  const viewDesc = document.getElementById("current-view-desc");

  const tabTitles = {
    dashboard: { title: "Industrial Safety Dashboard", desc: "Real-time workplace PPE compliance monitoring" },
    live: { title: "Live Camera Stream", desc: "Real-time webcam inference and bounding box tracking" },
    upload: { title: "Image Inspection & Analysis", desc: "High-resolution PPE detection on captured imagery" },
    history: { title: "Violation History Database", desc: "SQLite safety infractions registry with evidence records" },
    model: { title: "YOLOv5 Model Specifications", desc: "Architecture, class labels, and weight configurations" },
    about: { title: "About Smart PPE Detection", desc: "System architecture, compliance rules, and Windows run guide" }
  };

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const targetTab = item.dataset.tab;
      navItems.forEach(n => n.classList.remove("active"));
      tabPanes.forEach(p => p.classList.remove("active"));
      item.classList.add("active");
      
      const pane = document.getElementById(`pane-${targetTab}`);
      if (pane) pane.classList.add("active");

      if (tabTitles[targetTab]) {
        viewTitle.textContent = tabTitles[targetTab].title;
        viewDesc.textContent = tabTitles[targetTab].desc;
      }
    });
  });

  // Clock
  setInterval(() => {
    const now = new Date();
    const clock = document.getElementById("clock-display");
    if (clock) clock.textContent = now.toLocaleTimeString();
  }, 1000);

  // Audio Context for Violation Alarm
  let audioCtx = null;
  let soundEnabled = true;

  function playAlertBeep() {
    if (!soundEnabled) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch alarm
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.warn("Audio alarm playback error:", e);
    }
  }

  const soundBtn = document.getElementById("btn-toggle-sound");
  if (soundBtn) {
    soundBtn.addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      soundBtn.textContent = soundEnabled ? "🔊" : "🔇";
    });
  }

  // Model Status Check
  let isModelLoaded = false;
  async function checkModelStatus() {
    try {
      const res = await fetch("/api/model/status");
      const data = await res.json();
      isModelLoaded = data.is_loaded;

      const badge = document.getElementById("model-status-badge");
      const missingAlert = document.getElementById("missing-model-alert");

      if (isModelLoaded) {
        badge.innerHTML = `<span class="dot green"></span> <span class="label">YOLOv5 Ready (${Object.keys(data.class_names).length} classes)</span>`;
        missingAlert.style.display = "none";
      } else {
        badge.innerHTML = `<span class="dot red"></span> <span class="label">Model Missing (best.pt)</span>`;
        missingAlert.style.display = "flex";
      }
    } catch (err) {
      console.error("Model status check failed:", err);
      const badge = document.getElementById("model-status-badge");
      badge.innerHTML = `<span class="dot yellow"></span> <span class="label">Backend Standby</span>`;
    }
  }
  checkModelStatus();

  // Live Camera Streaming
  let stream = null;
  let isStreaming = false;
  let inferenceLoopId = null;
  const video = document.getElementById("live-video");
  const canvas = document.getElementById("live-canvas");
  const ctx = canvas.getContext("2d");
  const btnStartCam = document.getElementById("btn-start-camera");
  const btnStopCam = document.getElementById("btn-stop-camera");
  const standbyOverlay = document.getElementById("camera-standby-overlay");
  const liveConfSlider = document.getElementById("live-conf-slider");
  const liveConfVal = document.getElementById("live-conf-val");

  if (liveConfSlider) {
    liveConfSlider.addEventListener("input", (e) => {
      liveConfVal.textContent = `${e.target.value}%`;
    });
  }

  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      video.srcObject = stream;
      await video.play();

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      isStreaming = true;
      standbyOverlay.style.display = "none";
      btnStartCam.disabled = true;
      btnStopCam.disabled = false;
      document.getElementById("live-status-pill").innerHTML = `<span class="dot green"></span> LIVE STREAMING`;

      runLiveInferenceLoop();
    } catch (err) {
      alert("Unable to access camera: " + err.message);
    }
  }

  function stopCamera() {
    isStreaming = false;
    if (inferenceLoopId) cancelAnimationFrame(inferenceLoopId);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    standbyOverlay.style.display = "flex";
    btnStartCam.disabled = false;
    btnStopCam.disabled = true;
    document.getElementById("live-status-pill").innerHTML = `<span class="dot red"></span> CAMERA INACTIVE`;
  }

  btnStartCam?.addEventListener("click", startCamera);
  btnStopCam?.addEventListener("click", stopCamera);

  let lastFrameTime = performance.now();
  let frameCount = 0;
  let fps = 0;
  let isSendingFrame = false;

  async function runLiveInferenceLoop() {
    if (!isStreaming) return;

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // FPS calculation
    frameCount++;
    const now = performance.now();
    if (now - lastFrameTime >= 1000) {
      fps = frameCount;
      frameCount = 0;
      lastFrameTime = now;
      document.getElementById("live-fps").textContent = fps;
    }

    // Only send frames if model is loaded and previous frame finished
    if (isModelLoaded && !isSendingFrame) {
      isSendingFrame = true;
      const t0 = performance.now();
      const frameData = canvas.toDataURL("image/jpeg", 0.6);
      const conf = parseFloat(liveConfSlider.value) / 100.0;

      try {
        const res = await fetch("/api/detect/frame", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            frame: frameData,
            confidence: conf,
            record_violation: true
          })
        });

        if (!res.ok) {
          console.error(`[Camera Processing Error] Frame inference failed with HTTP status ${res.status}: ${res.statusText}`, {
            status: res.status,
            statusText: res.statusText,
            frameLength: frameData ? frameData.length : 0,
            confidence: conf,
            timestamp: new Date().toISOString()
          });

          const errorBody = await res.text().catch(() => "");
          console.error("[Camera Processing Error] Server response details:", errorBody);

          // Clear canvas properly back to current video frame without stale annotations
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          updateLiveVerdict(null, []);
          return;
        }

        const data = await res.json();
        const latency = Math.round(performance.now() - t0);
        document.getElementById("live-latency").textContent = `${latency} ms`;

        if (!data || !data.success) {
          console.error("[Camera Processing Error] Inference backend returned unsuccessful response:", {
            response: data,
            timestamp: new Date().toISOString()
          });

          // Clear canvas properly on empty or error response
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          updateLiveVerdict(null, []);
          return;
        }

        // Check if response has empty detections
        const hasDetections = Array.isArray(data.detections) && data.detections.length > 0;
        const hasAnnotatedFrame = Boolean(data.annotated_frame);

        if (!hasDetections && !hasAnnotatedFrame) {
          console.warn("[Camera Processing] Inference returned empty detections and empty annotated frame. Clearing canvas annotations.");
          // Clear canvas and restore clean video frame
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          updateLiveVerdict({
            status: "NO_DETECTIONS",
            message: "No objects or workers detected in the current video frame."
          }, []);
        } else {
          updateLiveVerdict(data.compliance, data.detections || []);

          // If annotated frame returned, draw it onto canvas
          if (data.annotated_frame) {
            const img = new Image();
            img.onload = () => {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.onerror = (imgErr) => {
              console.error("[Camera Processing Error] Failed to decode annotated frame image from backend:", imgErr);
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            };
            img.src = data.annotated_frame;
          } else {
            // No annotated frame returned: keep clean video frame
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
        }
      } catch (err) {
        console.error("[Camera Processing Error] Network or serialization exception during frame transmission to /api/detect/frame:", {
          message: err.message || String(err),
          frameSize: frameData ? `${(frameData.length / 1024).toFixed(2)} KB` : "0 KB",
          confidenceThreshold: conf,
          timestamp: new Date().toISOString()
        });

        // Ensure canvas clears properly on exceptions
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        updateLiveVerdict(null, []);
      } finally {
        isSendingFrame = false;
      }
    }

    inferenceLoopId = requestAnimationFrame(runLiveInferenceLoop);
  }

  function updateLiveVerdict(compliance, detections) {
    const verdictBox = document.getElementById("live-verdict-box");
    const verdictTitle = document.getElementById("live-verdict-title");
    const verdictDesc = document.getElementById("live-verdict-desc");
    const detectedList = document.getElementById("live-detected-list");

    if (!compliance) {
      if (verdictBox) verdictBox.className = "verdict-box";
      if (verdictTitle) verdictTitle.textContent = "INFERENCE STANDBY";
      if (verdictDesc) verdictDesc.textContent = "No active detections received from inference engine.";
      if (detectedList) detectedList.innerHTML = `<div class="empty-state">No objects detected</div>`;
      return;
    }

    if (compliance.status === "SAFE") {
      verdictBox.className = "verdict-box safe";
      verdictTitle.textContent = "SAFE - FULL PPE COMPLIANCE";
      verdictDesc.textContent = `${compliance.compliant_workers} compliant worker(s) monitored.`;
    } else if (compliance.status === "VIOLATION") {
      verdictBox.className = "verdict-box violation";
      verdictTitle.textContent = "VIOLATION DETECTED";
      verdictDesc.textContent = `${compliance.violation_workers} worker(s) missing required PPE!`;
      playAlertBeep();
    } else {
      verdictBox.className = "verdict-box";
      verdictTitle.textContent = compliance.status;
      verdictDesc.textContent = compliance.message;
    }

    // Render detected items
    if (detections && detections.length > 0) {
      detectedList.innerHTML = detections.map(d => `
        <div class="check-item">
          <span>${d.class}</span>
          <strong style="margin-left: auto;">${Math.round(d.confidence * 100)}%</strong>
        </div>
      `).join("");
    } else {
      detectedList.innerHTML = `<div class="empty-state">No objects detected</div>`;
    }
  }

  // Image Upload Handling
  const dropzone = document.getElementById("image-dropzone");
  const fileInput = document.getElementById("image-file-input");
  const btnBrowse = document.getElementById("btn-browse-file");
  const btnRunInference = document.getElementById("btn-run-inference");
  const uploadConfSlider = document.getElementById("upload-conf-slider");
  const uploadConfVal = document.getElementById("upload-conf-val");
  let selectedFile = null;

  btnBrowse?.addEventListener("click", () => fileInput.click());
  fileInput?.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      selectedFile = e.target.files[0];
      btnRunInference.disabled = false;
      btnBrowse.textContent = `Selected: ${selectedFile.name}`;
    }
  });

  uploadConfSlider?.addEventListener("input", (e) => {
    uploadConfVal.textContent = `${e.target.value}%`;
  });

  btnRunInference?.addEventListener("click", async () => {
    if (!selectedFile) return;
    btnRunInference.disabled = true;
    btnRunInference.textContent = "Processing YOLOv5 Inference...";

    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("confidence", parseFloat(uploadConfSlider.value) / 100.0);

    try {
      const res = await fetch("/api/detect/image", {
        method: "POST",
        body: formData
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert("Inference Error: " + (data.error || "Unknown error"));
        return;
      }

      // Display results
      const resultsSection = document.getElementById("upload-results-section");
      resultsSection.style.display = "block";

      document.getElementById("result-orig-img").src = data.original_image_url;
      document.getElementById("result-annot-img").src = data.annotated_image_url;

      const verdictBadge = document.getElementById("upload-verdict-badge");
      const verdictHeading = document.getElementById("upload-verdict-heading");
      const breakdown = document.getElementById("upload-workers-breakdown");

      if (data.compliance.status === "SAFE") {
        verdictBadge.textContent = "SAFE";
        verdictBadge.className = "verdict-status-badge tag green";
        verdictHeading.textContent = "All Personnel Fully Compliant";
      } else {
        verdictBadge.textContent = "VIOLATION";
        verdictBadge.className = "verdict-status-badge tag red";
        verdictHeading.textContent = `${data.compliance.violation_workers} Safety Infraction(s) Identified`;
      }

      breakdown.innerHTML = data.compliance.worker_evaluations.map(w => `
        <div class="panel" style="margin-top: 10px;">
          <h4>Worker #${w.worker_id} - <span class="tag ${w.status === 'SAFE' ? 'green' : 'red'}">${w.status}</span></h4>
          <p><strong>Detected PPE:</strong> ${w.detected_ppe.join(", ") || "None"}</p>
          <p><strong>Missing PPE:</strong> ${w.missing_ppe.join(", ") || "None"}</p>
          <p style="color: var(--text-muted); font-size: 12px;">${w.details}</p>
        </div>
      `).join("");

      // Refresh violation database tab
      loadViolations();

    } catch (err) {
      alert("Failed to analyze image: " + err.message);
    } finally {
      btnRunInference.disabled = false;
      btnRunInference.textContent = "🔍 Analyze Image";
    }
  });

  // Violation History Table
  async function loadViolations() {
    try {
      const res = await fetch("/api/violations");
      const data = await res.json();
      const tbody = document.getElementById("violations-tbody");
      const stream = document.getElementById("dashboard-recent-stream");

      if (!data.violations || data.violations.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center">No violations recorded yet.</td></tr>`;
        if (stream) stream.innerHTML = `<div class="empty-state">No active safety violations recorded.</div>`;
        return;
      }

      // Update Dashboard Metrics
      const totalViolations = data.stats.total_violations || 0;
      document.getElementById("stat-violations").textContent = totalViolations;

      tbody.innerHTML = data.violations.map(v => `
        <tr>
          <td>#${v.id}</td>
          <td>${v.timestamp}</td>
          <td><span class="tag red">${v.violation_type}</span></td>
          <td><strong>${v.missing_ppe}</strong></td>
          <td>${Math.round(v.confidence * 100)}%</td>
          <td>${v.source}</td>
          <td>${v.evidence_path ? `<a href="${v.evidence_path}" target="_blank" class="view-link">View Evidence</a>` : "N/A"}</td>
        </tr>
      `).join("");

      if (stream) {
        stream.innerHTML = data.violations.slice(0, 5).map(v => `
          <div class="check-item" style="border-left: 3px solid var(--color-red);">
            <div>
              <strong>${v.violation_type}: ${v.missing_ppe}</strong>
              <div style="font-size: 11px; color: var(--text-muted);">${v.timestamp} • Confidence: ${Math.round(v.confidence * 100)}%</div>
            </div>
          </div>
        `).join("");
      }

    } catch (e) {
      console.warn("Failed to load violations:", e);
    }
  }

  document.getElementById("btn-refresh-history")?.addEventListener("click", loadViolations);
  document.getElementById("btn-clear-history")?.addEventListener("click", async () => {
    if (confirm("Are you sure you want to clear all violation history?")) {
      await fetch("/api/violations/clear", { method: "POST" });
      loadViolations();
    }
  });

  loadViolations();
});
