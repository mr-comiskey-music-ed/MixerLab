import React, { useEffect, useMemo, useState } from 'react';
import { ChannelSettings, MasterSettings } from '../types/audio';
import { makeDefaultChannels, makeDefaultMaster } from '../utils/mixDefaults';

export const WHAT_CHANGED_QUESTIONS = 8;

type StemType = string; // 'drums' | 'bass' | 'vocal' | 'guitar' | 'synth' | 'perc'

interface ChangeType {
  id: string;
  short: string;       // shown in the answer choices
  listenFor: string;   // explanation shown after answering
  big: boolean;        // easier-to-hear change (used for the first questions)
  fits: StemType[];    // which kinds of stems this change is clearly audible on
  songs?: string[];    // limit to songs where the change is clearly audible (default: all)
  apply: (ch: ChannelSettings) => ChannelSettings;
}

const ALL: StemType[] = ['drums', 'bass', 'vocal', 'guitar', 'synth', 'perc'];

const CHANGE_TYPES: ChangeType[] = [
  {
    id: 'louder',
    short: 'got louder (fader up)',
    listenFor: 'The whole part jumped forward in the mix. Nothing about its tone changed, just its level against everything else.',
    big: true,
    fits: ALL,
    apply: (ch) => ({ ...ch, faderLevel: 8 })
  },
  {
    id: 'quieter',
    short: 'got quieter (fader down)',
    listenFor: 'The part sank back into the mix. It is still there with the same tone, just lower in level.',
    big: true,
    fits: ALL,
    apply: (ch) => ({ ...ch, faderLevel: -12 })
  },
  {
    id: 'muted',
    short: 'was muted',
    listenFor: 'The part disappeared completely. A good trick: listen for a hole where something used to be.',
    big: true,
    fits: ALL,
    apply: (ch) => ({ ...ch, mute: true })
  },
  {
    id: 'pan_left',
    short: 'was panned hard left',
    listenFor: 'The part moved out of the center and into the left side. Headphones make this much easier to hear.',
    big: true,
    fits: ALL,
    apply: (ch) => ({ ...ch, pan: -1 })
  },
  {
    id: 'pan_right',
    short: 'was panned hard right',
    listenFor: 'The part moved out of the center and into the right side. Headphones make this much easier to hear.',
    big: true,
    fits: ALL,
    apply: (ch) => ({ ...ch, pan: 1 })
  },
  {
    id: 'distorted',
    short: 'got distorted (gain too high)',
    listenFor: 'The part got crunchy and fuzzy because the preamp was overloaded. On a real console the red PEAK light would be flashing.',
    big: true,
    fits: ['drums', 'bass', 'vocal', 'guitar'],
    songs: ['song1', 'song2'],
    apply: (ch) => ({ ...ch, gain: 20, faderLevel: -14 })
  },
  {
    id: 'reverb',
    short: 'had reverb added',
    listenFor: 'A wash of space appeared around the part, especially audible in the gaps after notes or words.',
    big: false,
    fits: ['vocal', 'guitar', 'synth', 'perc', 'drums'],
    apply: (ch) => ({ ...ch, fxPost: 4 })
  },
  {
    id: 'low_boost',
    short: 'got more bass (LOW EQ boost)',
    listenFor: 'The part got heavier and boomier. The extra energy is down low, under about 80 Hz.',
    big: false,
    fits: ['drums', 'bass', 'synth', 'guitar'],
    apply: (ch) => ({ ...ch, eqLow: 12 })
  },
  {
    id: 'high_boost',
    short: 'got brighter (HIGH EQ boost)',
    listenFor: 'The part got brighter and more sizzly, with more "air" on top.',
    big: false,
    fits: ['drums', 'vocal', 'guitar', 'perc'],
    apply: (ch) => ({ ...ch, eqHigh: 12 })
  },
  {
    id: 'high_cut',
    short: 'got duller (HIGH EQ cut)',
    listenFor: 'The part lost its top end and sounded darker, like it moved behind a curtain.',
    big: false,
    fits: ['drums', 'vocal', 'guitar', 'perc'],
    apply: (ch) => ({ ...ch, eqHigh: -15 })
  },
  {
    id: 'low_cut',
    short: 'had the 100Hz LOW CUT switched on',
    listenFor: 'The bottom end was filtered away, so the part got thinner and lost its weight.',
    big: false,
    fits: ['drums', 'bass', 'synth'],
    apply: (ch) => ({ ...ch, lowCut100Hz: true, eqLow: 0 })
  },
  {
    id: 'compressed',
    short: 'got squashed (heavy compression)',
    listenFor: 'The hits lost their punch and everything got flattened to one level. Quiet details popped up while the peaks got held down.',
    big: false,
    fits: ['drums', 'bass'],
    // The hip-hop stems are recorded quietly, so the fixed-threshold compressor barely touches them
    songs: ['song1', 'song2'],
    apply: (ch) => ({ ...ch, comp: 100 })
  }
];

