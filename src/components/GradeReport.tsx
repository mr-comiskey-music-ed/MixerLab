import React, { useState } from 'react';
import { ChannelSettings, MasterSettings, MyMix, StudentSubmission } from '../types/audio';
import { SCENARIOS } from './ScenarioChallenges';
import { REFERENCE_PROFILES } from './MatchTheMix';
import { WHAT_CHANGED_QUESTIONS } from './WhatChanged';
import { MY_MIX_MIN_WORDS } from './MyMix';
import { BUILTIN_SONGS } from '../audio/stemSynthesizer';
import { encodeSubmission, decodeSubmission } from '../utils/submissionCodec';

interface GradeReportProps {
  scenariosCompleted: Record<number, number>;
  whatChangedBest: number;
  matchScores: Record<string, number>;
  learnCompleted: boolean;
  myMix: MyMix | null;
  onListenToMix: (mix: MyMix) => void;
}

interface VerifiedRow {
  submission: StudentSubmission | null; // null = unreadable code
  isValid: boolean;
  rawCode: string;
}

const TOTAL_SCENARIOS = SCENARIOS.length;
const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

/** Average of the best score on every reference mix (references not attempted count as 0). */
export function matchAverage(matchScores: Record<string, number>): number {
  if (matchScores.legacy !== undefined) return matchScores.legacy; // older codes stored a single score
  if (REFERENCE_PROFILES.length === 0) return 0;
  const sum = REFERENCE_PROFILES.reduce((acc, p) => acc + (matchScores[p.id] || 0), 0);
  return Math.round(sum / REFERENCE_PROFILES.length);
}

/**
 * Composite grade (auto-scored parts only):
 * Scenarios 40% · What Changed? 20% · Match the Mix 20% · Mixer Academy 20%.
 * My Mix is creative work for the teacher to listen to and grade separately.
 */
export function computeComposite(
  scenarios: Record<number, number>,
  whatChanged: number,
  matchScores: Record<string, number>,
  learnCompleted: boolean
): number {
  const scenarioPoints = Object.values(scenarios).reduce((a, b) => a + b, 0);
  const scenarioPct = (scenarioPoints / (TOTAL_SCENARIOS * 100)) * 100;
  const drillPct = (whatChanged / WHAT_CHANGED_QUESTIONS) * 100;
  const learnPct = learnCompleted ? 100 : 0;
  return Math.round(scenarioPct * 0.4 + drillPct * 0.2 + matchAverage(matchScores) * 0.2 + learnPct * 0.2);
}

const fmtDb = (v: number) => (v <= -59 ? '-∞' : `${v > 0 ? '+' : ''}${Number(v.toFixed(1))}`);
const fmtPan = (p: number) => (Math.abs(p) < 0.005 ? 'C' : p < 0 ? `L${Math.round(Math.abs(p) * 100)}` : `R${Math.round(p * 100)}`);
const songTitle = (id: string) => BUILTIN_SONGS.find((s) => s.id === id)?.title || id;

