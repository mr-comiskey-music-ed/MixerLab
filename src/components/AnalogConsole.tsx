import React, { useRef, useState } from 'react';
import { ChannelSettings, MasterSettings } from '../types/audio';
import { audioEngine } from '../audio/audioEngine';
import { Knob } from './Knob';
import { FxPanel } from './FxPanel';
import { CompKnob } from './CompKnob';
import { MeterLadder } from './MeterLadder';
import { FaderScale } from './FaderScale';
import { sliderPosToDb, dbToSliderPos } from '../utils/faderCurves';

interface AnalogConsoleProps {
  channels: ChannelSettings[];
  master: MasterSettings;
  meterLevels: {
    channels: { level: number; clipped: boolean; hasSignal?: boolean; compGr?: number }[];
    masterL: number;
    masterR: number;
    masterClipped: boolean;
    aux1: number;
    pflActive: boolean;
  };
  onUpdateChannel: (index: number, settings: ChannelSettings) => void;
  onUpdateMaster: (settings: MasterSettings) => void;
  onLoadCustomStem: (channelIndex: number, file: File) => void;
  onOpenXRay: (channelId: number, channelName: string) => void;
}

export const AnalogConsole: React.FC<AnalogConsoleProps> = ({
  channels,
  master,
  meterLevels,
  onUpdateChannel,
  onUpdateMaster,
  onLoadCustomStem,
  onOpenXRay
}) => {
  const fileInputs = useRef<(HTMLInputElement | null)[]>([]);
  const [lastInteractedChannelIdx, setLastInteractedChannelIdx] = useState<number>(0);
  const lastTouchTime = useRef(0);

  const handleTouchStartReset = (resetVal: number, setVal: (v: number) => void) => (e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTouchTime.current < 350) {
      e.preventDefault();
      e.stopPropagation();
      setVal(resetVal);
      lastTouchTime.current = 0;
      return;
    }
    lastTouchTime.current = now;
  };
  const handleChannelField = <K extends keyof ChannelSettings>(
    index: number,
    field: K,
    val: ChannelSettings[K]
  ) => {
    setLastInteractedChannelIdx(index);
    const updated = { ...channels[index], [field]: val };
    onUpdateChannel(index, updated);
  };

  const handleMasterField = <K extends keyof MasterSettings>(
    field: K,
    val: MasterSettings[K]
  ) => {
    onUpdateMaster({ ...master, [field]: val });
  };

  const recentCh = channels[lastInteractedChannelIdx] || channels[0];

  return (
    <div className="w-full flex justify-center overflow-x-auto pb-4 pt-1">
      <div className="inline-flex bg-zinc-950 p-2 rounded-2xl border border-zinc-800 shadow-2xl gap-1">
        {/* CHANNELS 1 to 6 (Scaled to horizontally fit tablet landscape) */}
        {channels.map((ch, idx) => {
          const isStereo = idx >= 4;
          const meter = meterLevels.channels[idx] || { level: 0, clipped: false };

          return (
            <div
              key={ch.id}
              className="w-28 flex flex-col bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-lg p-1 gap-1 shadow-md relative"
            >
              {/* Channel Strip Header */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-1">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-cyan-400 font-bold">
                      Ch {ch.id}
                    </span>
                    <div
                      className={`w-2 h-2 rounded-full ${
                        meter.clipped ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-ping' : 'bg-zinc-800'
                      }`}
                      title={meter.clipped ? 'PEAK / CLIPPING' : 'Normal'}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-zinc-100 truncate max-w-[70px]" title={ch.name}>
                    {ch.name}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setLastInteractedChannelIdx(idx);
                    onOpenXRay(ch.id, ch.name);
                  }}
                  className="px-1 py-0.5 rounded bg-zinc-800 hover:bg-cyan-950 hover:text-cyan-400 text-zinc-400 text-[8px] font-mono border border-zinc-700 transition-colors"
                  title="Signal Flow"
                >
                  FLOW
                </button>
              </div>

              {/* Preamp & Input Section */}
              <div className="flex flex-col items-center gap-1 bg-zinc-950/60 p-1 rounded border border-zinc-850">
                <span className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider text-center leading-none">
                  {isStereo ? 'TRIM' : 'GAIN'}
                </span>
                <div className="flex items-center gap-1 w-full justify-center">
                  <Knob
                    label={isStereo ? "TRIM" : "GAIN"}
                    hideLabel
                    value={ch.gain}
                    min={-60}
                    max={20}
                    step={0.5}
                    color="red"
                    size="sm"
                    isGain
                    defaultValue={0}
                    formatValue={(v) => (v <= -59 ? '-∞ dB' : `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`)}
                    onChange={(v) => handleChannelField(idx, 'gain', v)}
                  />
                  <div className="flex flex-col gap-1 items-center justify-center">
                    <div
                      className={`px-1 py-0.5 rounded text-[6.5px] font-mono font-bold border transition-all ${
                        meter.hasSignal
                          ? 'bg-emerald-500 text-zinc-950 border-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                          : 'bg-zinc-900 text-zinc-600 border-zinc-800'
                      }`}
                      title={meter.hasSignal ? 'Signal Active (-24dB or higher)' : 'No Signal'}
                    >
                      SIG
                    </div>
                    <div
                      className={`px-1 py-0.5 rounded text-[6.5px] font-mono font-bold border transition-all ${
                        meter.clipped
                          ? 'bg-red-600 text-white border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse'
                          : 'bg-zinc-900 text-zinc-600 border-zinc-800'
                      }`}
                      title={meter.clipped ? 'PEAK / CLIPPING DETECTED' : 'Peak Indicator (Normal)'}
                    >
                      PEAK
                    </div>
                  </div>
                </div>

                {/* Input Switches */}
                <div className="grid grid-cols-2 gap-1 w-full mt-0.5">
                  {!isStereo ? (
                    <button
                      onClick={() => handleChannelField(idx, 'phantom48V', !ch.phantom48V)}
                      className={`text-[8px] font-mono font-bold py-1 px-0.5 rounded border transition-all ${
                        ch.phantom48V
                          ? 'bg-red-600 text-white border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.7)]'
                          : 'bg-zinc-850 text-zinc-400 border-zinc-750 hover:bg-zinc-800'
                      }`}
                    >
                      +48V
                    </button>
                  ) : (
                    <div className="text-[8px] font-mono text-center text-zinc-600 py-1">LINE</div>
                  )}

                  {idx < 2 ? (
                    <button
                      onClick={() => handleChannelField(idx, 'hiZ', !ch.hiZ)}
                      className={`text-[8px] font-mono font-bold py-1 px-0.5 rounded border transition-all ${
                        ch.hiZ
                          ? 'bg-amber-600 text-white border-amber-400 shadow-[0_0_8px_rgba(217,119,6,0.7)]'
                          : 'bg-zinc-850 text-zinc-400 border-zinc-750 hover:bg-zinc-800'
                      }`}
                    >
                      Hi-Z
                    </button>
                  ) : (
                    <button
                      onClick={() => handleChannelField(idx, 'phaseInvert', !ch.phaseInvert)}
                      className={`text-[8px] font-mono font-bold py-1 px-0.5 rounded border transition-all ${
                        ch.phaseInvert
                          ? 'bg-sky-600 text-white border-sky-400 shadow-[0_0_8px_rgba(2,132,199,0.7)]'
                          : 'bg-zinc-850 text-zinc-400 border-zinc-750 hover:bg-zinc-800'
                      }`}
                    >
                      Ø INV
                    </button>
                  )}

                  <button
                    onClick={() => handleChannelField(idx, 'lowCut100Hz', !ch.lowCut100Hz)}
                    className={`col-span-2 text-[8px] font-mono font-bold py-1 px-0.5 rounded border transition-all ${
                      ch.lowCut100Hz
                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                        : 'bg-zinc-850 text-zinc-400 border-zinc-750 hover:bg-zinc-800'
                    }`}
                  >
                    100Hz LOW CUT
                  </button>
                </div>

                {/* One-knob Compressor (sits below the +48V / Hi-Z / low-cut switches) */}
                <CompKnob
                  centerLabel
                  value={ch.comp ?? 0}
                  gainReductionDb={meter.compGr ?? 0}
                  onChange={(v) => handleChannelField(idx, 'comp', v)}
                />
              </div>

              {/* 3-Band EQ Section */}
              <div className="flex flex-col items-center gap-1 bg-zinc-950/40 p-1 rounded border border-zinc-850">
                <span className="text-[8px] font-mono font-bold text-sky-400 uppercase tracking-wider">
                  EQ
                </span>
                <Knob
                  label="HIGH"
                  value={ch.eqHigh}
                  min={-15}
                  max={15}
                  step={0.5}
                  color="blue"
                  size="sm"
                  centerDetent
                  defaultValue={0}
                  onChange={(v) => handleChannelField(idx, 'eqHigh', v)}
                />
                <Knob
                  label="MID FREQ"
                  value={ch.eqMidFreq || 2500}
                  min={100}
                  max={8000}
                  step={25}
                  color="white"
                  size="sm"
                  defaultValue={2500}
                  centerValue={2500}
                  formatValue={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)} Hz`)}
                  onChange={(v) => handleChannelField(idx, 'eqMidFreq', v)}
                />
                <Knob
                  label="MID"
                  value={ch.eqMid}
                  min={-15}
                  max={15}
                  step={0.5}
                  color="blue"
                  size="sm"
                  centerDetent
                  defaultValue={0}
                  onChange={(v) => handleChannelField(idx, 'eqMid', v)}
                />
                <Knob
                  label="LOW"
                  value={ch.eqLow}
                  min={-15}
                  max={15}
                  step={0.5}
                  color="blue"
                  size="sm"
                  centerDetent
                  defaultValue={0}
                  onChange={(v) => handleChannelField(idx, 'eqLow', v)}
                />
              </div>

              {/* Aux & FX Sends */}
              <div className="flex flex-col items-center gap-1 bg-zinc-950/40 p-1 rounded border border-zinc-850">
                <Knob
                  label="AUX (MON)"
                  value={ch.aux1Pre}
                  min={-60}
                  max={10}
                  step={1}
                  color="green"
                  size="sm"
                  defaultValue={-60}
                  formatValue={(v) => (v <= -59 ? '-∞ dB' : `${v > 0 ? '+' : ''}${v} dB`)}
                  onChange={(v) => handleChannelField(idx, 'aux1Pre', v)}
                />
                <Knob
                  label="FX"
                  value={ch.fxPost}
                  min={-60}
                  max={10}
                  step={1}
                  color="purple"
                  size="sm"
                  defaultValue={-60}
                  formatValue={(v) => (v <= -59 ? '-∞ dB' : `${v > 0 ? '+' : ''}${v} dB`)}
                  onChange={(v) => handleChannelField(idx, 'fxPost', v)}
                />
              </div>

              {/* Pan (-64 to +64 DAW coding) */}
              <div className="flex flex-col items-center bg-zinc-950/40 p-1 rounded border border-zinc-850">
                <Knob
                  label={isStereo ? "BAL" : "PAN"}
                  value={Math.round(ch.pan * 64)}
                  min={-64}
                  max={64}
                  step={1}
                  color="yellow"
                  size="sm"
                  centerDetent
                  defaultValue={0}
                  formatValue={(v) => (Math.abs(v) < 0.5 ? 'C' : v < 0 ? `L${Math.abs(Math.round(v))}` : `R${Math.round(v)}`)}
                  onChange={(v) => handleChannelField(idx, 'pan', v / 64)}
                />
              </div>

              {/* Mute & Solo */}
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => handleChannelField(idx, 'mute', !ch.mute)}
                  className={`text-[9px] font-bold py-1 rounded border transition-all ${
                    ch.mute
                      ? 'bg-rose-600 text-white border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.8)]'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-750'
                  }`}
                >
                  MUTE
                </button>
                <button
                  onClick={() => handleChannelField(idx, 'soloPfl', !ch.soloPfl)}
                  className={`text-[9px] font-bold py-1 rounded border transition-all ${
                    ch.soloPfl
                      ? 'bg-amber-500 text-zinc-950 border-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.9)]'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-750'
                  }`}
                  title="SOLO: Mutes all other channels in terms of audio playback for isolated auditing"
                >
                  SOLO
                </button>
              </div>

              {/* Instrument Name Label */}
              <div className="text-[10px] font-mono font-bold text-center text-cyan-400 bg-zinc-950/80 py-0.5 px-1 rounded border border-zinc-800 truncate" title={ch.name}>
                {ch.name}
              </div>

              {/* Fader & Meter */}
              <div className="flex items-center justify-center bg-zinc-950 p-1.5 rounded border border-zinc-850 h-48">
                <FaderScale heightClass="h-40" />
                <div className="flex-1 flex justify-center items-center h-full px-0.5">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.1}
                    value={dbToSliderPos(ch.faderLevel)}
                    onChange={(e) => handleChannelField(idx, 'faderLevel', sliderPosToDb(parseFloat(e.target.value)))}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      handleChannelField(idx, 'faderLevel', 0);
                    }}
                    onTouchStart={handleTouchStartReset(0, (v) => handleChannelField(idx, 'faderLevel', v))}
                    className="fader-vertical h-40 w-8"
                    title={`Fader: ${ch.faderLevel > 0 ? '+' : ''}${ch.faderLevel.toFixed(1)} dB\n(double click or double tap to reset)`}
                  />
                </div>
              </div>

              {/* Fader Readout */}
              <div
                onDoubleClick={() => handleChannelField(idx, 'faderLevel', 0)}
                onTouchStart={handleTouchStartReset(0, (v) => handleChannelField(idx, 'faderLevel', v))}
                className="flex items-center justify-between text-[9px] font-mono px-0.5 cursor-pointer select-none"
                title="Double-click or double-tap to reset fader to 0.0 dB"
              >
                <span className="text-zinc-500">LEVEL</span>
                <span className="font-bold text-zinc-200 hover:text-cyan-300 transition-colors">
                  {ch.faderLevel <= -59 ? '-∞' : `${ch.faderLevel > 0 ? '+' : ''}${ch.faderLevel.toFixed(1)}`}
                </span>
              </div>

              {/* Load Stem (hidden on mobile and tablet) */}
              <div className="hidden md:block mt-auto pt-1 border-t border-zinc-800/80">
                <input
                  type="file"
                  accept="audio/*"
                  ref={(el) => {
                    fileInputs.current[idx] = el;
                  }}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      onLoadCustomStem(idx, e.target.files[0]);
                    }
                  }}
                />
                <button
                  onClick={() => fileInputs.current[idx]?.click()}
                  className="w-full text-[8px] font-mono py-1 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-750 transition-colors"
                  title="Load custom stem"
                >
                  LOAD STEM
                </button>
              </div>
            </div>
          );
        })}

        {/* MASTER SECTION */}
        <div className="w-56 flex flex-col bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border-2 border-red-900/60 rounded-lg p-2 gap-2 shadow-2xl">
          {/* Master Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-1">
            <span className="text-xs font-mono font-bold text-red-500 uppercase tracking-wider">
              MASTER SECTION
            </span>
            <div className="flex items-center gap-1.5">
              <div
                className={`px-1.5 py-1 rounded text-[8px] font-mono font-bold border transition-all ${
                  meterLevels.masterClipped
                    ? 'bg-red-600 text-white border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.9)] animate-pulse'
                    : 'bg-zinc-900 text-zinc-600 border-zinc-800'
                }`}
                title={meterLevels.masterClipped ? 'MASTER PEAK / CLIPPING DETECTED' : 'Master Peak (Normal)'}
              >
                PEAK
              </div>
              {meterLevels.pflActive && (
                <span className="text-[9px] font-mono font-bold bg-amber-500 text-zinc-950 px-1 py-0.5 rounded animate-pulse">
                  SOLO
                </span>
              )}
            </div>
          </div>

          {/* Internal FX Engine Controls (Top) */}
          <div className="flex flex-col gap-1.5 bg-zinc-950/60 p-2 rounded border border-zinc-850">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono font-bold text-purple-400">
                INTERNAL FX (DSP)
              </span>
              <button
                onClick={() => handleMasterField('fxMute', !master.fxMute)}
                className={`text-[8px] font-mono px-1 py-0.5 rounded border ${
                  master.fxMute
                    ? 'bg-rose-600 text-white border-rose-400'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}
              >
                {master.fxMute ? 'MUTED' : 'ACTIVE'}
              </button>
            </div>

            <FxPanel master={master} onField={handleMasterField} />
          </div>

          {/* Aux Master & FX Return (zero-point at 2 o'clock) */}
          <div className="flex items-center justify-around bg-zinc-950/60 p-2 rounded border border-zinc-850">
            <Knob
              label="AUX MASTER"
              value={master.aux1Master}
              min={-60}
              max={10}
              color="green"
              size="sm"
              defaultValue={0}
              zeroNorm={0.7222}
              onChange={(v) => handleMasterField('aux1Master', v)}
            />
            <Knob
              label="FX RETURN"
              value={master.fxReturn}
              min={-60}
              max={10}
              color="purple"
              size="sm"
              defaultValue={0}
              zeroNorm={0.7222}
              onChange={(v) => handleMasterField('fxReturn', v)}
            />
          </div>

          {/* Master Stereo Meters (Taller & Expanded) */}
          <div className="flex flex-col bg-zinc-950 p-2 rounded border border-zinc-850 gap-1 flex-1 justify-center">
            <span className="text-[9px] font-mono text-center text-zinc-400 font-bold">
              STEREO VU METERS (L / R)
            </span>
            <div className="flex justify-center gap-4">
              <MeterLadder
                level={meterLevels.masterL}
                clipped={meterLevels.masterClipped}
                height={220}
                width={14}
                showLabels
              />
              <MeterLadder
                level={meterLevels.masterR}
                clipped={meterLevels.masterClipped}
                height={220}
                width={14}
              />
            </div>
          </div>

          {/* Main Mix Master Fader with Fully Expanded X-Ray Box Inside */}
          <div className="flex-1 flex flex-col justify-end bg-zinc-950 p-2 rounded border border-zinc-850 gap-2">
            {/* Fully Expanded Vertical Mini Signal Flow X-Ray Widget */}
            <div className="bg-zinc-900 border border-cyan-500/50 rounded p-2 flex flex-col gap-1.5">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-1">
                <span className="text-[9px] font-mono font-bold text-cyan-400 uppercase truncate">
                  FLOW: CH {recentCh.id} ({recentCh.name})
                </span>
                <button
                  onClick={() => onOpenXRay(recentCh.id, recentCh.name)}
                  className="px-1.5 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-zinc-950 text-[8px] font-mono font-bold transition-colors"
                  title="Open full Signal Flow chart"
                >
                  MORE
                </button>
              </div>
              <div className="flex flex-col gap-1 pl-2 border-l border-cyan-500/30 my-0.5 max-h-60 overflow-y-auto pr-1">
                <div className="flex items-center justify-between text-[8px] font-mono bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                  <span className="text-zinc-400">1. Input</span>
                  <span className="text-emerald-400 font-bold">XLR / LINE</span>
                </div>
                <div className="flex items-center justify-between text-[8px] font-mono bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                  <span className="text-zinc-400">2. Preamp</span>
                  <span className="text-red-400 font-bold">{recentCh.gain > 0 ? `+${recentCh.gain}` : recentCh.gain} dB</span>
                </div>
                <div className="flex items-center justify-between text-[8px] font-mono bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                  <span className="text-zinc-400">3. HP Filter</span>
                  <span className="text-white font-bold">{recentCh.lowCut100Hz ? '100Hz ON' : 'Bypass'}</span>
                </div>
                <div className="flex items-center justify-between text-[8px] font-mono bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                  <span className="text-zinc-400">3b. Compressor</span>
                  <span className="text-orange-400 font-bold">{(recentCh.comp ?? 0) > 0 ? Math.round(recentCh.comp) : 'Off'}</span>
                </div>
                <div className="flex items-center justify-between text-[8px] font-mono bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                  <span className="text-zinc-400">4a. EQ High</span>
                  <span className="text-sky-400 font-bold">{recentCh.eqHigh > 0 ? `+${recentCh.eqHigh}` : recentCh.eqHigh} dB</span>
                </div>
                <div className="flex items-center justify-between text-[8px] font-mono bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                  <span className="text-zinc-400">4b. EQ Mid ({recentCh.eqMidFreq >= 1000 ? `${(recentCh.eqMidFreq/1000).toFixed(1)}k` : Math.round(recentCh.eqMidFreq)}Hz)</span>
                  <span className="text-sky-400 font-bold">{recentCh.eqMid > 0 ? `+${recentCh.eqMid}` : recentCh.eqMid} dB</span>
                </div>
                <div className="flex items-center justify-between text-[8px] font-mono bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                  <span className="text-zinc-400">4c. EQ Low</span>
                  <span className="text-sky-400 font-bold">{recentCh.eqLow > 0 ? `+${recentCh.eqLow}` : recentCh.eqLow} dB</span>
                </div>
                <div className="flex items-center justify-between text-[8px] font-mono bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                  <span className="text-zinc-400">5a. Aux Send</span>
                  <span className="text-emerald-400 font-bold">{recentCh.aux1Pre <= -59 ? 'Off' : `${recentCh.aux1Pre > 0 ? '+' : ''}${recentCh.aux1Pre} dB`}</span>
                </div>
                <div className="flex items-center justify-between text-[8px] font-mono bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                  <span className="text-zinc-400">5b. FX Send</span>
                  <span className="text-purple-400 font-bold">{recentCh.fxPost <= -59 ? 'Off' : `${recentCh.fxPost > 0 ? '+' : ''}${recentCh.fxPost} dB`}</span>
                </div>
                <div className="flex items-center justify-between text-[8px] font-mono bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                  <span className="text-zinc-400">6. Pan</span>
                  <span className="text-yellow-400 font-bold">{recentCh.pan === 0 ? 'Center' : recentCh.pan < 0 ? `L${Math.round(-recentCh.pan*100)}` : `R${Math.round(recentCh.pan*100)}`}</span>
                </div>
                <div className="flex items-center justify-between text-[8px] font-mono bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                  <span className="text-zinc-400">7. Mute</span>
                  <span className={`font-bold ${recentCh.mute ? 'text-rose-500' : 'text-zinc-400'}`}>{recentCh.mute ? 'MUTED' : 'ACTIVE'}</span>
                </div>
                <div className="flex items-center justify-between text-[8px] font-mono bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                  <span className="text-zinc-400">8. Channel Fader</span>
                  <span className="text-indigo-400 font-bold">{recentCh.faderLevel > 0 ? `+${recentCh.faderLevel}` : recentCh.faderLevel} dB</span>
                </div>
              </div>
            </div>

            <div
              onDoubleClick={() => handleMasterField('mainFader', 0)}
              onTouchStart={handleTouchStartReset(0, (v) => handleMasterField('mainFader', v))}
              className="flex items-center justify-between text-[9px] font-mono mb-0.5 cursor-pointer select-none"
              title="Double-click or double-tap to reset Main Mix to 0.0 dB Unity"
            >
              <span className="text-red-400 font-bold">MAIN MIX</span>
              <span className="font-bold text-zinc-200 hover:text-red-400 transition-colors">
                {master.mainFader <= -59 ? '-∞' : `${master.mainFader > 0 ? '+' : ''}${master.mainFader.toFixed(1)} dB`}
              </span>
            </div>
            <div className="flex justify-center items-center h-52 bg-zinc-950 p-1 rounded border border-zinc-850">
              <FaderScale heightClass="h-44" isMaster />
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={dbToSliderPos(master.mainFader)}
                onChange={(e) => handleMasterField('mainFader', sliderPosToDb(parseFloat(e.target.value)))}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  handleMasterField('mainFader', 0);
                }}
                onTouchStart={handleTouchStartReset(0, (v) => handleMasterField('mainFader', v))}
                className="fader-vertical fader-master h-44 w-10"
                title={`Main Mix: ${master.mainFader > 0 ? '+' : ''}${master.mainFader.toFixed(1)} dB\n(double click or double tap to reset)`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
