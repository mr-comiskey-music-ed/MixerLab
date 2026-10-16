import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EQ_QUESTIONS } from '../../types/audio';
import { GEQ_31 } from '../../audio/eqBands';
import { eqWizardPlayer } from '../../audio/eqWizardAudio';
import { Clip, EQ_WIZARD_SONGS, getSongStems, pickMixClip } from '../../audio/clipFinder';
import { GraphicEQ, GeqOverlay } from '../GraphicEQ';
import { FREQ_BAND_LEVELS, freqBandChange, makeFreqBandQuestions, levelPct } from './levels';
import { QuizHeader, LevelResults, ABSwitch } from './QuizParts';

interface Props {
  levelIndex: number;
  best: number;
  onDone: (pct: number) => void;
  onQuit: () => void;
}

const CLIP_SECONDS = 9;

export const FreqBandId: React.FC<Props> = ({ levelIndex, best, onDone, onQuit }) => {
  const level = FREQ_BAND_LEVELS[levelIndex];
  const songIds = EQ_WIZARD_SONGS.map((s) => s.id);
  const [questions, setQuestions] = useState(() => makeFreqBandQuestions(level, EQ_QUESTIONS, songIds));
  const [qIndex, setQIndex] = useState(0);
  const [picks, setPicks] = useState<(string | null)[]>(() => Array(EQ_QUESTIONS).fill(null));
  const [finished, setFinished] = useState(false);
  const [clip, setClip] = useState<Clip | null>(null);
  const [which, setWhich] = useState<'A' | 'B'>('A');
  const [loading, setLoading] = useState(true);
  const usedClips = useRef<Clip[]>([]);
  const [, force] = useState(0);

  useEffect(() => {
    eqWizardPlayer.onChange = () => force((n) => n + 1);
    return () => {
      eqWizardPlayer.stopAll();
      eqWizardPlayer.onChange = undefined;
    };
  }, []);

  const q = questions[qIndex];

  // Find a clip of this question's song with music all the way through
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    eqWizardPlayer.stopAll();
    getSongStems(q.songId).then((stems) => {
      if (cancelled) return;
      const c = pickMixClip(stems, CLIP_SECONDS, usedClips.current);
      if (c) usedClips.current = [...usedClips.current.slice(-6), c];
      setClip(c);
      setWhich('A');
      eqWizardPlayer.which = 'A';
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [q]);

  const picked = picks[qIndex];
  const answerId = `${q.bandId}:${q.dir}`;
  const results = picks.map((p, i) => (p === null ? null : p === `${questions[i].bandId}:${questions[i].dir}` ? 100 : 0));
  const accuracy = Math.round(results.reduce<number>((a, r) => a + (r ?? 0), 0) / EQ_QUESTIONS);
  const levelScore = levelPct(accuracy);
  const describe = (bandId: string, dir: string) =>
    `${level.bands.find((b) => b.id === bandId)?.label} ${level.cutsToo ? (dir === 'boost' ? 'boost' : 'cut') : 'boost'}`;

  const play = () => clip && eqWizardPlayer.playClip(clip, freqBandChange(level, q));
  const flip = (w: 'A' | 'B') => {
    setWhich(w);
    eqWizardPlayer.setWhich(w);
  };

  const rows = level.cutsToo ? 2 : 1;
  const overlays: GeqOverlay[] = useMemo(() => {
    const list: GeqOverlay[] = [];
    for (const b of level.bands) {
      const dirs: ('boost' | 'cut')[] = level.cutsToo ? ['boost', 'cut'] : ['boost'];
      dirs.forEach((dir, row) => {
        const id = `${b.id}:${dir}`;
        list.push({
          id,
          from: b.from,
          to: b.to,
          row,
          label: level.cutsToo ? `${dir === 'boost' ? '▲' : '▼'} ${b.label}` : b.label,
          sub: level.cutsToo ? (dir === 'boost' ? 'BOOST' : 'CUT') : undefined,
          color: b.color,
          state: picked === null ? 'idle' : id === answerId ? 'correct' : id === picked ? 'wrong' : 'faded'
        });
      });
    }
    return list;
  }, [level, picked, answerId]);

  const choose = (id: string) => {
    if (picked !== null) return;
    const next = [...picks];
    next[qIndex] = id;
    setPicks(next);
  };

  const goNext = () => {
    eqWizardPlayer.stopAll();
    if (qIndex < EQ_QUESTIONS - 1) setQIndex(qIndex + 1);
    else {
      setFinished(true);
      onDone(levelScore);
    }
  };

  const retry = () => {
    setQuestions(makeFreqBandQuestions(level, EQ_QUESTIONS, songIds));
    setPicks(Array(EQ_QUESTIONS).fill(null));
    setQIndex(0);
    setFinished(false);
  };

  if (finished) {
    return (
      <LevelResults
        section="Freq Band ID"
        title={level.title}
        score={levelScore}
        accuracy={accuracy}
        best={best}
        review={questions.map((qq, i) => ({
          text: `${EQ_WIZARD_SONGS.find((s) => s.id === qq.songId)?.title}: ${describe(qq.bandId, qq.dir)}`,
          pct: results[i] ?? 0
        }))}
        onRetry={retry}
        onBack={onQuit}
      />
    );
  }

  const song = EQ_WIZARD_SONGS.find((s) => s.id === q.songId);

  return (
    <div className="w-full max-w-5xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6 flex flex-col gap-4">
      <QuizHeader section="Freq Band ID" title={level.title} qIndex={qIndex} results={results} onQuit={onQuit} />
      <p className="text-sm text-zinc-300">
        Listen to the <strong className="text-sky-300">original</strong>, then the <strong className="text-orange-300">changed</strong>{' '}
        version. {level.cutsToo ? 'Which change was made?' : 'Which part of the sound was boosted?'}{' '}
        <span className="text-zinc-500">({song?.title}, full mix)</span>
      </p>

      <ABSwitch
        which={which}
        labels={['ORIGINAL', 'CHANGED']}
        isPlaying={eqWizardPlayer.isPlaying}
        loading={loading}
        onPlay={play}
        onStop={() => eqWizardPlayer.stopAll()}
        onWhich={flip}
      />

      <GraphicEQ
        bands={GEQ_31}
        overlays={overlays}
        overlayRows={rows}
        onPickOverlay={choose}
        disabled={picked !== null}
        height={rows === 2 ? 220 : 180}
        reveal={(() => {
          if (picked === null) return null;
          const b = level.bands.find((x) => x.id === q.bandId)!;
          return { from: b.from, to: b.to, db: q.dir === 'cut' ? -level.amount : level.amount };
        })()}
      />

      {level.vocab && (
        <div className="relative w-full h-9 -mt-2">
          {level.bands.map((b) => (
            <div
              key={b.id}
              className="absolute text-center text-[10px] sm:text-[11px] leading-tight font-semibold"
              style={{ left: `${(b.from / GEQ_31.length) * 100}%`, width: `${((b.to - b.from + 1) / GEQ_31.length) * 100}%`, color: `rgb(${b.color})` }}
            >
              {b.label}
              <br />
              <span className="text-zinc-400 font-normal">{b.vocab}</span>
            </div>
          ))}
        </div>
      )}

      {picked !== null && (
        <div
          className={`rounded-lg border px-3 py-2.5 text-sm ${
            picked === answerId ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200' : 'bg-rose-950/20 border-rose-900/60 text-rose-200'
          }`}
        >
          <strong>{picked === answerId ? 'Nice ears!' : 'Not quite.'}</strong> It was a <strong>{describe(q.bandId, q.dir)}</strong>{' '}
          of {level.amount} dB. Flip between A and B again now that you know.
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
