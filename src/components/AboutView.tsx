import React, { useState } from 'react';
import {
  Info,
  Terminal,
  Download,
  FolderTree,
  FileCode,
  Copy,
  Check,
  ShieldCheck,
  ExternalLink,
  Laptop,
} from 'lucide-react';
import { PYTHON_PROJECT_FILES, generateProjectZip, triggerBlobDownload } from '../utils/projectZipGenerator';

export const AboutView: React.FC = () => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [downloadingZip, setDownloadingZip] = useState<boolean>(false);

  const windowsSteps = [
    { title: '1. Create Virtual Environment', cmd: 'python -m venv venv' },
    { title: '2. Activate Virtual Environment', cmd: 'venv\\Scripts\\activate' },
    { title: '3. Install Dependencies', cmd: 'pip install -r requirements.txt' },
    { title: '4. Place YOLOv5 Weights', cmd: 'copy best.pt models\\best.pt' },
    { title: '5. Launch Flask Server', cmd: 'python app.py' },
    { title: '6. Open in Browser', cmd: 'start http://127.0.0.1:5000' },
  ];

  const handleCopyCmd = (cmd: string, idx: number) => {
    navigator.clipboard.writeText(cmd);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleDownload = async () => {
    try {
      setDownloadingZip(true);
      const blob = await generateProjectZip();
      triggerBlobDownload(blob, 'smart-ppe-detection.zip');
    } catch (e) {
      console.error(e);
      alert('Failed to generate ZIP.');
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Overview */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              Smart PPE Kit Detection System (YOLOv5)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Autonomous workplace safety compliance monitoring engineered with PyTorch YOLOv5, OpenCV, Flask, and SQLite
            </p>
          </div>

          <button
            onClick={handleDownload}
            disabled={downloadingZip}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{downloadingZip ? 'Packaging ZIP Archive...' : 'Download Project (.ZIP)'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-xs text-slate-300">
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
            <h4 className="font-bold text-white mb-1">Deep Learning Engine</h4>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Real-time object detection via custom-trained Ultralytics YOLOv5 with dynamic class discovery from <code className="text-amber-300">model.names</code>.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
            <h4 className="font-bold text-white mb-1">Spatial IoU Association</h4>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Connects individual helmets, vests, and safety gear to distinct workers via bounding-box overlap and containment checks.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
            <h4 className="font-bold text-white mb-1">Zero-Pretense Integrity</h4>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Fails safely when weights are absent without synthesizing fake detections, and outputs <strong className="text-amber-400">NEEDS REVIEW</strong> when associations are inconclusive.
            </p>
          </div>
        </div>
      </div>

      {/* Windows & VS Code Execution Instructions */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-2">
          <Laptop className="w-4 h-4 text-blue-400" />
          Windows & VS Code Execution Guide
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Execute these standard terminal commands in VS Code or Windows Command Prompt:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {windowsSteps.map((step, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between"
            >
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block">{step.title}</span>
                <code className="text-emerald-400 font-mono text-xs">{step.cmd}</code>
              </div>
              <button
                onClick={() => handleCopyCmd(step.cmd, idx)}
                title="Copy command"
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                {copiedIndex === idx ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Project Structure & Python Code Inspector */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-2">
          <FolderTree className="w-4 h-4 text-purple-400" />
          Project File Explorer & Source Code
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Click any file to inspect the complete executable Python codebase:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* File selector list */}
          <div className="space-y-1.5">
            {PYTHON_PROJECT_FILES.map((file, idx) => {
              const isSelected = selectedFileIndex === idx;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFileIndex(idx)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-mono transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                      : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="truncate">{file.path}</span>
                  <FileCode className="w-3.5 h-3.5 shrink-0" />
                </button>
              );
            })}
          </div>

          {/* Code viewer */}
          <div className="md:col-span-2 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex flex-col">
            <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono text-white">
                {PYTHON_PROJECT_FILES[selectedFileIndex].path}
              </span>
              <button
                onClick={() =>
                  handleCopyCmd(PYTHON_PROJECT_FILES[selectedFileIndex].content, 999)
                }
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
              >
                {copiedIndex === 999 ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy Code
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 text-[11px] font-mono text-slate-300 max-h-96 overflow-y-auto leading-relaxed">
              {PYTHON_PROJECT_FILES[selectedFileIndex].content}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
