import React from 'react';
import { ChallengeTabId } from '../types/audio';

interface ChallengeTabsProps {
  tabs: { id: ChallengeTabId; label: string }[];
  assignmentTitle: string; // shown above the tabs when the student opened an assignment link
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
const COLS: Record<number, string> = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' };

export const ChallengeTabs: React.FC<ChallengeTabsProps> = ({ tabs, assignmentTitle, active, onSelect, progress }) => (
  <div className="w-full max-w-5xl mx-auto mb-4 flex flex-col gap-2">
  {assignmentTitle && (
    <span className="text-[11px] font-mono text-zinc-400">
      ASSIGNMENT: <strong className="text-meter-300">{assignmentTitle}</strong>
    </span>
  )}
  <nav className={`grid grid-cols-2 ${COLS[Math.min(4, tabs.length)] || 'sm:grid-cols-4'} gap-2`}>
    {tabs.map((tab) => {
      const isActive = tab.id === active;
      const p = progress[tab.id];
      return (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={`text-left px-3 py-2 rounded-lg border transition-all ${
            isActive
              ? 'bg-meter-500/15 border-meter-400 shadow-[0_0_10px_color-mix(in_srgb,var(--acc-500)_25%,transparent)]'
              : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className={`font-display text-[15px] font-bold tracking-wider ${isActive ? 'text-meter-300' : 'text-zinc-200'}`}>{tab.label}</span>
            <span className={`text-[10px] font-mono font-bold whitespace-nowrap ${p.done ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {p.text}
            </span>
          </div>
          <span className="block text-[11px] text-zinc-500 mt-0.5 truncate">{BLURBS[tab.id]}</span>
        </button>
      );
    })}
  </nav>
  </div>
);