export interface WhatChangedQuestion {
  channelIdx: number;
  changeId: string;
  options: { channelIdx: number; changeId: string }[]; // 4 choices, one is correct
}

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Build 8 questions: the first 4 use big, obvious changes; the last 4 can be subtler. */
export function generateQuestions(channels: ChannelSettings[], songId: string): WhatChangedQuestion[] {
  const fitsChannel = (ct: ChangeType, idx: number) =>
    ct.fits.includes(channels[idx]?.type || 'synth') && (!ct.songs || ct.songs.includes(songId));
  const used = new Set<string>();
  const questions: WhatChangedQuestion[] = [];
  let lastChannel = -1;

  for (let q = 0; q < WHAT_CHANGED_QUESTIONS; q++) {
    const pool = CHANGE_TYPES.filter((ct) => (q < 4 ? ct.big : true));
    let pick: { channelIdx: number; ct: ChangeType } | null = null;
    for (let tries = 0; tries < 200 && !pick; tries++) {
      const ct = pool[Math.floor(Math.random() * pool.length)];
      const channelIdx = Math.floor(Math.random() * channels.length);
      const key = `${channelIdx}:${ct.id}`;
      if (used.has(key) || channelIdx === lastChannel || !fitsChannel(ct, channelIdx)) continue;
      // Avoid repeating the same kind of change back to back
      if (questions.length && questions[questions.length - 1].changeId === ct.id) continue;
      pick = { channelIdx, ct };
    }
    if (!pick) pick = { channelIdx: 0, ct: CHANGE_TYPES[0] };
    used.add(`${pick.channelIdx}:${pick.ct.id}`);
    lastChannel = pick.channelIdx;

    // Distractors: the same change on other channels, and other changes on the same channel
    const correctKey = `${pick.channelIdx}:${pick.ct.id}`;
    const candidates = new Map<string, { channelIdx: number; changeId: string }>();
    shuffle(channels.map((_, i) => i).filter((i) => i !== pick!.channelIdx))
      .slice(0, 2)
      .forEach((i) => candidates.set(`${i}:${pick!.ct.id}`, { channelIdx: i, changeId: pick!.ct.id }));
    shuffle(CHANGE_TYPES.filter((ct) => ct.id !== pick!.ct.id && fitsChannel(ct, pick!.channelIdx)))
      .slice(0, 2)
      .forEach((ct) => candidates.set(`${pick!.channelIdx}:${ct.id}`, { channelIdx: pick!.channelIdx, changeId: ct.id }));
    candidates.delete(correctKey);
    const distractors = shuffle([...candidates.values()]).slice(0, 3);

    questions.push({
      channelIdx: pick.channelIdx,
      changeId: pick.ct.id,
      options: shuffle([{ channelIdx: pick.channelIdx, changeId: pick.ct.id }, ...distractors])
    });
  }
  return questions;
}

/** The "before" and "after" console settings for a question. */
export function buildQuestionMixes(songId: string, q: WhatChangedQuestion) {
  const before = makeDefaultChannels(songId);
  const ct = CHANGE_TYPES.find((c) => c.id === q.changeId) || CHANGE_TYPES[0];
  const after = before.map((ch, i) => (i === q.channelIdx ? ct.apply(ch) : ch));
  const master: MasterSettings = makeDefaultMaster();
  return { before: { channels: before, master }, after: { channels: after, master } };
}

interface WhatChangedProps {
  currentSongId: string;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onAudition: (mix: { channels: ChannelSettings[]; master: MasterSettings } | null) => void;
  bestScore: number;
  onFinish: (correct: number) => void;
}

