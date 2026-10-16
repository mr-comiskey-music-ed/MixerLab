import React, { useEffect, useMemo, useState } from 'react';
import { EQ_QUESTIONS } from '../../types/audio';
import { audioEngine } from '../../audio/audioEngine';
import { eqWizardPlayer, channelEqSpecs, FilterSpec } from '../../audio/eqWizardAudio';
import { Clip, StemInfo, loadAllWizardStems, pickStemClip, goodStarts } from '../../audio/clipFinder';
import { Knob } from '../Knob';
import {
  FREQ_TWEAK_LEVELS, FreqTweakLevel, TweakBand, TweakKnob, TweakQuestion, TweakSettings, FLAT_TWEAK,
  makeTweakQuestion, tweakScore
} from './levels';
import { QuizHeader, LevelResults, ABSwitch } from './QuizParts';

interface Props {
  levelIndex: number;
  best: number;
  onDone: (pct: number) => void;
  onQuit: () => void;
}

const CLIP_SECONDS = 8;
const FIXED_MID_FREQ = 2500;

// Which bands an instrument has enough sound in for a change to be heard
const canUseFor = (stem: StemInfo) => (b: TweakBand) =>
  b === 'low' ? stem.lowShare >= 0.12 : b === 'high' ? stem.highShare >= 0.003 : true;
const freqRangeFor = (stem: StemInfo): [number, number] =>
  stem.highShare < 0.001 ? [200, 800] : stem.lowShare < 0.05 ? [1500, 5000] : [250, 4000];

interface Round {
  stem: StemInfo;
  clip: Clip;
  question: TweakQuestion;
}

function makeRound(level: FreqTweakLevel, qIndex: number, stems: StemInfo[], lastStem?: StemInfo): Round | null {
  const levelBands = (['low', 'mid', 'high'] as TweakBand[]).filter((b) => level.active.includes(b));
  const needMulti = qIndex >= 6 && levelBands.length > 1;
  const shuffled = [...stems].sort(() => Math.random() - 0.5);
  const ordered = [...shuffled.filter((s) => s !== lastStem), ...shuffled.filter((s) => s === lastStem)];
  for (const stem of ordered) {
    const usable = levelBands.filter(canUseFor(stem));
    if (usable.length === 0 || (needMulti && usable.length < 2)) continue;
    const clip = pickStemClip(stem, CLIP_SECONDS);
    if (!clip) continue;
    const question = makeTweakQuestion(level, qIndex, canUseFor(stem), freqRangeFor(stem));
    if (!level.active.includes('freq')) question.fix.freq = FIXED_MID_FREQ;
    return { stem, clip, question };
  }
  return null;
}

/** The hidden change is the opposite of the fix, so turning the knobs to the fix undoes it exactly. */
const changeSpecs = (fix: TweakSettings): FilterSpec[] => channelEqSpecs(-fix.low, -fix.mid, fix.freq, -fix.high);

