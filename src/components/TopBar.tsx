import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, ShieldCheck, AlertOctagon, Sliders, Clock, LogOut, User as UserIcon } from 'lucide-react';
import { isAlarmMuted, setAlarmMuted } from '../utils/audioAlert';
import { TabId } from './Sidebar';
import { User } from '../types/auth';

interface TopBarProps {
  activeTab: TabId;
  systemStatus: 'SAFE' | 'VIOLATION' | 'NEEDS REVIEW' | 'NO_DETECTIONS' | 'STANDBY';
  confidenceThreshold: number;
  onThresholdChange?: (val: number) => void;
  currentUser?: User | null;
  onLogout?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  systemStatus,
  confidenceThreshold,
  currentUser,
  onLogout,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [muted, setMuted] = useState<boolean>(isAlarmMuted());

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleSound = () => {
    const next = !muted;
    setAlarmMuted(next);
    setMuted(next);
  };

  const getStatusBadge = () => {
    switch (systemStatus) {
      case 'SAFE':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>SAFE • 100% COMPLIANT</span>
          </div>
        );
      case 'VIOLATION':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>PPE VIOLATION DETECTED</span>
          </div>
        );
      case 'NEEDS REVIEW':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>NEEDS REVIEW</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span>SYSTEM STANDBY</span>
          </div>
        );
    }
  };

  const getTabHeading = () => {
    switch (activeTab) {
      case 'dashboard':
        return { title: 'Industrial Safety Dashboard', desc: 'Real-time workplace PPE compliance monitoring & metrics' };
      case 'live':
        return { title: 'Live Camera Detection', desc: 'WebRTC video frame ingestion with YOLOv5 bounding-box overlay' };
      case 'upload':
        return { title: 'Image Inspection & Analysis', desc: 'High-resolution PPE detection and worker spatial evaluation' };
      case 'history':
        return { title: 'Safety Violation Registry', desc: 'SQLite-backed violation logs with evidence snapshots' };
      case 'model':
        return { title: 'YOLOv5 Model Specifications', desc: 'Weights inspection, class mapping, and detection thresholds' };
      case 'about':
        return { title: 'About Smart PPE Kit Detection', desc: 'System architecture, Windows & VS Code execution guide' };
    }
  };

  const { title, desc } = getTabHeading();

  return (
    <header className="h-16 px-6 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex items-center justify-between shrink-0 select-none">
      <div>
        <h2 className="text-base font-bold text-white tracking-tight">{title}</h2>
        <p className="text-xs text-slate-400">{desc}</p>
      </div>

      <div className="flex items-center gap-4">
        {/* Status indicator */}
        {getStatusBadge()}

        {/* Confidence threshold tag */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-slate-300 text-xs">
          <Sliders className="w-3 h-3 text-slate-400" />
          <span>Conf: <strong className="text-white">{Math.round(confidenceThreshold * 100)}%</strong></span>
        </div>

        {/* Audio alarm toggle */}
        <button
          onClick={toggleSound}
          title={muted ? 'Unmute violation buzzer' : 'Mute violation buzzer'}
          className={`p-2 rounded-lg border transition ${
            muted
              ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
          }`}
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Clock */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-950/80 border border-slate-800 text-slate-300 font-mono text-xs">
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          <span>{currentTime || '00:00:00'}</span>
        </div>

        {/* User Profile & Sign Out */}
        {currentUser && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs">
              <div
                className={`w-6 h-6 rounded-md bg-gradient-to-br ${
                  currentUser.avatarColor || 'from-amber-500 to-emerald-600'
                } flex items-center justify-center text-[10px] font-bold text-slate-950 shrink-0`}
              >
                {currentUser.name.charAt(0)}
              </div>
              <div className="text-left">
                <div className="font-semibold text-white leading-tight">{currentUser.name}</div>
                <div className="text-[10px] text-slate-400 font-mono leading-tight truncate max-w-[140px]">
                  {currentUser.email}
                </div>
              </div>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                title={`Sign out (${currentUser.email})`}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 text-xs font-semibold transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Sign Out</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
