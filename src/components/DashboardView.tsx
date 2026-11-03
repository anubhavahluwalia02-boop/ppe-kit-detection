import React from 'react';
import {
  Users,
  ShieldCheck,
  AlertTriangle,
  HardHat,
  Percent,
  ArrowRight,
  Camera,
  Upload,
  Check,
  X,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { ComplianceResult, ViolationRecord } from '../types/ppe';
import { TabId } from './Sidebar';

interface DashboardViewProps {
  compliance: ComplianceResult;
  violationsHistory: ViolationRecord[];
  onNavigate: (tab: TabId) => void;
  isModelLoaded: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  compliance,
  violationsHistory,
  onNavigate,
  isModelLoaded,
}) => {
  const complianceRate = compliance.overall_compliance_rate;

  const mandatoryItems = [
    { name: 'Safety Helmet', key: 'helmet', standard: 'EN 397 / ANSI Z89.1', icon: '🪖' },
    { name: 'Safety Vest', key: 'vest', standard: 'ISO 20471 Class 2', icon: '🦺' },
    { name: 'Safety Gloves', key: 'gloves', standard: 'EN 388 Mechanical', icon: '🧤' },
    { name: 'Safety Goggles', key: 'goggles', standard: 'ANSI Z87.1 Impact', icon: '🥽' },
    { name: 'Safety Boots', key: 'boots', standard: 'ASTM F2413 Steel Toe', icon: '🥾' },
  ];

  const recentViolations = violationsHistory.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Model Missing or Standby Warning Banner */}
      {!isModelLoaded && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-amber-300">
                YOLOv5 Model Weights Standby (models/best.pt)
              </h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Trained PyTorch weights file <code className="px-1.5 py-0.5 rounded bg-slate-950 font-mono text-amber-200">best.pt</code> was not located in the local directory. You can test live scenarios using built-in high-accuracy fixtures, test images, or add your trained weights.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('model')}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold shrink-0 transition"
          >
            Setup Guide →
          </button>
        </div>
      )}

      {/* Main KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Workers */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Detected Workers</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {compliance.total_workers}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Personnel actively tracked</p>
          </div>
        </div>

        {/* Compliant Workers */}
        <div className="p-5 rounded-xl bg-slate-900 border border-emerald-500/30 bg-gradient-to-b from-emerald-500/5 to-transparent flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider text-emerald-400">Compliant</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-emerald-400 tracking-tight">
              {compliance.compliant_workers}
            </div>
            <p className="text-[11px] text-emerald-400/80 mt-1">Full 5/5 mandatory PPE</p>
          </div>
        </div>

        {/* PPE Violations */}
        <div className="p-5 rounded-xl bg-slate-900 border border-red-500/30 bg-gradient-to-b from-red-500/5 to-transparent flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider text-red-400">Violations</span>
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-red-400 tracking-tight">
              {compliance.violation_workers}
            </div>
            <p className="text-[11px] text-red-400/80 mt-1">Active safety infractions</p>
          </div>
        </div>

        {/* Total PPE Items */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Detected Items</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <HardHat className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {compliance.worker_evaluations.reduce((sum, w) => sum + w.detected_ppe.length, 0) + compliance.unassigned_ppe.length}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Helmets, vests, gloves, etc.</p>
          </div>
        </div>

        {/* Overall Compliance % */}
        <div className="p-5 rounded-xl bg-slate-900 border border-blue-500/30 bg-gradient-to-b from-blue-500/5 to-transparent flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider text-blue-400">Compliance Rate</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-blue-400 tracking-tight">
              {compliance.total_workers > 0 ? `${complianceRate}%` : 'N/A'}
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  complianceRate >= 90 ? 'bg-emerald-400' : complianceRate >= 50 ? 'bg-amber-400' : 'bg-red-400'
                }`}
                style={{ width: `${complianceRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Two-Column Industrial Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Compliance Checklist & Quick Triggers */}
        <div className="lg:col-span-2 space-y-6">
          {/* Mandatory PPE Checklist Standard */}
          <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Mandatory PPE Checklist Standard
                </h3>
                <p className="text-xs text-slate-400">
                  Worker compliance rule: all 5 mandatory items must be present per person
                </p>
              </div>
              <span className="px-2.5 py-1 rounded bg-slate-800 text-[11px] font-mono text-slate-300">
                OSHA 1910.132 / ISO 45001
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4">
              {mandatoryItems.map((item) => (
                <div
                  key={item.key}
                  className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-200">{item.name}</h4>
                      <p className="text-[10px] text-slate-400">{item.standard}</p>
                    </div>
                  </div>
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                    ✓
                  </span>
                </div>
              ))}

              <div
                onClick={() => onNavigate('model')}
                className="cursor-pointer p-3 rounded-lg bg-blue-950/20 border border-blue-900/40 hover:border-blue-700/60 transition flex items-center justify-between"
              >
                <div>
                  <h4 className="text-xs font-semibold text-blue-300">Configure Rules</h4>
                  <p className="text-[10px] text-slate-400">Toggle required classes</p>
                </div>
                <ArrowRight className="w-4 h-4 text-blue-400" />
              </div>
            </div>
          </div>

          {/* Quick Launchpad */}
          <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              Real-Time Inference Launchpad
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => onNavigate('live')}
                className="cursor-pointer group p-4 rounded-xl bg-gradient-to-br from-blue-900/30 to-slate-950 border border-blue-800/40 hover:border-blue-600 transition flex items-start gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition shrink-0">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition flex items-center gap-1.5">
                    Live Webcam Stream <ArrowRight className="w-3.5 h-3.5" />
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Capture frames directly using browser <code className="text-slate-300">getUserMedia()</code> and render real-time bounding boxes.
                  </p>
                </div>
              </div>

              <div
                onClick={() => onNavigate('upload')}
                className="cursor-pointer group p-4 rounded-xl bg-gradient-to-br from-purple-900/30 to-slate-950 border border-purple-800/40 hover:border-purple-600 transition flex items-start gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition shrink-0">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white group-hover:text-purple-400 transition flex items-center gap-1.5">
                    Inspect Images & Test Cases <ArrowRight className="w-3.5 h-3.5" />
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Upload inspection photos or test with verified safety violation sample fixtures.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (1 span): Recent Violations Stream */}
        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 flex flex-col h-full">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                Violation Stream
              </h3>
              <button
                onClick={() => onNavigate('history')}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
              >
                View all ({violationsHistory.length}) <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3 mt-4 flex-1">
              {recentViolations.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <ShieldCheck className="w-8 h-8 text-emerald-400/50 mx-auto mb-2" />
                  No violations logged yet. All monitored personnel compliant.
                </div>
              ) : (
                recentViolations.map((v) => (
                  <div
                    key={v.id}
                    className="p-3 rounded-lg bg-slate-950 border border-red-900/40 hover:border-red-700/60 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-red-400">{v.violation_type}</span>
                      <span className="text-[10px] font-mono text-slate-400">{v.timestamp}</span>
                    </div>
                    <p className="text-xs text-slate-200 font-medium mt-1">
                      Missing: <span className="text-amber-400">{v.missing_ppe.join(', ')}</span>
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/80">
                      <span>Source: {v.source}</span>
                      <span>Confidence: {Math.round(v.confidence * 100)}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
