import React from 'react';
import {
  LayoutDashboard,
  Camera,
  Image as ImageIcon,
  History,
  Cpu,
  Info,
  Download,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { generateProjectZip, triggerBlobDownload } from '../utils/projectZipGenerator';

import { User } from '../types/auth';

export type TabId = 'dashboard' | 'live' | 'upload' | 'history' | 'model' | 'about';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  isModelLoaded: boolean;
  activeViolationsCount: number;
  currentUser?: User | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isModelLoaded,
  activeViolationsCount,
  currentUser,
  onLogout,
}) => {
  const [downloadingZip, setDownloadingZip] = React.useState(false);

  const handleDownloadZip = async () => {
    try {
      setDownloadingZip(true);
      const blob = await generateProjectZip();
      triggerBlobDownload(blob, 'smart-ppe-detection.zip');
    } catch (e) {
      console.error('Failed to create zip:', e);
      alert('Failed to package project zip.');
    } finally {
      setDownloadingZip(false);
    }
  };

  const navItems = [
    { id: 'dashboard' as TabId, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'live' as TabId, label: 'Live Detection', icon: Camera, badge: 'WebRTC' },
    { id: 'upload' as TabId, label: 'Image Analysis', icon: ImageIcon },
    {
      id: 'history' as TabId,
      label: 'Violation History',
      icon: History,
      badge: activeViolationsCount > 0 ? `${activeViolationsCount}` : undefined,
      badgeColor: 'bg-red-500/20 text-red-400 border border-red-500/30',
    },
    { id: 'model' as TabId, label: 'Model Information', icon: Cpu },
    { id: 'about' as TabId, label: 'About Project', icon: Info },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4 shrink-0 h-screen sticky top-0 select-none">
      <div className="space-y-6">
        {/* Brand header */}
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <ShieldAlert className="w-6 h-6 text-slate-950 font-bold" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wider text-white flex items-center gap-1.5">
              SAFEGUARD <span className="text-amber-400 text-xs">AI</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">YOLOv5 PPE Sentinel</p>
          </div>
        </div>

        {/* Model status indicator */}
        <div
          onClick={() => onTabChange('model')}
          className="cursor-pointer group flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition"
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isModelLoaded ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <div className="text-left">
              <p className="text-xs font-semibold text-slate-200">
                {isModelLoaded ? 'YOLOv5 Model Ready' : 'Standby / weights check'}
              </p>
              <p className="text-[10px] text-slate-400">
                {isModelLoaded ? 'models/best.pt active' : 'Click to inspect weights'}
              </p>
            </div>
          </div>
          {isModelLoaded ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          )}
        </div>

        {/* Navigation list */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      item.badgeColor || 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Download Zip & User Profile Footer */}
      <div className="space-y-3 pt-3 border-t border-slate-800/80">
        {currentUser && (
          <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 truncate">
                <div
                  className={`w-6 h-6 rounded-md bg-gradient-to-br ${
                    currentUser.avatarColor || 'from-amber-500 to-emerald-600'
                  } flex items-center justify-center text-[10px] font-bold text-slate-950 shrink-0`}
                >
                  {currentUser.name.charAt(0)}
                </div>
                <div className="truncate">
                  <div className="font-semibold text-white truncate text-[11px]">{currentUser.name}</div>
                  <div className="text-[10px] text-amber-400 font-medium truncate">{currentUser.role}</div>
                </div>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 font-mono truncate px-0.5">
              {currentUser.email}
            </div>
          </div>
        )}

        <button
          onClick={handleDownloadZip}
          disabled={downloadingZip}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 transition shadow-sm disabled:opacity-60"
        >
          <Download className="w-3.5 h-3.5 text-amber-400" />
          <span>{downloadingZip ? 'Packaging...' : 'Download Project (.ZIP)'}</span>
        </button>

        <div className="text-[10px] text-slate-400 px-1 text-center">
          Ultralytics YOLOv5 • OpenCV • SQLite
        </div>
      </div>
    </aside>
  );
};
