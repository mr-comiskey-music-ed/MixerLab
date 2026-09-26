import React, { useState } from 'react';
import { ChannelSettings, MasterSettings, SerializedMixerState } from '../types/audio';

interface GradeReportProps {
  channels: ChannelSettings[];
  master: MasterSettings;
  scenariosCompleted: Record<number, number>;
  drillHighScore: number;
  drillBestReactionMs: number;
  matchScore: number;
  learnCompleted: boolean;
  onLoadStudentMix: (loadedChannels: ChannelSettings[], loadedMaster: MasterSettings) => void;
}

interface VerifiedStudentRow {
  studentName: string;
  period: string;
  totalPercentage: number;
  scenariosCount: number;
  drillScore: number;
  drillReactionMs: number;
  matchScore: number;
  learnCompleted: boolean;
  timestamp: string;
  isValid: boolean;
  serializedData: SerializedMixerState;
}

export function fnv1aHash(str: string, salt: string = "AudioEng2026Salt"): string {
  let hash = 0x811c9dc5;
  const combined = salt + str;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export const GradeReport: React.FC<GradeReportProps> = ({
  channels,
  master,
  scenariosCompleted,
  drillHighScore,
  drillBestReactionMs,
  matchScore,
  learnCompleted,
  onLoadStudentMix
}) => {
  const [studentName, setStudentName] = useState<string>('');
  const [periodId, setPeriodId] = useState<string>('');
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Teacher batch verifier state
  const [batchInput, setBatchInput] = useState<string>('');
  const [verifiedStudents, setVerifiedStudents] = useState<VerifiedStudentRow[]>([]);
  const [sortField, setSortField] = useState<keyof VerifiedStudentRow>('totalPercentage');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Full Report Modal State
  const [activeReportData, setActiveReportData] = useState<{
    studentName: string;
    period: string;
    timestamp: string;
    isValid: boolean;
    scores: {
      scenarios: Record<number, number>;
      drillScore: number;
      drillReactionMs: number;
      matchScore: number;
      learnCompleted: boolean;
      totalPercentage: number;
    };
    mixerState?: {
      channels: ChannelSettings[];
      master: MasterSettings;
    };
  } | null>(null);
  const [copiedReportText, setCopiedReportText] = useState<boolean>(false);

  // Calculate composite score (out of 100%) - Scenarios 40%, Drill 20%, Match 20%, Learn Academy 20%
  const totalScenarios = 8;
  const scenarioPoints = Object.values(scenariosCompleted).reduce((a, b) => a + b, 0);
  const scenarioPct = (scenarioPoints / (totalScenarios * 100)) * 100; // max 100
  const drillPct = Math.min(100, (drillHighScore / 400) * 100);
  const learnPct = learnCompleted ? 100 : 0;
  const compositeGrade = Math.round(scenarioPct * 0.4 + drillPct * 0.2 + matchScore * 0.2 + learnPct * 0.2);

  const handleGenerateCode = () => {
    if (!studentName.trim() || !periodId.trim()) {
      alert("Please enter Student Full Name and Period/ID before generating report.");
      return;
    }

    const payload: SerializedMixerState = {
      version: "2026.1",
      timestamp: new Date().toISOString(),
      student: {
        name: studentName.trim(),
        period: periodId.trim()
      },
      scores: {
        scenarios: scenariosCompleted,
        drillScore: drillHighScore,
        drillReactionMs: drillBestReactionMs,
        matchScore: matchScore,
        learnCompleted: learnCompleted,
        totalPercentage: compositeGrade
      },
      mixerState: {
        channels,
        master
      }
    };

    const jsonStr = JSON.stringify(payload);
    const checksum = fnv1aHash(jsonStr);
    const packaged = JSON.stringify({ d: jsonStr, h: checksum });
    const b64 = btoa(unescape(encodeURIComponent(packaged)));

    setGeneratedCode(b64);
  };

  const handleCopy = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Teacher Batch Verifier
  const handleVerifyBatch = () => {
    const lines = batchInput.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const results: VerifiedStudentRow[] = [];

    lines.forEach((line) => {
      try {
        const decodedStr = decodeURIComponent(escape(atob(line)));
        const envelope = JSON.parse(decodedStr);
        const dataStr = envelope.d;
        const providedHash = envelope.h;
        const calculatedHash = fnv1aHash(dataStr);
        const isValid = providedHash === calculatedHash;

        const payload: SerializedMixerState = JSON.parse(dataStr);

        results.push({
          studentName: payload.student.name,
          period: payload.student.period,
          totalPercentage: payload.scores.totalPercentage,
          scenariosCount: Object.keys(payload.scores.scenarios).length,
          drillScore: payload.scores.drillScore,
          drillReactionMs: payload.scores.drillReactionMs,
          matchScore: payload.scores.matchScore,
          learnCompleted: Boolean(payload.scores.learnCompleted),
          timestamp: new Date(payload.timestamp).toLocaleString(),
          isValid,
          serializedData: payload
        });
      } catch {
        results.push({
          studentName: "Corrupted Record",
          period: "N/A",
          totalPercentage: 0,
          scenariosCount: 0,
          drillScore: 0,
          drillReactionMs: 0,
          matchScore: 0,
          learnCompleted: false,
          timestamp: "Invalid",
          isValid: false,
          serializedData: {} as SerializedMixerState
        });
      }
    });

    setVerifiedStudents(results);
  };

  const handleSort = (field: keyof VerifiedStudentRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedStudents = [...verifiedStudents].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortAsc ? valA - valB : valB - valA;
    }
    return sortAsc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
  });

  const handleExportCSV = () => {
    if (verifiedStudents.length === 0) return;
    const headers = [
      "Student Name",
      "Period/ID",
      "Total Grade %",
      "Scenarios Completed",
      "Drill High Score",
      "Avg Reaction (ms)",
      "Match Mix %",
      "Learn Academy",
      "Verified Status",
      "Submission Date"
    ];

    const rows = verifiedStudents.map(s => [
      `"${s.studentName}"`,
      `"${s.period}"`,
      s.totalPercentage,
      s.scenariosCount,
      s.drillScore,
      s.drillReactionMs,
      s.matchScore,
      s.learnCompleted ? "COMPLETED" : "INCOMPLETE",
      s.isValid ? "VERIFIED" : "TAMPERED / CORRUPTED",
      `"${s.timestamp}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `profx_audio_lab_grades_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 pb-8">
      {/* SECTION 1: STUDENT GRADE REPORT */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col gap-5">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex flex-col">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase">
              STUDENT ASSESSMENT DISCLOSURE
            </span>
            <h2 className="text-xl font-bold text-zinc-100 mt-0.5">
              LAB GRADE REPORT & ANTI-TAMPER EXPORT
            </h2>
          </div>
          <span className="text-2xl font-mono font-extrabold text-emerald-400">
            {compositeGrade}% GRADE
          </span>
        </div>

        {/* Student Information Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-mono text-zinc-400 font-semibold uppercase">
              Student Full Name
            </label>
            <input
              type="text"
              placeholder="e.g. Alex Rivera"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-mono text-zinc-400 font-semibold uppercase">
              Class Period / Student ID
            </label>
            <input
              type="text"
              placeholder="e.g. Period 4 (ID: 84920)"
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
        </div>

        {/* Real-time Performance Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-zinc-950 p-4 rounded-lg border border-zinc-850 text-xs font-mono">
          <div>
            <span className="text-zinc-500">Scenarios Completed:</span>
            <div className="text-sm font-bold text-zinc-200 mt-1">
              {Object.keys(scenariosCompleted).length} / {totalScenarios} ({scenarioPoints} pts)
            </div>
          </div>
          <div>
            <span className="text-zinc-500">Emergency Drill:</span>
            <div className="text-sm font-bold text-zinc-200 mt-1">
              {drillHighScore} pts {drillBestReactionMs > 0 ? `(${drillBestReactionMs}ms avg)` : ''}
            </div>
          </div>
          <div>
            <span className="text-zinc-500">Match the Mix Accuracy:</span>
            <div className="text-sm font-bold text-zinc-200 mt-1">
              {matchScore}% Accuracy
            </div>
          </div>
          <div>
            <span className="text-zinc-500">Mixer Academy (Learn):</span>
            <div className="text-sm font-bold mt-1">
              {learnCompleted ? (
                <span className="text-emerald-400">✓ COMPLETED</span>
              ) : (
                <span className="text-amber-400">INCOMPLETE</span>
              )}
            </div>
          </div>
        </div>

        {/* Generate Encoded Base64 Code Button & Full Report Preview */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleGenerateCode}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono font-bold text-xs rounded-lg shadow-lg border border-emerald-400/50 transition-all"
          >
            GENERATE ANTI-TAMPER SUBMISSION CODE
          </button>
          <button
            onClick={() => setActiveReportData({
              studentName: studentName || 'Current Student',
              period: periodId || 'Active Session',
              timestamp: new Date().toISOString(),
              isValid: true,
              scores: {
                scenarios: scenariosCompleted,
                drillScore: drillHighScore,
                drillReactionMs: drillBestReactionMs,
                matchScore: matchScore,
                learnCompleted: learnCompleted,
                totalPercentage: compositeGrade
              },
              mixerState: { channels, master }
            })}
            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-750 text-cyan-400 font-mono font-bold text-xs rounded-lg border border-cyan-800/60 transition-all flex items-center gap-1.5"
          >
            <span>📄</span>
            <span>VIEW FULL ACTION REPORT</span>
          </button>
        </div>

        {/* Generated Code Area */}
        {generatedCode && (
          <div className="flex flex-col gap-2 bg-zinc-950 p-4 rounded-lg border border-emerald-500/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-emerald-400 font-bold">
                ✓ VERIFIED BASE64 SUBMISSION CODE (INCLUDES CHECKSUM + COMPLETE MIXER STATE)
              </span>
              <button
                onClick={handleCopy}
                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono rounded border border-zinc-700 transition-colors"
              >
                {copied ? 'COPIED TO CLIPBOARD!' : 'COPY CODE'}
              </button>
            </div>
            <textarea
              readOnly
              value={generatedCode}
              rows={3}
              className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-[10px] font-mono text-zinc-400 break-all select-all resize-none focus:outline-none"
            />
            <span className="text-[10px] font-mono text-zinc-500">
              Submit this code to your instructor. It contains an FNV-1a checksum salted with "AudioEng2026Salt" to verify authenticity.
            </span>
          </div>
        )}
      </div>

      {/* SECTION 2: TEACHER BATCH VERIFIER & CSV EXPORT */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col gap-5">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex flex-col">
            <span className="text-xs font-mono font-bold text-purple-400 uppercase">
              INSTRUCTOR GRADING DESK
            </span>
            <h2 className="text-xl font-bold text-zinc-100 mt-0.5">
              TEACHER BATCH VERIFIER & CSV EXPORT
            </h2>
          </div>
          {verifiedStudents.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-emerald-400 font-mono font-bold text-xs rounded-lg border border-emerald-700/60 transition-colors"
            >
              EXPORT CSV (GOOGLE SHEETS)
            </button>
          )}
        </div>

        {/* Batch Paste Textarea */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-mono text-zinc-400">
            Paste 1 to 35+ Student Base64 submission codes below (one per line):
          </label>
          <textarea
            value={batchInput}
            onChange={(e) => setBatchInput(e.target.value)}
            rows={4}
            placeholder="Paste student submission codes here..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-200 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={handleVerifyBatch}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-mono font-bold text-xs rounded-lg border border-purple-400/50 transition-all self-start"
          >
            VERIFY & PROCESS ALL CODES
          </button>
        </div>

        {/* Results Table */}
        {verifiedStudents.length > 0 && (
          <div className="overflow-x-auto border border-zinc-800 rounded-lg">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                  <th onClick={() => handleSort('studentName')} className="p-3 cursor-pointer hover:text-white">
                    Student Name
                  </th>
                  <th onClick={() => handleSort('period')} className="p-3 cursor-pointer hover:text-white">
                    Period
                  </th>
                  <th onClick={() => handleSort('totalPercentage')} className="p-3 cursor-pointer hover:text-white">
                    Total Grade
                  </th>
                  <th onClick={() => handleSort('scenariosCount')} className="p-3 cursor-pointer hover:text-white">
                    Scenarios
                  </th>
                  <th onClick={() => handleSort('drillScore')} className="p-3 cursor-pointer hover:text-white">
                    Drill
                  </th>
                  <th onClick={() => handleSort('matchScore')} className="p-3 cursor-pointer hover:text-white">
                    Match
                  </th>
                  <th onClick={() => handleSort('learnCompleted')} className="p-3 cursor-pointer hover:text-white">
                    Learn
                  </th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                  <th className="p-3">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {sortedStudents.map((s, idx) => (
                  <tr key={idx} className="hover:bg-zinc-850/50">
                    <td className="p-3 font-semibold text-zinc-100">{s.studentName}</td>
                    <td className="p-3 text-zinc-400">{s.period}</td>
                    <td className="p-3 font-bold text-emerald-400">{s.totalPercentage}%</td>
                    <td className="p-3 text-zinc-300">{s.scenariosCount} / 8</td>
                    <td className="p-3 text-zinc-300">{s.drillScore} pts</td>
                    <td className="p-3 text-zinc-300">{s.matchScore}%</td>
                    <td className="p-3 text-zinc-300">
                      {s.learnCompleted ? <span className="text-emerald-400">✓ Done</span> : <span className="text-amber-400">Incomplete</span>}
                    </td>
                    <td className="p-3">
                      {s.isValid ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800">
                          VERIFIED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-rose-950 text-rose-400 border border-rose-800">
                          TAMPERED
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {s.isValid && s.serializedData.mixerState ? (
                        <button
                          onClick={() => onLoadStudentMix(s.serializedData.mixerState.channels, s.serializedData.mixerState.master)}
                          className="px-2.5 py-1 bg-zinc-800 hover:bg-cyan-950 hover:text-cyan-400 text-zinc-300 rounded text-[10px] font-bold border border-zinc-700 transition-colors"
                          title="Load this student's actual mixer settings into the audio console to listen"
                        >
                          LOAD MIX
                        </button>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => setActiveReportData({
                          studentName: s.studentName,
                          period: s.period,
                          timestamp: s.timestamp,
                          isValid: s.isValid,
                          scores: s.serializedData.scores,
                          mixerState: s.serializedData.mixerState
                        })}
                        className="px-2.5 py-1 bg-purple-900/60 hover:bg-purple-800 text-purple-300 rounded text-[10px] font-bold border border-purple-600 transition-colors flex items-center gap-1 shadow-sm"
                        title="View comprehensive student action audit and console settings report"
                      >
                        <span>📋</span>
                        <span>FULL REPORT</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* POPUP MODAL: COMPREHENSIVE STUDENT ACTION AUDIT REPORT */}
      {activeReportData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-4xl w-full p-5 sm:p-7 shadow-2xl flex flex-col gap-5 max-h-[92vh] overflow-y-auto text-zinc-100 font-sans">
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 pb-4 gap-3">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-600">
                    INSTRUCTOR VERIFICATION DOSSIER
                  </span>
                  {activeReportData.isValid ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-700">
                      ✓ FNV-1a HASH VERIFIED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950 text-rose-400 border border-rose-700">
                      ⚠ UNVERIFIED / TAMPERED
                    </span>
                  )}
                </div>
                <h3 className="text-xl sm:text-2xl font-bold font-mono text-zinc-100 mt-1">
                  {activeReportData.studentName}
                </h3>
                <span className="text-xs font-mono text-zinc-400">
                  {activeReportData.period} · Submitted: {new Date(activeReportData.timestamp).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-xs font-mono text-zinc-400">COMPOSITE GRADE</span>
                  <span className="text-3xl font-mono font-extrabold text-emerald-400">
                    {activeReportData.scores.totalPercentage}%
                  </span>
                </div>
                <button
                  onClick={() => setActiveReportData(null)}
                  className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono font-bold flex items-center justify-center border border-zinc-700 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Performance Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800">
                <span className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">
                  MODULE 1: SCENARIOS
                </span>
                <div className="text-lg font-mono font-bold text-cyan-400 mt-1">
                  {Object.keys(activeReportData.scores.scenarios).length} / 8 Passed
                </div>
                <span className="text-[11px] font-mono text-zinc-500">
                  {Object.values(activeReportData.scores.scenarios).reduce((a, b) => a + b, 0)} Total Points
                </span>
              </div>

              <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800">
                <span className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">
                  MODULE 2: EMERGENCY DRILL
                </span>
                <div className="text-lg font-mono font-bold text-rose-400 mt-1">
                  {activeReportData.scores.drillScore} Points
                </div>
                <span className="text-[11px] font-mono text-zinc-500">
                  {activeReportData.scores.drillReactionMs > 0
                    ? `${(activeReportData.scores.drillReactionMs / 1000).toFixed(2)}s avg reaction`
                    : 'Not completed'}
                </span>
              </div>

              <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800">
                <span className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">
                  MODULE 3: MATCH THE MIX
                </span>
                <div className="text-lg font-mono font-bold text-amber-400 mt-1">
                  {activeReportData.scores.matchScore}% Accuracy
                </div>
                <span className="text-[11px] font-mono text-zinc-500">
                  Critical listening spectral curve
                </span>
              </div>
            </div>

            {/* Section A: Scenarios Detail Breakdown */}
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wide">
                Detailed Scenarios Action Log:
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                {[
                  { id: 1, title: 'Vocal Condenser Mic (+48V Phantom)' },
                  { id: 2, title: 'Passive Electric Bass (Hi-Z Impedance)' },
                  { id: 3, title: 'Preamp Gain Staging (Kick/Snare Clipping)' },
                  { id: 4, title: 'Muddy Low End (Bass Low EQ Taper)' },
                  { id: 5, title: 'Aux (Mon) Foldback Monitor Wedge' },
                  { id: 6, title: 'Master FOH Overload (Gain Structure)' },
                  { id: 7, title: 'Stage Acoustic Feedback Loop (Ch 3 Vocal)' },
                  { id: 8, title: 'PFL Solo Audition (Pre-Fade Listen)' }
                ].map((sc) => {
                  const pts = activeReportData.scores.scenarios[sc.id];
                  const passed = pts !== undefined && pts > 0;

                  return (
                    <div
                      key={sc.id}
                      className={`p-2.5 rounded-lg border flex items-center justify-between ${
                        passed
                          ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{passed ? '✓' : '○'}</span>
                        <span className="text-[11px]">#{sc.id} {sc.title}</span>
                      </div>
                      <span className="font-bold text-[11px]">
                        {passed ? `${pts} PTS` : 'INCOMPLETE'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section B: Detailed Console Parameter Audit */}
            {activeReportData.mixerState && (
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-mono font-bold text-purple-400 uppercase tracking-wide">
                  Console Parameters &amp; Mix Settings Audit:
                </h4>
                <div className="overflow-x-auto border border-zinc-800 rounded-lg">
                  <table className="w-full text-left text-[11px] font-mono border-collapse">
                    <thead>
                      <tr className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                        <th className="p-2">Channel</th>
                        <th className="p-2">Gain</th>
                        <th className="p-2">+48V</th>
                        <th className="p-2">Hi-Z</th>
                        <th className="p-2">HPF</th>
                        <th className="p-2">Low</th>
                        <th className="p-2">Mid</th>
                        <th className="p-2">High</th>
                        <th className="p-2">Aux (Mon)</th>
                        <th className="p-2">FX</th>
                        <th className="p-2">Pan</th>
                        <th className="p-2">Fader</th>
                        <th className="p-2">Mute</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850">
                      {activeReportData.mixerState.channels.map((c) => (
                        <tr key={c.id} className="hover:bg-zinc-850/50">
                          <td className="p-2 font-bold text-zinc-200">
                            Ch {c.id} ({c.name})
                          </td>
                          <td className="p-2 text-zinc-300">+{c.gain}dB</td>
                          <td className="p-2">{c.phantom48V ? <span className="text-red-400 font-bold">ON</span> : <span className="text-zinc-600">OFF</span>}</td>
                          <td className="p-2">{c.hiZ ? <span className="text-cyan-400 font-bold">ON</span> : <span className="text-zinc-600">OFF</span>}</td>
                          <td className="p-2">{c.lowCut100Hz ? <span className="text-amber-400 font-bold">ON</span> : <span className="text-zinc-600">OFF</span>}</td>
                          <td className="p-2 text-zinc-300">{c.eqLow > 0 ? `+${c.eqLow}` : c.eqLow}dB</td>
                          <td className="p-2 text-zinc-300">{c.eqMid > 0 ? `+${c.eqMid}` : c.eqMid}dB</td>
                          <td className="p-2 text-zinc-300">{c.eqHigh > 0 ? `+${c.eqHigh}` : c.eqHigh}dB</td>
                          <td className="p-2 text-zinc-300">{c.aux1Pre <= -59 ? '-∞' : `${c.aux1Pre}dB`}</td>
                          <td className="p-2 text-zinc-300">{c.fxPost <= -59 ? '-∞' : `${c.fxPost}dB`}</td>
                          <td className="p-2 text-zinc-300">
                            {c.pan === 0 ? 'C' : c.pan < 0 ? `L${Math.round(Math.abs(c.pan) * 100)}` : `R${Math.round(c.pan * 100)}`}
                          </td>
                          <td className="p-2 font-bold text-zinc-100">
                            {c.faderLevel <= -59 ? '-∞' : `${c.faderLevel > 0 ? '+' : ''}${c.faderLevel.toFixed(1)}dB`}
                          </td>
                          <td className="p-2">{c.mute ? <span className="text-rose-400 font-bold">MUTED</span> : <span className="text-emerald-400">LIVE</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Master Bus Audit */}
                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 text-xs font-mono flex flex-wrap items-center justify-between gap-3 text-zinc-300">
                  <span><strong>Main Master Fader:</strong> {activeReportData.mixerState.master.mainFader.toFixed(1)} dB</span>
                  <span><strong>Aux (Mon) Master:</strong> {activeReportData.mixerState.master.aux1Master.toFixed(1)} dB</span>
                  <span><strong>FX Return:</strong> {activeReportData.mixerState.master.fxReturn.toFixed(1)} dB ({activeReportData.mixerState.master.fxType})</span>
                  <span><strong>FX Mute:</strong> {activeReportData.mixerState.master.fxMute ? 'MUTED' : 'ACTIVE'}</span>
                  <span><strong>Phones:</strong> {activeReportData.mixerState.master.phonesLevel}%</span>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800">
              <div className="flex items-center gap-2">
                {activeReportData.mixerState && (
                  <button
                    onClick={() => {
                      if (activeReportData.mixerState) {
                        onLoadStudentMix(activeReportData.mixerState.channels, activeReportData.mixerState.master);
                        setActiveReportData(null);
                      }
                    }}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-zinc-950 font-mono font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <span>🎛</span>
                    <span>AUDITION IN MIX CONSOLE</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    const text = `PROFX AUDIO LAB REPORT: ${activeReportData.studentName} (${activeReportData.period})\n` +
                      `Timestamp: ${activeReportData.timestamp}\n` +
                      `Composite Grade: ${activeReportData.scores.totalPercentage}%\n` +
                      `Scenarios: ${Object.keys(activeReportData.scores.scenarios).length}/8\n` +
                      `Drill Score: ${activeReportData.scores.drillScore} pts\n` +
                      `Match The Mix: ${activeReportData.scores.matchScore}%\n` +
                      `FNV-1a Hash Status: ${activeReportData.isValid ? 'VERIFIED' : 'TAMPERED'}\n`;
                    navigator.clipboard.writeText(text);
                    setCopiedReportText(true);
                    setTimeout(() => setCopiedReportText(false), 2000);
                  }}
                  className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-mono text-xs rounded-lg border border-zinc-700 transition-colors"
                >
                  {copiedReportText ? '✓ COPIED TEXT' : 'COPY TEXT SUMMARY'}
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-mono text-xs rounded-lg border border-zinc-700 transition-colors"
                >
                  PRINT / SAVE PDF
                </button>
              </div>

              <button
                onClick={() => setActiveReportData(null)}
                className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono font-bold text-xs rounded-lg transition-colors"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