export const GradeReport: React.FC<GradeReportProps> = ({
  scenariosCompleted,
  whatChangedBest,
  matchScores,
  learnCompleted,
  myMix,
  onListenToMix
}) => {
  const [studentName, setStudentName] = useState<string>('');
  const [periodId, setPeriodId] = useState<string>('');
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [codeError, setCodeError] = useState<string>('');

  // Teacher batch verifier state
  const [batchInput, setBatchInput] = useState<string>('');
  const [rows, setRows] = useState<VerifiedRow[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'period' | 'total' | 'scenarios' | 'drill' | 'match' | 'mymix'>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Full report modal: either the student's own preview or a row from the batch
  const [reportIndex, setReportIndex] = useState<number | null>(null);
  const [previewSubmission, setPreviewSubmission] = useState<StudentSubmission | null>(null);
  const [copiedReportText, setCopiedReportText] = useState<boolean>(false);

  const compositeGrade = computeComposite(scenariosCompleted, whatChangedBest, matchScores, learnCompleted);
  const scenarioPoints = Object.values(scenariosCompleted).reduce((a, b) => a + b, 0);
  const myMixWords = myMix ? countWords(myMix.explanation) : 0;

  const buildMySubmission = (): StudentSubmission => ({
    timestamp: new Date().toISOString(),
    student: { name: studentName.trim(), period: periodId.trim() },
    scores: {
      scenarios: scenariosCompleted,
      whatChanged: whatChangedBest,
      matchScores,
      learnCompleted,
      totalPercentage: compositeGrade
    },
    myMix: myMix || undefined
  });

  const handleGenerateCode = async () => {
    if (!studentName.trim() || !periodId.trim()) {
      setCodeError('Enter your name and class period first.');
      return;
    }
    setCodeError('');
    setGeneratedCode(await encodeSubmission(buildMySubmission()));
    setCopied(false);
  };

  const handleCopy = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ---------- Teacher batch ----------
  const handleVerifyBatch = async () => {
    const lines = batchInput.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    setIsVerifying(true);
    const results = await Promise.all(
      lines.map(async (line): Promise<VerifiedRow> => {
        const decoded = await decodeSubmission(line);
        return decoded
          ? { submission: decoded.submission, isValid: decoded.isValid, rawCode: line }
          : { submission: null, isValid: false, rawCode: line };
      })
    );
    setRows(results);
    setIsVerifying(false);
  };

  const sortValue = (r: VerifiedRow): string | number => {
    const s = r.submission;
    if (!s) return sortAsc ? '￿' : '';
    switch (sortField) {
      case 'name': return s.student.name.toLowerCase();
      case 'period': return s.student.period.toLowerCase();
      case 'total': return s.scores.totalPercentage;
      case 'scenarios': return Object.keys(s.scores.scenarios).length;
      case 'drill': return s.scores.whatChanged;
      case 'match': return matchAverage(s.scores.matchScores);
      case 'mymix': return s.myMix ? countWords(s.myMix.explanation) : -1;
    }
  };

  const sortedRows = [...rows].sort((a, b) => {
    const va = sortValue(a);
    const vb = sortValue(b);
    const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
    return sortAsc ? cmp : -cmp;
  });
  const readableRows = sortedRows.filter((r) => r.submission);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(field === 'name' || field === 'period');
    }
  };

  const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const handleExportCSV = () => {
    if (readableRows.length === 0) return;
    const headers = [
      'Student Name', 'Period', 'Auto Grade %', 'Scenarios Passed', 'Scenario Points',
      'What Changed (of 8)', 'Match the Mix Avg %', 'Mixer Academy', 'My Mix Song', 'My Mix Explanation',
      'Checksum', 'Submitted'
    ];
    const lines = readableRows.map(({ submission: s, isValid }) => {
      const sc = s!.scores;
      return [
        csvCell(s!.student.name),
        csvCell(s!.student.period),
        sc.totalPercentage,
        Object.values(sc.scenarios).filter((p) => p > 0).length,
        Object.values(sc.scenarios).reduce((a, b) => a + b, 0),
        s!.legacy ? csvCell('n/a (old code)') : sc.whatChanged,
        matchAverage(sc.matchScores),
        sc.learnCompleted ? 'COMPLETED' : 'INCOMPLETE',
        csvCell(s!.myMix ? songTitle(s!.myMix.songId) : ''),
        csvCell(s!.myMix?.explanation || ''),
        isValid ? 'VERIFIED' : 'EDITED / DAMAGED',
        csvCell(new Date(s!.timestamp).toLocaleString())
      ].join(',');
    });
    const blob = new Blob([[headers.map(csvCell).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mixerlab_grades_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ---------- Report modal ----------
  const reportRow = reportIndex !== null ? readableRows[reportIndex] : null;
  const report: StudentSubmission | null = previewSubmission || reportRow?.submission || null;
  const reportValid = previewSubmission ? true : reportRow?.isValid ?? false;
  const closeReport = () => {
    setReportIndex(null);
    setPreviewSubmission(null);
  };

  const sortHeader = (field: typeof sortField, label: string) => (
    <th onClick={() => handleSort(field)} className="p-3 cursor-pointer hover:text-white whitespace-nowrap">
      {label} {sortField === field ? (sortAsc ? '▲' : '▼') : ''}
    </th>
  );

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 pb-8">
      {/* SECTION 1: STUDENT GRADE REPORT */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6 shadow-xl flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
          <div className="flex flex-col">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase">STUDENT SUBMISSION</span>
            <h2 className="text-xl font-bold text-zinc-100 mt-0.5">MY GRADE REPORT</h2>
          </div>
          <span className="text-2xl font-mono font-extrabold text-emerald-400">{compositeGrade}%</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-mono text-zinc-400 font-semibold uppercase">Your Name</label>
            <input
              type="text"
              placeholder="e.g. Alex R."
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-cyan-500 font-mono select-text"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-mono text-zinc-400 font-semibold uppercase">Class Period</label>
            <input
              type="text"
              placeholder="e.g. Period 4"
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-cyan-500 font-mono select-text"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 bg-zinc-950 p-4 rounded-lg border border-zinc-850 text-xs font-mono">
          <div>
            <span className="text-zinc-500">Scenarios:</span>
            <div className="text-sm font-bold text-zinc-200 mt-1">
              {Object.values(scenariosCompleted).filter((p) => p > 0).length} / {TOTAL_SCENARIOS} ({scenarioPoints} pts)
            </div>
          </div>
          <div>
            <span className="text-zinc-500">What Changed?:</span>
            <div className="text-sm font-bold text-zinc-200 mt-1">
              {whatChangedBest} / {WHAT_CHANGED_QUESTIONS} best
            </div>
          </div>
          <div>
            <span className="text-zinc-500">Match the Mix:</span>
            <div className="text-sm font-bold text-zinc-200 mt-1">{matchAverage(matchScores)}% avg</div>
          </div>
          <div>
            <span className="text-zinc-500">Mixer Academy:</span>
            <div className="text-sm font-bold mt-1">
              {learnCompleted ? <span className="text-emerald-400">✓ DONE</span> : <span className="text-amber-400">INCOMPLETE</span>}
            </div>
          </div>
          <div>
            <span className="text-zinc-500">My Mix:</span>
            <div className="text-sm font-bold mt-1">
              {myMix ? (
                <span className={myMixWords >= MY_MIX_MIN_WORDS ? 'text-emerald-400' : 'text-amber-400'}>
                  ✓ {myMixWords} words
                </span>
              ) : (
                <span className="text-amber-400">NOT STARTED</span>
              )}
            </div>
          </div>
        </div>
        <p className="text-[11px] font-mono text-zinc-500 -mt-2">
          The % grade covers Scenarios (40%), What Changed? (20%), Match the Mix (20%) and Mixer Academy (20%). Your
          teacher listens to and grades My Mix separately.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleGenerateCode}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono font-bold text-xs rounded-lg shadow-lg border border-emerald-400/50 transition-all"
          >
            GENERATE SUBMISSION CODE
          </button>
          <button
            onClick={() => setPreviewSubmission(buildMySubmission())}
            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-750 text-cyan-400 font-mono font-bold text-xs rounded-lg border border-cyan-800/60 transition-all"
          >
            PREVIEW WHAT MY TEACHER SEES
          </button>
          {codeError && <span className="text-xs font-mono text-amber-400">{codeError}</span>}
        </div>

        {generatedCode && (
          <div className="flex flex-col gap-2 bg-zinc-950 p-4 rounded-lg border border-emerald-500/50">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-emerald-400 font-bold">
                ✓ YOUR SUBMISSION CODE ({generatedCode.length} characters)
              </span>
              <button
                onClick={handleCopy}
                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono rounded border border-zinc-700 transition-colors"
              >
                {copied ? 'COPIED!' : 'COPY CODE'}
              </button>
            </div>
            <textarea
              readOnly
              value={generatedCode}
              rows={3}
              className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-[10px] font-mono text-zinc-400 break-all select-all resize-none focus:outline-none"
            />
            <span className="text-[10px] font-mono text-zinc-500">
              Paste this whole code into your Google Classroom assignment. If you keep working, generate a new code
              before you turn it in.
            </span>
          </div>
        )}
      </div>

      {/* SECTION 2: TEACHER BATCH VERIFIER */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6 shadow-xl flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
          <div className="flex flex-col">
            <span className="text-xs font-mono font-bold text-purple-400 uppercase">TEACHER GRADING DESK</span>
            <h2 className="text-xl font-bold text-zinc-100 mt-0.5">BATCH GRADING & CSV EXPORT</h2>
          </div>
          {readableRows.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-emerald-400 font-mono font-bold text-xs rounded-lg border border-emerald-700/60 transition-colors"
            >
              EXPORT CSV (GOOGLE SHEETS)
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-mono text-zinc-400">Paste the whole class's codes below (one per line):</label>
          <textarea
            value={batchInput}
            onChange={(e) => setBatchInput(e.target.value)}
            rows={4}
            placeholder="ML3d.…"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-200 focus:outline-none focus:border-purple-500 select-text"
          />
          <button
            onClick={handleVerifyBatch}
            disabled={isVerifying}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-mono font-bold text-xs rounded-lg border border-purple-400/50 transition-all self-start"
          >
            {isVerifying ? 'CHECKING…' : 'CHECK ALL CODES'}
          </button>
        </div>

        {rows.length > 0 && (
          <div className="overflow-x-auto border border-zinc-800 rounded-lg">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                  {sortHeader('name', 'Student')}
                  {sortHeader('period', 'Period')}
                  {sortHeader('total', 'Auto %')}
                  {sortHeader('scenarios', 'Scenarios')}
                  {sortHeader('drill', 'What Changed')}
                  {sortHeader('match', 'Match')}
                  <th className="p-3">Learn</th>
                  {sortHeader('mymix', 'My Mix')}
                  <th className="p-3">Code</th>
                  <th className="p-3">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {sortedRows.map((r, idx) => {
                  const s = r.submission;
                  if (!s) {
                    return (
                      <tr key={idx} className="bg-rose-950/10">
                        <td className="p-3 text-rose-300" colSpan={10}>
                          Couldn't read this code: <span className="text-zinc-500">{r.rawCode.slice(0, 40)}…</span> (it may be
                          cut off. Ask the student to copy it again.)
                        </td>
                      </tr>
                    );
                  }
                  const readableIdx = readableRows.indexOf(r);
                  return (
                    <tr key={idx} className="hover:bg-zinc-850/50">
                      <td className="p-3 font-semibold text-zinc-100">{s.student.name}</td>
                      <td className="p-3 text-zinc-400">{s.student.period}</td>
                      <td className="p-3 font-bold text-emerald-400">{s.scores.totalPercentage}%</td>
                      <td className="p-3 text-zinc-300">
                        {Object.values(s.scores.scenarios).filter((p) => p > 0).length} / {TOTAL_SCENARIOS}
                      </td>
                      <td className="p-3 text-zinc-300">
                        {s.legacy ? <span className="text-zinc-600">old code</span> : `${s.scores.whatChanged} / ${WHAT_CHANGED_QUESTIONS}`}
                      </td>
                      <td className="p-3 text-zinc-300">{matchAverage(s.scores.matchScores)}%</td>
                      <td className="p-3">
                        {s.scores.learnCompleted ? <span className="text-emerald-400">✓</span> : <span className="text-amber-400">—</span>}
                      </td>
                      <td className="p-3">
                        {s.myMix ? (
                          <button
                            onClick={() => onListenToMix(s.myMix!)}
                            className="px-2.5 py-1 bg-zinc-800 hover:bg-orange-950 hover:text-orange-300 text-zinc-300 rounded text-[10px] font-bold border border-zinc-700 transition-colors whitespace-nowrap"
                            title="Load this student's mix into the console and listen"
                          >
                            ▶ LISTEN ({countWords(s.myMix.explanation)}w)
                          </button>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        {r.isValid ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800">OK</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-rose-950 text-rose-400 border border-rose-800" title="The checksum doesn't match: this code was edited or damaged">
                            EDITED?
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => setReportIndex(readableIdx)}
                          className="px-2.5 py-1 bg-purple-900/60 hover:bg-purple-800 text-purple-300 rounded text-[10px] font-bold border border-purple-600 transition-colors whitespace-nowrap"
                        >
                          FULL REPORT
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* POPUP MODAL: FULL STUDENT REPORT */}
      {report && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-4xl w-full p-4 sm:p-7 shadow-2xl flex flex-col gap-5 max-h-[92vh] overflow-y-auto text-zinc-100 font-sans">
            <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 pb-4 gap-3">
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-600">
                    {previewSubmission ? 'PREVIEW' : `STUDENT ${reportIndex! + 1} OF ${readableRows.length}`}
                  </span>
                  {reportValid ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-700">✓ CODE OK</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950 text-rose-400 border border-rose-700">⚠ EDITED OR DAMAGED</span>
                  )}
                  {report.legacy && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">OLDER CODE FORMAT</span>
                  )}
                </div>
                <h3 className="text-xl sm:text-2xl font-bold font-mono text-zinc-100 mt-1">{report.student.name || 'Student'}</h3>
                <span className="text-xs font-mono text-zinc-400">
                  {report.student.period} · Submitted {new Date(report.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-mono text-zinc-400">AUTO GRADE</span>
                  <span className="text-3xl font-mono font-extrabold text-emerald-400">{report.scores.totalPercentage}%</span>
                </div>
                <button
                  onClick={closeReport}
                  className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono font-bold flex items-center justify-center border border-zinc-700 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Score cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800">
                <span className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">Scenarios</span>
                <div className="text-lg font-mono font-bold text-cyan-400 mt-1">
                  {Object.values(report.scores.scenarios).filter((p) => p > 0).length} / {TOTAL_SCENARIOS} attempted
                </div>
                <span className="text-[11px] font-mono text-zinc-500">
                  {Object.values(report.scores.scenarios).reduce((a, b) => a + b, 0)} of {TOTAL_SCENARIOS * 100} points
                </span>
              </div>
              <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800">
                <span className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">What Changed?</span>
                <div className="text-lg font-mono font-bold text-fuchsia-400 mt-1">
                  {report.legacy ? 'n/a' : `${report.scores.whatChanged} / ${WHAT_CHANGED_QUESTIONS}`}
                </div>
                <span className="text-[11px] font-mono text-zinc-500">Best set of 8 ear-training questions</span>
              </div>
              <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800">
                <span className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">Match the Mix</span>
                <div className="text-lg font-mono font-bold text-amber-400 mt-1">{matchAverage(report.scores.matchScores)}% avg</div>
                <span className="text-[11px] font-mono text-zinc-500">
                  {REFERENCE_PROFILES.map((p) => `${p.name.split(' ').slice(-2).join(' ')}: ${report.scores.matchScores[p.id] ?? '—'}${report.scores.matchScores[p.id] !== undefined ? '%' : ''}`).join(' · ')}
                </span>
              </div>
            </div>

            {/* Scenario list */}
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wide">Scenarios</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                {SCENARIOS.map((sc) => {
                  const pts = report.scores.scenarios[sc.id];
                  const passed = pts !== undefined && pts >= 100;
                  const tried = pts !== undefined && pts > 0;
                  return (
                    <div
                      key={sc.id}
                      className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                        passed
                          ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                          : tried
                          ? 'bg-amber-950/20 border-amber-800/50 text-amber-300'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      <span className="text-[11px]">
                        {passed ? '✓' : tried ? '◐' : '○'} #{sc.id} {sc.title}
                      </span>
                      <span className="font-bold text-[11px] whitespace-nowrap">{tried ? `${pts} PTS` : '—'}</span>
                    </div>
                  );
                })}
              </div>
              <span className="text-[11px] font-mono text-zinc-500">
                Mixer Academy (Learn): {report.scores.learnCompleted ? '✓ completed' : 'not completed'}
              </span>
            </div>

            {/* My Mix */}
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-mono font-bold text-orange-400 uppercase tracking-wide">My Mix</h4>
              {report.myMix ? (
                <>
                  <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-mono text-zinc-400">
                        Song: <strong className="text-zinc-200">{songTitle(report.myMix.songId)}</strong> ·{' '}
                        {countWords(report.myMix.explanation)} words
                      </span>
                      <button
                        onClick={() => {
                          onListenToMix(report.myMix!);
                          closeReport();
                        }}
                        className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-mono font-bold text-xs rounded-lg transition-colors"
                      >
                        ▶ LISTEN IN CONSOLE
                      </button>
                    </div>
                    <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap select-text">
                      {report.myMix.explanation || <span className="text-zinc-500 italic">No explanation written.</span>}
                    </p>
                  </div>
                  <MixSettingsTable channels={report.myMix.channels} master={report.myMix.master} />
                </>
              ) : (
                <span className="text-xs font-mono text-zinc-500">No My Mix in this submission.</span>
              )}
            </div>

            {/* Modal actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    const sc = report.scores;
                    const text =
                      `MIXERLAB REPORT: ${report.student.name} (${report.student.period})\n` +
                      `Submitted: ${new Date(report.timestamp).toLocaleString()}\n` +
                      `Auto grade: ${sc.totalPercentage}%\n` +
                      `Scenarios: ${Object.values(sc.scenarios).filter((p) => p > 0).length}/${TOTAL_SCENARIOS}\n` +
                      `What Changed?: ${report.legacy ? 'n/a' : `${sc.whatChanged}/${WHAT_CHANGED_QUESTIONS}`}\n` +
                      `Match the Mix: ${matchAverage(sc.matchScores)}%\n` +
                      `Mixer Academy: ${sc.learnCompleted ? 'completed' : 'incomplete'}\n` +
                      (report.myMix ? `My Mix (${songTitle(report.myMix.songId)}): ${report.myMix.explanation}\n` : '') +
                      `Code check: ${reportValid ? 'OK' : 'EDITED OR DAMAGED'}\n`;
                    navigator.clipboard.writeText(text);
                    setCopiedReportText(true);
                    setTimeout(() => setCopiedReportText(false), 2000);
                  }}
                  className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-mono text-xs rounded-lg border border-zinc-700 transition-colors"
                >
                  {copiedReportText ? '✓ COPIED' : 'COPY TEXT SUMMARY'}
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-mono text-xs rounded-lg border border-zinc-700 transition-colors"
                >
                  PRINT / SAVE PDF
                </button>
              </div>
              <div className="flex items-center gap-2">
                {!previewSubmission && reportIndex !== null && (
                  <>
                    <button
                      onClick={() => setReportIndex(Math.max(0, reportIndex - 1))}
                      disabled={reportIndex === 0}
                      className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-200 font-mono font-bold text-xs rounded-lg transition-colors"
                    >
                      ← PREV
                    </button>
                    <button
                      onClick={() => setReportIndex(Math.min(readableRows.length - 1, reportIndex + 1))}
                      disabled={reportIndex >= readableRows.length - 1}
                      className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-200 font-mono font-bold text-xs rounded-lg transition-colors"
                    >
                      NEXT →
                    </button>
                  </>
                )}
                <button
                  onClick={closeReport}
                  className="px-5 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 font-mono font-bold text-xs rounded-lg transition-colors"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MixSettingsTable: React.FC<{ channels: ChannelSettings[]; master: MasterSettings }> = ({ channels, master }) => (
  <>
    <div className="overflow-x-auto border border-zinc-800 rounded-lg">
      <table className="w-full text-left text-[11px] font-mono border-collapse">
        <thead>
          <tr className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
            <th className="p-2">Channel</th>
            <th className="p-2">Gain</th>
            <th className="p-2">HPF</th>
            <th className="p-2">Comp</th>
            <th className="p-2">Low</th>
            <th className="p-2">Mid</th>
            <th className="p-2">High</th>
            <th className="p-2">FX</th>
            <th className="p-2">Pan</th>
            <th className="p-2">Fader</th>
            <th className="p-2">Mute</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {channels.map((c) => (
            <tr key={c.id}>
              <td className="p-2 font-bold text-zinc-200 whitespace-nowrap">
                {c.id}. {c.name}
              </td>
              <td className="p-2 text-zinc-300">{fmtDb(c.gain)}</td>
              <td className="p-2">{c.lowCut100Hz ? <span className="text-emerald-400 font-bold">ON</span> : <span className="text-zinc-600">off</span>}</td>
              <td className="p-2">{c.comp > 0 ? <span className="text-orange-400 font-bold">{Math.round(c.comp)}</span> : <span className="text-zinc-600">off</span>}</td>
              <td className="p-2 text-zinc-300">{fmtDb(c.eqLow)}</td>
              <td className="p-2 text-zinc-300">
                {fmtDb(c.eqMid)}
                {c.eqMid !== 0 && <span className="text-zinc-500"> @{c.eqMidFreq >= 1000 ? `${(c.eqMidFreq / 1000).toFixed(1)}k` : Math.round(c.eqMidFreq)}</span>}
              </td>
              <td className="p-2 text-zinc-300">{fmtDb(c.eqHigh)}</td>
              <td className="p-2 text-zinc-300">{fmtDb(c.fxPost)}</td>
              <td className="p-2 text-zinc-300">{fmtPan(c.pan)}</td>
              <td className="p-2 font-bold text-zinc-100">{fmtDb(c.faderLevel)}</td>
              <td className="p-2">{c.mute ? <span className="text-rose-400 font-bold">MUTED</span> : <span className="text-zinc-600">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 text-[11px] font-mono flex flex-wrap items-center gap-x-5 gap-y-1 text-zinc-300">
      <span>
        <strong>Main fader:</strong> {fmtDb(master.mainFader)} dB
      </span>
      <span>
        <strong>FX:</strong> {master.fxType} · return {fmtDb(master.fxReturn)} dB{master.fxMute ? ' (muted)' : ''}
      </span>
    </div>
  </>
);
