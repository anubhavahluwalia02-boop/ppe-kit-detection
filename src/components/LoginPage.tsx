import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  UserCheck,
  CheckCircle2,
  HardHat,
  Glasses,
  Flame,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { User, DEMO_USERS } from '../types/auth';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('anubhavahluwalia02@gmail.com');
  const [password, setPassword] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'Safety Officer' | 'Site Auditor' | 'Plant Supervisor' | 'HSE Manager'>('Safety Officer');
  const [siteLocation, setSiteLocation] = useState('Zone A - Industrial Complex');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectDemoUser = (user: User) => {
    setEmail(user.email);
    setSelectedRole(user.role);
    setSiteLocation(user.siteLocation);
    setPassword('demoPass123!');
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please provide a valid workplace email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email format (e.g., officer@site.com).');
      return;
    }

    if (!password || password.trim().length < 3) {
      setError('Please enter your security access password.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      // Find matching demo user or construct active user session
      const matched = DEMO_USERS.find(
        (u) => u.email.toLowerCase() === trimmedEmail.toLowerCase()
      );

      const activeUser: User = {
        id: matched?.id || `user-${Date.now()}`,
        name:
          matched?.name ||
          trimmedEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        email: trimmedEmail,
        role: selectedRole,
        siteLocation: siteLocation || 'Main Plant Facility',
        loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        avatarColor: matched?.avatarColor || 'from-amber-500 to-emerald-600',
      };

      if (rememberMe) {
        try {
          localStorage.setItem('safeguard_auth_user', JSON.stringify(activeUser));
        } catch (e) {
          console.warn('Failed to store session:', e);
        }
      }

      setIsLoading(false);
      onLogin(activeUser);
    }, 450);
  };

  return (
    <div className="min-h-screen w-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
      {/* Top Header Strip */}
      <header className="border-b border-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <ShieldAlert className="w-5 h-5 text-slate-950 font-bold" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wider text-white flex items-center gap-1.5">
              SAFEGUARD <span className="text-amber-400 text-xs">AI</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">YOLOv5 PPE Sentinel System</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Industrial Vision Server • Online</span>
        </div>
      </header>

      {/* Main Login Container */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-8 backdrop-blur">
          {/* Card Title */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 mb-3 text-amber-400">
              <UserCheck className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Safety Portal Sign In</h2>
            <p className="text-xs text-slate-400 mt-1">
              Authenticate via email to access live camera detection & violation logs
            </p>
          </div>

          {/* Quick Demo Account Selector */}
          <div className="mb-6">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Quick Sign In Profile
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {DEMO_USERS.map((u) => {
                const isSelected = email.toLowerCase() === u.email.toLowerCase();
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectDemoUser(u)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left text-xs transition ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div
                        className={`w-6 h-6 rounded-md bg-gradient-to-br ${u.avatarColor} flex items-center justify-center text-[10px] font-bold text-slate-950 shrink-0`}
                      >
                        {u.name.charAt(0)}
                      </div>
                      <div className="truncate">
                        <div className="font-semibold text-white truncate">{u.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{u.email}</div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0 font-medium ml-2">
                      {u.role}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Workplace Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Access Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter security code"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Assigned Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="Safety Officer">Safety Officer</option>
                  <option value="Site Auditor">Site Auditor</option>
                  <option value="HSE Manager">HSE Manager</option>
                  <option value="Plant Supervisor">Plant Supervisor</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Site Facility
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={siteLocation}
                    onChange={(e) => setSiteLocation(e.target.value)}
                    placeholder="Facility name"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0"
                />
                <span>Remember session</span>
              </label>

              <span className="text-[11px] text-amber-400/90 font-medium">
                Standard ISO 45001 Access
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Safety Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Safety Checklist Footer Note */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-around text-slate-400 text-[11px]">
            <div className="flex items-center gap-1.5">
              <HardHat className="w-3.5 h-3.5 text-amber-400" />
              <span>Hardhat</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Glasses className="w-3.5 h-3.5 text-purple-400" />
              <span>Goggles</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-emerald-400" />
              <span>Hi-Vis Vest</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-500">
        Safeguard AI • Real-Time YOLOv5 Personal Protective Equipment Computer Vision Engine • 2026
      </footer>
    </div>
  );
};
