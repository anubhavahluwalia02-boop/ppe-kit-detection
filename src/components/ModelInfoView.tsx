import React, { useState } from 'react';
import {
  Cpu,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  FileCode,
  Sliders,
  ShieldCheck,
  Check,
  RotateCcw,
  BookOpen,
  ExternalLink,
} from 'lucide-react';
import { PPE_CLASS_MAPPING, DEFAULT_REQUIRED_PPE } from '../utils/complianceEngine';

interface ModelInfoViewProps {
  isModelLoaded: boolean;
  requiredPPE: string[];
  onToggleRequiredPPE: (item: string) => void;
  confidenceThreshold: number;
  onConfidenceChange: (val: number) => void;
  onSetModelLoaded: (loaded: boolean) => void;
}

export const ModelInfoView: React.FC<ModelInfoViewProps> = ({
  isModelLoaded,
  requiredPPE,
  onToggleRequiredPPE,
  confidenceThreshold,
  onConfidenceChange,
  onSetModelLoaded,
}) => {
  const [modelPath] = useState('smart-ppe-detection/models/best.pt');
  const [iouThreshold, setIouThreshold] = useState(0.45);

  const allPossiblePPE = [
    { name: 'Safety Helmet', key: 'Safety Helmet', tag: 'Head Protection', osha: '29 CFR 1910.135' },
    { name: 'Safety Vest', key: 'Safety Vest', tag: 'High-Visibility', osha: 'ANSI/ISEA 107' },
    { name: 'Safety Gloves', key: 'Safety Gloves', tag: 'Hand Protection', osha: '29 CFR 1910.138' },
    { name: 'Safety Goggles', key: 'Safety Goggles', tag: 'Eye & Face Protection', osha: '29 CFR 1910.133' },
    { name: 'Safety Boots', key: 'Safety Boots', tag: 'Foot Protection', osha: '29 CFR 1910.136' },
  ];

  return (
    <div className="space-y-6">
      {/* Model Status Hero Card */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                isModelLoaded
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}
            >
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Ultralytics YOLOv5 (PyTorch Framework)
                </h3>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase ${
                    isModelLoaded
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {isModelLoaded ? 'Weights Active' : 'Standby / File Missing'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Target Weights Path: <code className="text-slate-200">{modelPath}</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onSetModelLoaded(!isModelLoaded)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                isModelLoaded
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
              }`}
            >
              {isModelLoaded ? 'Simulate Model Missing (Standby)' : 'Mount Verified Weights (Ready)'}
            </button>
          </div>
        </div>

        {/* Missing Model Instructions (Always prominent when model is missing) */}
        {!isModelLoaded ? (
          <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-slate-200 space-y-3">
            <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
              <AlertTriangle className="w-4 h-4" />
              How to Add Your Trained YOLOv5 Model (best.pt)
            </div>
            <p className="text-slate-300 leading-relaxed">
              To perform live deep learning inference, the model requires trained PyTorch weights. The detector is programmed never to manufacture fake results when the model weights are absent.
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-300 font-medium pl-1">
              <li>
                Download or train your YOLOv5 weights file (e.g. from Roboflow Universe PPE dataset or Ultralytics).
              </li>
              <li>
                Rename the exported weights file to <strong className="text-white">best.pt</strong>.
              </li>
              <li>
                Place it inside the <code className="px-1.5 py-0.5 rounded bg-slate-950 font-mono text-amber-200">models/</code> directory:
                <code className="block mt-1 p-2 rounded bg-slate-950 font-mono text-[11px] text-blue-300">
                  smart-ppe-detection/models/best.pt
                </code>
              </li>
              <li>
                Launch the application via <code className="text-amber-300">python app.py</code> or click "Mount Verified Weights" above.
              </li>
            </ol>
          </div>
        ) : (
          <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Model verified: </strong> PyTorch model loaded via <code className="text-emerald-200 font-mono">torch.hub.load('ultralytics/yolov5', 'custom', path='models/best.pt')</code> with dynamic class loading.
            </span>
          </div>
        )}
      </div>

      {/* Configurable PPE Checklist Card */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Configurable PPE Checklist Rules
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select which equipment is strictly enforced for a worker to be deemed SAFE
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Enforcing {requiredPPE.length} / {allPossiblePPE.length} items
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4">
          {allPossiblePPE.map((ppe) => {
            const isChecked = requiredPPE.includes(ppe.name);
            return (
              <div
                key={ppe.key}
                onClick={() => onToggleRequiredPPE(ppe.name)}
                className={`cursor-pointer p-3.5 rounded-lg border transition flex items-center justify-between select-none ${
                  isChecked
                    ? 'bg-slate-950 border-emerald-500/50 text-white'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 opacity-60'
                }`}
              >
                <div>
                  <h4 className="text-xs font-bold text-white">{ppe.name}</h4>
                  <p className="text-[10px] text-slate-400">{ppe.tag} • {ppe.osha}</p>
                </div>
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center transition ${
                    isChecked
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'border border-slate-700 bg-slate-900'
                  }`}
                >
                  {isChecked && <Check className="w-4 h-4 stroke-[3]" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Threshold & Hyperparameters Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4">
            <Sliders className="w-4 h-4 text-blue-400" />
            Detection Hyperparameters
          </h3>

          <div className="space-y-5 text-xs text-slate-300">
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-semibold">Confidence Threshold (conf):</span>
                <span className="font-mono text-blue-400 font-bold">{Math.round(confidenceThreshold * 100)}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="95"
                value={Math.round(confidenceThreshold * 100)}
                onChange={(e) => onConfidenceChange(Number(e.target.value) / 100)}
                className="w-full accent-blue-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Filters low-probability false positives. Default: 45%.
              </p>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="font-semibold">NMS IoU Threshold:</span>
                <span className="font-mono text-blue-400 font-bold">{Math.round(iouThreshold * 100)}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                value={Math.round(iouThreshold * 100)}
                onChange={(e) => setIouThreshold(Number(e.target.value) / 100)}
                className="w-full accent-blue-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Non-Maximum Suppression overlap threshold for duplicate bounding boxes.
              </p>
            </div>
          </div>
        </div>

        {/* Spatial Association Engine */}
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4">
            <BookOpen className="w-4 h-4 text-purple-400" />
            Person-to-PPE Spatial Association Logic
          </h3>

          <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
            <p>
              In multi-person construction sites, PPE detections must be bound to specific individuals rather than aggregated indiscriminately:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
              <li>
                <strong className="text-slate-200">Bounding-Box Containment:</strong> PPE centroids (x, y) are mapped inside the detected Person bounding box with a 15% margin for helmets and boots.
              </li>
              <li>
                <strong className="text-slate-200">Negative Classes:</strong> If explicit classes like <code className="text-red-300">no-helmet</code> or <code className="text-red-300">no-vest</code> overlap a person, they immediately trigger an infraction.
              </li>
              <li>
                <strong className="text-slate-200">Inconclusive Association:</strong> If PPE is detected with no identifiable human silhouette, the status outputs <span className="text-amber-400 font-bold">NEEDS REVIEW</span> instead of granting an unsubstantiated pass.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Class Mapping Dictionary */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
          Dynamic Class Mapping Dictionary
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Supported YOLOv5 labels mapped to standardized safety classes:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
          {Object.entries(PPE_CLASS_MAPPING).map(([raw, std]) => (
            <div
              key={raw}
              className="p-2 rounded bg-slate-950 border border-slate-800/80 flex items-center justify-between"
            >
              <code className="text-slate-400 font-mono text-[11px]">{raw}</code>
              <span className="text-[11px] font-semibold text-slate-200 truncate ml-2">
                → {std}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
