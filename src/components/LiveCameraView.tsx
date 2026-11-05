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
  Users,
} from 'lucide-react';
import { ComplianceResult, Detection, ViolationRecord } from '../types/ppe';
import { CLASS_COLORS, evaluateCompliance } from '../utils/complianceEngine';
import { isAlarmMuted, playViolationAlarm, setAlarmMuted } from '../utils/audioAlert';
import { SAMPLE_TEST_CASES } from '../data/sampleImages';
import {
  detectPPEFromMedia,
  loadBrowserDetectionModel,
  PersonCountMode,
  VirtualPPEState,
} from '../utils/browserVisionDetector';

interface LiveCameraViewProps {
  isModelLoaded: boolean;
  requiredPPE: string[];
  confidenceThreshold: number;
  onRecordViolation: (record: ViolationRecord) => void;
  onNavigateToModel: () => void;
}

type CameraPreset = 'helmet-boots' | 'helmet-only' | 'head-safety' | 'full-body';

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

  // Worker detection mode ('auto' dynamically finds 1, 2, or 3 people; or manual station lock)
  const [personCountMode, setPersonCountMode] = useState<PersonCountMode>('auto');

  // Camera-specific required checklist (defaults to Helmet & Boots for OSHA Site Entry)
  // Ensures both Missing Helmet and Missing Boots are promptly detected & flagged if absent
  const [activeCamPreset, setActiveCamPreset] = useState<CameraPreset>('helmet-boots');
  const [camRequiredPPE, setCamRequiredPPE] = useState<string[]>(['Safety Helmet', 'Safety Boots']);

  // Optical detection sensitivity for glasses & eyewear
  const [glassesSensitivity, setGlassesSensitivity] = useState<number>(0.5);
  // Optical detection sensitivity for safety helmet & hardhat
  const [helmetSensitivity, setHelmetSensitivity] = useState<number>(0.5);
  // Optical detection sensitivity for safety boots & footwear
  const [bootsSensitivity, setBootsSensitivity] = useState<number>(0.5);

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
  const latestComplianceRef = useRef<ComplianceResult | null>(null);

  // Initialize COCO-SSD detector model on mount
  useEffect(() => {
    loadBrowserDetectionModel().then(() => {
      setIsDetectorReady(true);
    });
  }, []);

  // Update preset checklist
  const handleApplyPreset = (preset: CameraPreset) => {
    setActiveCamPreset(preset);
    if (preset === 'helmet-boots') {
      setCamRequiredPPE(['Safety Helmet', 'Safety Boots']);
    } else if (preset === 'helmet-only') {
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
    latestComplianceRef.current = null;
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

        if (virtualPPE.boots) {
          validDetections = validDetections.filter(
            (d) =>
              !d.class.toLowerCase().includes('no-boots') &&
              !d.class.toLowerCase().includes('missing boots')
          );
          if (!validDetections.some((d) => d.class === 'Safety Boots')) {
            validDetections.push({
              id: 'virtual-boots',
              class: 'Safety Boots',
              raw_class: 'boots',
              confidence: 0.98,
              box: [220, 465, 380, 515],
            });
          }
        }

        setActiveDetections(validDetections);

        const comp = evaluateCompliance(validDetections, camRequiredPPE);
        latestComplianceRef.current = comp;
        setActiveCompliance(comp);

        drawBoxes(ctx, validDetections, canvas.width, canvas.height, comp);

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
              glassesSensitivity,
              helmetSensitivity,
              personCountMode,
              bootsSensitivity,
              camRequiredPPE
            );

            setActiveDetections(detections);

            // Evaluate compliance against the active camera PPE requirements for ALL detected workers
            const comp = evaluateCompliance(detections, camRequiredPPE);
            latestComplianceRef.current = comp;
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

        // Draw current bounding boxes with color-coded labels directly onto canvas
        drawBoxes(ctx, activeDetections, canvas.width, canvas.height, latestComplianceRef.current);
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
    helmetSensitivity,
    bootsSensitivity,
    personCountMode,
  ]);

  // Canvas bounding box drawer: Draws color-coded bounding boxes directly onto canvas for every detected person
  // Green (#10B981) for compliant / SAFE, Red (#EF4444) for violation / NON-COMPLIANT
  const drawBoxes = (
    ctx: CanvasRenderingContext2D,
    detections: Detection[],
    w: number,
    h: number,
    complianceResult?: ComplianceResult | null
  ) => {
    const comp = complianceResult || latestComplianceRef.current || activeCompliance;

    // Filter detections into persons and PPE items
    const personDets = detections.filter(
      (d) => d.class === 'Person' || d.raw_class === 'person'
    );
    const itemDets = detections.filter(
      (d) => d.class !== 'Person' && d.raw_class !== 'person'
    );
    const hasMultipleWorkers = personDets.length > 1;

    // Helper to draw rounded rectangle
    const drawRoundRect = (
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      rw: number,
      rh: number,
      radius: number
    ) => {
      const r = Math.min(radius, rw / 2, rh / 2);
      c.beginPath();
      c.moveTo(x + r, y);
      c.lineTo(x + rw - r, y);
      c.quadraticCurveTo(x + rw, y, x + rw, y + r);
      c.lineTo(x + rw, y + rh - r);
      c.quadraticCurveTo(x + rw, y + rh, x + rw - r, y + rh);
      c.lineTo(x + r, y + rh);
      c.quadraticCurveTo(x, y + rh, x, y + rh - r);
      c.lineTo(x, y + r);
      c.quadraticCurveTo(x, y, x + r, y);
      c.closePath();
    };

    // STEP 1: DRAW EVERY DETECTED PERSON FIRST WITH COLOR-CODED BOUNDING BOX & LABELS
    personDets.forEach((det, personIdx) => {
      const [x1, y1, x2, y2] = det.box;
      const boxW = Math.max(12, x2 - x1);
      const boxH = Math.max(12, y2 - y1);

      // Extract worker index if present in det.id (e.g. 'person-0' -> Worker #1, 'person-1' -> Worker #2)
      const workerMatch = det.id?.match(/-(\d+)$/);
      const workerIdx = workerMatch ? parseInt(workerMatch[1], 10) + 1 : personIdx + 1;

      // Find matching worker evaluation from the compliance engine
      let workerEval = comp?.worker_evaluations?.find((we) => we.worker_id === workerIdx);
      if (!workerEval && comp?.worker_evaluations && comp.worker_evaluations.length > 0) {
        workerEval = comp.worker_evaluations[personIdx] || comp.worker_evaluations[0];
      }

      // Determine compliance: Green for compliant (SAFE), Red for violation (VIOLATION)
      let isCompliant = false;
      if (workerEval) {
        isCompliant = workerEval.status === 'SAFE';
      } else if (comp) {
        isCompliant = comp.status === 'SAFE';
      } else {
        // Fallback: check if station requires helmet and helmet is detected
        const hasHelmet = detections.some(
          (d) => d.class === 'Safety Helmet' || d.raw_class === 'helmet'
        );
        isCompliant = hasHelmet;
      }

      // Color coding: Green for compliant, Red for violation
      const personColor = isCompliant ? '#10B981' : '#EF4444';
      const personFill = isCompliant ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.12)';
      const personGlow = isCompliant ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.55)';

      ctx.save();

      // Translucent tinted fill over worker silhouette
      ctx.fillStyle = personFill;
      ctx.fillRect(x1, y1, boxW, boxH);

      // Outer Bounding Box Border
      ctx.strokeStyle = personColor;
      ctx.lineWidth = Math.max(2.5, Math.round(w / 260));
      if (!isCompliant) {
        ctx.setLineDash([8, 6]); // Alert dashed stroke for non-compliance
      } else {
        ctx.setLineDash([]); // Clean solid stroke for compliant
      }
      ctx.strokeRect(x1, y1, boxW, boxH);
      ctx.setLineDash([]);

      // Industrial HUD Corner Accents for high-tech precision visual aesthetic
      const cornerLen = Math.min(26, Math.max(12, Math.round(Math.min(boxW, boxH) * 0.12)));
      const cornerWidth = Math.max(4, Math.round(w / 180));
      ctx.strokeStyle = personColor;
      ctx.lineWidth = cornerWidth;
      ctx.shadowColor = personGlow;
      ctx.shadowBlur = 8;

      // Top-Left corner
      ctx.beginPath();
      ctx.moveTo(x1, y1 + cornerLen);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1 + cornerLen, y1);
      ctx.stroke();

      // Top-Right corner
      ctx.beginPath();
      ctx.moveTo(x2 - cornerLen, y1);
      ctx.lineTo(x2, y1);
      ctx.lineTo(x2, y1 + cornerLen);
      ctx.stroke();

      // Bottom-Left corner
      ctx.beginPath();
      ctx.moveTo(x1, y2 - cornerLen);
      ctx.lineTo(x1, y2);
      ctx.lineTo(x1 + cornerLen, y2);
      ctx.stroke();

      // Bottom-Right corner
      ctx.beginPath();
      ctx.moveTo(x2 - cornerLen, y2);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2, y2 - cornerLen);
      ctx.stroke();

      ctx.shadowBlur = 0; // Reset shadow

      // --- COLOR-CODED LABEL DIRECTLY ON CANVAS ---
      // Compliant: Green pill with "👤 Worker #1 • COMPLIANT ✓"
      // Violation: Red pill with "⚠️ Worker #2 • VIOLATION ✕"
      const workerLabel = `Worker #${workerIdx}`;
      const statusText = isCompliant ? 'COMPLIANT ✓' : 'VIOLATION ✕';
      const mainLabel = isCompliant ? `👤 ${workerLabel} • ${statusText}` : `⚠️ ${workerLabel} • ${statusText}`;

      const fontSize = Math.max(11, Math.round(w / 48));
      ctx.font = `bold ${fontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      const mainLabelWidth = ctx.measureText(mainLabel).width;

      const pillHeight = fontSize + 8;
      const pillWidth = mainLabelWidth + 14;

      // Position label above the box; if at top of viewport, position just inside top of box
      let pillY = y1 - pillHeight - 3;
      if (pillY < 2) {
        pillY = y1 + 3;
      }
      const pillX = Math.max(4, Math.min(x1, w - pillWidth - 4));

      // Draw Main Header Pill in Green (compliant) or Red (violation)
      ctx.fillStyle = personColor;
      drawRoundRect(ctx, pillX, pillY, pillWidth, pillHeight, 4);
      ctx.fill();

      // Draw Header Text in bold white
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(mainLabel, pillX + 7, pillY + fontSize);

      // --- SECONDARY ON-CANVAS SUB-LABEL ---
      // If violation, clearly show missing items in an alert badge directly below the header
      if (!isCompliant && workerEval && workerEval.missing_ppe.length > 0) {
        const missingText = `MISSING: ${workerEval.missing_ppe.join(', ')}`;
        const subFontSize = Math.max(9, Math.round(fontSize * 0.82));
        ctx.font = `bold ${subFontSize}px ui-sans-serif, system-ui, sans-serif`;
        const subWidth = ctx.measureText(missingText).width;
        const subHeight = subFontSize + 6;
        const subPillWidth = subWidth + 12;
        const subY = pillY + pillHeight + 2;

        if (subY + subHeight < h - 4) {
          ctx.fillStyle = '#7F1D1D'; // Dark red backdrop
          drawRoundRect(ctx, pillX, subY, subPillWidth, subHeight, 3);
          ctx.fill();
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          ctx.fillStyle = '#FEE2E2'; // High-contrast light red text
          ctx.fillText(missingText, pillX + 6, subY + subFontSize);
        }
      } else if (isCompliant) {
        // If compliant, display verification sub-badge
        const verifiedText = '✓ ALL MANDATORY PPE';
        const subFontSize = Math.max(8.5, Math.round(fontSize * 0.78));
        ctx.font = `bold ${subFontSize}px ui-sans-serif, system-ui, sans-serif`;
        const subWidth = ctx.measureText(verifiedText).width;
        const subHeight = subFontSize + 5;
        const subPillWidth = subWidth + 12;
        const subY = pillY + pillHeight + 2;

        if (subY + subHeight < h - 4) {
          ctx.fillStyle = 'rgba(6, 78, 59, 0.9)'; // Dark emerald backdrop
          drawRoundRect(ctx, pillX, subY, subPillWidth, subHeight, 3);
          ctx.fill();
          ctx.strokeStyle = '#10B981';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = '#D1FAE5'; // Light green text
          ctx.fillText(verifiedText, pillX + 6, subY + subFontSize);
        }
      }

      ctx.restore();
    });

    // STEP 2: DRAW PPE ITEMS AND VIOLATIONS ON TOP
    itemDets.forEach((det) => {
      const [x1, y1, x2, y2] = det.box;
      const isMissingHelmet = det.class === 'Missing Helmet' || det.raw_class === 'no-helmet';
      const isSafetyHelmet = det.class === 'Safety Helmet';
      const isMissingBoots = det.class === 'Missing Boots' || det.raw_class === 'no-boots';
      const isSafetyBoots = det.class === 'Safety Boots';
      const isMissingVest = det.class === 'Missing Vest' || det.raw_class === 'no-vest';
      const isSafetyVest = det.class === 'Safety Vest';
      const isMissingGoggles = det.class === 'Missing Goggles' || det.raw_class === 'no-goggles';
      const isSafetyGoggles = det.class === 'Safety Goggles';
      const isViolation = det.class.startsWith('Missing ') || det.class.toLowerCase().includes('no-');

      // Extract worker index if present in det.id (e.g. 'helmet-0')
      const workerMatch = det.id?.match(/-(\d+)$/);
      const workerIdx = workerMatch ? parseInt(workerMatch[1], 10) + 1 : undefined;

      let color = CLASS_COLORS[det.class] || '#38BDF8';
      if (isMissingHelmet || isMissingBoots || isMissingVest || isMissingGoggles || isViolation) {
        color = '#EF4444'; // Red for violation items
      } else if (isSafetyHelmet) {
        color = '#10B981'; // Green for safety helmet
      } else if (isSafetyBoots) {
        color = '#3B82F6'; // Blue for safety boots
      } else if (isSafetyVest) {
        color = '#F59E0B'; // Amber for safety vest
      } else if (isSafetyGoggles) {
        color = '#8B5CF6'; // Purple for safety goggles
      }

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2.5, Math.round(w / 220));

      if (isMissingHelmet || isMissingBoots || isViolation) {
        ctx.setLineDash([6, 4]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.setLineDash([]);

      const prefix = (hasMultipleWorkers || (workerIdx && workerIdx > 1)) && workerIdx ? `W#${workerIdx}: ` : '';
      let label = `${prefix}${det.class} ${Math.round(det.confidence * 100)}%`;

      if (isMissingHelmet) {
        label = `⚠️ ${prefix}NO HELMET (VIOLATION)`;
      } else if (isSafetyHelmet) {
        label = `✓ ${prefix}SAFETY HELMET ${Math.round(det.confidence * 100)}%`;
      } else if (isMissingBoots) {
        label = `⚠️ ${prefix}NO BOOTS (VIOLATION)`;
      } else if (isSafetyBoots) {
        label = `✓ ${prefix}SAFETY BOOTS ${Math.round(det.confidence * 100)}%`;
      } else if (isMissingVest) {
        label = `⚠️ ${prefix}NO VEST (VIOLATION)`;
      } else if (isSafetyVest) {
        label = `✓ ${prefix}SAFETY VEST ${Math.round(det.confidence * 100)}%`;
      } else if (isMissingGoggles) {
        label = `⚠️ ${prefix}NO GOGGLES (VIOLATION)`;
      } else if (isSafetyGoggles) {
        label = `✓ ${prefix}SAFETY GOGGLES ${Math.round(det.confidence * 100)}%`;
      }

      const fontSize = Math.max(10, Math.round(w / 52));
      ctx.font = `bold ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
      const textWidth = ctx.measureText(label).width;

      const tagHeight = fontSize + 7;
      const bgY = Math.max(0, y1 - tagHeight);
      ctx.fillStyle = color;
      drawRoundRect(ctx, x1, bgY, textWidth + 12, tagHeight, 3);
      ctx.fill();

      // Label text
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(label, x1 + 6, bgY + fontSize);
      ctx.restore();
    });
  };

  const hasGlassesDetected = activeDetections.some((d) => d.class === 'Safety Goggles');
  const hasHelmetDetected = activeDetections.some((d) => d.class === 'Safety Helmet');
  const hasBootsDetected = activeDetections.some((d) => d.class === 'Safety Boots');

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
              onClick={() => handleApplyPreset('helmet-boots')}
              className={`px-3 py-1.5 rounded-md font-semibold transition flex items-center gap-1.5 ${
                activeCamPreset === 'helmet-boots'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <HardHat className="w-3.5 h-3.5" />
              <span>🪖+🥾 Helmet & Boots (OSHA)</span>
            </button>
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
              onClick={() => toggleVirtualItem('boots')}
              className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                virtualPPE.boots || hasBootsDetected
                  ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Toggle wearing safety boots to see Safe vs Violation"
            >
              <span>🥾</span>
              <span>Boots {virtualPPE.boots || hasBootsDetected ? 'ON (Safe)' : 'OFF'}</span>
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

        {/* Multi-Worker Detection & Tracking Mode */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-400" /> Worker Detection:
            </span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setPersonCountMode('auto')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                  personCountMode === 'auto'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Automatically detect and count multiple people simultaneously using Non-Maximum Suppression (NMS)"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Auto Detect (Multi-Person NMS)</span>
              </button>
              <button
                onClick={() => setPersonCountMode(1)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition flex items-center gap-1 cursor-pointer ${
                  personCountMode === 1
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Fixed Single Worker Station"
              >
                <span>👤 1 Worker</span>
              </button>
              <button
                onClick={() => setPersonCountMode(2)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition flex items-center gap-1 cursor-pointer ${
                  personCountMode === 2
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Dual Worker Stations (Side by side)"
              >
                <span>👥 2 Workers</span>
              </button>
              <button
                onClick={() => setPersonCountMode(3)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition flex items-center gap-1 cursor-pointer ${
                  personCountMode === 3
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Three Workers Crew"
              >
                <span>👥👤 3 Workers</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Tracking Status:</span>
            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-950 border border-slate-800 text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                {activeCompliance?.total_workers || 0} Worker{activeCompliance?.total_workers === 1 ? '' : 's'} Detected
                {activeCompliance && activeCompliance.total_workers > 0 && (
                  <span className="text-slate-400 font-normal ml-1">
                    ({activeCompliance.compliant_workers} Safe, {activeCompliance.violation_workers} Violations)
                  </span>
                )}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Real-time Helmet, Boots & Eyewear Optical Feedback Bar */}
      {isStreaming && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Helmet Status Card */}
          <div
            className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between text-xs ${
              hasHelmetDetected
                ? 'bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                : 'bg-red-950/40 border-red-500/80 shadow-lg shadow-red-500/15'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{hasHelmetDetected ? '🪖' : '⚠️'}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-extrabold text-sm ${
                      hasHelmetDetected ? 'text-emerald-300' : 'text-red-300'
                    }`}
                  >
                    {hasHelmetDetected ? 'HELMET: WORN' : 'HELMET: MISSING'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      hasHelmetDetected
                        ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400/50'
                        : 'bg-red-500/30 text-red-200 border-red-400/50 animate-pulse'
                    }`}
                  >
                    {hasHelmetDetected ? 'SAFE ✓' : 'NO HELMET ✕'}
                  </span>
                </div>
                <div className="text-[11px] mt-0.5">
                  {hasHelmetDetected ? (
                    <span className="text-emerald-300/90 font-medium">
                      Hard hat crown verified on head.
                    </span>
                  ) : (
                    <span className="text-red-300/95 font-semibold">
                      Bare head! Safety helmet required.
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => toggleVirtualItem('helmet')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer shrink-0 ml-1.5 ${
                virtualPPE.helmet || hasHelmetDetected
                  ? 'bg-emerald-600/30 hover:bg-emerald-600/50 border-emerald-500/50 text-emerald-200'
                  : 'bg-red-600 hover:bg-red-500 border-red-500 text-white shadow-md'
              }`}
              title="Test wear/remove helmet"
            >
              {virtualPPE.helmet || hasHelmetDetected ? 'Remove' : 'Wear'}
            </button>
          </div>

          {/* Boots Status Card */}
          <div
            className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between text-xs ${
              hasBootsDetected
                ? 'bg-blue-950/40 border-blue-500/60 shadow-lg shadow-blue-500/10'
                : 'bg-red-950/40 border-red-500/80 shadow-lg shadow-red-500/15'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{hasBootsDetected ? '🥾' : '⚠️'}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-extrabold text-sm ${
                      hasBootsDetected ? 'text-blue-300' : 'text-red-300'
                    }`}
                  >
                    {hasBootsDetected ? 'BOOTS: WORN' : 'BOOTS: MISSING'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      hasBootsDetected
                        ? 'bg-blue-500/30 text-blue-200 border-blue-400/50'
                        : 'bg-red-500/30 text-red-200 border-red-400/50 animate-pulse'
                    }`}
                  >
                    {hasBootsDetected ? 'SAFE ✓' : 'NO BOOTS ✕'}
                  </span>
                </div>
                <div className="text-[11px] mt-0.5">
                  {hasBootsDetected ? (
                    <span className="text-blue-300/90 font-medium">
                      Protective work footwear verified.
                    </span>
                  ) : (
                    <span className="text-red-300/95 font-semibold">
                      Missing boots! Foot protection required.
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => toggleVirtualItem('boots')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer shrink-0 ml-1.5 ${
                virtualPPE.boots || hasBootsDetected
                  ? 'bg-blue-600/30 hover:bg-blue-600/50 border-blue-500/50 text-blue-200'
                  : 'bg-red-600 hover:bg-red-500 border-red-500 text-white shadow-md'
              }`}
              title="Test wear/remove boots"
            >
              {virtualPPE.boots || hasBootsDetected ? 'Remove' : 'Wear'}
            </button>
          </div>

          {/* Eyewear Status Card */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="text-2xl">👓</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-white">
                    {hasGlassesDetected ? 'GLASSES: DETECTED' : 'EYEWEAR: BARE EYES'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      hasGlassesDetected
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {hasGlassesDetected ? 'GLASSES ON ✓' : 'NO GLASSES'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {hasGlassesDetected ? (
                    <span className="text-purple-300 font-medium">
                      Ocular frames/lenses identified.
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      Bare eyes (Smooth facial skin, no frame).
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => toggleVirtualItem('goggles')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer shrink-0 ml-1.5 ${
                virtualPPE.goggles || hasGlassesDetected
                  ? 'bg-purple-600/30 hover:bg-purple-600/50 border-purple-500/50 text-purple-200'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
              title="Test wear/remove glasses"
            >
              {virtualPPE.goggles || hasGlassesDetected ? 'Remove' : 'Wear'}
            </button>
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
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span>🪖 Helmet Sens:</span>
                    <input
                      type="range"
                      min="0.2"
                      max="0.8"
                      step="0.05"
                      value={helmetSensitivity}
                      onChange={(e) => setHelmetSensitivity(parseFloat(e.target.value))}
                      className="w-16 accent-emerald-500 cursor-pointer"
                      title="Adjust optical helmet detection threshold"
                    />
                    <span className="font-mono text-white">{(helmetSensitivity * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>🥾 Boots Sens:</span>
                    <input
                      type="range"
                      min="0.2"
                      max="0.8"
                      step="0.05"
                      value={bootsSensitivity}
                      onChange={(e) => setBootsSensitivity(parseFloat(e.target.value))}
                      className="w-16 accent-blue-500 cursor-pointer"
                      title="Adjust optical safety boots detection threshold"
                    />
                    <span className="font-mono text-white">{(bootsSensitivity * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>👓 Glasses Sens:</span>
                    <input
                      type="range"
                      min="0.3"
                      max="0.8"
                      step="0.05"
                      value={glassesSensitivity}
                      onChange={(e) => setGlassesSensitivity(parseFloat(e.target.value))}
                      className="w-16 accent-purple-500 cursor-pointer"
                      title="Adjust optical eyewear detection threshold"
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
                <h4 className="text-base font-extrabold tracking-wide">
                  {activeCompliance.total_workers > 1
                    ? `ALL ${activeCompliance.total_workers} WORKERS COMPLIANT`
                    : 'SAFE - 100% COMPLIANT'}
                </h4>
                <p className="text-xs text-emerald-300/80 mt-1">
                  {activeCompliance.total_workers > 1
                    ? `All ${activeCompliance.total_workers} workers verified compliant with mandatory safety gear.`
                    : 'Worker satisfies all mandatory PPE regulations for this station.'}
                </p>
                <div className="mt-2.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                  {activeCompliance.total_workers > 1
                    ? `${activeCompliance.compliant_workers}/${activeCompliance.total_workers} Workers Safe (100%)`
                    : 'Compliance: 100%'}
                </div>
              </div>
            )}

            {activeCompliance?.status === 'VIOLATION' && (
              <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 flex flex-col items-center text-center animate-pulse">
                <ShieldAlert className="w-10 h-10 mb-2 text-red-400" />
                <h4 className="text-base font-extrabold tracking-wide">
                  {activeCompliance.total_workers > 1
                    ? `${activeCompliance.violation_workers} OF ${activeCompliance.total_workers} WORKERS IN VIOLATION`
                    : 'PPE VIOLATION DETECTED'}
                </h4>
                <p className="text-xs text-red-300/90 mt-1 font-semibold">
                  {activeCompliance.total_workers > 1
                    ? activeCompliance.worker_evaluations
                        .filter((w) => w.status === 'VIOLATION')
                        .map((w) => `Worker #${w.worker_id}: Missing ${w.missing_ppe.join(', ')}`)
                        .join(' | ')
                    : activeCompliance.worker_evaluations[0]?.missing_ppe?.length > 0
                    ? `Missing: ${activeCompliance.worker_evaluations[0].missing_ppe.join(', ')}`
                    : 'Worker missing required safety items!'}
                </p>
                <div className="mt-2.5 px-3 py-1 rounded-full bg-red-500/30 text-red-300 text-xs font-bold">
                  Compliance: {activeCompliance.overall_compliance_rate}% ({activeCompliance.compliant_workers} Safe, {activeCompliance.violation_workers} Violations)
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
