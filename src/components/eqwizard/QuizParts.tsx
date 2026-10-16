import React, { useEffect, useRef } from 'react';
import { EQ_QUESTIONS } from '../../types/audio';

/**
 * Desktop keyboard shortcuts for a quiz screen. `keys` maps a key name (' ', 'ArrowLeft', ',' …)
 * to an action; typing in a text box or slider is left alone.
 */
export function useHotkeys(keys: Record<string, () => void>) {
  const ref = useRef(keys);
  ref.current = keys;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const action = ref.current[e.key];
      if (!action) return;
      e.preventDefault();
      if (e.repeat) return;
      // A just-clicked button would also "click" on Space; drop focus so only the shortcut runs
      if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
      action();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Small keyboard reminder, shown on larger screens only. */
export const KeyHint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="hidden md:block text-[11px] font-mono text-zinc-500">⌨ {children}</span>
);

/** Header for a running level: title, question count, progress dots. */
export const QuizHeader: React.FC<{
  section: string;
  title: string;
  qIndex: number;
  results: (number | null)[];
  onQuit: () => void;
}> = ({ section, title, qIndex, results, onQuit }) => (
  <div className="flex flex-col gap-3">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <button
          onClick={onQuit}
          className="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold"
          title="Back to levels"
        >
          ✕
        </button>
        <div>
          <span className="text-[10px] font-mono font-bold text-orange-400 uppercase">{section}</span>
          <h2 className="text-xl font-bold text-zinc-100 leading-tight">{title}</h2>
        </div>
      </div>
      <span className="text-xs font-mono font-bold text-zinc-300">
        QUESTION {Math.min(qIndex + 1, EQ_QUESTIONS)} OF {EQ_QUESTIONS}
      </span>
    </div>
    <div className="flex gap-1.5">
      {results.map((r, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full ${
            r === null ? (i === qIndex ? 'bg-orange-500' : 'bg-zinc-800') : r >= 100 ? 'bg-emerald-500' : r > 0 ? 'bg-amber-500' : 'bg-rose-500'
          }`}
        />
      ))}
    </div>
  </div>
);

export const HeadphonesNote: React.FC = () => (
  <div className="text-xs font-mono text-amber-300 bg-amber-950/30 border border-amber-800/50 rounded-lg px-3 py-2">
    🎧 Headphones needed: laptop and Chromebook speakers can't play the lowest notes. Start with the volume low.
  </div>
);

/** End-of-level card. */
export const LevelResults: React.FC<{
  section: string;
  title: string;
  score: number;
  accuracy: number;
  best: number;
  review: { text: string; pct: number }[];
  onRetry: () => void;
  onBack: () => void;
}> = ({ section, title, score, accuracy, best, review, onRetry, onBack }) => (
  <div className="w-full max-w-xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col items-center gap-4 text-center">
    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl ${score >= 70 ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
      {score >= 70 ? '🏆' : '🎧'}
    </div>
    <div>
      <span className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
        {section} · {title}
      </span>
      <div className="text-5xl font-mono font-extrabold text-zinc-100 mt-2">{score}%</div>
      <span className="block text-xs font-mono text-zinc-300 mt-1">50% for finishing + {Math.round(accuracy / 2)}% for accuracy ({accuracy}% right)</span>
      <span className="text-xs font-mono text-zinc-500">Best on this level: {Math.max(best, score)}% (goes on your grade report)</span>
    </div>
    <div className="w-full flex flex-col gap-1 text-left">
      {review.map((r, i) => (
        <div
          key={i}
          className={`text-xs font-mono px-2.5 py-1.5 rounded border flex justify-between gap-2 ${
            r.pct >= 100 ? 'border-emerald-800/60 text-emerald-200 bg-emerald-950/20' : r.pct > 0 ? 'border-amber-800/60 text-amber-200 bg-amber-950/20' : 'border-rose-900/60 text-rose-200 bg-rose-950/20'
          }`}
        >
          <span>
            Q{i + 1}: {r.text}
          </span>
          <span className="font-bold">{r.pct}%</span>
        </div>
      ))}
    </div>
    <div className="flex gap-3 w-full">
      <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-300 font-bold text-sm hover:bg-zinc-800">
        All Levels
      </button>
      <button onClick={onRetry} className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-zinc-950 font-bold text-sm">
        Retry Level
      </button>
    </div>
  </div>
);

/** A/B switch used by Freq Band ID and Freq Tweak. */
export const ABSwitch: React.FC<{
  which: 'A' | 'B';
  labels: [string, string];
  isPlaying: boolean;
  loading?: boolean;
  onPlay: () => void;
  onStop: () => void;
  onWhich: (w: 'A' | 'B') => void;
}> = ({ which, labels, isPlaying, loading, onPlay, onStop, onWhich }) => (
  <div className="flex flex-col sm:flex-row items-stretch gap-3">
    <button
      onClick={isPlaying ? onStop : onPlay}
      disabled={loading}
      className={`px-5 py-3 rounded-lg font-mono font-bold text-sm transition-colors ${
        loading ? 'bg-zinc-700 text-zinc-400' : isPlaying ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
      }`}
    >
      {loading ? 'LOADING…' : isPlaying ? '■ STOP' : '▶ PLAY'}
    </button>
    <div className="flex flex-1 rounded-lg overflow-hidden border border-zinc-700">
      {(['A', 'B'] as const).map((w, i) => (
        <button
          key={w}
          onClick={() => onWhich(w)}
          className={`flex-1 px-4 py-3 font-mono font-bold text-sm transition-all ${
            which === w ? (w === 'A' ? 'bg-sky-500 text-zinc-950' : 'bg-orange-500 text-zinc-950') : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-750'
          }`}
        >
          {w} · {labels[i]}
        </button>
      ))}
    </div>
  </div>
);
