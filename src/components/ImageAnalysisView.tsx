import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  FileImage,
  Sliders,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  BookmarkPlus,
  RefreshCw,
  Eye,
  Columns,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import { ComplianceResult, Detection, ViolationRecord } from '../types/ppe';
import { CLASS_COLORS, evaluateCompliance } from '../utils/complianceEngine';
import { SAMPLE_TEST_CASES, TestSample } from '../data/sampleImages';
import { detectPPEFromMedia } from '../utils/browserVisionDetector';

interface ImageAnalysisViewProps {
  isModelLoaded: boolean;
  requiredPPE: string[];
  confidenceThreshold: number;
  onRecordViolation: (record: ViolationRecord) => void;
}

export const ImageAnalysisView: React.FC<ImageAnalysisViewProps> = ({
  isModelLoaded,
  requiredPPE,
  confidenceThreshold: initialConf,
  onRecordViolation,
}) => {
  const [currentImageSrc, setCurrentImageSrc] = useState<string>(SAMPLE_TEST_CASES[0].imageUrl);
  const [currentImageName, setCurrentImageName] = useState<string>(SAMPLE_TEST_CASES[0].name);
  const [confThreshold, setConfThreshold] = useState<number>(initialConf);
  const [viewMode, setViewMode] = useState<'overlay' | 'split'>('overlay');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [rawDetections, setRawDetections] = useState<Detection[]>(SAMPLE_TEST_CASES[0].detections);
  const [complianceResult, setComplianceResult] = useState<ComplianceResult | null>(null);
  const [savedNotification, setSavedNotification] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);

  // Evaluate compliance whenever rawDetections, confThreshold, or requiredPPE changes
  useEffect(() => {
    const validDetections = rawDetections.filter((d) => d.confidence >= confThreshold);
    const result = evaluateCompliance(validDetections, requiredPPE);
    setComplianceResult(result);
  }, [rawDetections, confThreshold, requiredPPE]);

  // Render bounding boxes on overlay canvas whenever detections or image changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = currentImageSrc;
    img.onload = () => {
      canvas.width = img.naturalWidth || 600;
      canvas.height = img.naturalHeight || 600;

      // Draw base image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Draw bounding boxes for valid detections
      const validDetections = rawDetections.filter((d) => d.confidence >= confThreshold);

      const personDets = validDetections.filter(
        (d) => d.class === 'Person' || d.raw_class === 'person'
      );
      const hasMultipleWorkers = personDets.length > 1;
      const comp = evaluateCompliance(validDetections, requiredPPE);

      validDetections.forEach((det, dIdx) => {
        const [x1, y1, x2, y2] = det.box;
        const isPerson = det.class === 'Person' || det.raw_class === 'person';
        const isMissingHelmet = det.class === 'Missing Helmet' || det.raw_class === 'no-helmet';
        const isSafetyHelmet = det.class === 'Safety Helmet';
        const isMissingBoots = det.class === 'Missing Boots' || det.raw_class === 'no-boots';
        const isSafetyBoots = det.class === 'Safety Boots';
        const isViolation = det.class.startsWith('Missing ') || det.class.toLowerCase().includes('no-');

        const workerMatch = det.id?.match(/-(\d+)$/);
        const workerIdx = workerMatch ? parseInt(workerMatch[1], 10) + 1 : undefined;

        // Find worker evaluation if person
        let workerEval = workerIdx
          ? comp.worker_evaluations?.find((we) => we.worker_id === workerIdx)
          : undefined;
        if (isPerson && !workerEval && comp.worker_evaluations?.length) {
          const personIdx = personDets.findIndex((p) => p.id === det.id);
          workerEval = comp.worker_evaluations[personIdx >= 0 ? personIdx : 0];
        }

        const isCompliant = isPerson ? (workerEval ? workerEval.status === 'SAFE' : comp.status === 'SAFE') : false;

        let color = CLASS_COLORS[det.class] || '#38BDF8';
        if (isPerson) {
          color = isCompliant ? '#10B981' : '#EF4444'; // Green for compliant, Red for violation
        } else if (isMissingHelmet || isMissingBoots || isViolation) {
          color = '#EF4444';
        } else if (isSafetyHelmet) {
          color = '#10B981';
        } else if (isSafetyBoots) {
          color = '#3B82F6';
        }

        ctx.save();

        if (isPerson) {
          // Translucent fill
          ctx.fillStyle = isCompliant ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.12)';
          ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = isPerson ? Math.max(2.5, Math.round(canvas.width / 260)) : Math.max(2.5, Math.round(canvas.width / 220));

        if (isPerson && !isCompliant) {
          ctx.setLineDash([8, 6]);
        } else if (isMissingHelmet || isMissingBoots || isViolation) {
          ctx.setLineDash([8, 4]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        ctx.setLineDash([]);

        // Label tag
        const prefix = (hasMultipleWorkers || (workerIdx && workerIdx > 1)) && workerIdx ? `W#${workerIdx}: ` : '';
        let label = `${prefix}${det.class} ${Math.round(det.confidence * 100)}%`;

        if (isPerson) {
          const statusText = isCompliant ? 'COMPLIANT [SAFE] ✓' : 'VIOLATION [NON-COMPLIANT] ✕';
          label = `👤 Worker #${workerIdx || 1} • ${statusText}`;
        } else if (isMissingHelmet) {
          label = `⚠️ ${prefix}NO HELMET (VIOLATION)`;
        } else if (isSafetyHelmet) {
          label = `✓ ${prefix}SAFETY HELMET (WORN) ${Math.round(det.confidence * 100)}%`;
        } else if (isMissingBoots) {
          label = `⚠️ ${prefix}NO BOOTS (VIOLATION)`;
        } else if (isSafetyBoots) {
          label = `✓ ${prefix}SAFETY BOOTS (WORN) ${Math.round(det.confidence * 100)}%`;
        }

        const fontSize = isPerson ? Math.max(12, Math.round(canvas.width / 44)) : Math.max(11, Math.round(canvas.width / 50));
        ctx.font = `bold ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
        const textWidth = ctx.measureText(label).width;

        const tagHeight = fontSize + 8;
        const bgY = Math.max(0, y1 - tagHeight);
        ctx.fillStyle = color;
        ctx.fillRect(x1, bgY, textWidth + 14, tagHeight);

        // Text
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(label, x1 + 7, bgY + fontSize);
        ctx.restore();
      });
    };
  }, [currentImageSrc, rawDetections, confThreshold, requiredPPE]);

  // Handle local image file upload (JPG, JPEG, PNG)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
      alert('Unsupported file format. Please upload JPG, JPEG, or PNG images.');
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setCurrentImageSrc(dataUrl);
      setCurrentImageName(file.name);

      const img = new Image();
      img.src = dataUrl;
      img.onload = async () => {
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = img.naturalWidth || 640;
        offscreenCanvas.height = img.naturalHeight || 480;
        const offCtx = offscreenCanvas.getContext('2d');
        if (offCtx) {
          offCtx.drawImage(img, 0, 0);
          const detections = await detectPPEFromMedia(
            offscreenCanvas,
            null,
            { helmet: false, vest: false, goggles: false, gloves: false, boots: false },
            confThreshold,
            0.5,
            0.5,
            'auto',
            0.5,
            requiredPPE
          );
          setRawDetections(detections);
        }
        setIsProcessing(false);
      };
    };
    reader.readAsDataURL(file);
  };

  // Select a curated test sample
  const handleSelectSample = (sample: TestSample) => {
    setCurrentImageSrc(sample.imageUrl);
    setCurrentImageName(sample.name);
    setRawDetections(sample.detections);
  };

  // Save detected violation to SQLite history
  const handleSaveViolation = () => {
    if (!complianceResult || complianceResult.status !== 'VIOLATION') return;

    const firstWorker = complianceResult.worker_evaluations.find((w) => w.status === 'VIOLATION');
    const missing = firstWorker ? firstWorker.missing_ppe : ['Required PPE'];

    onRecordViolation({
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      violation_type: 'Image Safety Infraction',
      missing_ppe: missing,
      confidence: 0.94,
      source: 'image_upload',
      evidence_url: currentImageSrc,
      details: `${currentImageName}: Non-compliant (${missing.join(', ')})`,
    });

    setSavedNotification('Violation logged to safety history.');
    setTimeout(() => setSavedNotification(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Upload & Sample Selector Header */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <FileImage className="w-4 h-4 text-blue-400" />
              Image Inspection & Inference Engine
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select verified test scenario fixtures or upload site inspection photos
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg, image/png, image/jpg"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm"
            >
              <Upload className="w-4 h-4" /> Upload Image
            </button>
          </div>
        </div>

        {/* Quick Sample Fixtures */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Test Scenario Benchmarks:
            </span>
            <span className="text-[11px]">Click any sample to evaluate compliance rules</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {SAMPLE_TEST_CASES.map((sample) => {
              const isSelected = currentImageName === sample.name;
              return (
                <button
                  key={sample.id}
                  onClick={() => handleSelectSample(sample)}
                  className={`p-3 rounded-lg border text-left transition flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-950/40 border-blue-500 text-white shadow-md'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold truncate pr-1">{sample.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        sample.expectedStatus === 'SAFE'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : sample.expectedStatus === 'VIOLATION'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {sample.expectedStatus}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {sample.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Analysis Display */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Canvas Viewport */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex flex-col">
            {/* Viewport Toolbar */}
            <div className="px-5 py-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-200 truncate max-w-xs">
                  {currentImageName}
                </span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-400">
                  Detections: <strong className="text-white font-mono">{complianceResult?.worker_evaluations.length || 0} Workers, {rawDetections.filter(d => d.confidence >= confThreshold).length} Items</strong>
                </span>
              </div>

              {/* View mode toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('overlay')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition ${
                    viewMode === 'overlay'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" /> Annotated Overlay
                </button>
                <button
                  onClick={() => setViewMode('split')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition ${
                    viewMode === 'split'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" /> Side-by-Side
                </button>
              </div>
            </div>

            {/* Viewport Content */}
            <div className="p-4 bg-slate-950 flex items-center justify-center min-h-[420px]">
              {viewMode === 'overlay' ? (
                <div className="relative max-w-full flex items-center justify-center">
                  <canvas
                    ref={canvasRef}
                    className="max-h-[550px] w-auto object-contain rounded-lg shadow-xl border border-slate-800"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Original Input Image
                    </p>
                    <img
                      src={currentImageSrc}
                      alt="Original"
                      className="w-full h-auto max-h-[400px] object-contain rounded-lg border border-slate-800 bg-slate-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      YOLOv5 Annotated Detections
                    </p>
                    <canvas
                      ref={canvasRef}
                      className="w-full h-auto max-h-[400px] object-contain rounded-lg border border-slate-800 bg-slate-900"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Threshold Slider Bar */}
            <div className="px-5 py-3.5 bg-slate-950/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-300">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Sliders className="w-4 h-4 text-blue-400" />
                <label htmlFor="conf-slider" className="font-semibold">
                  Confidence Threshold: <span className="text-blue-400 font-mono font-bold">{Math.round(confThreshold * 100)}%</span>
                </label>
                <input
                  id="conf-slider"
                  type="range"
                  min="10"
                  max="95"
                  value={Math.round(confThreshold * 100)}
                  onChange={(e) => setConfThreshold(Number(e.target.value) / 100)}
                  className="w-36 accent-blue-500 cursor-pointer"
                />
              </div>

              {complianceResult?.status === 'VIOLATION' && (
                <button
                  onClick={handleSaveViolation}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-xs font-bold transition"
                >
                  <BookmarkPlus className="w-4 h-4" /> Save Violation to History
                </button>
              )}
            </div>
          </div>

          {savedNotification && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {savedNotification}
            </div>
          )}
        </div>

        {/* Right Column (1 span): Verdict & Worker Evaluations */}
        <div className="space-y-4">
          {/* Verdict Box */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Compliance Verdict
            </h3>

            {complianceResult?.status === 'SAFE' && (
              <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-center">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
                <h4 className="text-lg font-black tracking-wide">SAFE (100%)</h4>
                <p className="text-xs text-emerald-300/80 mt-1">
                  Worker satisfies all mandatory PPE regulations.
                </p>
              </div>
            )}

            {complianceResult?.status === 'VIOLATION' && (
              <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-center">
                <AlertOctagon className="w-10 h-10 mx-auto mb-2 text-red-400 animate-bounce" />
                <h4 className="text-lg font-black tracking-wide">PPE VIOLATION</h4>
                <p className="text-xs text-red-300/90 mt-1">
                  {complianceResult.message}
                </p>
              </div>
            )}

            {complianceResult?.status === 'NEEDS REVIEW' && (
              <div className="p-4 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 text-center">
                <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-amber-400" />
                <h4 className="text-lg font-black tracking-wide">NEEDS REVIEW</h4>
                <p className="text-xs text-amber-300/90 mt-1 leading-relaxed">
                  {complianceResult.message}
                </p>
              </div>
            )}

            {/* Worker Breakdown Cards */}
            {complianceResult && complianceResult.worker_evaluations.length > 0 && (
              <div className="mt-4 space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Worker Evaluations
                </h4>
                {complianceResult.worker_evaluations.map((worker) => (
                  <div
                    key={worker.worker_id}
                    className={`p-3.5 rounded-lg border text-xs ${
                      worker.status === 'SAFE'
                        ? 'bg-slate-950 border-emerald-500/40'
                        : worker.status === 'VIOLATION'
                        ? 'bg-slate-950 border-red-500/40'
                        : 'bg-slate-950 border-amber-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <span className="font-bold text-white">Worker #{worker.worker_id}</span>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase ${
                          worker.status === 'SAFE'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : worker.status === 'VIOLATION'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {worker.status}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1.5">
                      <div>
                        <span className="text-slate-400 text-[11px]">Detected PPE:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {worker.detected_ppe.length === 0 ? (
                            <span className="text-slate-400 text-[11px]">None</span>
                          ) : (
                            worker.detected_ppe.map((item, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-200 border border-slate-700"
                              >
                                {item}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      {worker.missing_ppe.length > 0 && (
                        <div>
                          <span className="text-red-400 text-[11px] font-bold">Missing Required PPE:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {worker.missing_ppe.map((item, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300 border border-red-500/40 font-semibold"
                              >
                                ✕ {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detected Objects Table */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              YOLOv5 Bounding Box Detections
            </h3>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {rawDetections.filter(d => d.confidence >= confThreshold).map((d, i) => (
                <div
                  key={i}
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
          </div>
        </div>
      </div>
    </div>
  );
};
