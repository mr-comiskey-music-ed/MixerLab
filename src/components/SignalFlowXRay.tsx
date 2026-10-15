import React, { useEffect } from 'react';
import { ChannelSettings } from '../types/audio';

interface SignalFlowXRayProps {
  isOpen: boolean;
  onClose: () => void;
  channelId?: number;
  channelName?: string;
  channelSettings?: ChannelSettings;
}

export const SignalFlowXRay: React.FC<SignalFlowXRayProps> = ({
  isOpen,
  onClose,
  channelId = 1,
  channelName = 'Kick / Snare',
}) => {
  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-5xl w-full p-6 relative flex flex-col gap-6 text-zinc-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="text-lg font-bold tracking-tight text-cyan-400 font-mono">
              SIGNAL FLOW // CH {channelId}: {channelName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-mono font-bold transition-colors"
            title="Close (ESC)"
          >
            ✕
          </button>
        </div>

        {/* Signal Flow Diagram */}
        <div className="relative bg-zinc-950 p-6 rounded-lg border border-zinc-800 overflow-x-auto">
          <div className="min-w-[900px] flex flex-col gap-8">
            {/* Primary Channel Strip Audio Trunk */}
            <div className="flex items-center justify-between relative py-4">
              <div className="absolute top-1/2 left-0 right-0 h-1 bg-zinc-800 -translate-y-1/2 z-0" />
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-cyan-500/50 -translate-y-1/2 z-0 animate-pulse" />

              {/* Node 1: Input */}
              <div className="z-10 flex flex-col items-center bg-zinc-900 border border-zinc-700 rounded p-2.5 shadow-md w-24 text-center">
                <span className="text-[10px] text-zinc-400 font-mono">INPUT</span>
                <span className="text-xs font-bold text-zinc-100">XLR / Line</span>
                <span className="text-[9px] font-mono font-bold text-zinc-500">
                  Mic / Source
                </span>
              </div>

              {/* Node 2: Preamp */}
              <div className="z-10 flex flex-col items-center bg-zinc-900 border border-red-500/40 rounded p-2.5 shadow-md w-28 text-center">
                <span className="text-[10px] text-red-400 font-mono">PREAMP GAIN</span>
                <span className="text-xs font-bold text-zinc-100">Trim / Gain</span>
                <span className="text-[9px] text-zinc-400 font-mono">Analog Stage</span>
              </div>

              {/* Node 3: Filter */}
              <div className="z-10 flex flex-col items-center bg-zinc-900 border border-zinc-700 rounded p-2.5 shadow-md w-24 text-center">
                <span className="text-[10px] text-zinc-400 font-mono">HI-PASS</span>
                <span className="text-xs font-bold text-zinc-400">
                  100Hz HPF
                </span>
                <span className="text-[9px] text-zinc-400 font-mono">Rumble Filter</span>
              </div>

              {/* Node 3b: One-knob Compressor */}
              <div className="z-10 flex flex-col items-center bg-zinc-900 border border-orange-500/50 rounded p-2.5 shadow-md w-24 text-center">
                <span className="text-[10px] text-orange-400 font-mono">COMP</span>
                <span className="text-xs font-bold text-zinc-100">1-Knob</span>
                <span className="text-[9px] text-zinc-400 font-mono">Dynamics</span>
              </div>

              {/* Node 4: 3-Band EQ */}
              <div className="z-10 flex flex-col items-center bg-zinc-900 border border-sky-500/50 rounded p-2.5 shadow-md w-32 text-center">
                <span className="text-[10px] text-sky-400 font-mono">3-BAND EQ</span>
                <span className="text-[10px] font-bold text-zinc-100">
                  Hi / Mid / Low
                </span>
                <span className="text-[9px] text-amber-400 font-mono">
                  Parametric Tone
                </span>
              </div>

              {/* Pre-Fade Tap Point */}
              <div className="z-20 relative flex flex-col items-center">
                <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] border-2 border-zinc-900" />
                <span className="text-[9px] font-mono text-emerald-400 font-bold mt-1">
                  AUX TAP
                </span>
              </div>

              {/* Node 5: Mute & Pan */}
              <div className="z-10 flex flex-col items-center bg-zinc-900 border border-yellow-500/40 rounded p-2.5 shadow-md w-24 text-center">
                <span className="text-[10px] text-yellow-400 font-mono">PAN / MUTE</span>
                <span className="text-xs font-bold text-zinc-100">
                  Stereo Image
                </span>
                <span className="text-[9px] text-zinc-400 font-mono">Routing</span>
              </div>

              {/* Node 6: Channel Fader */}
              <div className="z-10 flex flex-col items-center bg-zinc-900 border-2 border-indigo-500 rounded p-2.5 shadow-md w-28 text-center">
                <span className="text-[10px] text-indigo-400 font-mono">60mm FADER</span>
                <span className="text-xs font-bold text-white">Channel Level</span>
                <span className="text-[9px] text-zinc-400 font-mono">Attenuation</span>
              </div>

              {/* Post-Fade Tap Point */}
              <div className="z-20 relative flex flex-col items-center">
                <div className="w-4 h-4 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)] border-2 border-zinc-900" />
                <span className="text-[9px] font-mono text-purple-400 font-bold mt-1">
                  FX TAP
                </span>
              </div>

              {/* Node 7: Master Bus */}
              <div className="z-10 flex flex-col items-center bg-red-950/40 border border-red-600 rounded p-2.5 shadow-md w-28 text-center">
                <span className="text-[10px] text-red-400 font-mono">MAIN BUS</span>
                <span className="text-xs font-bold text-white">FOH Stereo</span>
                <span className="text-[9px] text-red-300 font-mono">Master Summing</span>
              </div>
            </div>

            {/* Branching Aux & FX Routes */}
            <div className="grid grid-cols-2 gap-4 border-t border-zinc-800/80 pt-4">
              <div className="bg-emerald-950/20 border border-emerald-500/40 rounded-lg p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="text-xs font-bold text-emerald-300 font-mono">
                      AUX (MON) SEND (PRE-FADER)
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Tapped before the channel fader for CH {channelId} ({channelName}). Stage wedge monitor volume is independent of house fader adjustments.
                </p>
              </div>

              <div className="bg-purple-950/20 border border-purple-500/40 rounded-lg p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                    <span className="text-xs font-bold text-purple-300 font-mono">
                      FX SEND (POST-FADER)
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Tapped after the channel fader for CH {channelId} ({channelName}). Proportional to channel level for lush spatial reverb/delay sends.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
          <span>Channel {channelId} ({channelName}) DSP Signal Topology</span>
          <span className="text-cyan-400">Console Flow Architecture</span>
        </div>
      </div>
    </div>
  );
};
