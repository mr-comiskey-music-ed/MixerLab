import React from 'react';
import { CHALLENGE_TABS, ChallengeTabId } from '../types/audio';

interface ChallengeTabsProps {
  active: ChallengeTabId;
  onSelect: (tab: ChallengeTabId) => void;
  progress: Record<ChallengeTabId, { text: string; done: boolean }>;
}

const BLURBS: Record<ChallengeTabId, string> = {
  scenarios: 'Fix real live-sound problems',
  whatchanged: 'Ear training: spot the change',
  match: 'Match a mix by ear',
  mymix: 'Your own creative mix'
};

/** Sub-tabs under CHALLENGES, each with a small progress readout. */
export const ChallengeTabs: React.FC<ChallengeTabsProps> = ({ active, onSelect, progress }) => (
  <nav className="w-full max-w-5xl mx-auto mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
    {CHALLENGE_TABS.map((tab) => {
      const isActive = tab.id === active;
      const p = progress[tab.id];
      return (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={`text-left px-3 py-2 rounded-lg border transition-all ${
            isActive
              ? 'bg-cyan-500/15 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
              : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className={`text-xs font-mono font-bold ${isActive ? 'text-cyan-300' : 'text-zinc-200'}`}>{tab.label}</span>
            <span className={`text-[10px] font-mono font-bold whitespace-nowrap ${p.done ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {p.text}
            </span>
          </div>
          <span className="block text-[11px] text-zinc-500 mt-0.5 truncate">{BLURBS[tab.id]}</span>
        </button>
      );
    })}
  </nav>
);
