import React, { useState } from 'react';
import { ChannelSettings, MasterSettings, MyMix, StudentSubmission, EqWizardScores } from '../types/audio';
import { SCENARIOS } from './ScenarioChallenges';
import { BUILTIN_SONGS } from '../audio/stemSynthesizer';
import { summarizeMixChanges } from '../utils/mixChanges';
import { encodeSubmission, decodeSubmission } from '../utils/submissionCodec';
import {
  Assignment, AssignmentItem, ASSIGNMENT_ITEMS, EVERYTHING, assignmentName, buildAssignmentLink,
  computeGrade, isEverything, itemsToLetters, lettersToItems, matchGrade
} from '../utils/assignment';

/** Total grade colour, like a level meter: 0–59% red, 60–84% yellow, 85–100% green. */
const totalGradeColor = (pct: number) => (pct >= 85 ? 'text-green-400' : pct >= 60 ? 'text-yellow-400' : 'text-red-400');

interface GradeReportProps {
  scenariosCompleted: Record<number, number>;
  whatChangedBest: number;
  matchScores: Record<string, number>;
  learnCompleted: boolean;
  myMix: MyMix | null;
  eqScores: EqWizardScores;
  assignment: Assignment;
  onListenToMix: (mix: MyMix) => void;
}

interface VerifiedRow {
  submission: StudentSubmission | null; // null = unreadable code
  isValid: boolean;
  rawCode: string;
}

const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

/** The assignment a submission was graded against (older codes: everything). */
const assignmentOf = (sub: StudentSubmission): Assignment =>
  sub.assignment ? { items: lettersToItems(sub.assignment.letters), title: sub.assignment.title } : EVERYTHING;
const assignmentKey = (sub: StudentSubmission) => (sub.assignment ? `${sub.assignment.letters}|${sub.assignment.title}` : 'all|');

const fmtDb = (v: number) => (v <= -59 ? '-∞' : `${v > 0 ? '+' : ''}${Number(v.toFixed(1))}`);
const fmtPan = (p: number) => (Math.abs(p) < 0.005 ? 'C' : p < 0 ? `L${Math.round(Math.abs(p) * 100)}` : `R${Math.round(p * 100)}`);
const songTitle = (id: string) => BUILTIN_SONGS.find((s) => s.id === id)?.title || id;

