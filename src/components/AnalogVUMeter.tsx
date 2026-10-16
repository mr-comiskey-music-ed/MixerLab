import React, { useId, useState } from 'react';
import {
  useVuBallistics,
  VuBallisticsMode,
  BALLISTICS_PRESETS,
  VU_SCALE_POINTS
} from '../utils/vuBallistics';

export interface AnalogVUMeterProps {
  level: number;            // Raw audio level [0.0 to 1.0]
  clipped?: boolean;        // Clip / overload indicator
  label?: string;           // E.g., 'LEFT', 'RIGHT', 'CH 1', 'MASTER'
  width?: number | string;  // Width in pixels or CSS string
  height?: number | string; // Height in pixels or CSS string
  ballistics?: VuBallisticsMode; // 'vu' (300ms), 'ppm' (10ms), 'vintage' (400ms)
  showPeakLed?: boolean;
  backlight?: boolean;
  theme?: 'vintage' | 'dark' | 'cream';
  compact?: boolean;
}

export const AnalogVUMeter: React.FC<AnalogVUMeterProps> = ({
  level,
  clipped = false,
  label = 'VU',
  width = '100%',
  height = 'auto',
  ballistics = 'vu',
  showPeakLed = true,
  backlight = true,
  theme = 'vintage',
  compact = false
}) => {
  const filterId = useId().replace(/:/g, '_');
  const { angle, pos, peakHold } = useVuBallistics(level, ballistics);

  // Meter geometry
  const pivotX = 100;
  const pivotY = 120;
  const scaleRadius = 85;

  // Colors based on theme
  const isDark = theme === 'dark';
  const faceBg = isDark
    ? 'fill-zinc-900'
    : 'fill-[#faf3e3]';

  return (
    <div
      className="relative select-none flex flex-col items-center"
      style={{ width, height }}
      title={`${label} VU Meter: ${Math.round(pos * 100)}% deflection (Ballistics: ${BALLISTICS_PRESETS[ballistics]?.name || 'VU'})`}
    >
      <svg
        viewBox="0 0 200 130"
        className="w-full h-full drop-shadow-md rounded-md overflow-hidden"
        style={{ aspectRatio: '200 / 130' }}
      >
        <defs>
          {/* Needle Drop Shadow */}
          <filter id={`shadow_${filterId}`} x="-20%" y="-20%" width="150%" height="150%">
            <feDropShadow dx="1.5" dy="2" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.45" />
          </filter>

          {/* Incandescent Lamp Glow Filter */}
          <radialGradient id={`lamp_${filterId}`} cx="50%" cy="0%" r="90%">
            <stop offset="0%" stopColor="#fef08a" stopOpacity={backlight ? '0.45' : '0.05'} />
            <stop offset="35%" stopColor="#fde047" stopOpacity={backlight ? '0.22' : '0.02'} />
            <stop offset="70%" stopColor="#ca8a04" stopOpacity={backlight ? '0.08' : '0.0'} />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.0" />
          </radialGradient>

          {/* Vintage Faceplate Parchment Gradient */}
          <linearGradient id={`faceplate_${filterId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            {isDark ? (
              <>
                <stop offset="0%" stopColor="#27272a" />
                <stop offset="60%" stopColor="#18181b" />
                <stop offset="100%" stopColor="#09090b" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#fffdf5" />
                <stop offset="40%" stopColor="#f7eed8" />
                <stop offset="100%" stopColor="#ebd8b5" />
              </>
            )}
          </linearGradient>

          {/* Metallic Pivot Gradient */}
          <radialGradient id={`pivot_${filterId}`} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="45%" stopColor="#a1a1aa" />
            <stop offset="85%" stopColor="#3f3f46" />
            <stop offset="100%" stopColor="#18181b" />
          </radialGradient>

          {/* Bezel Border Gradient */}
          <linearGradient id={`bezel_${filterId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#52525b" />
            <stop offset="50%" stopColor="#27272a" />
            <stop offset="100%" stopColor="#09090b" />
          </linearGradient>

          {/* Glass Specular Glare */}
          <linearGradient id={`glass_${filterId}`} x1="0%" y1="0%" x2="100%" y2="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="35%" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Outer Bezel */}
        <rect
          x="1"
          y="1"
          width="198"
          height="128"
          rx="6"
          fill={`url(#bezel_${filterId})`}
          stroke="#71717a"
          strokeWidth="1.2"
        />

        {/* Inner Bezel Shadow / Lip */}
        <rect
          x="4"
          y="4"
          width="192"
          height="122"
          rx="4"
          fill="#18181b"
        />

        {/* Meter Dial Faceplate */}
        <rect
          x="6"
          y="6"
          width="188"
          height="118"
          rx="3"
          fill={`url(#faceplate_${filterId})`}
          stroke={isDark ? '#3f3f46' : '#d4c5a9'}
          strokeWidth="0.8"
        />

        {/* Incandescent Lamp Glow Overlay */}
        <rect
          x="6"
          y="6"
          width="188"
          height="118"
          rx="3"
          fill={`url(#lamp_${filterId})`}
          pointerEvents="none"
        />

        {/* Mechanical Left Stop Bumper Pin */}
        <circle cx="43.5" cy="56" r="1.6" fill="#71717a" stroke="#27272a" strokeWidth="0.5" />
        {/* Mechanical Right Stop Bumper Pin */}
        <circle cx="156.5" cy="56" r="1.6" fill="#71717a" stroke="#27272a" strokeWidth="0.5" />

        {/* Primary Scale Arcs: Normal Range (Black) & Overload Range (Vivid Red) */}
        {/* Scale Arc from -38° (-20 VU) to +25.5° (0 VU) */}
        <path
          d="M 47.7 53.0 A 85 85 0 0 1 136.5 43.3"
          fill="none"
          stroke={isDark ? '#e4e4e7' : '#18181b'}
          strokeWidth="1.2"
          strokeLinecap="butt"
        />
        {/* Overload Arc from +25.5° (0 VU) to +38° (+3 VU) */}
        <path
          d="M 136.5 43.3 A 85 85 0 0 1 152.3 53.0"
          fill="none"
          stroke="#dc2626"
          strokeWidth="2.4"
          strokeLinecap="butt"
        />

        {/* Scale Tick Marks and Numerical Labels */}
        {VU_SCALE_POINTS.map(([db, def]) => {
          const tickAngle = -38 + def * 76;
          const rad = (tickAngle * Math.PI) / 180;
          const isRed = db >= 0;
          const isMajor = db === -20 || db === -10 || db === -7 || db === -5 || db === -3 || db === 0 || db === 3;
          const tickLength = isMajor ? (db === 0 ? 8 : 6.5) : 4.5;
          const tickWidth = db === 0 ? 1.8 : isMajor ? 1.2 : 0.8;

          // Tick start (on arc) and end (inwards towards pivot)
          const x1 = pivotX + scaleRadius * Math.sin(rad);
          const y1 = pivotY - scaleRadius * Math.cos(rad);
          const x2 = pivotX + (scaleRadius - tickLength) * Math.sin(rad);
          const y2 = pivotY - (scaleRadius - tickLength) * Math.cos(rad);

          // Label position (slightly inwards)
          const textRadius = scaleRadius - tickLength - 6.5;
          const tx = pivotX + textRadius * Math.sin(rad);
          const ty = pivotY - textRadius * Math.cos(rad);

          const strokeColor = isRed
            ? '#dc2626'
            : isDark
            ? '#e4e4e7'
            : '#18181b';

          return (
            <g key={db}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={strokeColor}
                strokeWidth={tickWidth}
                strokeLinecap="square"
              />
              {isMajor && (
                <text
                  x={tx}
                  y={ty}
                  fill={strokeColor}
                  fontSize={db === 0 ? '8.5' : '7'}
                  fontWeight={db === 0 ? 'bold' : '600'}
                  fontFamily="'JetBrains Mono', monospace"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {db > 0 ? `+${db}` : db}
                </text>
              )}
            </g>
          );
        })}

        {/* Percentage Modulation Scale Underneath (0%, 20%, 40%, 60%, 80%, 100%) */}
        {!compact && (
          <g opacity={isDark ? 0.75 : 0.85}>
            {/* Secondary thin arc */}
            <path
              d="M 54.0 66.0 A 70 70 0 0 1 144.0 66.0"
              fill="none"
              stroke={isDark ? '#a1a1aa' : '#78716c'}
              strokeWidth="0.6"
              strokeDasharray="1 2"
            />
            {[
              { pct: 0, def: 0 },
              { pct: 20, def: 0.22 },
              { pct: 40, def: 0.43 },
              { pct: 60, def: 0.60 },
              { pct: 80, def: 0.73 },
              { pct: 100, def: 0.835 } // 100% = 0 VU
            ].map(({ pct, def }) => {
              const rad = ((-38 + def * 76) * Math.PI) / 180;
              const tx = pivotX + 61 * Math.sin(rad);
              const ty = pivotY - 61 * Math.cos(rad);
              const isHundred = pct === 100;
              return (
                <text
                  key={pct}
                  x={tx}
                  y={ty}
                  fill={isHundred ? '#dc2626' : isDark ? '#a1a1aa' : '#57534e'}
                  fontSize="5"
                  fontWeight={isHundred ? 'bold' : 'normal'}
                  fontFamily="'Plus Jakarta Sans', sans-serif"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {pct}
                </text>
              );
            })}
          </g>
        )}

        {/* Dial Face Typography: VU Badge & Calibration Standard */}
        <g textAnchor="middle" className="select-none">
          <text
            x={pivotX}
            y="78"
            fill={isDark ? '#f4f4f5' : '#292524'}
            fontSize="14"
            fontWeight="800"
            fontFamily="'Plus Jakarta Sans', sans-serif"
            letterSpacing="1.5"
          >
            VU
          </text>
          <text
            x={pivotX}
            y="87"
            fill={isDark ? '#a1a1aa' : '#78716c'}
            fontSize="5"
            fontWeight="bold"
            letterSpacing="0.8"
            fontFamily="'JetBrains Mono', monospace"
          >
            VOLUME UNIT
          </text>
          <text
            x={pivotX}
            y="94"
            fill={isDark ? '#71717a' : '#a8a29e'}
            fontSize="4.5"
            fontFamily="'JetBrains Mono', monospace"
          >
            0 VU = +4 dBu · 300ms
          </text>
        </g>

        {/* Channel / Bus Label */}
        {label && (
          <text
            x="14"
            y="18"
            fill={isDark ? '#38bdf8' : '#0369a1'}
            fontSize="8"
            fontWeight="bold"
            fontFamily="'JetBrains Mono', monospace"
            textAnchor="start"
          >
            {label}
          </text>
        )}

        {/* Built-in Peak / Overload LED */}
        {showPeakLed && (
          <g>
            <circle
              cx="184"
              cy="16"
              r="4.2"
              fill={clipped ? '#ef4444' : '#450a0a'}
              stroke="#18181b"
              strokeWidth="0.8"
            />
            {clipped && (
              <>
                <circle
                  cx="184"
                  cy="16"
                  r="6.5"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="1.2"
                  opacity="0.6"
                  className="animate-ping"
                />
                <circle
                  cx="184"
                  cy="16"
                  r="2.5"
                  fill="#fecaca"
                />
              </>
            )}
            <text
              x="176"
              y="18"
              fill={clipped ? '#ef4444' : isDark ? '#71717a' : '#a8a29e'}
              fontSize="5"
              fontWeight="bold"
              fontFamily="'JetBrains Mono', monospace"
              textAnchor="end"
            >
              PEAK
            </text>
          </g>
        )}

        {/* Floating Peak Hold Indicator along the scale */}
        {peakHold > 0.05 && (
          <g transform={`rotate(${-38 + peakHold * 76} ${pivotX} ${pivotY})`}>
            <line
              x1={pivotX}
              y1={pivotY - scaleRadius - 1}
              x2={pivotX}
              y2={pivotY - scaleRadius + 6}
              stroke={peakHold >= 0.835 ? '#ef4444' : '#f59e0b'}
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity="0.85"
            />
          </g>
        )}

        {/* THE NEEDLE with Shadow and Physical Ballistics Angle */}
        {/* 1. Needle Drop Shadow */}
        <g
          transform={`rotate(${angle} ${pivotX} ${pivotY})`}
          filter={`url(#shadow_${filterId})`}
        >
          {/* Shadow pointer */}
          <polygon
            points={`
              ${pivotX - 1.3},${pivotY}
              ${pivotX - 0.4},${pivotY - 84}
              ${pivotX + 0.4},${pivotY - 84}
              ${pivotX + 1.3},${pivotY}
            `}
            fill="#000000"
            opacity="0.4"
          />
        </g>

        {/* 2. Needle Assembly (Blade + Crimson Tip + Tail Counterweight) */}
        <g transform={`rotate(${angle} ${pivotX} ${pivotY})`}>
          {/* Needle Tail & Counterweight */}
          <line
            x1={pivotX}
            y1={pivotY}
            x2={pivotX}
            y2={pivotY + 11}
            stroke="#18181b"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle
            cx={pivotX}
            cy={pivotY + 11}
            r="3.2"
            fill="#71717a"
            stroke="#18181b"
            strokeWidth="0.8"
          />

          {/* Needle Main Blade (Matte Charcoal) */}
          <polygon
            points={`
              ${pivotX - 1.4},${pivotY}
              ${pivotX - 0.75},${pivotY - 68}
              ${pivotX + 0.75},${pivotY - 68}
              ${pivotX + 1.4},${pivotY}
            `}
            fill="#18181b"
          />

          {/* Needle Knife-Edge Precision Indicator Tip (Vivid Crimson) */}
          <polygon
            points={`
              ${pivotX - 0.75},${pivotY - 68}
              ${pivotX - 0.35},${pivotY - 85}
              ${pivotX + 0.35},${pivotY - 85}
              ${pivotX + 0.75},${pivotY - 68}
            `}
            fill="#dc2626"
          />
        </g>

        {/* Center Metallic Pivot Cap / Galvanometer Screw */}
        <circle
          cx={pivotX}
          cy={pivotY}
          r="9.5"
          fill="#27272a"
          stroke="#52525b"
          strokeWidth="0.8"
        />
        <circle
          cx={pivotX}
          cy={pivotY}
          r="6.8"
          fill={`url(#pivot_${filterId})`}
        />
        {/* Screw slot detail */}
        <line
          x1={pivotX - 3.5}
          y1={pivotY}
          x2={pivotX + 3.5}
          y2={pivotY}
          stroke="#18181b"
          strokeWidth="0.9"
        />

        {/* Curved Glass Specular Highlight Sheen */}
        <path
          d="M 8 8 L 192 8 L 192 36 Q 100 55 8 36 Z"
          fill={`url(#glass_${filterId})`}
          pointerEvents="none"
        />
      </svg>
    </div>
  );
};

export interface StereoAnalogVUMeterProps {
  levelL: number;
  levelR: number;
  clipped?: boolean;
  ballistics?: VuBallisticsMode;
  onBallisticsChange?: (mode: VuBallisticsMode) => void;
  showControls?: boolean;
  theme?: 'vintage' | 'dark' | 'cream';
}

/**
 * Stereo Twin VU Meter housing Left and Right needle movements in a vintage console bay.
 */
export const StereoAnalogVUMeter: React.FC<StereoAnalogVUMeterProps> = ({
  levelL,
  levelR,
  clipped = false,
  ballistics = 'vu',
  onBallisticsChange,
  showControls = true,
  theme = 'vintage'
}) => {
  const [internalMode, setInternalMode] = useState<VuBallisticsMode>(ballistics);
  const [backlight, setBacklight] = useState<boolean>(true);

  const activeMode = onBallisticsChange ? ballistics : internalMode;
  const setMode = (m: VuBallisticsMode) => {
    setInternalMode(m);
    onBallisticsChange?.(m);
  };

  return (
    <div className="flex flex-col bg-zinc-950 p-2 rounded-xl border border-zinc-800 shadow-2xl gap-1.5 w-full">
      {/* Meter Header Bar with Preset Controls */}
      {showControls && (
        <div className="flex items-center justify-between px-1 pb-1 border-b border-zinc-850">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono font-bold text-amber-500 uppercase tracking-wider">
              STEREO VU METERS
            </span>
            <span className="text-[8px] font-mono text-zinc-500 hidden sm:inline">
              ({BALLISTICS_PRESETS[activeMode].name})
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Lamp Toggle */}
            <button
              onClick={() => setBacklight(b => !b)}
              className={`px-1.5 py-0.5 rounded text-[8px] font-mono transition-colors border ${
                backlight
                  ? 'bg-amber-950/70 text-amber-300 border-amber-800'
                  : 'bg-zinc-900 text-zinc-600 border-zinc-800'
              }`}
              title="Toggle VU incandescent meter lamp glow"
            >
              💡 LAMP {backlight ? 'ON' : 'OFF'}
            </button>

            {/* Ballistics Preset Selector */}
            <div className="flex items-center bg-zinc-900 rounded p-0.5 border border-zinc-800">
              {(['vu', 'ppm', 'vintage'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-semibold transition-all ${
                    activeMode === m
                      ? 'bg-amber-500 text-zinc-950 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title={BALLISTICS_PRESETS[m].description}
                >
                  {m === 'vu' ? 'VU (300ms)' : m === 'ppm' ? 'PPM (10ms)' : 'VINTAGE'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Dual VU Meters */}
      <div className="grid grid-cols-2 gap-2">
        <AnalogVUMeter
          level={levelL}
          clipped={clipped}
          label="LEFT"
          ballistics={activeMode}
          backlight={backlight}
          theme={theme}
        />
        <AnalogVUMeter
          level={levelR}
          clipped={clipped}
          label="RIGHT"
          ballistics={activeMode}
          backlight={backlight}
          theme={theme}
        />
      </div>

      {/* Ballistics Info Footer */}
      <div className="flex items-center justify-between text-[8px] font-mono text-zinc-500 px-1 pt-0.5 border-t border-zinc-900">
        <span>ANSI C16.5-1954 SPECS</span>
        <span>RISE: 300ms · OVERSHOOT: 1.2%</span>
        <span>0 VU = +4 dBu</span>
      </div>
    </div>
  );
};
