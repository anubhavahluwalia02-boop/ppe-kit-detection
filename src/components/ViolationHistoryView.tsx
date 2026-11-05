import React, { useState } from 'react';
import {
  History,
  Trash2,
  Download,
  Search,
  Filter,
  Eye,
  FileSpreadsheet,
  AlertTriangle,
  X,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { ViolationRecord } from '../types/ppe';

interface ViolationHistoryViewProps {
  violations: ViolationRecord[];
  onClearHistory: () => void;
  onDeleteViolation: (id: string | number) => void;
}

export const ViolationHistoryView: React.FC<ViolationHistoryViewProps> = ({
  violations,
  onClearHistory,
  onDeleteViolation,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [previewEvidence, setPreviewEvidence] = useState<ViolationRecord | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'warning'; message: string } | null>(null);

  // Filter violations
  const filteredViolations = violations.filter((v) => {
    const matchesSearch =
      v.violation_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.missing_ppe.some((m) => m.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (v.details && v.details.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSource = selectedSource === 'all' || v.source === selectedSource;

    return matchesSearch && matchesSource;
  });

  // Helper to safely format values for RFC 4180 CSV
  const formatCSVField = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '""';
    const text = String(val).replace(/"/g, '""');
    return `"${text}"`;
  };

  // Export current violation logs into a CSV format file
  const exportCSV = () => {
    // Export currently filtered violation records (or all records if none filtered)
    const recordsToExport = filteredViolations.length > 0 ? filteredViolations : violations;

    if (recordsToExport.length === 0) {
      setNotification({
        type: 'warning',
        message: 'No violation records available to export.',
      });
      setTimeout(() => setNotification(null), 3500);
      return;
    }

    const headers = [
      'Record ID',
      'Timestamp',
      'Infraction Classification',
      'Missing Mandatory PPE',
      'Confidence Score',
      'Source Channel',
      'Inspection Details',
      'Has Evidence Photo',
    ];

    const rows = recordsToExport.map((v) => [
      v.id,
      formatCSVField(v.timestamp),
      formatCSVField(v.violation_type),
      formatCSVField(v.missing_ppe.join('; ')),
      formatCSVField(`${Math.round(v.confidence * 100)}%`),
      formatCSVField(v.source),
      formatCSVField(v.details || 'Logged safety infraction'),
      formatCSVField(v.evidence_url ? 'Yes' : 'No'),
    ]);

    // Prepend UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility
    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ppe_violations_current_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setNotification({
      type: 'success',
      message: `Exported ${recordsToExport.length} current violation record(s) to CSV file successfully!`,
    });
    setTimeout(() => setNotification(null), 4000);
  };

  // Export to JSON
  const exportJSON = () => {
    const recordsToExport = filteredViolations.length > 0 ? filteredViolations : violations;

    if (recordsToExport.length === 0) {
      setNotification({
        type: 'warning',
        message: 'No violation records available to export.',
      });
      setTimeout(() => setNotification(null), 3500);
      return;
    }

    const jsonString = JSON.stringify(recordsToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ppe_violations_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setNotification({
      type: 'success',
      message: `Exported ${recordsToExport.length} violation record(s) to JSON file!`,
    });
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions Card */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-red-400" />
              Safety Infraction Log & Evidence Vault
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Auditable safety records stored with timestamps, confidence scores, and photographic evidence
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={exportCSV}
              title="Export current violation records into CSV spreadsheet file"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:border-emerald-400 text-xs font-bold transition cursor-pointer shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export CSV</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/25 text-[10px] font-mono text-emerald-200">
                {filteredViolations.length}
              </span>
            </button>
            <button
              onClick={exportJSON}
              title="Export violation logs as JSON"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" /> Export JSON
            </button>
            {violations.length > 0 && (
              <button
                onClick={onClearHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-xs font-semibold transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear All Records
              </button>
            )}
          </div>
        </div>

        {/* Export / Action Notification */}
        {notification && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-center justify-between transition-all ${
              notification.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span className="font-medium">{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Filters & Search */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by violation or missing PPE..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Source:</span>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Channels</option>
                <option value="live_camera">Live Camera Stream</option>
                <option value="image_upload">Image Upload Inspection</option>
                <option value="sample_test">Test Benchmark Fixture</option>
              </select>
            </div>
            <button
              onClick={exportCSV}
              title="Download current logs in CSV format"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-slate-800 hover:border-emerald-500/40 text-xs font-semibold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[11px] tracking-wider">
                <th className="py-3.5 px-4">Record ID</th>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Infraction Classification</th>
                <th className="py-3.5 px-4">Missing Mandatory PPE</th>
                <th className="py-3.5 px-4">Confidence</th>
                <th className="py-3.5 px-4">Source Channel</th>
                <th className="py-3.5 px-4 text-center">Photographic Evidence</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredViolations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <AlertTriangle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    No violation records match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredViolations.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono text-slate-400">#{v.id}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">{v.timestamp}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-red-500/20 text-red-400 border border-red-500/30">
                        {v.violation_type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {v.missing_ppe.map((item, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-200">
                      {Math.round(v.confidence * 100)}%
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-300">
                      {v.source.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {v.evidence_url ? (
                        <button
                          onClick={() => setPreviewEvidence(v)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 font-semibold text-[11px] transition"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Frame
                        </button>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onDeleteViolation(v.id)}
                        title="Delete record"
                        className="p-1.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evidence Snapshot Modal */}
      {previewEvidence && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  Evidence Frame #{previewEvidence.id}
                </h4>
                <p className="text-[11px] text-slate-400">Captured: {previewEvidence.timestamp}</p>
              </div>
              <button
                onClick={() => setPreviewEvidence(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-black flex items-center justify-center">
              <img
                src={previewEvidence.evidence_url}
                alt="Violation Evidence"
                className="max-h-[450px] w-auto object-contain rounded-lg border border-slate-800"
              />
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 text-xs text-slate-300 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">Missing: {previewEvidence.missing_ppe.join(', ')}</p>
                <p className="text-[11px] text-slate-400">{previewEvidence.details || 'Captured via PPE detection feed'}</p>
              </div>
              <span className="font-mono text-emerald-400 font-bold">
                Confidence: {Math.round(previewEvidence.confidence * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