export const WhatChanged: React.FC<WhatChangedProps> = ({
  currentSongId,
  isPlaying,
  onPlay,
  onPause,
  onAudition,
  bestScore,
  onFinish
}) => {
  // Channel names and stem types come straight from the song, so questions always match what's loaded
  const channels = useMemo(() => makeDefaultChannels(currentSongId), [currentSongId]);
  const [questions, setQuestions] = useState<WhatChangedQuestion[]>(() => generateQuestions(makeDefaultChannels(currentSongId), currentSongId));
  const [qIndex, setQIndex] = useState(0);
  const [listening, setListening] = useState<'A' | 'B'>('A');
  const [answers, setAnswers] = useState<(number | null)[]>(() => Array(WHAT_CHANGED_QUESTIONS).fill(null));
  const [finished, setFinished] = useState(false);

  const question = questions[qIndex];
  const mixes = useMemo(() => buildQuestionMixes(currentSongId, question), [currentSongId, question]);
  const selected = answers[qIndex];
  const answered = selected !== null;
  const correctCount = answers.filter((a, i) => a !== null && isCorrect(questions[i], a)).length;

  // Send A (before) or B (after) to the speakers. Restores the student's console on unmount.
  useEffect(() => {
    onAudition(listening === 'A' ? mixes.before : mixes.after);
  }, [listening, mixes]);
  useEffect(() => () => onAudition(null), []);

  // Switching songs mid-set changes which parts are on which channel, so start a fresh set
  const [setSongId, setSetSongId] = useState(currentSongId);
  useEffect(() => {
    if (currentSongId !== setSongId) {
      setSetSongId(currentSongId);
      startNewSet();
    }
  }, [currentSongId]);

  const startNewSet = () => {
    setQuestions(generateQuestions(channels, currentSongId));
    setQIndex(0);
    setAnswers(Array(WHAT_CHANGED_QUESTIONS).fill(null));
    setListening('A');
    setFinished(false);
  };

  const choose = (optionIdx: number) => {
    if (answered) return;
    const next = [...answers];
    next[qIndex] = optionIdx;
    setAnswers(next);
  };

  const goNext = () => {
    if (qIndex < WHAT_CHANGED_QUESTIONS - 1) {
      setQIndex(qIndex + 1);
      setListening('A');
    } else {
      setFinished(true);
      onFinish(correctCount);
    }
  };

  const labelFor = (opt: { channelIdx: number; changeId: string }) => {
    const ct = CHANGE_TYPES.find((c) => c.id === opt.changeId);
    return `${channels[opt.channelIdx]?.name || `Ch ${opt.channelIdx + 1}`} ${ct?.short || ''}`;
  };

  const transport = (
    <div className="flex flex-col sm:flex-row items-stretch gap-3">
      <button
        onClick={isPlaying ? onPause : onPlay}
        className={`px-4 py-3 rounded-lg font-mono font-bold text-sm transition-colors ${
          isPlaying ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
        }`}
      >
        {isPlaying ? '❚❚ PAUSE' : '▶ PLAY'}
      </button>
      <div className="flex flex-1 rounded-lg overflow-hidden border border-zinc-700">
        <button
          onClick={() => setListening('A')}
          className={`flex-1 px-4 py-3 font-mono font-bold text-sm transition-all ${
            listening === 'A' ? 'bg-sky-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-750'
          }`}
        >
          A · BEFORE
        </button>
        <button
          onClick={() => setListening('B')}
          className={`flex-1 px-4 py-3 font-mono font-bold text-sm transition-all ${
            listening === 'B' ? 'bg-fuchsia-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-750'
          }`}
        >
          B · AFTER
        </button>
      </div>
    </div>
  );

  if (finished) {
    return (
      <div className="w-full max-w-3xl mx-auto flex flex-col gap-4 pb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 sm:p-6 shadow-xl flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <span className="text-xs font-mono font-bold text-fuchsia-400 uppercase">EAR TRAINING DRILL</span>
              <h2 className="text-xl font-bold text-zinc-100 mt-0.5">WHAT CHANGED? RESULTS</h2>
            </div>
            <span className="text-3xl font-mono font-extrabold text-fuchsia-400">
              {correctCount} / {WHAT_CHANGED_QUESTIONS}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {questions.map((q, i) => {
              const ok = answers[i] !== null && isCorrect(q, answers[i]!);
              return (
                <div
                  key={i}
                  className={`text-xs font-mono p-2 rounded border flex items-start gap-2 ${
                    ok ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200' : 'bg-rose-950/20 border-rose-900/60 text-rose-200'
                  }`}
                >
                  <span className="font-bold">{ok ? '✓' : '✗'}</span>
                  <span>
                    Q{i + 1}: {labelFor({ channelIdx: q.channelIdx, changeId: q.changeId })}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800">
            <span className="text-xs font-mono text-zinc-400">
              Best score so far: <strong className="text-emerald-400">{Math.max(bestScore, correctCount)} / {WHAT_CHANGED_QUESTIONS}</strong> (this goes on your grade report)
            </span>
            <button
              onClick={startNewSet}
              className="px-5 py-2.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-mono font-bold text-xs"
            >
              TRY A NEW SET OF 8
            </button>
          </div>
        </div>
      </div>
    );
  }

  const correctOption = question.options.findIndex(
    (o) => o.channelIdx === question.channelIdx && o.changeId === question.changeId
  );
  const changeInfo = CHANGE_TYPES.find((c) => c.id === question.changeId);

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-4 pb-8">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6 shadow-xl flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-fuchsia-400 uppercase">EAR TRAINING DRILL</span>
            <h2 className="text-xl font-bold text-zinc-100 mt-0.5">WHAT CHANGED?</h2>
          </div>
          <div className="flex flex-col items-end text-xs font-mono">
            <span className="text-zinc-300 font-bold">
              QUESTION {qIndex + 1} OF {WHAT_CHANGED_QUESTIONS}
            </span>
            <span className="text-zinc-500">
              {correctCount} correct so far · best {bestScore}/{WHAT_CHANGED_QUESTIONS}
            </span>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5">
          {questions.map((q, i) => {
            const a = answers[i];
            const color =
              a === null
                ? i === qIndex
                  ? 'bg-fuchsia-500'
                  : 'bg-zinc-800'
                : isCorrect(q, a)
                ? 'bg-emerald-500'
                : 'bg-rose-500';
            return <div key={i} className={`h-1.5 flex-1 rounded-full ${color}`} />;
          })}
        </div>

        <p className="text-sm text-zinc-300">
          <strong className="text-zinc-100">One thing changed on one channel</strong> between A and B. Play the song, flip
          between A and B as many times as you like, then pick what changed.
          {qIndex < 4 ? (
            <span className="text-zinc-500"> (Warm-up: these first changes are big.)</span>
          ) : (
            <span className="text-zinc-500"> (These changes can be more subtle, so listen closely.)</span>
          )}
        </p>

        {transport}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {question.options.map((opt, i) => {
            const isChosen = selected === i;
            const isRight = i === correctOption;
            let style = 'bg-zinc-950 border-zinc-700 text-zinc-200 hover:border-fuchsia-500 hover:bg-zinc-900';
            if (answered) {
              if (isRight) style = 'bg-emerald-950/50 border-emerald-500 text-emerald-200';
              else if (isChosen) style = 'bg-rose-950/40 border-rose-500 text-rose-200';
              else style = 'bg-zinc-950 border-zinc-800 text-zinc-500';
            }
            return (
              <button
                key={i}
                onClick={() => choose(i)}
                disabled={answered}
                className={`text-left px-3 py-3 rounded-lg border text-sm transition-colors ${style} ${answered ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <span className="font-mono font-bold mr-2 text-zinc-500">{i + 1}.</span>
                {labelFor(opt)}
                {answered && isRight && <span className="ml-2 font-bold">✓</span>}
                {answered && isChosen && !isRight && <span className="ml-2 font-bold">✗</span>}
              </button>
            );
          })}
        </div>

        {answered && (
          <div
            className={`p-3 rounded-lg border text-sm flex flex-col gap-1 ${
              selected === correctOption ? 'bg-emerald-950/30 border-emerald-800/60' : 'bg-zinc-950 border-zinc-700'
            }`}
          >
            <span className={`font-mono font-bold text-xs ${selected === correctOption ? 'text-emerald-400' : 'text-rose-400'}`}>
              {selected === correctOption ? 'NICE EARS!' : `NOT QUITE. IT WAS: ${labelFor(question.options[correctOption]).toUpperCase()}`}
            </span>
            <span className="text-zinc-300">
              <strong className="text-zinc-200">What to listen for:</strong> {changeInfo?.listenFor}
            </span>
            <span className="text-zinc-500 text-xs">Flip between A and B again now that you know what to listen for.</span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={goNext}
            disabled={!answered}
            className={`px-5 py-2.5 rounded-lg font-mono font-bold text-xs transition-colors ${
              answered ? 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            }`}
          >
            {qIndex < WHAT_CHANGED_QUESTIONS - 1 ? 'NEXT QUESTION →' : 'SEE RESULTS →'}
          </button>
        </div>
      </div>
    </div>
  );
};

function isCorrect(q: WhatChangedQuestion, optionIdx: number): boolean {
  const o = q.options[optionIdx];
  return !!o && o.channelIdx === q.channelIdx && o.changeId === q.changeId;
}
