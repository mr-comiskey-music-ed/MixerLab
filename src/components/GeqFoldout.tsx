import React, { useState } from 'react';
import { MasterSettings } from '../types/audio';
import { GEQ_10, GEQ_31 } from '../audio/eqBands';
import { GraphicEQ } from './GraphicEQ';

interface GeqFoldoutProps {
  master: MasterSettings;
  onUpdateMaster: (m: MasterSettings) => void;
}

/** Graphic EQ on the main mix, tucked into a fold-out panel under the console. */
export const GeqFoldout: React.FC<GeqFoldoutProps> = ({ master, onUpdateMaster }) => {
  const [open, setOpen] = useState(false);
  const mode = master.geqMode || 'off';
  const bands = mode === '10' ? GEQ_10 : GEQ_31;
  const gains = mode === '10' ? master.geq10 : master.geq31;
  const moved = (gains || []).some((g) => g !== 0);

  const setMode = (m: 'off' | '10' | '31') => onUpdateMaster({ ...master, geqMode: m });
  const setBand = (i: number, db: number) => {
    const key = mode === '10' ? 'geq10' : 'geq31';
    const next = [...(master[key] || Array(bands.length).fill(0))];
    next[i] = db;
    onUpdateMaster({ ...master, [key]: next });
  };
  const flatten = () => onUpdateMaster({ ...master, [mode === '10' ? 'geq10' : 'geq31']: Array(bands.length).fill(0) });

  return (
    <div className="w-full max-w-6xl mt-3 bg-zinc-900 border border-zinc-800 rounded-xl">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="text-xs font-mono font-bold text-orange-300">
          {open ? '▾' : '▸'} GRAPHIC EQ <span className="text-zinc-500 font-normal">(main mix)</span>
        </span>
        <span className={`text-[11px] font-mono font-bold ${mode === 'off' ? 'text-zinc-600' : 'text-orange-400'}`}>
          {mode === 'off' ? 'OFF' : `${mode}-BAND ${moved ? '· ACTIVE' : '· FLAT'}`}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(['off', '10', '31'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border ${
                  mode === m ? 'bg-orange-500 text-zinc-950 border-orange-300' : 'bg-zinc-950 text-zinc-400 border-zinc-700 hover:border-zinc-500'
                }`}
              >
                {m === 'off' ? 'OFF' : `${m}-BAND`}
              </button>
            ))}
            {mode !== 'off' && (
              <button
                onClick={flatten}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold border bg-zinc-950 text-zinc-400 border-zinc-700 hover:border-zinc-500"
              >
                FLATTEN
              </button>
            )}
            <span className="text-[11px] text-zinc-500">
              Shapes the whole mix after the main fader. Drag a slider; double-click to reset it.
            </span>
          </div>
          {mode !== 'off' && <GraphicEQ bands={bands} gains={gains} onChange={setBand} height={180} />}
        </div>
      )}
    </div>
  );
};
