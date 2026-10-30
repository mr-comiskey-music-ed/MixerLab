import React from 'react';

export type SaveStatus = 'idle' | 'saved' | 'failed';

/** Small status label for the header: lets students see their work is being kept. */
export const SaveIndicator: React.FC<{ status: SaveStatus; savedAt: number | null }> = ({ status, savedAt }) => {
  if (status === 'idle') return null;
  if (status === 'failed') {
    return (
      <span
        className="text-[11px] font-mono font-bold text-meter-400 px-1"
        title="This browser is blocking saving. Your work will be lost if you close this tab. Copy your code from the Grade Report to keep it."
      >
        ⚠ NOT SAVING
      </span>
    );
  }
  const time = savedAt ? new Date(savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  return (
    <span className="text-[11px] font-mono text-zinc-400 px-1" title="Your work is saved in this browser on this computer.">
      ✓ Saved{time ? ` ${time}` : ''}
    </span>
  );
};

/** Shown on load when this browser has saved work from an earlier visit. */
export const RestorePrompt: React.FC<{ savedAt: number; onRestore: () => void; onStartFresh: () => void }> = ({
  savedAt,
  onRestore,
  onStartFresh
}) => {
  const when = new Date(savedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 p-5 shadow-xl">
        <h2 className="font-display text-xl font-bold text-zinc-100">Restore your last session?</h2>
        <p className="mt-2 text-sm text-zinc-300">
          Your work from {when} is saved in this browser. Restore it to pick up where you left off, or start over.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onRestore}
            className="flex-1 rounded bg-meter-500 px-3 py-2 font-mono text-sm font-bold text-black hover:bg-meter-400 cursor-pointer"
          >
            Restore
          </button>
          <button
            onClick={onStartFresh}
            className="flex-1 rounded border border-zinc-600 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-200 hover:bg-zinc-700 cursor-pointer"
          >
            Start Fresh
          </button>
        </div>
      </div>
    </div>
  );
};
