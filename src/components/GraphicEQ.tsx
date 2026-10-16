import React, { useRef } from 'react';
import { formatHz, GEQ_RANGE_DB } from '../audio/eqBands';

/** A clickable answer box laid over a range of graphic EQ bands. */
export interface GeqOverlay {
  id: string;
  from: number;        // first band index covered
  to: number;          // last band index covered (inclusive)
  row?: number;        // which row (0 = top) when the overlay area is split into rows
  label: string;
  sub?: string;        // small line under the label (Hz range, vocabulary…)
  color: string;       // tailwind-free rgb triplet, e.g. '56,189,248'
  state?: 'idle' | 'correct' | 'wrong' | 'partial' | 'faded';
  partialText?: string;
}

interface GraphicEQProps {
  bands: number[];
  gains?: number[];                         // dB per band (defaults to flat)
  onChange?: (index: number, db: number) => void; // omit for a display-only EQ
  overlays?: GeqOverlay[];
  overlayRows?: number;
  onPickOverlay?: (id: string) => void;
  disabled?: boolean;                       // answers locked in
  dimOutside?: [number, number];            // grey out bands outside this index range
  height?: number;
  /** Slide the faders in this band range to `db`, with a smooth move (used to show the answer). */
  reveal?: { from: number; to: number; db: number } | null;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Graphic EQ: one vertical slider per band (±12 dB). Used as the fold-out EQ on the
 * main mix and as the backdrop for the EQ Wizard answer boxes.
 */
export const GraphicEQ: React.FC<GraphicEQProps> = ({
  bands,
  gains,
  onChange,
  overlays = [],
  overlayRows = 1,
  onPickOverlay,
  disabled = false,
  dimOutside,
  height = 200,
  reveal = null
}) => {
  const areaRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);
  const n = bands.length;
  const colW = 100 / n;
  const inReveal = (i: number) => !!reveal && i >= reveal.from && i <= reveal.to;
  const g = (i: number) => (inReveal(i) ? reveal!.db : gains?.[i] ?? 0);

  const valueFromPointer = (clientY: number) => {
    const rect = areaRef.current!.getBoundingClientRect();
    const pad = 10;
    const t = clamp((clientY - rect.top - pad) / (rect.height - 2 * pad), 0, 1);
    return Math.round((GEQ_RANGE_DB - t * 2 * GEQ_RANGE_DB) * 2) / 2; // 0.5 dB steps
  };

