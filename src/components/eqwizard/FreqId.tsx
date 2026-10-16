import React, { useEffect, useMemo, useState } from 'react';
import { EQ_QUESTIONS } from '../../types/audio';
import { GEQ_31, formatHz } from '../../audio/eqBands';
import { eqWizardPlayer } from '../../audio/eqWizardAudio';
import { GraphicEQ, GeqOverlay } from '../GraphicEQ';
import { FREQ_ID_LEVELS, makeFreqIdQuestions, bandScore, COLORS } from './levels';
import { QuizHeader, HeadphonesNote, LevelResults } from './QuizParts';

interface Props {
  levelIndex: number;
  best: number;
  onDone: (pct: number) => void;
  onQuit: () => void;
}

export const FreqId: React.FC<Props> = ({ levelIndex, best, onDone, onQuit }) => {
  const level = FREQ_ID_LEVELS[levelIndex];
  const [questions, setQuestions] = useState(() => makeFreqIdQuestions(level, EQ_QUESTIONS));
  const [qIndex, setQIndex] = useState(0);
  const [picks, setPicks] = useState<(string | null)[]>(() => Array(EQ_QUESTIONS).fill(null));
  const [finished, setFinished] = useState(false);
  const [, force] = useState(0);

  useEffect(() => {
    eqWizardPlayer.onChange = () => force((n) => n + 1);
    return () => {
      eqWizardPlayer.stopAll();
      eqWizardPlayer.onChange = undefined;
    };
  }, []);

  const q = questions[qIndex];
  const picked = picks[qIndex];
  const scoreFor = (i: number, pick: string | null) => {
    if (pick === null) return null;
    const qq = questions[i];
    return level.kind === 'bands' ? bandScore(Number(pick), Number(qq.answer)) : pick === qq.answer ? 100 : 0;
  };
  const results = picks.map((p, i) => scoreFor(i, p));
  const levelScore = Math.round(results.reduce<number>((a, r) => a + (r ?? 0), 0) / EQ_QUESTIONS);

  const play = () => eqWizardPlayer.playTone(q.freq);

  const answerLabel = (ans: string) =>
    level.kind === 'bands' ? `${formatHz(level.bands![Number(ans)])} Hz band` : level.regions!.find((r) => r.id === ans)?.label || ans;

  // Overlays: either named regions on the 31-band, or one box per band
  const overlays: GeqOverlay[] = useMemo(() => {
    if (level.kind === 'regions') {
      return level.regions!.map((r) => ({
        id: r.id,
        from: r.from,
        to: r.to,
        label: r.label,
        sub: r.sub,
        color: r.color,
        state:
          picked === null ? 'idle' : r.id === q.answer ? 'correct' : r.id === picked ? 'wrong' : 'faded'
      }));
    }
    return level.bands!.map((_, i) => {
      const pickedIdx = picked === null ? null : Number(picked);
      const ans = Number(q.answer);
      let state: GeqOverlay['state'] = 'idle';
      let partialText: string | undefined;
      if (pickedIdx !== null) {
        if (i === ans) state = 'correct';
        else if (i === pickedIdx) {
          const sc = bandScore(pickedIdx, ans);
          state = sc > 0 ? 'partial' : 'wrong';
          partialText = sc > 0 ? `${sc}%` : undefined;
        } else state = 'faded';
      }
      return { id: String(i), from: i, to: i, label: '', color: COLORS.band, state, partialText };
    });
  }, [level, q, picked]);

  const choose = (id: string) => {
    if (picked !== null) return;
    const next = [...picks];
    next[qIndex] = id;
    setPicks(next);
  };

  const goNext = () => {
    eqWizardPlayer.stopAll();
    if (qIndex < EQ_QUESTIONS - 1) {
      setQIndex(qIndex + 1);
    } else {
      setFinished(true);
      onDone(levelScore);
    }
  };

  const retry = () => {
    setQuestions(makeFreqIdQuestions(level, EQ_QUESTIONS));
    setPicks(Array(EQ_QUESTIONS).fill(null));
    setQIndex(0);
    setFinished(false);
  };

  if (finished) {
    return (
      <LevelResults
        section="Freq ID"
        title={level.title}
        score={levelScore}
        best={best}
        review={questions.map((qq, i) => ({ text: `${qq.freq} Hz → ${answerLabel(qq.answer)}`, pct: results[i] ?? 0 }))}
        onRetry={retry}
        onBack={onQuit}
      />
    );
  }

  const bands = level.kind === 'bands' ? level.bands! : GEQ_31;
  const sc = results[qIndex];

  return (
    <div className="w-full max-w-5xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6 flex flex-col gap-4">
      <QuizHeader section="Freq ID" title={level.title} qIndex={qIndex} results={results} onQuit={onQuit} />
      {level.headphones && <HeadphonesNote />}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={play}
          className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-zinc-950 font-bold text-sm"
        >
          🔊 {eqWizardPlayer.isPlaying ? 'Playing…' : 'Play Tone'}
        </button>
        <span className="text-sm text-zinc-300">{level.blurb} Click your answer on the EQ.</span>
      </div>

      <GraphicEQ
        bands={bands}
        overlays={overlays}
        onPickOverlay={choose}
        disabled={picked !== null}
        dimOutside={level.focus}
        height={level.kind === 'bands' ? 170 : 200}
      />

      {picked !== null && (
        <div
          className={`rounded-lg border px-3 py-2.5 text-sm ${
            sc === 100 ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200' : sc ? 'bg-amber-950/30 border-amber-800/60 text-amber-200' : 'bg-rose-950/20 border-rose-900/60 text-rose-200'
          }`}
        >
          <strong>{sc === 100 ? 'Nice ears!' : sc ? `Close, ${sc}% credit.` : 'Not quite.'}</strong> The tone was{' '}
          <strong>{q.freq} Hz</strong>: {answerLabel(q.answer)}. Play it again to lock in the sound.
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={goNext}
          disabled={picked === null}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm ${
            picked === null ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-zinc-100 text-zinc-950 hover:bg-white'
          }`}
        >
          {qIndex < EQ_QUESTIONS - 1 ? 'Next →' : 'See Results →'}
        </button>
      </div>
    </div>
  );
};
