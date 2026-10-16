import React, { useState } from 'react';
import { MasterSettings } from '../types/audio';
import { audioEngine, reverbDecayScale, PLATE_BASE_SECONDS, HALL_BASE_SECONDS } from '../audio/audioEngine';
import { Knob } from './Knob';

interface FxPanelProps {
  master: MasterSettings;
  onField: <K extends keyof MasterSettings>(field: K, val: MasterSettings[K]) => void;
}

const FX_TYPES = ['plate', 'hall', 'delay', 'chorus'] as const;
const DEFAULT_DELAY_MS = 375;

/**
 * The master FX controls, the same on every console: pick an effect, read its description
 * (or tap a tempo for delay), and turn the one purple knob that shapes it.
 */
export const FxPanel: React.FC<FxPanelProps> = ({ master, onField }) => {
  const [delayMs, setDelayMs] = useState(() => audioEngine.getDelayInfo().delayMs);
  const [tapFlash, setTapFlash] = useState(false);

  const type = master.fxType;
  const decay = master.fxDecay ?? 50;
  const scale = reverbDecayScale(decay);

  const handleTap = () => {
    const res = audioEngine.tapTempo();
    setDelayMs(Math.round(res.delaySec * 1000));
    setTapFlash(true);
    setTimeout(() => setTapFlash(false), 120);
  };

  const boxClass = 'flex flex-col items-center justify-center p-1.5 bg-zinc-900/60 rounded border border-zinc-850 gap-0.5';
  const hintRow = (left: string, mid: string, right: string) => (
    <div className="flex items-center justify-between w-full px-1.5 text-[7px] font-mono text-zinc-400">
      <span>{left}</span>
      <span className="text-purple-300 font-bold">{mid}</span>
      <span>{right}</span>
    </div>
  );

  return (
    <>
      {/* FX Type Selector */}
      <div className="grid grid-cols-4 gap-1">
        {FX_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => onField('fxType', t)}
            className={`text-[8px] font-mono uppercase py-1 rounded border transition-colors ${
              type === t ? 'bg-purple-600 text-white border-purple-400 font-bold shadow-sm' : 'bg-zinc-850 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Description (or the tap-tempo button for delay) */}
      {type === 'delay' ? (
        <button
          onClick={handleTap}
          className={`w-full text-[8px] font-mono text-center py-0.5 rounded border font-bold transition-all ${
            tapFlash
              ? 'bg-purple-500 text-white border-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.8)]'
              : 'bg-purple-950 hover:bg-purple-900 text-purple-300 border-purple-700'
          }`}
          title="Click rhythmically to set the delay time"
        >
          TAP TEMPO · {delayMs}ms
        </button>
      ) : (
        <div className="text-[8px] font-mono text-center text-zinc-400 py-0.5 bg-zinc-900/90 rounded border border-zinc-850">
          {type === 'plate' && `LUSH EMT 140 STEEL PLATE (${(PLATE_BASE_SECONDS * scale).toFixed(1)}s)`}
          {type === 'hall' && `CONCERT HALL BLOOM (${(HALL_BASE_SECONDS * scale).toFixed(1)}s)`}
          {type === 'chorus' && `JUNO-STYLE STEREO CHORUS (${Math.round(master.chorusIntensity ?? 50)}%)`}
        </div>
      )}

      {/* The one purple knob */}
      {(type === 'plate' || type === 'hall') && (
        <div className={boxClass} title="Double-click to reset to the default reverb length">
          <Knob
            label="DECAY"
            value={decay}
            min={0}
            max={100}
            step={1}
            unit=""
            color="purple"
            size="sm"
            defaultValue={50}
            formatValue={(v) => `${((type === 'plate' ? PLATE_BASE_SECONDS : HALL_BASE_SECONDS) * reverbDecayScale(v)).toFixed(1)}s`}
            onChange={(v) => onField('fxDecay', v)}
          />
          {hintRow('SHORT', `${Math.round(decay)}%`, 'LONG')}
        </div>
      )}

      {type === 'delay' && (
        <div className={boxClass} title="Double-click to reset to 375ms">
          <Knob
            label="DELAY TIME"
            value={delayMs}
            min={80}
            max={1200}
            step={5}
            unit="ms"
            color="purple"
            size="sm"
            defaultValue={DEFAULT_DELAY_MS}
            formatValue={(v) => `${Math.round(v)}ms`}
            onChange={(v) => {
              audioEngine.setDelayTime(v / 1000);
              setDelayMs(Math.round(v));
            }}
          />
          {hintRow('FAST', '', 'SLOW')}
        </div>
      )}

      {type === 'chorus' && (
        <div className={boxClass} title="Double-click to reset Chorus Intensity to 50%">
          <Knob
            label="INTENSITY"
            value={master.chorusIntensity ?? 50}
            min={0}
            max={100}
            step={1}
            color="purple"
            size="sm"
            unit="%"
            defaultValue={50}
            formatValue={(v) => `${Math.round(v)}%`}
            onChange={(v) => {
              onField('chorusIntensity', v);
              audioEngine.setChorusIntensity(v);
            }}
          />
          {hintRow('SUBTLE', `${Math.round(master.chorusIntensity ?? 50)}%`, 'DEEP')}
        </div>
      )}
    </>
  );
};