  const onPointerDown = (i: number) => (e: React.PointerEvent) => {
    if (!onChange) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = i;
    onChange(i, valueFromPointer(e.clientY));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!onChange || dragging.current === null) return;
    onChange(dragging.current, valueFromPointer(e.clientY));
  };
  const onPointerUp = () => (dragging.current = null);

  const stateStyle = (o: GeqOverlay) => {
    const c = o.color;
    switch (o.state) {
      case 'correct':
        return { background: `rgba(16,185,129,0.45)`, borderColor: `rgb(52,211,153)` };
      case 'wrong':
        return { background: `rgba(244,63,94,0.40)`, borderColor: `rgb(251,113,133)` };
      case 'partial':
        return { background: `rgba(245,158,11,0.40)`, borderColor: `rgb(251,191,36)` };
      case 'faded':
        return { background: `rgba(${c},0.06)`, borderColor: `rgba(${c},0.25)` };
      default:
        return { background: `rgba(${c},0.22)`, borderColor: `rgba(${c},0.75)` };
    }
  };

  return (
    <div className="w-full select-none">
      <div
        ref={areaRef}
        className="relative w-full bg-zinc-950 rounded-lg border border-zinc-800"
        style={{ height }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* 0 dB line */}
        <div className="absolute left-0 right-0 top-1/2 h-px bg-zinc-700/70 pointer-events-none" />

        {/* Sliders */}
        {bands.map((f, i) => {
          const dim = dimOutside && (i < dimOutside[0] || i > dimOutside[1]);
          const pos = (GEQ_RANGE_DB - g(i)) / (2 * GEQ_RANGE_DB); // 0 top .. 1 bottom
          return (
            <div
              key={f}
              className={`absolute top-0 bottom-0 flex justify-center ${onChange ? 'cursor-ns-resize touch-none' : ''}`}
              style={{ left: `${i * colW}%`, width: `${colW}%`, opacity: dim ? 0.25 : 1 }}
              onPointerDown={onPointerDown(i)}
              onDoubleClick={() => onChange?.(i, 0)}
              title={onChange ? `${formatHz(f)} Hz: ${g(i) > 0 ? '+' : ''}${g(i)} dB (double-click to reset)` : `${formatHz(f)} Hz`}
            >
              {/* Recessed fader slot with a black cap, like a real console fader */}
              <div className="relative my-2.5 w-[5px] rounded-full bg-black border border-zinc-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.9)]">
                <div
                  className={`absolute left-1/2 -translate-x-1/2 w-px ${inReveal(i) ? 'bg-emerald-400/70' : 'bg-zinc-600'}`}
                  style={{
                    top: pos < 0.5 ? `${pos * 100}%` : '50%',
                    height: `${Math.abs(pos - 0.5) * 100}%`,
                    transition: reveal ? 'all 900ms cubic-bezier(.3,.8,.3,1)' : undefined
                  }}
                />
                <div
                  className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 h-[18px] rounded-[3px] border flex items-center justify-center bg-gradient-to-b from-zinc-700 via-zinc-900 to-black ${
                    inReveal(i) ? 'border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'border-zinc-500 shadow-[0_2px_3px_rgba(0,0,0,0.8)]'
                  }`}
                  style={{
                    width: n > 20 ? 13 : 20,
                    top: `${pos * 100}%`,
                    transition: reveal ? 'top 900ms cubic-bezier(.3,.8,.3,1)' : undefined
                  }}
                >
                  <div className={`w-full h-px ${inReveal(i) ? 'bg-emerald-300' : 'bg-zinc-200'}`} />
                </div>
              </div>
            </div>
          );
        })}

        {/* Answer overlays */}
        {overlays.map((o) => {
          const rowH = 100 / overlayRows;
          const top = (o.row ?? 0) * rowH;
          const style = stateStyle(o);
          return (
            <button
              key={o.id}
              onClick={() => !disabled && onPickOverlay?.(o.id)}
              disabled={disabled}
              className={`absolute rounded-md border-2 flex flex-col items-center justify-center text-center px-0.5 transition-colors ${
                disabled ? 'cursor-default' : 'cursor-pointer hover:brightness-150'
              }`}
              style={{
                left: `calc(${o.from * colW}% + 2px)`,
                width: `calc(${(o.to - o.from + 1) * colW}% - 4px)`,
                top: `calc(${top}% + 3px)`,
                height: `calc(${rowH}% - 6px)`,
                ...style
              }}
            >
              <span className="text-[11px] sm:text-xs font-bold text-white drop-shadow leading-tight">{o.label}</span>
              {o.sub && <span className="text-[9px] sm:text-[10px] font-mono text-zinc-200 drop-shadow leading-tight mt-0.5">{o.sub}</span>}
              {o.partialText && <span className="text-[9px] font-mono font-bold text-white mt-0.5">{o.partialText}</span>}
            </button>
          );
        })}
      </div>

      {/* Band labels */}
      <div className="relative w-full h-4 mt-1">
        {bands.map((f, i) => (
          <span
            key={f}
            className="absolute text-center text-[8px] sm:text-[9px] font-mono text-zinc-500"
            style={{ left: `${i * colW}%`, width: `${colW}%`, opacity: dimOutside && (i < dimOutside[0] || i > dimOutside[1]) ? 0.3 : 1 }}
          >
            {formatHz(f)}
          </span>
        ))}
      </div>
    </div>
  );
};