const fmt = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;
const fmtHz = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(2)} kHz` : `${Math.round(v)} Hz`);

export const FreqTweak: React.FC<Props> = ({ levelIndex, best, onDone, onQuit }) => {
  const level = FREQ_TWEAK_LEVELS[levelIndex];
  const [stems, setStems] = useState<StemInfo[] | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [round, setRound] = useState<Round | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [knobs, setKnobs] = useState<TweakSettings>({ ...FLAT_TWEAK });
  const [scores, setScores] = useState<(number | null)[]>(() => Array(EQ_QUESTIONS).fill(null));
  const [answers, setAnswers] = useState<(TweakSettings | null)[]>(() => Array(EQ_QUESTIONS).fill(null));
  const [which, setWhich] = useState<'A' | 'B'>('B');
  const [finished, setFinished] = useState(false);
  const [, force] = useState(0);

  useEffect(() => {
    eqWizardPlayer.onChange = () => force((n) => n + 1);
    loadAllWizardStems().then((all) => setStems(all.filter((s) => goodStarts(s.blocksDb, CLIP_SECONDS).length > 0)));
    return () => {
      eqWizardPlayer.stopAll();
      eqWizardPlayer.onChange = undefined;
    };
  }, []);

  // New question: pick an instrument and clip, reset the knobs
  useEffect(() => {
    if (!stems || finished) return;
    eqWizardPlayer.stopAll();
    const r = makeRound(level, qIndex, stems, rounds[qIndex - 1]?.stem);
    setRound(r);
    setRounds((prev) => {
      const next = [...prev];
      if (r) next[qIndex] = r;
      return next;
    });
    setKnobs({ ...FLAT_TWEAK });
    setWhich('B');
    eqWizardPlayer.which = 'B';
  }, [stems, qIndex, finished]);

  const studentSpecs = (k: TweakSettings) =>
    channelEqSpecs(k.low, k.mid, level.active.includes('freq') ? k.freq : FIXED_MID_FREQ, k.high);

  const setKnob = (key: keyof TweakSettings, v: number) => {
    const next = { ...knobs, [key]: v };
    setKnobs(next);
    eqWizardPlayer.updateStudent(studentSpecs(next));
  };

  const play = () => round && eqWizardPlayer.playClip(round.clip, changeSpecs(round.question.fix), studentSpecs(knobs));
  const flip = (w: 'A' | 'B') => {
    setWhich(w);
    eqWizardPlayer.setWhich(w);
  };

  const submitted = scores[qIndex] !== null;
  const result = round && submitted ? tweakScore(level, { ...knobs, freq: level.active.includes('freq') ? knobs.freq : FIXED_MID_FREQ }, round.question.fix) : null;

  const submit = () => {
    if (!round) return;
    const r = tweakScore(level, { ...knobs, freq: level.active.includes('freq') ? knobs.freq : FIXED_MID_FREQ }, round.question.fix);
    const s = [...scores];
    s[qIndex] = r.total;
    setScores(s);
    const a = [...answers];
    a[qIndex] = { ...knobs };
    setAnswers(a);
  };

  const levelScore = Math.round(scores.reduce<number>((a, r) => a + (r ?? 0), 0) / EQ_QUESTIONS);

  const goNext = () => {
    eqWizardPlayer.stopAll();
    if (qIndex < EQ_QUESTIONS - 1) setQIndex(qIndex + 1);
    else {
      setFinished(true);
      onDone(levelScore);
    }
  };

  const retry = () => {
    setScores(Array(EQ_QUESTIONS).fill(null));
    setAnswers(Array(EQ_QUESTIONS).fill(null));
    setRounds([]);
    setQIndex(0);
    setFinished(false);
  };

  const describeFix = (fix: TweakSettings, bands: TweakBand[]) =>
    bands
      .map((b) => (b === 'mid' ? `MID ${fmt(fix.mid)}${level.active.includes('freq') ? ` @ ${fmtHz(fix.freq)}` : ''}` : `${b.toUpperCase()} ${fmt(fix[b])}`))
      .join(', ');

  if (finished) {
    return (
      <LevelResults
        section="Freq Tweak"
        title={level.title}
        score={levelScore}
        best={best}
        review={rounds.map((r, i) => ({ text: `${r.stem.stemName}: fix was ${describeFix(r.question.fix, r.question.bands)}`, pct: scores[i] ?? 0 }))}
        onRetry={retry}
        onBack={onQuit}
      />
    );
  }

  const digital = qIndex >= 4;
  const isOn = (k: TweakKnob) => level.active.includes(k);

  return (
    <div className="w-full max-w-5xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6 flex flex-col gap-4">
      <QuizHeader section="Freq Tweak" title={level.title} qIndex={qIndex} results={scores} onQuit={onQuit} />
      {!stems || !round ? (
        <div className="text-sm font-mono text-zinc-400 py-10 text-center">Loading the instruments…</div>
      ) : (
        <>
          <p className="text-sm text-zinc-300">
            The <strong className="text-orange-300">{round.stem.stemName}</strong> ({round.stem.songTitle}) has had its EQ
            knocked out of shape. Turn the knobs until <strong className="text-orange-300">YOURS</strong> sounds like the{' '}
            <strong className="text-sky-300">TARGET</strong>, then submit.
          </p>

          <ABSwitch
            which={which}
            labels={['TARGET', 'YOURS']}
            isPlaying={eqWizardPlayer.isPlaying}
            onPlay={play}
            onStop={() => eqWizardPlayer.stopAll()}
            onWhich={flip}
          />
          {round.question.multi && (
            <p className="text-xs font-bold text-amber-300 -mt-2 text-center">(More than one knob was changed.)</p>
          )}

          {digital ? (
            <DigitalEq knobs={knobs} isOn={isOn} onKnob={setKnob} locked={submitted} fix={submitted ? round.question.fix : null} />
          ) : (
            <AnalogEq knobs={knobs} isOn={isOn} onKnob={setKnob} locked={submitted} />
          )}

          {result && (
            <div
              className={`rounded-lg border px-3 py-2.5 text-sm flex flex-col gap-1 ${
                result.total >= 90 ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200' : result.total > 0 ? 'bg-amber-950/30 border-amber-800/60 text-amber-200' : 'bg-rose-950/20 border-rose-900/60 text-rose-200'
              }`}
            >
              <span>
                <strong>{result.total}%.</strong> The exact fix was {describeFix(round.question.fix, round.question.bands)}
                {level.active.filter((k) => k !== 'freq').length > round.question.bands.length ? ', with every other knob left at 0' : ''}
                .
              </span>
              <span className="text-xs font-mono opacity-80">
                {Object.entries(result.parts)
                  .map(([k, v]) => `${k === 'freq' ? 'MID FREQ' : k.toUpperCase()}: ${v}%`)
                  .join(' · ')}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center gap-3">
            <span className="text-[11px] font-mono text-zinc-500">
              {digital ? 'Digital EQ (questions 5–8)' : 'Analog channel EQ (questions 1–4)'}
            </span>
            {!submitted ? (
              <button onClick={submit} className="px-8 py-3 rounded-xl bg-zinc-100 text-zinc-950 hover:bg-white font-bold text-sm">
                Submit
              </button>
            ) : (
              <button onClick={goNext} className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-zinc-950 font-bold text-sm">
                {qIndex < EQ_QUESTIONS - 1 ? 'Next →' : 'See Results →'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

/* ---------------- Analog channel-strip EQ (questions 1-4) ---------------- */
const AnalogEq: React.FC<{
  knobs: TweakSettings;
  isOn: (k: TweakKnob) => boolean;
  onKnob: (k: keyof TweakSettings, v: number) => void;
  locked: boolean;
}> = ({ knobs, isOn, onKnob, locked }) => {
  const slot = (k: TweakKnob, node: React.ReactNode) => (
    <div className={`flex flex-col items-center ${!isOn(k) ? 'opacity-25 pointer-events-none grayscale' : locked ? 'pointer-events-none' : ''}`}>
      {node}
      {!isOn(k) && <span className="text-[8px] font-mono text-zinc-500 mt-0.5">LOCKED</span>}
    </div>
  );
  return (
    <div className="flex justify-center">
      <div className="w-40 flex flex-col items-center gap-2 bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-700 rounded-lg p-3">
        <span className="text-[9px] font-mono font-bold text-sky-400 uppercase tracking-wider">EQ</span>
        {slot('high', <Knob label="HIGH" value={knobs.high} min={-15} max={15} step={0.5} color="blue" size="md" centerDetent defaultValue={0} onChange={(v) => onKnob('high', v)} />)}
        {slot(
          'freq',
          <Knob
            label="MID FREQ"
            value={isOn('freq') ? knobs.freq : FIXED_MID_FREQ}
            min={100}
            max={8000}
            step={25}
            color="white"
            size="md"
            defaultValue={2500}
            centerValue={2500}
            formatValue={(v) => (v >= 1000 ? `${(v / 1000).toFixed(2)}k` : `${Math.round(v)} Hz`)}
            onChange={(v) => onKnob('freq', v)}
          />
        )}
        {slot('mid', <Knob label="MID" value={knobs.mid} min={-15} max={15} step={0.5} color="blue" size="md" centerDetent defaultValue={0} onChange={(v) => onKnob('mid', v)} />)}
        {slot('low', <Knob label="LOW" value={knobs.low} min={-15} max={15} step={0.5} color="blue" size="md" centerDetent defaultValue={0} onChange={(v) => onKnob('low', v)} />)}
      </div>
    </div>
  );
};

/* ---------------- Digital EQ with a response curve (questions 5-8) ---------------- */
const CURVE_POINTS = 160;
const freqsForCurve = new Float32Array(Array.from({ length: CURVE_POINTS }, (_, i) => 20 * Math.pow(1000, i / (CURVE_POINTS - 1))));

function responseDb(specs: FilterSpec[]): number[] {
  if (!audioEngine.ctx) audioEngine.init();
  const ctx = audioEngine.ctx!;
  const total = new Array(CURVE_POINTS).fill(0);
  const mag = new Float32Array(CURVE_POINTS);
  const phase = new Float32Array(CURVE_POINTS);
  for (const s of specs) {
    const f = ctx.createBiquadFilter();
    f.type = s.type;
    f.frequency.value = s.freq;
    f.gain.value = s.gain;
    if (s.q !== undefined) f.Q.value = s.q;
    f.getFrequencyResponse(freqsForCurve, mag, phase);
    for (let i = 0; i < CURVE_POINTS; i++) total[i] += 20 * Math.log10(mag[i] || 1e-6);
  }
  return total;
}

const DigitalEq: React.FC<{
  knobs: TweakSettings;
  isOn: (k: TweakKnob) => boolean;
  onKnob: (k: keyof TweakSettings, v: number) => void;
  locked: boolean;
  fix: TweakSettings | null;
}> = ({ knobs, isOn, onKnob, locked, fix }) => {
  const W = 600, H = 170, RANGE = 16;
  const midFreq = isOn('freq') ? knobs.freq : FIXED_MID_FREQ;
  const curve = useMemo(() => responseDb(channelEqSpecs(knobs.low, knobs.mid, midFreq, knobs.high)), [knobs, midFreq]);
  const fixCurve = useMemo(() => (fix ? responseDb(channelEqSpecs(fix.low, fix.mid, fix.freq, fix.high)) : null), [fix]);
  const toPath = (vals: number[]) =>
    vals.map((db, i) => `${i ? 'L' : 'M'}${((i / (CURVE_POINTS - 1)) * W).toFixed(1)},${(H / 2 - (Math.max(-RANGE, Math.min(RANGE, db)) / RANGE) * (H / 2 - 6)).toFixed(1)}`).join(' ');
  const gridHz = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
  const xFor = (hz: number) => (Math.log(hz / 20) / Math.log(1000)) * W;

  const ctrl = (k: TweakKnob, label: string, node: React.ReactNode, tone = 'text-cyan-300') => (
    <div className={`flex-1 min-w-[120px] flex flex-col items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2 ${!isOn(k) ? 'opacity-25 pointer-events-none grayscale' : locked ? 'pointer-events-none' : ''}`}>
      <span className={`text-[10px] font-mono font-bold ${tone}`}>{label}{!isOn(k) ? ' (LOCKED)' : ''}</span>
      {node}
    </div>
  );
  const gainKnob = (k: 'low' | 'mid' | 'high', label: string, color: 'blue' | 'teal' | 'light-blue') => (
    <Knob
      label={label}
      value={knobs[k]}
      min={-15}
      max={15}
      step={0.5}
      color={color}
      size="sm"
      centerDetent
      defaultValue={0}
      formatValue={fmt}
      onChange={(v) => onKnob(k, v)}
    />
  );

  return (
    <div className="flex flex-col gap-3 bg-zinc-950/60 border border-cyan-900/50 rounded-xl p-3">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-40 bg-zinc-950 rounded-lg border border-zinc-800">
        {gridHz.map((hz) => (
          <g key={hz}>
            <line x1={xFor(hz)} x2={xFor(hz)} y1={0} y2={H} stroke="#27272a" strokeWidth={1} />
            <text x={xFor(hz) + 3} y={H - 4} fontSize={10} fill="#52525b" fontFamily="monospace">
              {hz >= 1000 ? `${hz / 1000}k` : hz}
            </text>
          </g>
        ))}
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="#3f3f46" strokeWidth={1} />
        {fixCurve && <path d={toPath(fixCurve)} fill="none" stroke="#34d399" strokeWidth={2} strokeDasharray="5 4" />}
        <path d={toPath(curve)} fill="none" stroke="#22d3ee" strokeWidth={2.5} />
      </svg>
      {fix && (
        <span className="text-[11px] font-mono text-zinc-400 -mt-1">
          <span className="text-cyan-300">━ your EQ</span> · <span className="text-emerald-300">┅ the exact fix</span>
        </span>
      )}
      <div className="flex flex-wrap gap-2">
        {ctrl('low', '● LOW (80Hz)', gainKnob('low', 'LOW GAIN', 'blue'))}
        {ctrl('mid', '● MID GAIN', gainKnob('mid', 'MID GAIN', 'teal'), 'text-amber-400')}
        {ctrl(
          'freq',
          '● MID SWEEP',
          <Knob
            label="FREQ SELECT"
            value={midFreq}
            min={100}
            max={8000}
            step={25}
            color="indigo"
            size="sm"
            defaultValue={2500}
            centerValue={2500}
            formatValue={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)} Hz`)}
            onChange={(v) => onKnob('freq', v)}
          />,
          'text-amber-400'
        )}
        {ctrl('high', '● HIGH (10kHz)', gainKnob('high', 'HIGH GAIN', 'light-blue'), 'text-sky-400')}
      </div>
    </div>
  );
};
