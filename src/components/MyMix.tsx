import React, { useState } from 'react';
import { BUILTIN_SONGS } from '../audio/stemSynthesizer';

interface MyMixProps {
  songId: string;
  explanation: string;
  onExplanationChange: (text: string) => void;
  onStartOver: () => void;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
}

export const MY_MIX_MIN_WORDS = 40;

const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

export const MyMix: React.FC<MyMixProps> = ({
  songId,
  explanation,
  onExplanationChange,
  onStartOver,
  isPlaying,
  onPlay,
  onPause
}) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const song = BUILTIN_SONGS.find((s) => s.id === songId);
  const words = countWords(explanation);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6 shadow-xl flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
          <div className="flex flex-col">
            <span className="text-xs font-mono font-bold text-orange-400 uppercase">CREATIVE PROJECT</span>
            <h2 className="text-2xl font-bold text-zinc-100 mt-0.5">MY MIX</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={isPlaying ? onPause : onPlay}
              className={`px-4 py-2 rounded-lg font-mono font-bold text-xs transition-colors ${
                isPlaying ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isPlaying ? '❚❚ PAUSE' : '▶ PLAY'}
            </button>
            {confirmReset ? (
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-zinc-400">Reset every knob?</span>
                <button
                  onClick={() => {
                    onStartOver();
                    setConfirmReset(false);
                  }}
                  className="px-2.5 py-2 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold"
                >
                  YES
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="px-2.5 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold"
                >
                  NO
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono font-bold text-xs border border-zinc-700"
                title="Reset the console to a clean starting point (your writing is kept)"
              >
                START OVER
              </button>
            )}
          </div>
        </div>

        <div className="text-sm text-zinc-300 leading-relaxed bg-zinc-950 p-3 rounded border border-zinc-850 flex flex-col gap-1.5">
          <span>
            This one is yours. There's no right answer. Pick a song with the song menu at the top, then use{' '}
            <strong className="text-zinc-100">everything you've learned</strong> on the console below to make it sound the
            way <em>you</em> want it to sound.
          </span>
          <span className="text-zinc-400 text-xs font-mono">
            Now mixing: <strong className="text-orange-300">{song?.title || 'Custom stems'}</strong> · Your mix saves
            automatically and goes into your submission code on the Grade Report tab.
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="mymix-explanation" className="text-xs font-mono font-bold text-zinc-300 uppercase">
            Explain your choices
          </label>
          <ul className="text-xs text-zinc-400 list-disc pl-5 flex flex-col gap-0.5">
            <li>What feeling or vibe were you going for?</li>
            <li>Which part did you put in the spotlight, and how did you do it?</li>
            <li>Name at least two specific moves (EQ, pan, compression, reverb, levels) and <em>why</em> you made them.</li>
            <li>What would you try next if you had more time?</li>
          </ul>
          <textarea
            id="mymix-explanation"
            value={explanation}
            onChange={(e) => onExplanationChange(e.target.value)}
            rows={6}
            maxLength={2000}
            placeholder="I wanted this mix to feel... so I..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-100 focus:outline-none focus:border-orange-500 leading-relaxed select-text"
          />
          <div className="flex justify-between text-[11px] font-mono">
            <span className={words >= MY_MIX_MIN_WORDS ? 'text-emerald-400' : 'text-zinc-500'}>
              {words} words {words >= MY_MIX_MIN_WORDS ? '✓' : `(aim for at least ${MY_MIX_MIN_WORDS})`}
            </span>
            <span className="text-zinc-600">{explanation.length} / 2000</span>
          </div>
        </div>
      </div>
    </div>
  );
};