export const GradeReport: React.FC<GradeReportProps> = ({
  scenariosCompleted,
  whatChangedBest,
  matchScores,
  learnCompleted,
  myMix,
  eqScores,
  assignment,
  onListenToMix
}) => {
  const [studentName, setStudentName] = useState<string>('');
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [openChanges, setOpenChanges] = useState<number[]>([]); // batch rows with the My Mix change list open
  const [codeError, setCodeError] = useState<string>('');

  // Teacher batch verifier state
  const [batchInput, setBatchInput] = useState<string>('');
  const [rows, setRows] = useState<VerifiedRow[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'assignment' | 'total' | 'scenarios' | 'drill' | 'match' | 'mymix'>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Full report modal: either the student's own preview or a row from the batch
  const [reportIndex, setReportIndex] = useState<number | null>(null);
  const [previewSubmission, setPreviewSubmission] = useState<StudentSubmission | null>(null);
  const [copiedReportText, setCopiedReportText] = useState<boolean>(false);

  const myScores = { scenarios: scenariosCompleted, whatChanged: whatChangedBest, matchScores, learnCompleted, totalPercentage: 0, eqWizard: eqScores };
  const myGrade = computeGrade(myScores, myMix, assignment);
  const compositeGrade = myGrade.total;
  const assigned = (item: AssignmentItem) => assignment.items.includes(item);

  // Teacher: assignment link builder
  const [linkItems, setLinkItems] = useState<AssignmentItem[]>(() => (isEverything(assignment) ? [] : assignment.items));
  const [linkTitle, setLinkTitle] = useState<string>(assignment.title);
  const [linkCopied, setLinkCopied] = useState(false);
  const [teacherDeskOpen, setTeacherDeskOpen] = useState(false);
  const showTeacherDesk = isEverything(assignment) || teacherDeskOpen;
  const assignmentLink = linkItems.length ? buildAssignmentLink({ items: linkItems, title: linkTitle }) : '';

  const buildMySubmission = (): StudentSubmission => ({
    timestamp: new Date().toISOString(),
    student: { name: studentName.trim() },
    scores: {
      scenarios: scenariosCompleted,
      whatChanged: whatChangedBest,
      matchScores,
      learnCompleted,
      totalPercentage: compositeGrade,
      eqWizard: eqScores
    },
    myMix: (assigned('mymix') && myMix) || undefined,
    assignment: { letters: itemsToLetters(assignment.items), title: assignment.title }
  });

  const handleGenerateCode = async () => {
    if (!studentName.trim()) {
      setCodeError('Enter your name first.');
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
      case 'assignment': return assignmentName(assignmentOf(s)).toLowerCase();
      case 'total': return computeGrade(s.scores, s.myMix, assignmentOf(s)).total;
      case 'scenarios': return computeGrade(s.scores, s.myMix, assignmentOf(s)).parts.find((p) => p.id === 'scenarios')?.percent ?? -1;
      case 'drill': return s.scores.whatChanged;
      case 'match': return matchGrade(s.scores.matchScores);
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
  // Codes made from a different assignment link than most of the class get flagged
  const mostCommonAssignment = (() => {
    const counts = new Map<string, number>();
    readableRows.forEach((r) => counts.set(assignmentKey(r.submission!), (counts.get(assignmentKey(r.submission!)) || 0) + 1));
    if (counts.size < 2) return null;
    return [...counts.entries()].sort((x, y) => y[1] - x[1])[0][0];
  })();

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(field === 'name');
    }
  };

  const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const handleExportCSV = () => {
    if (readableRows.length === 0) return;
    const headers = [
      'Student Name', 'Assignment', 'Grade %', 'Scenarios Passed', 'Scenario Points',
      'What Changed (of 8)', 'Match the Mix %', 'Mixer Academy', 'My Mix Song', 'My Mix Explanation',
      'Checksum', 'Submitted'
    ];
    const lines = readableRows.map(({ submission: s, isValid }) => {
      const sc = s!.scores;
      return [
        csvCell(s!.student.name),
        csvCell(assignmentName(assignmentOf(s!))),
        computeGrade(sc, s!.myMix, assignmentOf(s!)).total,
        Object.values(sc.scenarios).filter((p) => p > 0).length,
        Object.values(sc.scenarios).reduce((a, b) => a + b, 0),
        s!.legacy ? csvCell('n/a (old code)') : sc.whatChanged,
        matchGrade(sc.matchScores),
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
  const reportGrade = report ? computeGrade(report.scores, report.myMix, assignmentOf(report)) : null;
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
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase">
              {isEverything(assignment) && !assignment.title ? 'STUDENT SUBMISSION' : `ASSIGNMENT: ${assignmentName(assignment)}`}
            </span>
            <h2 className="text-2xl font-bold text-zinc-100 mt-0.5">MY GRADE REPORT</h2>
          </div>
          <span className={`text-2xl font-mono font-extrabold ${totalGradeColor(compositeGrade)}`}>{compositeGrade}%</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-mono text-zinc-400 font-semibold uppercase">Your Name</label>
            <input
              type="text"
              placeholder="e.g. Alex R."
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-400 font-mono select-text"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 bg-zinc-950 p-4 rounded-lg border border-zinc-800 text-xs font-mono">
          {myGrade.parts.map((part) => (
            <div key={part.id}>
              <span className="text-zinc-500">{part.label}:</span>
              <div className={`text-sm font-bold mt-1 ${part.percent >= 100 ? 'text-emerald-400' : part.percent > 0 ? 'text-zinc-200' : 'text-amber-400'}`}>
                {part.percent}%
              </div>
              <span className="text-[11px] text-zinc-500">{part.detail}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] font-mono text-zinc-500 -mt-2">
          Your grade is an even split across {myGrade.parts.length === 1 ? 'this part' : `these ${myGrade.parts.length} parts`}.
          {assigned('mymix') && ' My Mix counts as done once you write at least 40 words; your teacher will also listen to it.'}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleGenerateCode}
            className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white font-mono font-bold text-xs rounded-lg shadow-lg border border-green-400/50 transition-all"
          >
            GENERATE SUBMISSION CODE
          </button>
          <button
            onClick={() => setPreviewSubmission(buildMySubmission())}
            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 font-mono font-bold text-xs rounded-lg border border-zinc-600 transition-all"
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

      {/* SECTION 2: TEACHER DESK (tucked away when a student opened an assignment link) */}
      {!showTeacherDesk ? (
        <button
          onClick={() => setTeacherDeskOpen(true)}
          className="self-center text-[11px] font-mono text-zinc-600 hover:text-zinc-400 underline"
        >
          Teacher? Open the grading desk
        </button>
      ) : (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6 shadow-xl flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
          <div className="flex flex-col">
            <span className="text-xs font-mono font-bold text-purple-400 uppercase">TEACHER GRADING DESK</span>
            <h2 className="text-2xl font-bold text-zinc-100 mt-0.5">ASSIGN & GRADE</h2>
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

        {/* Assignment link builder */}
        <div className="flex flex-col gap-3 bg-zinc-950 p-4 rounded-lg border border-zinc-800">
          <div>
            <span className="text-xs font-mono font-bold text-purple-300 uppercase">1 · Create an assignment link</span>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Tick what students should do, then post the link in Google Classroom. Students who open it see only those
              challenges, and their grade is an even split across what you picked.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ASSIGNMENT_ITEMS.map((item) => {
              const on = linkItems.includes(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => setLinkItems(on ? linkItems.filter((x) => x !== item.id) : [...linkItems, item.id])}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors ${
                    on ? 'bg-purple-600 text-white border-purple-400' : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  {on ? '✓ ' : ''}
                  {item.label}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            maxLength={60}
            placeholder="Assignment name (optional), e.g. Unit 3 Ear Training"
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500 font-mono select-text"
          />
          {assignmentLink ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                readOnly
                value={assignmentLink}
                onFocus={(e) => e.target.select()}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-[11px] text-zinc-300 font-mono select-all"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(assignmentLink);
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-mono font-bold text-xs rounded-lg"
              >
                {linkCopied ? 'COPIED!' : 'COPY LINK'}
              </button>
              <a
                href={assignmentLink}
                target="_blank"
                rel="noopener"
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono font-bold text-xs rounded-lg text-center"
              >
                TRY IT
              </a>
            </div>
          ) : (
            <span className="text-[11px] font-mono text-zinc-600">Pick at least one item to get a link.</span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-mono font-bold text-purple-300 uppercase">2 · Paste the whole class's codes (one per line)</label>
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
                  {sortHeader('assignment', 'Assignment')}
                  {sortHeader('total', 'Grade')}
                  <th className="p-3">Learn</th>
                  {sortHeader('drill', 'What Changed')}
                  {sortHeader('scenarios', 'Scenarios')}
                  {sortHeader('match', 'Match')}
                  {sortHeader('mymix', 'My Mix')}
                  <th className="p-3 whitespace-nowrap">Freq Tone ID</th>
                  <th className="p-3 whitespace-nowrap">Band ID</th>
                  <th className="p-3 whitespace-nowrap">Tweak</th>
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
                        <td className="p-3 text-rose-300" colSpan={13}>
                          Couldn't read this code: <span className="text-zinc-500">{r.rawCode.slice(0, 40)}…</span> (it may be
                          cut off. Ask the student to copy it again.)
                        </td>
                      </tr>
                    );
                  }
                  const readableIdx = readableRows.indexOf(r);
                  const a = assignmentOf(s);
                  const grade = computeGrade(s.scores, s.myMix, a);
                  const parts = grade.parts;
                  const cell = (id: AssignmentItem) => {
                    const part = parts.find((p) => p.id === id);
                    if (!part) return <span className="text-zinc-700" title="Not in this assignment">·</span>;
                    if (id === 'whatchanged' && s.legacy) return <span className="text-zinc-600">old code</span>;
                    return (
                      <span className={part.percent >= 100 ? 'text-emerald-400' : part.percent > 0 ? 'text-zinc-300' : 'text-amber-400'} title={part.detail}>
                        {id === 'learn' ? (part.percent >= 100 ? '✓' : '—') : `${part.percent}%`}
                      </span>
                    );
                  };
                  const odd = mostCommonAssignment !== null && assignmentKey(s) !== mostCommonAssignment;
                  const changes = s.myMix ? summarizeMixChanges(s.myMix) : null;
                  const isOpen = openChanges.includes(idx);
                  return (
                    <React.Fragment key={idx}>
                    <tr className="hover:bg-zinc-850/50">
                      <td className="p-3 font-semibold text-zinc-100">{s.student.name}</td>
                      <td className="p-3 text-zinc-400 whitespace-nowrap">
                        {assignmentName(a)}
                        {odd && (
                          <span
                            className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] bg-amber-950 text-amber-300 border border-amber-800"
                            title="This code was made with a different assignment link than most of the class"
                          >
                            DIFFERENT
                          </span>
                        )}
                      </td>
                      <td className={`p-3 font-bold ${totalGradeColor(grade.total)}`}>{grade.total}%</td>
                      <td className="p-3">{cell('learn')}</td>
                      <td className="p-3">{cell('whatchanged')}</td>
                      <td className="p-3">{cell('scenarios')}</td>
                      <td className="p-3">{cell('match')}</td>
                      <td className="p-3">
                        {s.myMix ? (
                          <span className="inline-flex items-center">
                          <button
                            onClick={() => onListenToMix(s.myMix!)}
                            className="px-2.5 py-1 bg-zinc-800 hover:bg-orange-950 hover:text-orange-300 text-zinc-300 rounded text-[10px] font-bold border border-zinc-700 transition-colors whitespace-nowrap"
                            title="Load this student's mix into the console and listen"
                          >
                            ▶ LISTEN ({countWords(s.myMix.explanation)}w)
                          </button>
                          {changes && (
                            <button
                              onClick={() => setOpenChanges((prev) => (prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx]))}
                              className={`ml-1.5 px-2 py-1 rounded text-[10px] font-bold border transition-colors whitespace-nowrap ${
                                isOpen ? 'bg-orange-950 text-orange-300 border-orange-700' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                              }`}
                              title="Show every console setting this student changed from a fresh console"
                            >
                              {isOpen ? '▴' : '▾'} {changes.count} CHANGES
                            </button>
                          )}
                          </span>
                        ) : (
                          cell('mymix')
                        )}
                      </td>
                      <td className="p-3">{cell('freqid')}</td>
                      <td className="p-3">{cell('freqband')}</td>
                      <td className="p-3">{cell('freqtweak')}</td>
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
                    {isOpen && changes && (
                      <tr className="bg-zinc-950/70">
                        <td colSpan={99} className="px-3 pb-3 pt-1">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 text-[11px] font-mono">
                            {changes.rows.map((row) => (
                              <div key={row.name} className="flex gap-2">
                                <span className="font-bold text-zinc-300 whitespace-nowrap">{row.name}:</span>
                                <span className={row.changes.length ? 'text-zinc-400' : 'text-zinc-600 italic'}>
                                  {row.changes.length ? row.changes.join(', ') : 'untouched'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

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
                <h3 className="text-2xl sm:text-3xl font-bold text-zinc-100 mt-1">{report.student.name || 'Student'}</h3>
                <span className="text-xs font-mono text-zinc-400">
                  Submitted {new Date(report.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-mono text-zinc-400">GRADE</span>
                  <span className={`text-3xl font-mono font-extrabold ${totalGradeColor(reportGrade!.total)}`}>{reportGrade!.total}%</span>
                </div>
                <button
                  onClick={closeReport}
                  className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono font-bold flex items-center justify-center border border-zinc-700 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Score parts for this student's assignment */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-mono text-zinc-400">
                Assignment: <strong className="text-zinc-200">{assignmentName(assignmentOf(report))}</strong> · even split across{' '}
                {reportGrade!.parts.length} part{reportGrade!.parts.length === 1 ? '' : 's'}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {reportGrade!.parts.map((part) => (
                  <div key={part.id} className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">{part.label}</span>
                    <div className="text-lg font-mono font-bold text-zinc-100 mt-1">{part.percent}%</div>
                    <span className="text-[11px] font-mono text-zinc-500">{part.detail}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Scenario list */}
            {assignmentOf(report).items.includes('scenarios') && (
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-bold text-yellow-400 uppercase tracking-wider">Scenarios</h4>
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
            </div>
            )}

            {/* My Mix */}
            {(assignmentOf(report).items.includes('mymix') || report.myMix) && (
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-bold text-orange-400 uppercase tracking-wider">My Mix</h4>
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
            )}

            {/* Modal actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    const text =
                      `MIXERLAB REPORT: ${report.student.name}\n` +
                      `Assignment: ${assignmentName(assignmentOf(report))}\n` +
                      `Submitted: ${new Date(report.timestamp).toLocaleString()}\n` +
                      `Grade: ${reportGrade!.total}%\n` +
                      reportGrade!.parts.map((p) => `${p.label}: ${p.percent}% (${p.detail})\n`).join('') +
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
