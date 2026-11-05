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
  Cloud,
  HardDrive,
  Server,
  CheckCircle2,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { PYTHON_PROJECT_FILES, generateProjectZip, triggerBlobDownload } from '../utils/projectZipGenerator';

export const AboutView: React.FC = () => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [downloadingZip, setDownloadingZip] = useState<boolean>(false);
  const [renderDeployTab, setRenderDeployTab] = useState<'static' | 'node' | 'python'>('static');

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

      {/* Render Free Tier Deployment Guide (500 MB Limit Optimization) */}
      <div className="p-6 rounded-xl bg-slate-900 border border-emerald-500/30 shadow-lg shadow-emerald-500/5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Render Deployment Guide (500 MB Free Tier Compliant)
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Optimized
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Render enforces a strict <strong className="text-amber-300">500 MB disk limit</strong> on free accounts. This repository is pre-optimized to stay well within limits.
            </p>
          </div>

          {/* Disk usage comparison badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
            <HardDrive className="w-4 h-4 text-emerald-400" />
            <div className="text-right font-mono text-[11px]">
              <span className="text-emerald-400 font-bold">~0.98 MB</span>
              <span className="text-slate-500"> / 500 MB Limit (99.8% free)</span>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={() => setRenderDeployTab('static')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              renderDeployTab === 'static'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Option 1: Static Site (Recommended • 0 MB Disk)
          </button>
          <button
            onClick={() => setRenderDeployTab('node')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              renderDeployTab === 'node'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Option 2: Node.js Express Service (~28 MB Disk)
          </button>
          <button
            onClick={() => setRenderDeployTab('python')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              renderDeployTab === 'python'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Option 3: Python YOLOv5 Backend (CPU Optimized)
          </button>
        </div>

        {/* Tab 1: Render Static Site (Best for Vite React) */}
        {renderDeployTab === 'static' && (
          <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4 text-xs">
            <div className="flex items-start gap-2 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <strong className="text-white">Why Static Site is best on Render: </strong>
                Render serves the compiled <code className="text-emerald-300">dist/</code> directory directly from its global CDN. It uses <strong>0 MB of your 500 MB web service disk quota</strong>, has <strong>no cold sleep restarts</strong>, and loads immediately worldwide!
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-white uppercase text-[11px] tracking-wider text-slate-300">
                Setup in 4 Steps on Render:
              </h4>
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-semibold">1. Service Type in Render Dashboard</span>
                    <span className="text-white font-mono">New + &gt; Static Site</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Free</span>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-semibold">2. Build Command</span>
                    <code className="text-emerald-400 font-mono text-xs">npm install && npm run build</code>
                  </div>
                  <button
                    onClick={() => handleCopyCmd('npm install && npm run build', 101)}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                  >
                    {copiedIndex === 101 ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-semibold">3. Publish Directory</span>
                    <code className="text-emerald-400 font-mono text-xs">dist</code>
                  </div>
                  <button
                    onClick={() => handleCopyCmd('dist', 102)}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                  >
                    {copiedIndex === 102 ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-semibold">4. SPA Rewrite Rule (Redirects / Rewrite tab)</span>
                    <span className="text-slate-300 font-mono text-[11px]">/* rewrite to /index.html</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Included in render.yaml</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Render Node.js Express Service */}
        {renderDeployTab === 'node' && (
          <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4 text-xs">
            <div className="flex items-start gap-2 text-blue-300">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <strong className="text-white">Node.js Express Web Service: </strong>
                Configured with our custom <code className="text-blue-300">server.js</code> and <code className="text-blue-300">render-prune</code> script. It builds Vite and discards devDependencies, keeping the production disk footprint down to ~28 MB (94% under the 500 MB limit).
              </div>
            </div>

            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block font-semibold">1. Service Type</span>
                  <span className="text-white font-mono">New + &gt; Web Service (Environment: Node)</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block font-semibold">2. Build Command (Prunes devDependencies to save space)</span>
                  <code className="text-blue-400 font-mono text-xs">npm install && npm run render-prune</code>
                </div>
                <button
                  onClick={() => handleCopyCmd('npm install && npm run render-prune', 201)}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  {copiedIndex === 201 ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block font-semibold">3. Start Command</span>
                  <code className="text-blue-400 font-mono text-xs">node server.js</code>
                </div>
                <button
                  onClick={() => handleCopyCmd('node server.js', 202)}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  {copiedIndex === 202 ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block font-semibold">4. Health Check Path</span>
                  <code className="text-blue-400 font-mono text-xs">/health</code>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Python Backend on Render */}
        {renderDeployTab === 'python' && (
          <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4 text-xs">
            <div className="flex items-start gap-2 text-amber-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
              <div>
                <strong className="text-white">Why standard PyTorch fails on Render: </strong>
                Standard <code className="text-amber-200">pip install torch</code> downloads CUDA GPU wheels taking <strong>2.5 GB to 3.0 GB</strong>, causing Render to fail with <em>"Disk limit of 500MB exceeded"</em>.
                <p className="mt-1 text-slate-300">
                  We created <strong className="text-emerald-400">requirements-render.txt</strong> which installs CPU-only PyTorch and headless OpenCV, reducing disk usage to ~340 MB!
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block font-semibold">1. Root Directory (in Render settings)</span>
                  <code className="text-purple-400 font-mono text-xs">smart-ppe-detection</code>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block font-semibold">2. Build Command (Uses CPU PyTorch + No pip cache)</span>
                  <code className="text-purple-400 font-mono text-xs">pip install --no-cache-dir -r requirements-render.txt</code>
                </div>
                <button
                  onClick={() => handleCopyCmd('pip install --no-cache-dir -r requirements-render.txt', 301)}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  {copiedIndex === 301 ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block font-semibold">3. Start Command</span>
                  <code className="text-purple-400 font-mono text-xs">python app.py</code>
                </div>
                <button
                  onClick={() => handleCopyCmd('python app.py', 302)}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  {copiedIndex === 302 ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        )}
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
          Click any file to inspect the complete executable code:
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
