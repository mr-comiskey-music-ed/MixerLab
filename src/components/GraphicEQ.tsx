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
  height = 200
}) => {
  const areaRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);
  const n = bands.length;
  const colW = 100 / n;
  const g = (i: number) => gains?.[i] ?? 0;

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
              <div className="relative my-2.5 w-1 rounded-full bg-zinc-700">
                <div
                  className="absolute left-1/2 -translate-x-1/2 w-1 rounded-full bg-orange-400/80"
                  style={{
                    top: pos < 0.5 ? `${pos * 100}%` : '50%',
                    height: `${Math.abs(pos - 0.5) * 100}%`
                  }}
                />
                <div
                  className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-orange-400 border border-orange-200 shadow"
                  style={{ top: `${pos * 100}%` }}
                />
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
