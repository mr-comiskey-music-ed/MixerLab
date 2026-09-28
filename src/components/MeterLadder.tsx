import React from 'react';
import { AnalogVUMeter } from './AnalogVUMeter';
import { VuBallisticsMode } from '../utils/vuBallistics';

export interface MeterLadderProps {
  level: number; // 0.0 to 1.0
  clipped: boolean;
  segments?: number;
  totalSegments?: number;
  height?: number;
  width?: number;
  showLabels?: boolean;
  variant?: 'ladder' | 'needle' | 'both';
  ballistics?: VuBallisticsMode;
  label?: string;
  theme?: 'vintage' | 'dark' | 'cream';
  showPeakHold?: boolean;
}

export const MeterLadder: React.FC<MeterLadderProps> = ({
  level,
  clipped,
  segments = 12,
  totalSegments,
  height = 130,
  width = 10,
  showLabels = false,
  variant = 'ladder',
  ballistics = 'vu',
  label,
  theme = 'vintage',
  showPeakHold = false
}) => {
  const numSegments = totalSegments ?? segments;

  // If user requested needle variant, render authentic analog needle meter
  if (variant === 'needle') {
    return (
      <AnalogVUMeter
        level={level}
        clipped={clipped}
        label={label}
        width={width > 30 ? width : 160}
        height={height > 40 ? height : 105}
        ballistics={ballistics}
        theme={theme}
      />
    );
  }

  // Linear calculation mapping normalized level (0.0 to 1.0) directly to active LED segments
  const activeSegments = Math.min(numSegments, Math.max(0, Math.round(level * numSegments)));

  const labels = ['+6', '+3', '0', '-3', '-6', '-12', '-18', '-24', '-30', '-40'];

  const ladderElement = (
    <div className="flex items-center gap-1 select-none">
      {showLabels && (
        <div
          className="flex flex-col justify-between text-[8px] font-mono text-zinc-500 text-right pr-0.5"
          style={{ height }}
        >
          {labels.map((l, i) => (
            <span key={i} className="leading-none">{l}</span>
          ))}
        </div>
      )}

      <div
        className="flex flex-col justify-between bg-zinc-950 p-[2px] rounded border border-zinc-800 shadow-inner"
        style={{ height, width }}
        title={`Meter Level: ${Math.round(level * 100)}%`}
      >
        {/* Clip LED at the top */}
        <div
          className={`w-full h-2 rounded-xs transition-colors duration-75 ${
            clipped
              ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse'
              : 'bg-zinc-850'
          }`}
          title="Clip Indicator (1.5s Hold)"
        />

        {/* Meter segments from top (high level) to bottom (low level) */}
        {Array.from({ length: numSegments }).map((_, i) => {
          const segIndex = numSegments - 1 - i; // 0 is bottom, numSegments-1 is near top
          const isActive = segIndex < activeSegments;

          // Color coding: top 2 red/amber, lower are green
          let activeColor = 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.7)]';
          if (segIndex >= numSegments - 2) {
            activeColor = 'bg-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.9)]';
          } else if (segIndex >= numSegments - 4) {
            activeColor = 'bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]';
          }

          let segmentClass = 'bg-zinc-900 opacity-60';
          if (isActive) {
            segmentClass = activeColor;
          }

          return (
            <div
              key={i}
              className={`w-full h-1 rounded-xs transition-all duration-75 ${segmentClass}`}
            />
          );
        })}
      </div>
    </div>
  );

  if (variant === 'both') {
    return (
      <div className="flex flex-col items-center gap-2">
        <AnalogVUMeter
          level={level}
          clipped={clipped}
          label={label}
          width={160}
          height={105}
          ballistics={ballistics}
          theme={theme}
        />
        {ladderElement}
      </div>
    );
  }

  return ladderElement;
};

// Re-export analog needle meters for easy consumption
export { AnalogVUMeter, StereoAnalogVUMeter } from './AnalogVUMeter';
