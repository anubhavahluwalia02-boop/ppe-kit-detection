/**
 * Smart PPE Kit Detection System (YOLOv5)
 * Main Application Shell
 */
import React, { useState, useEffect } from 'react';
import { Sidebar, TabId } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DashboardView } from './components/DashboardView';
import { LiveCameraView } from './components/LiveCameraView';
import { ImageAnalysisView } from './components/ImageAnalysisView';
import { ViolationHistoryView } from './components/ViolationHistoryView';
import { ModelInfoView } from './components/ModelInfoView';
import { AboutView } from './components/AboutView';
import { LoginPage } from './components/LoginPage';
import { User, DEMO_USERS } from './types/auth';
import { ComplianceResult, ViolationRecord } from './types/ppe';
import { DEFAULT_REQUIRED_PPE, evaluateCompliance } from './utils/complianceEngine';
import { SAMPLE_TEST_CASES } from './data/sampleImages';

const INITIAL_VIOLATIONS: ViolationRecord[] = [
  {
    id: 101,
    timestamp: '14:22:18',
    violation_type: 'Missing Required PPE',
    missing_ppe: ['Safety Helmet', 'Safety Vest'],
    confidence: 0.94,
    source: 'sample_test',
    evidence_url: SAMPLE_TEST_CASES[1].imageUrl,
    details: 'Structural Bay 3: Worker entered active fabrication zone without hard hat.',
  },
  {
    id: 102,
    timestamp: '11:05:42',
    violation_type: 'Incomplete Safety Gear',
    missing_ppe: ['Safety Goggles', 'Safety Gloves'],
    confidence: 0.89,
    source: 'image_upload',
    evidence_url: SAMPLE_TEST_CASES[2].imageUrl,
    details: 'Chemical Substation B: Eye protection mandatory near acid delivery pipe.',
  },
];

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('safeguard_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(true);
  const [requiredPPE, setRequiredPPE] = useState<string[]>(DEFAULT_REQUIRED_PPE);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.45);

  // Violation records state with localStorage persistence
  const [violations, setViolations] = useState<ViolationRecord[]>(() => {
    try {
      const saved = localStorage.getItem('safeguard_violations');
      return saved ? JSON.parse(saved) : INITIAL_VIOLATIONS;
    } catch {
      return INITIAL_VIOLATIONS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('safeguard_violations', JSON.stringify(violations));
    } catch (e) {
      console.warn('Failed to save violations:', e);
    }
  }, [violations]);

  // Compute active compliance state for dashboard
  const activeCompliance: ComplianceResult = React.useMemo(() => {
    const validDetections = SAMPLE_TEST_CASES[0].detections.filter(
      (d) => d.confidence >= confidenceThreshold
    );
    return evaluateCompliance(validDetections, requiredPPE);
  }, [confidenceThreshold, requiredPPE]);

  const handleRecordViolation = (record: ViolationRecord) => {
    setViolations((prev) => [record, ...prev]);
  };

  const handleClearHistory = () => {
    if (confirm('Clear all historical safety violations from database?')) {
      setViolations([]);
    }
  };

  const handleDeleteViolation = (id: string | number) => {
    setViolations((prev) => prev.filter((v) => v.id !== id));
  };

  const handleToggleRequiredPPE = (item: string) => {
    setRequiredPPE((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('safeguard_auth_user');
    } catch (e) {
      console.warn('Failed to clear session:', e);
    }
    setCurrentUser(null);
  };

  if (!currentUser) {
    return <LoginPage onLogin={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isModelLoaded={isModelLoaded}
        activeViolationsCount={violations.length}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top bar */}
        <TopBar
          activeTab={activeTab}
          systemStatus={isModelLoaded ? (activeCompliance.status as any) : 'STANDBY'}
          confidenceThreshold={confidenceThreshold}
          onThresholdChange={setConfidenceThreshold}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        {/* Scrollable View Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto pb-12">
            {activeTab === 'dashboard' && (
              <DashboardView
                compliance={activeCompliance}
                violationsHistory={violations}
                onNavigate={setActiveTab}
                isModelLoaded={isModelLoaded}
              />
            )}

            {activeTab === 'live' && (
              <LiveCameraView
                isModelLoaded={isModelLoaded}
                requiredPPE={requiredPPE}
                confidenceThreshold={confidenceThreshold}
                onRecordViolation={handleRecordViolation}
                onNavigateToModel={() => setActiveTab('model')}
              />
            )}

            {activeTab === 'upload' && (
              <ImageAnalysisView
                isModelLoaded={isModelLoaded}
                requiredPPE={requiredPPE}
                confidenceThreshold={confidenceThreshold}
                onRecordViolation={handleRecordViolation}
              />
            )}

            {activeTab === 'history' && (
              <ViolationHistoryView
                violations={violations}
                onClearHistory={handleClearHistory}
                onDeleteViolation={handleDeleteViolation}
              />
            )}

            {activeTab === 'model' && (
              <ModelInfoView
                isModelLoaded={isModelLoaded}
                requiredPPE={requiredPPE}
                onToggleRequiredPPE={handleToggleRequiredPPE}
                confidenceThreshold={confidenceThreshold}
                onConfidenceChange={setConfidenceThreshold}
                onSetModelLoaded={setIsModelLoaded}
              />
            )}

            {activeTab === 'about' && <AboutView />}
          </div>
        </main>
      </div>
    </div>
  );
}
