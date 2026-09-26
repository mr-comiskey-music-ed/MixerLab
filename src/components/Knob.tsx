import React, { useRef, useState, useCallback, useEffect } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  color?: 'red' | 'blue' | 'light-blue' | 'white' | 'green' | 'purple' | 'yellow' | 'zinc' | 'teal' | 'indigo';
  size?: 'sm' | 'md' | 'lg';
  onChange: (val: number) => void;
  centerDetent?: boolean;
  formatValue?: (val: number) => string;
  defaultValue?: number;
  isGain?: boolean;
  zeroNorm?: number; // custom normalized position for 0 (e.g. 0.7222 for 2 o'clock, 0.5 for 12 o'clock)
  centerValue?: number; // custom value pinned exactly to 12 o'clock (normalized = 0.5), e.g. 2500 for freq knob
}

export const Knob: React.FC<KnobProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = 'dB',
  color = 'blue',
  size = 'md',
  onChange,
  centerDetent = false,
  formatValue,
  defaultValue = 0,
  isGain = false,
  zeroNorm,
  centerValue
}) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dragStartY = useRef(0);
  const dragStartNorm = useRef(0);
  const lastClickTime = useRef(0);

  // Normalization & Angle calculation
  const getNormalized = useCallback(
    (val: number): number => {
      if (centerValue !== undefined) {
        if (val <= centerValue) {
          const factor = Math.max(0, Math.min(1, (val - min) / (centerValue - min || 1)));
          return factor * 0.5;
        } else {
          const factor = Math.max(0, Math.min(1, (val - centerValue) / (max - centerValue || 1)));
          return 0.5 + factor * 0.5;
        }
      }
      if (isGain || zeroNorm !== undefined) {
        const ZERO_DB_NORM = zeroNorm !== undefined ? zeroNorm : 0.7222;
        if (val <= 0) {
          const subRange = 0 - min || 1;
          const factor = Math.max(0, Math.min(1, (val - min) / subRange));
          return factor * ZERO_DB_NORM;
        } else {
          const upperRange = max - 0 || 1;
          const factor = Math.max(0, Math.min(1, val / upperRange));
          return ZERO_DB_NORM + factor * (1 - ZERO_DB_NORM);
        }
      }
      const range = max - min || 1;
      return Math.min(1, Math.max(0, (val - min) / range));
    },
    [centerValue, isGain, zeroNorm, min, max]
  );

  const normToVal = useCallback(
    (norm: number): number => {
      if (centerValue !== undefined) {
        if (norm <= 0.5) {
          return min + (norm / 0.5) * (centerValue - min);
        } else {
          return centerValue + ((norm - 0.5) / 0.5) * (max - centerValue);
        }
      }
      if (isGain || zeroNorm !== undefined) {
        const ZERO_DB_NORM = zeroNorm !== undefined ? zeroNorm : 0.7222;
        if (norm <= ZERO_DB_NORM) {
          return min + (norm / ZERO_DB_NORM) * (0 - min);
        } else {
          return 0 + ((norm - ZERO_DB_NORM) / (1 - ZERO_DB_NORM)) * (max - 0);
        }
      }
      return min + norm * (max - min);
    },
    [centerValue, isGain, zeroNorm, min, max]
  );

  const normalized = getNormalized(value);
  const angle = -135 + normalized * 270;

  // Color styles
  const colorStyles = {
    red: {
      body: 'bg-gradient-to-br from-rose-500 via-red-600 to-red-800',
      border: 'border-rose-400/60',
      shadow: 'shadow-[0_4px_10px_rgba(0,0,0,0.7),inset_0_1px_1.5px_rgba(255,255,255,0.4)]',
      pointer: 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.9)]',
      glow: 'hover:shadow-[0_0_14px_rgba(244,63,94,0.65)]',
      labelColor: 'text-rose-400'
    },
    blue: {
      body: 'bg-gradient-to-br from-sky-400 via-blue-600 to-blue-800',
      border: 'border-sky-300/60',
      shadow: 'shadow-[0_4px_10px_rgba(0,0,0,0.7),inset_0_1px_1.5px_rgba(255,255,255,0.4)]',
      pointer: 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.9)]',
      glow: 'hover:shadow-[0_0_14px_rgba(56,189,248,0.65)]',
      labelColor: 'text-sky-400'
    },
    'light-blue': {
      body: 'bg-gradient-to-br from-cyan-300 via-cyan-500 to-sky-700',
      border: 'border-cyan-200/70',
      shadow: 'shadow-[0_4px_10px_rgba(0,0,0,0.7),inset_0_1px_1.5px_rgba(255,255,255,0.5)]',
      pointer: 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.9)]',
      glow: 'hover:shadow-[0_0_14px_rgba(34,211,238,0.65)]',
      labelColor: 'text-cyan-400'
    },
    white: {
      body: 'bg-gradient-to-br from-white via-zinc-100 to-zinc-300',
      border: 'border-zinc-300/90',
      shadow: 'shadow-[0_4px_10px_rgba(0,0,0,0.7),inset_0_1px_1.5px_rgba(255,255,255,0.9)]',
      pointer: 'bg-zinc-950 shadow-[0_0_2px_rgba(255,255,255,0.8)]',
      glow: 'hover:shadow-[0_0_14px_rgba(255,255,255,0.55)]',
      labelColor: 'text-zinc-200'
    },
    green: {
      body: 'bg-gradient-to-br from-emerald-400 via-emerald-600 to-emerald-800',
      border: 'border-emerald-300/60',
      shadow: 'shadow-[0_4px_10px_rgba(0,0,0,0.7),inset_0_1px_1.5px_rgba(255,255,255,0.4)]',
      pointer: 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.9)]',
      glow: 'hover:shadow-[0_0_14px_rgba(52,211,153,0.65)]',
      labelColor: 'text-emerald-400'
    },
    purple: {
      body: 'bg-gradient-to-br from-purple-400 via-purple-600 to-purple-800',
      border: 'border-purple-300/60',
      shadow: 'shadow-[0_4px_10px_rgba(0,0,0,0.7),inset_0_1px_1.5px_rgba(255,255,255,0.4)]',
      pointer: 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.9)]',
      glow: 'hover:shadow-[0_0_14px_rgba(192,132,252,0.65)]',
      labelColor: 'text-purple-400'
    },
    yellow: {
      body: 'bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600',
      border: 'border-amber-200/70',
      shadow: 'shadow-[0_4px_10px_rgba(0,0,0,0.7),inset_0_1px_1.5px_rgba(255,255,255,0.5)]',
      pointer: 'bg-zinc-950 shadow-[0_0_2px_rgba(255,255,255,0.7)]',
      glow: 'hover:shadow-[0_0_14px_rgba(251,191,36,0.65)]',
      labelColor: 'text-amber-400'
    },
    zinc: {
      body: 'bg-gradient-to-br from-zinc-200 via-zinc-400 to-zinc-600',
      border: 'border-zinc-300/70',
      shadow: 'shadow-[0_4px_10px_rgba(0,0,0,0.7),inset_0_1px_1.5px_rgba(255,255,255,0.5)]',
      pointer: 'bg-zinc-950 shadow-[0_0_2px_rgba(255,255,255,0.7)]',
      glow: 'hover:shadow-[0_0_14px_rgba(212,212,216,0.55)]',
      labelColor: 'text-zinc-300'
    },
    teal: {
      body: 'bg-gradient-to-br from-teal-300 via-teal-600 to-teal-800',
      border: 'border-teal-200/70',
      shadow: 'shadow-[0_4px_10px_rgba(0,0,0,0.7),inset_0_1px_1.5px_rgba(255,255,255,0.5)]',
      pointer: 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.9)]',
      glow: 'hover:shadow-[0_0_14px_rgba(45,212,191,0.65)]',
      labelColor: 'text-teal-400'
    },
    indigo: {
      body: 'bg-gradient-to-br from-indigo-400 via-blue-700 to-indigo-950',
      border: 'border-indigo-300/70',
      shadow: 'shadow-[0_4px_10px_rgba(0,0,0,0.7),inset_0_1px_1.5px_rgba(255,255,255,0.4)]',
      pointer: 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.9)]',
      glow: 'hover:shadow-[0_0_14px_rgba(129,140,248,0.65)]',
      labelColor: 'text-indigo-400'
    }
  }[color];

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  }[size];

  const handleMouseDown = (e: React.MouseEvent) => {
    const now = Date.now();
    if (now - lastClickTime.current < 350 || e.altKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      onChange(defaultValue);
      lastClickTime.current = 0;
      return;
    }
    lastClickTime.current = now;

    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartNorm.current = getNormalized(value);
    document.body.style.cursor = 'ns-resize';
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(defaultValue);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaY = dragStartY.current - e.clientY;
      // Dragging 140px vertically traverses the entire 0-100% normalized travel
      const deltaNorm = deltaY / 140;
      let newNorm = Math.min(1, Math.max(0, dragStartNorm.current + deltaNorm));

      let newVal = normToVal(newNorm);

      if (centerDetent) {
        if (centerValue !== undefined) {
          if (Math.abs(newVal - centerValue) < (max - min) * 0.035) {
            newVal = centerValue;
          }
        } else if (Math.abs(newVal) < (max - min) * 0.035) {
          newVal = 0;
        }
      }

      newVal = Math.min(max, Math.max(min, newVal));
      if (step) {
        newVal = Math.round(newVal / step) * step;
      }
      onChange(Number(newVal.toFixed(step < 1 ? 1 : 0)));
    },
    [isDragging, max, min, step, centerDetent, centerValue, normToVal, onChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = 'default';
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? -1 : 1;
    let currentNorm = getNormalized(value);
    let stepNorm = step ? step / (max - min) : 0.02;
    let newNorm = Math.min(1, Math.max(0, currentNorm + dir * stepNorm));
    let newVal = normToVal(newNorm);
    newVal = Math.min(max, Math.max(min, newVal));
    if (step) {
      newVal = Math.round(newVal / step) * step;
    }
    onChange(Number(newVal.toFixed(step < 1 ? 1 : 0)));
  };

  const displayVal = formatValue
    ? formatValue(value)
    : `${value > 0 ? '+' : ''}${value} ${unit}`;

  return (
    <div
      className="flex flex-col items-center select-none group relative cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={handleDoubleClick}
      title="Double-click to reset to default"
    >
      <span
        onDoubleClick={handleDoubleClick}
        className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider text-center leading-none mb-1.5 hover:text-zinc-200 transition-colors"
      >
        {label}
      </span>

      <div
        className="relative flex items-center justify-center p-1"
        onDoubleClick={handleDoubleClick}
      >
        <svg
          className="absolute -inset-1.5 w-[calc(100%+12px)] h-[calc(100%+12px)] pointer-events-none select-none overflow-visible"
          viewBox="-10 -10 120 120"
          aria-hidden="true"
        >
          <path
            d="M 18.9 81.1 A 44 44 0 1 1 81.1 81.1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeDasharray="2 3"
            className="text-zinc-700/60"
          />
          <line x1="18.9" y1="81.1" x2="13.9" y2="86.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-zinc-500" />
          <line x1="18.9" y1="18.9" x2="14.6" y2="14.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-zinc-600" />
          <line
            x1="50"
            y1="6"
            x2="50"
            y2="-2"
            stroke="currentColor"
            strokeWidth={centerDetent || centerValue !== undefined ? '2.5' : '1.8'}
            strokeLinecap="round"
            className={centerDetent || centerValue !== undefined ? 'text-amber-400' : 'text-zinc-500'}
          />
          <line x1="81.1" y1="18.9" x2="85.4" y2="14.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-zinc-600" />
          <line x1="81.1" y1="81.1" x2="86.1" y2="86.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-zinc-500" />
        </svg>

        <div
          ref={knobRef}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
          className={`relative ${sizeClasses} rounded-full cursor-pointer touch-none select-none flex items-center justify-center transition-shadow duration-150 ${colorStyles.glow}`}
          style={{ transform: `rotate(${angle}deg)` }}
          title="Double-click or Alt+Click to reset to default"
        >
          <div
            className={`w-full h-full rounded-full ${colorStyles.body} border ${colorStyles.border} ${colorStyles.shadow} relative flex items-center justify-center`}
          >
            <div className="absolute inset-[3px] rounded-full border border-white/20 pointer-events-none" />
            <div className="absolute inset-[6px] rounded-full border border-black/15 pointer-events-none" />
            <div className="w-[30%] h-[30%] rounded-full bg-black/20 border border-white/10" />
            <div
              className={`absolute top-0.5 left-1/2 -translate-x-1/2 ${
                size === 'sm' ? 'w-[2.5px] h-[48%]' : size === 'lg' ? 'w-[3.5px] h-[48%]' : 'w-[3px] h-[48%]'
              } rounded-full ${colorStyles.pointer}`}
            />
            <div
              className={`absolute top-0 left-1/2 -translate-x-1/2 ${
                size === 'sm' ? 'w-[4px] h-[2.5px]' : 'w-[5px] h-[3px]'
              } rounded-t-sm ${colorStyles.pointer}`}
            />
          </div>
        </div>
      </div>

      <span
        onDoubleClick={handleDoubleClick}
        className="text-[9px] font-mono tabular-nums text-zinc-400 mt-1 tracking-tight hover:text-zinc-200 transition-colors cursor-pointer"
        title="Double-click to reset to default"
      >
        {displayVal}
      </span>

      {(isHovered || isDragging) && (
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-30 px-2 py-1 bg-zinc-900 text-zinc-100 text-[10px] font-mono rounded border border-zinc-700 shadow-lg pointer-events-none text-center whitespace-nowrap">
          <div>{label}: {displayVal}</div>
          <div className="text-[9px] text-zinc-400">(double click to reset)</div>
        </div>
      )}
    </div>
  );
};
