import React from 'react';
import { Knob } from './Knob';
import { compLightLevel, CompLightLevel } from '../audio/audioEngine';

interface CompKnobProps {
  value: number;          // 0-100
  gainReductionDb: number; // live gain reduction (positive dB)
  onChange: (val: number) => void;
  label?: string;
}

const LIGHT_STYLES: Record<CompLightLevel, { lamp: string; text: string; word: string }> = {
  off: {
    lamp: 'bg-zinc-800 border-zinc-700',
    text: 'text-zinc-600',
    word: 'OFF'
  },
  green: {
    lamp: 'bg-emerald-400 border-emerald-200 shadow-[0_0_8px_rgba(52,211,153,0.9)]',
    text: 'text-emerald-400',
    word: 'LIGHT'
  },
  yellow: {
    lamp: 'bg-amber-400 border-amber-200 shadow-[0_0_8px_rgba(251,191,36,0.9)]',
    text: 'text-amber-400',
    word: 'SOLID'
  },
  red: {
    lamp: 'bg-red-500 border-red-300 shadow-[0_0_10px_rgba(239,68,68,0.95)]',
    text: 'text-red-400',
    word: 'EXTREME'
  }
};

export const LIGHT_DESCRIPTIONS: Record<CompLightLevel, string> = {
  off: 'No compression happening',
  green: 'Light compression (about 1–6 dB of gain reduction)',
  yellow: 'Solid compression (about 6–15 dB of gain reduction)',
  red: 'Extreme compression (more than 15 dB of gain reduction)'
};

/**
 * Orange one-knob compressor with a gain-reduction light beside it.
 * Same footprint as the GAIN knob + SIG/PEAK boxes, so it fits on small screens.
 */
export const CompKnob: React.FC<CompKnobProps> = ({ value, gainReductionDb, onChange, label = 'COMP' }) => {
  const level = compLightLevel(gainReductionDb || 0);
  const style = LIGHT_STYLES[level];

  return (
    <div className="flex items-center gap-1 w-full justify-center">
      <Knob
        label={label}
        value={value}
        min={0}
        max={100}
        step={1}
        unit=""
        color="orange"
        size="sm"
        defaultValue={0}
        formatValue={(v) => (v <= 0 ? 'OFF' : `${Math.round(v)}`)}
        onChange={onChange}
      />
      <div
        className="flex flex-col items-center justify-center gap-0.5 w-8"
        title={`${LIGHT_DESCRIPTIONS[level]}${gainReductionDb >= 1 ? ` — ${gainReductionDb.toFixed(1)} dB right now` : ''}`}
      >
        <div className={`w-3 h-3 rounded-full border transition-colors duration-75 ${style.lamp}`} />
        <span className={`text-[6.5px] font-mono font-bold leading-none ${style.text}`}>{style.word}</span>
      </div>
    </div>
  );
};
