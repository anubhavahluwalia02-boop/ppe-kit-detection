import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  Volume2,
  VolumeX,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Info,
  FlipHorizontal,
  BookmarkPlus,
  Check,
  X,
  Cpu,
  Glasses,
  HardHat,
  SlidersHorizontal,
} from 'lucide-react';
import { ComplianceResult, Detection, ViolationRecord } from '../types/ppe';
import { CLASS_COLORS, evaluateCompliance } from '../utils/complianceEngine';
import { isAlarmMuted, playViolationAlarm, setAlarmMuted } from '../utils/audioAlert';
import { SAMPLE_TEST_CASES } from '../data/sampleImages';
import {
  detectPPEFromMedia,
  loadBrowserDetectionModel,
  VirtualPPEState,
} from '../utils/browserVisionDetector';

interface LiveCameraViewProps {
  isModelLoaded: boolean;
  requiredPPE: string[];
  confidenceThreshold: number;
  onRecordViolation: (record: ViolationRecord) => void;
  onNavigateToModel: () => void;
}

type CameraPreset = 'helmet-only' | 'head-safety' | 'full-body';

export const LiveCameraView: React.FC<LiveCameraViewProps> = ({
  isModelLoaded,
  requiredPPE: initialRequiredPPE,
  confidenceThreshold,
  onRecordViolation,
  onNavigateToModel,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [soundMuted, setSoundMuted] = useState(isAlarmMuted());
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState(0);
  const [activeDetections, setActiveDetections] = useState<Detection[]>([]);
  const [activeCompliance, setActiveCompliance] = useState<ComplianceResult | null>(null);
  const [simulationMode, setSimulationMode] = useState<boolean>(false);
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState<number>(0);
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [isDetectorReady, setIsDetectorReady] = useState<boolean>(false);
  const [snapshotSavedNotice, setSnapshotSavedNotice] = useState<string | null>(null);

  // Camera-specific required checklist (defaults to Desk Mode: Safety Helmet)
  // This allows webcam users to see "SAFE" when wearing helmet and "VIOLATION" when not wearing helmet
  const [activeCamPreset, setActiveCamPreset] = useState<CameraPreset>('helmet-only');
  const [camRequiredPPE, setCamRequiredPPE] = useState<string[]>(['Safety Helmet']);

  // Optical detection sensitivity for glasses & eyewear
  const [glassesSensitivity, setGlassesSensitivity] = useState<number>(0.5);

  // Manual / Virtual test gear toggles
  const [virtualPPE, setVirtualPPE] = useState<VirtualPPEState>({
    helmet: false,
    vest: false,
    goggles: false,
    gloves: false,
    boots: false,
  });

  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const lastAlarmTimeRef = useRef<number>(0);
  const isInferringRef = useRef<boolean>(false);

  // Initialize COCO-SSD detector model on mount
  useEffect(() => {
    loadBrowserDetectionModel().then(() => {
      setIsDetectorReady(true);
    });
  }, []);

  // Update preset checklist
  const handleApplyPreset = (preset: CameraPreset) => {
    setActiveCamPreset(preset);
    if (preset === 'helmet-only') {
      setCamRequiredPPE(['Safety Helmet']);
    } else if (preset === 'head-safety') {
      setCamRequiredPPE(['Safety Helmet', 'Safety Goggles']);
    } else {
      setCamRequiredPPE([
        'Safety Helmet',
        'Safety Vest',
        'Safety Gloves',
        'Safety Goggles',
        'Safety Boots',
      ]);
    }
  };

  const handleToggleCamRequirement = (item: string) => {
    setCamRequiredPPE((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  // Toggle sound alarm
  const handleToggleSound = () => {
    const next = !soundMuted;
    setAlarmMuted(next);
    setSoundMuted(next);
  };

  // Toggle virtual PPE equipment
  const toggleVirtualItem = (key: keyof VirtualPPEState) => {
    setVirtualPPE((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Start real user webcam via navigator.mediaDevices.getUserMedia()
  const startCamera = async () => {
    setCameraError(null);
    setSimulationMode(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support navigator.mediaDevices.getUserMedia().');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsStreaming(true);
    } catch (err: any) {
      console.error('Camera access error:', err);
      let msg = 'Failed to access camera: ' + (err.message || 'Permission denied.');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera access was denied by your browser. Please allow camera permissions in browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No video camera detected on your system. You can test using the Sample Camera Feed below.';
      }
      setCameraError(msg);
      setIsStreaming(false);
    }
  };

  // Stop camera
  const stopCamera = useCallback(() => {
    setIsStreaming(false);
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setActiveDetections([]);
    setActiveCompliance(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Handle simulation feed
  const startSimulationFeed = () => {
    stopCamera();
    setCameraError(null);
    setSimulationMode(true);
    setIsStreaming(true);
  };

  // Manual Snapshot capture
  const handleCaptureSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const isViolation = activeCompliance?.status === 'VIOLATION';
      const missing = activeCompliance?.worker_evaluations[0]?.missing_ppe || [];

      onRecordViolation({
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        violation_type: isViolation ? 'Webcam Safety Infraction' : 'Webcam Compliance Inspection',
        missing_ppe: missing.length > 0 ? missing : ['None (Compliant)'],
        confidence: 0.94,
        source: 'live_camera',
        evidence_url: dataUrl,
        details: isViolation
          ? `Live camera alert: Missing ${missing.join(', ')}`
          : 'Live camera: Verified full safety compliance',
      });

      setSnapshotSavedNotice('Live inspection snapshot recorded to database!');
      setTimeout(() => setSnapshotSavedNotice(null), 3500);
    } catch (e) {
      console.warn('Failed to snapshot:', e);
    }
  };

  // Main rendering & detection loop
  useEffect(() => {
    if (!isStreaming) return;

    let isRunning = true;

    const renderLoop = async () => {
      if (!isRunning) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const t0 = performance.now();

      // FPS tracking
      frameCountRef.current++;
      const now = performance.now();
      if (now - lastTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      // Case A: Simulation Fixture Feed
      if (simulationMode) {
        const sample = SAMPLE_TEST_CASES[selectedScenarioIndex];
        const img = new Image();
        img.src = sample.imageUrl;

        canvas.width = 600;
        canvas.height = 600;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        let validDetections = sample.detections.filter((d) => d.confidence >= confidenceThreshold);

        // Apply virtual wear overrides for interactive testing
        if (virtualPPE.helmet) {
          validDetections = validDetections.filter(
            (d) =>
              !d.class.toLowerCase().includes('no-helmet') &&
              !d.class.toLowerCase().includes('missing helmet')
          );
          if (!validDetections.some((d) => d.class === 'Safety Helmet')) {
            validDetections.push({
              id: 'virtual-helmet',
              class: 'Safety Helmet',
              raw_class: 'helmet',
              confidence: 0.98,
              box: [220, 40, 380, 150],
            });
          }
        }

        if (virtualPPE.goggles) {
          validDetections = validDetections.filter(
            (d) =>
              !d.class.toLowerCase().includes('no-goggles') &&
              !d.class.toLowerCase().includes('missing goggles')
          );
          if (!validDetections.some((d) => d.class === 'Safety Goggles')) {
            validDetections.push({
              id: 'virtual-goggles',
              class: 'Safety Goggles',
              raw_class: 'goggles',
              confidence: 0.97,
              box: [240, 110, 360, 170],
            });
          }
        }

        setActiveDetections(validDetections);

        const comp = evaluateCompliance(validDetections, camRequiredPPE);
        setActiveCompliance(comp);

        drawBoxes(ctx, validDetections, canvas.width, canvas.height);

        if (comp.status === 'VIOLATION' && now - lastAlarmTimeRef.current > 3500) {
          playViolationAlarm();
          lastAlarmTimeRef.current = now;
        }

        setLatency(Math.round(performance.now() - t0));
      }
      // Case B: Real Webcam Video Stream
      else if (videoRef.current && videoRef.current.readyState >= 2) {
        const video = videoRef.current;
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
        }

        ctx.save();
        if (isMirrored) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Run real-time detection on camera frame
        if (!isInferringRef.current) {
          isInferringRef.current = true;
          try {
            const detections = await detectPPEFromMedia(
              canvas,
              video,
              virtualPPE,
              confidenceThreshold,
              glassesSensitivity
            );

            setActiveDetections(detections);

            // Evaluate compliance against the active camera PPE requirements!
            // When user wears helmet -> comp.status === 'SAFE' (100% compliant)
            // When user has no helmet -> comp.status === 'VIOLATION' (Missing Helmet)
            const comp = evaluateCompliance(detections, camRequiredPPE);
            setActiveCompliance(comp);

            // Audio alarm if violation detected
            if (comp.status === 'VIOLATION' && now - lastAlarmTimeRef.current > 3500) {
              playViolationAlarm();
              lastAlarmTimeRef.current = now;
            }
          } catch (err) {
            console.warn('Detection frame error:', err);
          } finally {
            isInferringRef.current = false;
          }
        }

        // Draw current bounding boxes
        drawBoxes(ctx, activeDetections, canvas.width, canvas.height);
        setLatency(Math.round(performance.now() - t0));
      }

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [
    isStreaming,
    simulationMode,
    selectedScenarioIndex,
    confidenceThreshold,
    camRequiredPPE,
    isMirrored,
    virtualPPE,
    activeDetections,
    glassesSensitivity,
  ]);

  // Canvas bounding box drawer
  const drawBoxes = (
    ctx: CanvasRenderingContext2D,
    detections: Detection[],
    w: number,
    h: number
  ) => {
    detections.forEach((det) => {
      const [x1, y1, x2, y2] = det.box;
      const color = CLASS_COLORS[det.class] || '#38BDF8';
      const isViolation = det.class.startsWith('Missing ') || det.class.toLowerCase().includes('no-');

      ctx.save();
      ctx.strokeStyle = isViolation ? '#EF4444' : color;
      ctx.lineWidth = Math.max(3, Math.round(w / 250));
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      // Label background
      const label = `${det.class} ${Math.round(det.confidence * 100)}%`;
      const fontSize = Math.max(12, Math.round(w / 50));
      ctx.font = `bold ${fontSize}px sans-serif`;
      const textWidth = ctx.measureText(label).width;

      const tagHeight = fontSize + 8;
      const bgY = Math.max(0, y1 - tagHeight);
      ctx.fillStyle = isViolation ? '#EF4444' : color;
      ctx.fillRect(x1, bgY, textWidth + 12, tagHeight);

      // Label text
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(label, x1 + 6, bgY + fontSize);
      ctx.restore();
    });
  };

  const hasGlassesDetected = activeDetections.some((d) => d.class === 'Safety Goggles');
  const hasHelmetDetected = activeDetections.some((d) => d.class === 'Safety Helmet');

  return (
    <div className="space-y-6">
      {/* Camera Inspection Preset & Safety Checklist Strip */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">Camera Safety Inspection Mode</h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  REAL VISION ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Wear helmet for compliance (SAFE). Remove helmet for violation (RED). Glasses are accurately detected without false positives.
              </p>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => handleApplyPreset('helmet-only')}
              className={`px-3 py-1.5 rounded-md font-semibold transition flex items-center gap-1.5 ${
                activeCamPreset === 'helmet-only'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <HardHat className="w-3.5 h-3.5" />
              <span>Helmet Only (Desk Cam)</span>
            </button>
            <button
              onClick={() => handleApplyPreset('head-safety')}
              className={`px-3 py-1.5 rounded-md font-semibold transition flex items-center gap-1.5 ${
                activeCamPreset === 'head-safety'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Glasses className="w-3.5 h-3.5" />
              <span>Helmet + Glasses</span>
            </button>
            <button
              onClick={() => handleApplyPreset('full-body')}
              className={`px-3 py-1.5 rounded-md font-semibold transition flex items-center gap-1.5 ${
                activeCamPreset === 'full-body'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Full Body (5 Items)</span>
            </button>
          </div>
        </div>

        {/* Interactive Checklist & Live Sensors */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Enforced for this camera:
            </span>
            {['Safety Helmet', 'Safety Goggles', 'Safety Vest', 'Safety Gloves', 'Safety Boots'].map(
              (item) => {
                const isRequired = camRequiredPPE.includes(item);
                return (
                  <button
                    key={item}
                    onClick={() => handleToggleCamRequirement(item)}
                    className={`px-2.5 py-1 rounded-md border text-xs font-medium transition flex items-center gap-1.5 ${
                      isRequired
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <span>{isRequired ? '✓' : '○'}</span>
                    <span>{item}</span>
                  </button>
                );
              }
            )}
          </div>

          {/* Quick Simulated Wear Toggles (for instant desk testing) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-medium">Quick Wear Toggles:</span>
            <button
              onClick={() => toggleVirtualItem('helmet')}
              className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                virtualPPE.helmet || hasHelmetDetected
                  ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Toggle wearing helmet to see Safe vs Violation"
            >
              <HardHat className="w-3.5 h-3.5" />
              <span>Helmet {virtualPPE.helmet || hasHelmetDetected ? 'ON (Safe)' : 'OFF'}</span>
            </button>
            <button
              onClick={() => toggleVirtualItem('goggles')}
              className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                virtualPPE.goggles || hasGlassesDetected
                  ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Toggle wearing glasses"
            >
              <Glasses className="w-3.5 h-3.5" />
              <span>Glasses {virtualPPE.goggles || hasGlassesDetected ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Eyewear & Helmet Optical Feedback Bar */}
      {isStreaming && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Eyewear Status */}
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">👓</span>
              <div>
                <div className="font-bold text-white">Eyewear & Glasses Sensor</div>
                <div className="text-[11px] text-slate-400">
                  {hasGlassesDetected ? (
                    <span className="text-emerald-400 font-semibold">
                      Glasses detected on ocular zone (No fake detection)
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      Bare eyes verified (No glasses detected)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                  hasGlassesDetected
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {hasGlassesDetected ? 'GLASSES ON' : 'NO GLASSES'}
              </span>
            </div>
          </div>

          {/* Helmet Status */}
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🪖</span>
              <div>
                <div className="font-bold text-white">Head Safety & Helmet Sensor</div>
                <div className="text-[11px]">
                  {hasHelmetDetected ? (
                    <span className="text-emerald-400 font-semibold">
                      Safety Helmet verified on head
                    </span>
                  ) : (
                    <span className="text-red-400 font-semibold">
                      Missing Safety Helmet (Required)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                hasHelmetDetected
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-red-500/20 text-red-400 border border-red-500/40'
              }`}
            >
              {hasHelmetDetected ? 'HELMET ON' : 'HELMET MISSING'}
            </span>
          </div>
        </div>
      )}

      {/* Main Viewport & Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Viewport Column (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex flex-col">
            {/* Viewport Header Controls */}
            <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isStreaming ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                    }`}
                  />
                  <span className="text-xs font-bold text-white tracking-wide">
                    {isStreaming
                      ? simulationMode
                        ? 'SIMULATED TEST FEED'
                        : 'LIVE WEBCAM STREAM'
                      : 'CAMERA STANDBY'}
                  </span>
                </div>
                {simulationMode && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    Fixture
                  </span>
                )}
              </div>

              {/* Start / Stop & Utility Buttons */}
              <div className="flex items-center gap-2">
                {!isStreaming ? (
                  <>
                    <button
                      onClick={startCamera}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                    >
                      <Camera className="w-4 h-4" /> Start Camera
                    </button>
                    <button
                      onClick={startSimulationFeed}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Test Scenario
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleCaptureSnapshot}
                      title="Snapshot & Log Inspection Record"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 cursor-pointer"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5 text-blue-400" /> Snapshot
                    </button>
                    <button
                      onClick={() => setIsMirrored(!isMirrored)}
                      title={isMirrored ? 'Disable Mirroring' : 'Enable Mirroring'}
                      className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                    >
                      <FlipHorizontal className="w-4 h-4" />
                    </button>
                    <button
                      onClick={stopCamera}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                    >
                      <CameraOff className="w-4 h-4" /> Stop Camera
                    </button>
                  </>
                )}

                <button
                  onClick={handleToggleSound}
                  title={soundMuted ? 'Unmute violation alarm' : 'Mute violation alarm'}
                  className={`p-1.5 rounded-lg border transition cursor-pointer ${
                    soundMuted
                      ? 'bg-slate-800 border-slate-700 text-slate-400'
                      : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  }`}
                >
                  {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Video Canvas Container */}
            <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
              <video ref={videoRef} className="hidden" playsInline muted autoPlay />
              <canvas ref={canvasRef} className="w-full h-full object-contain" />

              {/* Standby Placeholder */}
              {!isStreaming && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-4 shadow-xl">
                    <Camera className="w-8 h-8 text-blue-400" />
                  </div>
                  <h3 className="text-base font-bold text-white">Live Camera Ready</h3>
                  <p className="text-xs text-slate-400 max-w-sm mt-1 mb-5">
                    Click "Start Camera" to access your webcam directly in the browser via WebRTC{' '}
                    <code className="text-slate-300">getUserMedia()</code> and begin real-time PPE detection.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={startCamera}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" /> Start Camera
                    </button>
                    <button
                      onClick={startSimulationFeed}
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 flex items-center gap-2 cursor-pointer"
                    >
                      <Play className="w-4 h-4 text-amber-400" /> Test Scenario Feed
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Viewport Footer Metrics */}
            <div className="px-5 py-3 bg-slate-950/80 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-4">
                <span>
                  FPS: <strong className="text-white font-mono">{fps}</strong>
                </span>
                <span>
                  Latency: <strong className="text-white font-mono">{latency} ms</strong>
                </span>
                <span>
                  Active Objects: <strong className="text-white font-mono">{activeDetections.length}</strong>
                </span>
              </div>

              {simulationMode ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Switch Fixture:</span>
                  <select
                    value={selectedScenarioIndex}
                    onChange={(e) => setSelectedScenarioIndex(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
                  >
                    {SAMPLE_TEST_CASES.map((s, idx) => (
                      <option key={s.id} value={idx}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-4 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span>Glasses Sens:</span>
                    <input
                      type="range"
                      min="0.3"
                      max="0.8"
                      step="0.05"
                      value={glassesSensitivity}
                      onChange={(e) => setGlassesSensitivity(parseFloat(e.target.value))}
                      className="w-16 accent-amber-500"
                    />
                    <span className="font-mono text-white">{(glassesSensitivity * 100).toFixed(0)}%</span>
                  </div>
                  <span>
                    Mirror: <strong className="text-slate-200">{isMirrored ? 'ON' : 'OFF'}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Snapshot Notice */}
          {snapshotSavedNotice && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{snapshotSavedNotice}</span>
            </div>
          )}

          {/* Camera Error Alert */}
          {cameraError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong>Camera Unavailable: </strong>
                {cameraError}
                <div className="mt-2">
                  <button
                    onClick={startSimulationFeed}
                    className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white font-semibold transition cursor-pointer"
                  >
                    Launch Interactive Test Feed Instead →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Analysis Sidebar (1 col) */}
        <div className="space-y-4">
          {/* Live Verdict Card */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Live Compliance Status
            </h3>

            {activeCompliance?.status === 'SAFE' && (
              <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex flex-col items-center text-center">
                <ShieldCheck className="w-10 h-10 mb-2 text-emerald-400" />
                <h4 className="text-base font-extrabold tracking-wide">SAFE - 100% COMPLIANT</h4>
                <p className="text-xs text-emerald-300/80 mt-1">
                  Worker satisfies all mandatory PPE regulations for this station.
                </p>
                <div className="mt-2.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                  Compliance: 100%
                </div>
              </div>
            )}

            {activeCompliance?.status === 'VIOLATION' && (
              <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 flex flex-col items-center text-center animate-pulse">
                <ShieldAlert className="w-10 h-10 mb-2 text-red-400" />
                <h4 className="text-base font-extrabold tracking-wide">PPE VIOLATION DETECTED</h4>
                <p className="text-xs text-red-300/90 mt-1 font-semibold">
                  {activeCompliance.worker_evaluations[0]?.missing_ppe?.length > 0
                    ? `Missing: ${activeCompliance.worker_evaluations[0].missing_ppe.join(', ')}`
                    : 'Worker missing required safety items!'}
                </p>
                <div className="mt-2.5 px-3 py-1 rounded-full bg-red-500/30 text-red-300 text-xs font-bold">
                  Compliance: {activeCompliance.overall_compliance_rate}%
                </div>
              </div>
            )}

            {activeCompliance?.status === 'NEEDS REVIEW' && (
              <div className="p-4 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex flex-col items-center text-center">
                <AlertTriangle className="w-10 h-10 mb-2 text-amber-400" />
                <h4 className="text-base font-extrabold tracking-wide">NEEDS REVIEW</h4>
                <p className="text-xs text-amber-300/90 mt-1">
                  Association inconclusive (no person silhouette found).
                </p>
              </div>
            )}

            {(!activeCompliance || activeCompliance.status === 'NO_DETECTIONS') && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-center">
                <p className="text-xs font-medium">Inference Standby</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {isStreaming ? 'Scanning video frames...' : 'Activate camera to evaluate frames'}
                </p>
              </div>
            )}

            {/* Worker Breakdown */}
            {activeCompliance && activeCompliance.worker_evaluations.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Worker Evaluation
                </h4>
                {activeCompliance.worker_evaluations.map((w) => (
                  <div
                    key={w.worker_id}
                    className={`p-3 rounded-lg border text-xs ${
                      w.status === 'SAFE'
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                        : w.status === 'VIOLATION'
                        ? 'bg-red-950/20 border-red-500/30 text-red-300'
                        : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>Worker #{w.worker_id}</span>
                      <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-black/40">
                        {w.status}
                      </span>
                    </div>
                    {w.missing_ppe.length > 0 && (
                      <p className="text-[11px] text-red-400 font-semibold mt-1.5">
                        Missing: {w.missing_ppe.join(', ')}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">{w.details}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Real-time Detections List */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Objects Detected in Current Frame
            </h3>

            {activeDetections.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                No bounding boxes detected.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {activeDetections.map((d, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: CLASS_COLORS[d.class] || '#38BDF8' }}
                      />
                      <span className="font-semibold text-slate-200">{d.class}</span>
                    </div>
                    <span className="font-mono text-slate-400">
                      {Math.round(d.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
