import React, { useEffect, useState } from 'react';
import { EQ_SECTIONS, EqSectionId, EqWizardScores, EQ_LEVELS } from '../../types/audio';
import { eqWizardPlayer } from '../../audio/eqWizardAudio';
import { FREQ_ID_LEVELS, FREQ_BAND_LEVELS, FREQ_TWEAK_LEVELS } from './levels';
import { FreqId } from './FreqId';
import { FreqBandId } from './FreqBandId';
import { FreqTweak } from './FreqTweak';

interface EqWizardProps {
  sections: EqSectionId[];          // only the assigned sections are shown
  assignmentTitle: string;
  scores: EqWizardScores;
  onRecord: (section: EqSectionId, level: number, pct: number) => void;
}

const LEVEL_INFO: Record<EqSectionId, { title: string; blurb: string; headphones?: boolean }[]> = {
  freqid: FREQ_ID_LEVELS.map((l) => ({ title: l.title, blurb: l.blurb, headphones: l.headphones })),
  freqband: FREQ_BAND_LEVELS.map((l) => ({ title: l.title, blurb: l.blurb })),
  freqtweak: FREQ_TWEAK_LEVELS.map((l) => ({ title: l.title, blurb: l.blurb }))
};

const INTRO: Record<EqSectionId, string> = {
  freqid: 'A test tone plays. Click where it lives on the EQ. Each level zooms in further, from Low/Mid/High down to single third-octave bands.',
  freqband: 'A real song has been EQ\'d. Flip between the original and the changed version and pick what was boosted or cut.',
  freqtweak: 'An instrument has had its EQ knocked out of shape. Use the console\'s EQ knobs to put it back the way it should sound.'
};

/** EQ Wizard: frequency ear training in three sections of six levels each. */
export const EqWizard: React.FC<EqWizardProps> = ({ sections, assignmentTitle, scores, onRecord }) => {
  const visible = EQ_SECTIONS.filter((s) => sections.includes(s.id));
  const [section, setSection] = useState<EqSectionId>(visible[0]?.id ?? 'freqid');
  const [level, setLevel] = useState<number | null>(null);

  // Stop any EQ Wizard audio when leaving the tab
  useEffect(() => () => eqWizardPlayer.stopAll(), []);

  const avg = (id: EqSectionId) => Math.round(scores[id].reduce((a, x) => a + Math.max(0, x), 0) / EQ_LEVELS);
  const tried = (id: EqSectionId) => scores[id].filter((x) => x >= 0).length;

  if (level !== null) {
    const common = {
      levelIndex: level,
      best: Math.max(0, scores[section][level]),
      onDone: (pct: number) => onRecord(section, level, pct),
      onQuit: () => {
        eqWizardPlayer.stopAll();
        setLevel(null);
      }
    };
    return (
      <div className="w-full">
        {section === 'freqid' && <FreqId key={`i${level}`} {...common} />}
        {section === 'freqband' && <FreqBandId key={`b${level}`} {...common} />}
        {section === 'freqtweak' && <FreqTweak key={`t${level}`} {...common} />}
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-4">
      {assignmentTitle && (
        <span className="text-[11px] font-mono text-zinc-400">
          ASSIGNMENT: <strong className="text-cyan-300">{assignmentTitle}</strong>
        </span>
      )}
      <nav className={`grid grid-cols-1 ${['sm:grid-cols-1', 'sm:grid-cols-1', 'sm:grid-cols-2', 'sm:grid-cols-3'][visible.length] || 'sm:grid-cols-3'} gap-2`}>
        {visible.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`text-left px-3 py-2 rounded-lg border transition-all ${
              section === s.id ? 'bg-orange-500/15 border-orange-400' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs font-mono font-bold ${section === s.id ? 'text-orange-300' : 'text-zinc-200'}`}>{s.label}</span>
              <span className={`text-[10px] font-mono font-bold ${tried(s.id) === EQ_LEVELS ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {tried(s.id) ? `${avg(s.id)}% · ${tried(s.id)}/${EQ_LEVELS}` : 'not tried'}
              </span>
            </div>
            <span className="block text-[11px] text-zinc-500 mt-0.5">{s.blurb}</span>
          </button>
        ))}
      </nav>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6 flex flex-col gap-4">
        <div>
          <span className="text-xs font-mono font-bold text-orange-400 uppercase">EQ WIZARD</span>
          <h2 className="text-xl font-bold text-zinc-100">{EQ_SECTIONS.find((s) => s.id === section)?.label}</h2>
          <p className="text-sm text-zinc-400 mt-1">{INTRO[section]} 8 questions per level, no timer. Your best score on each level counts.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {LEVEL_INFO[section].map((l, i) => {
            const best = scores[section][i];
            return (
              <button
                key={i}
                onClick={() => setLevel(i)}
                className="text-left bg-zinc-950 border border-zinc-800 hover:border-orange-500/70 rounded-xl p-4 flex flex-col gap-1.5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-zinc-500">LEVEL {i + 1}</span>
                  <span className={`text-xs font-mono font-bold ${best >= 70 ? 'text-emerald-400' : best >= 0 ? 'text-amber-400' : 'text-zinc-600'}`}>
                    {best >= 0 ? `best ${best}%` : '—'}
                  </span>
                </div>
                <span className="text-base font-bold text-zinc-100">{l.title}</span>
                <span className="text-xs text-zinc-400">{l.blurb}</span>
                {l.headphones && <span className="text-[10px] font-mono font-bold text-amber-400">🎧 HEADPHONES NEEDED</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
