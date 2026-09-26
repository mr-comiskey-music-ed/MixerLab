import React from 'react';
import { FADER_SCALE_POINTS } from '../utils/faderCurves';

interface FaderScaleProps {
  heightClass?: string; // e.g. 'h-48'
  isMaster?: boolean;
}

export const FaderScale: React.FC<FaderScaleProps> = ({
  heightClass = 'h-48',
  isMaster = false,
}) => {
  return (
    <div
      className={`${heightClass} py-[12px] flex flex-col justify-between select-none pointer-events-none pr-1`}
      aria-hidden="true"
    >
      {FADER_SCALE_POINTS.map((pt) => {
        const isUnity = pt.isUnity;
        return (
          <div
            key={pt.label}
            className="h-0 flex items-center justify-end gap-1"
          >
            <span
              className={`text-[8px] font-mono leading-none tracking-tighter ${
                isUnity
                  ? isMaster
                    ? 'text-red-300 font-bold'
                    : 'text-zinc-200 font-bold'
                  : 'text-zinc-500'
              }`}
            >
              {pt.label}
            </span>
            <span
              className={`block rounded-full ${
                isUnity
                  ? isMaster
                    ? 'w-2 h-[2px] bg-red-400 shadow-[0_0_4px_rgba(248,113,113,0.8)]'
                    : 'w-2 h-[2px] bg-zinc-200 shadow-[0_0_4px_rgba(255,255,255,0.6)]'
                  : 'w-1.5 h-[1px] bg-zinc-700'
              }`}
            />
          </div>
        );
      })}
    </div>
  );
};
