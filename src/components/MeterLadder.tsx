import React from 'react';
import { useVuBallistics, VuBallisticsMode } from '../utils/vuBallistics';
import { AnalogVUMeter } from './AnalogVUMeter';

export interface MeterLadderProps {
  level: number; // 0.0 to 1.0
  clipped: boolean;
  segments?: number;
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
  height = 130,
  width = 10,
  showLabels = false,
  variant = 'ladder',
  ballistics = 'vu',
  label,
  theme = 'vintage',
  showPeakHold = true
}) => {
  // Compute smooth analog VU ballistics (300ms rise & fall times with natural mass inertia)
  const vuState = useVuBallistics(level, ballistics);

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

  // Level mapped through realistic VU ballistics to segments
  // vuState.pos is normalized deflection [0.0 to 1.08], where 0.835 is 0 VU
  const activeSegments = Math.min(segments, Math.round(vuState.pos * segments));
  const peakSegment = Math.min(segments - 1, Math.round(vuState.peakHold * segments) - 1);

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
        title={`Meter: ${Math.round(vuState.pos * 100)}% (VU Ballistics: 300ms rise/fall)`}
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
        {Array.from({ length: segments }).map((_, i) => {
          const segIndex = segments - 1 - i; // 0 is bottom, segments-1 is near top
          const isActive = segIndex < activeSegments;
          const isPeakHold = showPeakHold && segIndex === peakSegment && !isActive;

          // Color coding: top 2 red/amber, lower are green
          let activeColor = 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.7)]';
          if (segIndex >= segments - 2) {
            activeColor = 'bg-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.9)]';
          } else if (segIndex >= segments - 4) {
            activeColor = 'bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]';
          }

          let segmentClass = 'bg-zinc-900 opacity-60';
          if (isActive) {
            segmentClass = activeColor;
          } else if (isPeakHold) {
            segmentClass = 'bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.9)] opacity-95';
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
