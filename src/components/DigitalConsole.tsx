import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ChannelSettings, MasterSettings } from '../types/audio';
import { audioEngine } from '../audio/audioEngine';
import { MeterLadder } from './MeterLadder';
import { FaderScale } from './FaderScale';
import { Knob } from './Knob';
import { FxPanel } from './FxPanel';
import { CompKnob } from './CompKnob';
import { sliderPosToDb, dbToSliderPos } from '../utils/faderCurves';
import { CONSOLE_LOW_HZ, CONSOLE_HIGH_HZ } from '../audio/eqCorners';

interface DigitalConsoleProps {
  channels: ChannelSettings[];
  master: MasterSettings;
  selectedChannelIndex: number;
  onSelectChannel: (idx: number) => void;
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
  onOpenXRay: (channelId: number, channelName: string) => void;
  matchMode?: boolean; // Match the Mix: only faders, pan, LOW and HIGH EQ count, so grey out the rest
  lockedEqChannelIds?: number[]; // Scenarios: channels whose EQ is greyed out and can't be touched
}

export const DigitalConsole: React.FC<DigitalConsoleProps> = ({
  channels,
  master,
  selectedChannelIndex,
  onSelectChannel,
  meterLevels,
  onUpdateChannel,
  onUpdateMaster,
  onOpenXRay,
  matchMode = false,
  lockedEqChannelIds = []
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedCh = channels[selectedChannelIndex] || channels[0];
  const eqLocked = lockedEqChannelIds.includes(selectedCh.id);
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

  const handleMasterField = (field: keyof MasterSettings, value: any) => {
    onUpdateMaster({
      ...master,
      [field]: value
    });
  };
  const [activeDragNode, setActiveDragNode] = useState<'low' | 'mid' | 'high' | null>(null);
  const [hoveredNode, setHoveredNode] = useState<'low' | 'mid' | 'high' | null>(null);
  const activeDragNodeRef = useRef<'low' | 'mid' | 'high' | null>(null);
  const hoveredNodeRef = useRef<'low' | 'mid' | 'high' | null>(null);

  // EQ Parameters
  const { eqLow, eqMid, eqMidFreq, eqHigh, lowCut100Hz } = selectedCh;

  // Convert Hz to Canvas X coordinate (Logarithmic 20Hz - 20,000Hz)
  const freqToX = useCallback((freq: number, width: number) => {
    const minLog = Math.log10(20);
    const maxLog = Math.log10(20000);
    const log = Math.log10(Math.max(20, Math.min(20000, freq)));
    return ((log - minLog) / (maxLog - minLog)) * width;
  }, []);

  // Convert Canvas X coordinate to Hz
  const xToFreq = useCallback((x: number, width: number) => {
    const minLog = Math.log10(20);
    const maxLog = Math.log10(20000);
    const norm = Math.max(0, Math.min(1, x / width));
    return Math.pow(10, minLog + norm * (maxLog - minLog));
  }, []);

  // Convert dB (-15 to +15) to Canvas Y coordinate
  const dbToY = useCallback((db: number, height: number) => {
    const norm = (db - -15) / 30; // 0 is -15dB, 1 is +15dB
    return height - norm * height; // Invert for canvas coordinates
  }, []);

  // Convert Canvas Y coordinate to dB
  const yToDb = useCallback((y: number, height: number) => {
    const norm = 1 - Math.max(0, Math.min(1, y / height));
    return -15 + norm * 30;
  }, []);

  // Normalize client pointer coordinates to internal canvas dimensions
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, width: 720, height: 220 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      width: canvas.width,
      height: canvas.height
    };
  };

  // Draw EQ Curve & Spectrum Analyzer on Canvas
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rtaData = new Uint8Array(1024);

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // 1. Grid Background
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);

      // Grid lines: 50, 100, 200, 500, 1k, 2k, 5k, 10k, 20k
      const gridFreqs = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 1;

      gridFreqs.forEach((f) => {
        const x = freqToX(f, width);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        ctx.fillStyle = '#52525b';
        ctx.font = '9px monospace';
        ctx.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, x + 3, height - 6);
      });

      // Horizontal dB Grid Lines (-12, -6, 0, +6, +12)
      [-12, -6, 0, 6, 12].forEach((db) => {
        const y = dbToY(db, height);
        ctx.strokeStyle = db === 0 ? '#3f3f46' : '#1f1f23';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        ctx.fillStyle = db === 0 ? '#a1a1aa' : '#52525b';
        ctx.font = '9px monospace';
        ctx.fillText(`${db > 0 ? '+' : ''}${db}dB`, 6, y - 3);
      });

      // 2. Real-Time RTA Spectrum Display (Logarithmic Frequency Mapping)
      audioEngine.getChannelFrequencyData(selectedChannelIndex, rtaData);
      const sampleRate = audioEngine.ctx?.sampleRate || 48000;
      const binCount = rtaData.length;
      const hzPerBin = (sampleRate / 2) / binCount;
      const NUM_RTA_BARS = 72;

      for (let b = 0; b < NUM_RTA_BARS; b++) {
        const x1 = (b / NUM_RTA_BARS) * width;
        const x2 = ((b + 1) / NUM_RTA_BARS) * width;
        const barW = Math.max(1.5, x2 - x1 - 1.5);

        // Map logarithmic x coordinates to start and end frequency
        const fStart = xToFreq(x1, width);
        const fEnd = xToFreq(x2, width);

        // Find FFT bin indices corresponding to this frequency range
        const binStart = Math.max(0, Math.floor(fStart / hzPerBin));
        const binEnd = Math.min(binCount - 1, Math.ceil(fEnd / hzPerBin));

        let maxVal = 0;
        let sumVal = 0;
        let count = 0;

        for (let bin = binStart; bin <= binEnd; bin++) {
          const v = rtaData[bin];
          if (v > maxVal) maxVal = v;
          sumVal += v;
          count++;
        }

        const avgVal = count > 0 ? sumVal / count : 0;
        const blended = maxVal * 0.75 + avgVal * 0.25;

        if (blended > 4) {
          const norm = blended / 255;
          const barH = Math.min(height, Math.pow(norm, 1.1) * height * 0.88);

          // Translucent green RTA bar
          ctx.fillStyle = 'rgba(34, 197, 94, 0.22)';
          ctx.fillRect(x1 + 0.75, height - barH, barW, barH);

          // Bright glowing peak cap on each bar
          ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
          ctx.fillRect(x1 + 0.75, height - barH, barW, 2);
        }
      }

      // 3. Composite Parametric EQ Curve
      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#38bdf8'; // Sky blue curve

      for (let x = 0; x <= width; x += 3) {
        const f = xToFreq(x, width);

        // Low cut HPF (100Hz 12dB/oct)
        let hpLoss = 0;
        if (lowCut100Hz && f < 100) {
          hpLoss = -12 * Math.log2(100 / Math.max(10, f));
        }

        // Low Shelf
        const lowGain = eqLow / (1 + Math.pow(f / CONSOLE_LOW_HZ, 2));

        // Mid Bell (Peaking at eqMidFreq)
        const midCenter = eqMidFreq || 2500;
        const q = 1.4;
        const midGain = eqMid * Math.exp(-Math.pow(Math.log(f / midCenter) * q, 2));

        // High Shelf
        const highGain = eqHigh / (1 + Math.pow(CONSOLE_HIGH_HZ / Math.max(1, f), 2));

        const totalDb = hpLoss + lowGain + midGain + highGain;
        const y = dbToY(totalDb, height);

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Subtle curve glow fill
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
      ctx.fillStyle = grad;
      ctx.fill();

      // 4. Interactive EQ Filter Handles / Nodes (The Little Colored Circles)
      const currentActive = activeDragNodeRef.current;
      const currentHover = hoveredNodeRef.current;

      // Low Shelf Node (Cyan)
      const lowNodeX = freqToX(CONSOLE_LOW_HZ, width);
      const lowNodeY = dbToY(eqLow, height);
      drawNode(
        ctx,
        lowNodeX,
        lowNodeY,
        '#06b6d4',
        'LOW',
        `${CONSOLE_LOW_HZ}Hz · ${eqLow > 0 ? '+' : ''}${eqLow.toFixed(1)}dB`,
        currentHover === 'low',
        currentActive === 'low',
        false
      );

      // Mid Bell Node (Parametric Sweepable Center & Gain, Teal)
      const midCenterFreq = eqMidFreq || 2500;
      const midNodeX = freqToX(midCenterFreq, width);
      const midNodeY = dbToY(eqMid, height);
      const midFreqTag = midCenterFreq >= 1000 ? `${(midCenterFreq / 1000).toFixed(1)}k` : `${Math.round(midCenterFreq)}Hz`;
      drawNode(
        ctx,
        midNodeX,
        midNodeY,
        '#14b8a6',
        'MID',
        `${midFreqTag} · ${eqMid > 0 ? '+' : ''}${eqMid.toFixed(1)}dB`,
        currentHover === 'mid',
        currentActive === 'mid',
        true
      );

      // High Shelf Node (Sky Blue)
      const highNodeX = freqToX(CONSOLE_HIGH_HZ, width);
      const highNodeY = dbToY(eqHigh, height);
      drawNode(
        ctx,
        highNodeX,
        highNodeY,
        '#38bdf8',
        'HIGH',
        `${CONSOLE_HIGH_HZ / 1000}k · ${eqHigh > 0 ? '+' : ''}${eqHigh.toFixed(1)}dB`,
        currentHover === 'high',
        currentActive === 'high',
        false
      );

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [selectedChannelIndex, eqLow, eqMid, eqMidFreq, eqHigh, lowCut100Hz, freqToX, xToFreq, dbToY]);

  const drawNode = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    label: string,
    badgeText: string,
    isHovered: boolean,
    isActive: boolean,
    isParametricMid: boolean
  ) => {
    // Crosshair guide lines when actively dragging
    if (isActive) {
      ctx.strokeStyle = isParametricMid ? 'rgba(245, 158, 11, 0.45)' : 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(ctx.canvas.width, y);
      if (isParametricMid) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ctx.canvas.height);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Outer Target Ring when Hovered or Active
    if (isActive || isHovered) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // The Little Colored Circle (Interactive grab point)
    ctx.shadowColor = color;
    ctx.shadowBlur = isActive ? 14 : 8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, isActive ? 9 : 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Crisp white border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Dark center pinhole
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Floating parameter badge
    ctx.font = 'bold 9px monospace';
    const metrics = ctx.measureText(badgeText);
    const pillW = metrics.width + 12;
    const pillH = 16;
    let pillX = x - pillW / 2;
    let pillY = y - 24;

    if (pillX < 4) pillX = 4;
    if (pillX + pillW > ctx.canvas.width - 4) pillX = ctx.canvas.width - pillW - 4;
    if (pillY < 4) pillY = y + 14;

    ctx.fillStyle = isActive ? 'rgba(9, 9, 11, 0.95)' : 'rgba(24, 24, 27, 0.9)';
    ctx.strokeStyle = isActive ? color : '#3f3f46';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isActive ? '#ffffff' : '#f4f4f5';
    ctx.fillText(badgeText, pillX + 6, pillY + 11);
  };

  // Canvas Pointer Dragging Interaction for EQ nodes (normalized to canvas resolution)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y, width, height } = getCanvasCoords(e);

    const lowX = freqToX(CONSOLE_LOW_HZ, width);
    const lowY = dbToY(eqLow, height);
    const midX = freqToX(eqMidFreq || 2500, width);
    const midY = dbToY(eqMid, height);
    const highX = freqToX(CONSOLE_HIGH_HZ, width);
    const highY = dbToY(eqHigh, height);

    const distLow = Math.hypot(x - lowX, y - lowY);
    const distMid = Math.hypot(x - midX, y - midY);
    const distHigh = Math.hypot(x - highX, y - highY);

    const HIT_RADIUS = 24; // Generous hit radius centered on the colored circles

    let targetNode: 'low' | 'mid' | 'high' | null = null;
    if (distMid <= HIT_RADIUS) {
      targetNode = 'mid';
    } else if (distLow <= HIT_RADIUS) {
      targetNode = 'low';
    } else if (distHigh <= HIT_RADIUS) {
      targetNode = 'high';
    }

    if (targetNode) {
      setActiveDragNode(targetNode);
      activeDragNodeRef.current = targetNode;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y, width, height } = getCanvasCoords(e);

    if (!activeDragNode) {
      // Hover detection to highlight the little colored circle and update cursor
      const lowX = freqToX(CONSOLE_LOW_HZ, width);
      const lowY = dbToY(eqLow, height);
      const midX = freqToX(eqMidFreq || 2500, width);
      const midY = dbToY(eqMid, height);
      const highX = freqToX(CONSOLE_HIGH_HZ, width);
      const highY = dbToY(eqHigh, height);

      const HIT_RADIUS = 24;
      if (Math.hypot(x - midX, y - midY) <= HIT_RADIUS) {
        setHoveredNode('mid');
        hoveredNodeRef.current = 'mid';
      } else if (Math.hypot(x - lowX, y - lowY) <= HIT_RADIUS) {
        setHoveredNode('low');
        hoveredNodeRef.current = 'low';
      } else if (Math.hypot(x - highX, y - highY) <= HIT_RADIUS) {
        setHoveredNode('high');
        hoveredNodeRef.current = 'high';
      } else {
        setHoveredNode(null);
        hoveredNodeRef.current = null;
      }
      return;
    }

    const newDb = Math.round(yToDb(y, height) * 2) / 2;
    const clampedDb = Math.max(-15, Math.min(15, newDb));

    const updated = { ...selectedCh };

    if (activeDragNode === 'low') {
      updated.eqLow = clampedDb;
    } else if (activeDragNode === 'high') {
      updated.eqHigh = clampedDb;
    } else if (activeDragNode === 'mid') {
      // Vertical movement controls Mid Gain (-15 to +15 dB)
      updated.eqMid = clampedDb;
      // Horizontal movement affects the Mid Center Frequency (100Hz to 8000Hz)
      const newFreq = Math.round(xToFreq(x, width));
      updated.eqMidFreq = Math.max(100, Math.min(8000, newFreq));
    }

    onUpdateChannel(selectedChannelIndex, updated);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeDragNode) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture released
      }
      setActiveDragNode(null);
      activeDragNodeRef.current = null;
    }
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const width = canvas.width;
    const height = canvas.height;

    const lowX = freqToX(CONSOLE_LOW_HZ, width);
    const lowY = dbToY(eqLow, height);
    const midX = freqToX(eqMidFreq || 2500, width);
    const midY = dbToY(eqMid, height);
    const highX = freqToX(CONSOLE_HIGH_HZ, width);
    const highY = dbToY(eqHigh, height);

    const HIT_RADIUS = 35;
    const updated = { ...selectedCh };

    if (Math.hypot(x - midX, y - midY) <= HIT_RADIUS) {
      updated.eqMid = 0;
      updated.eqMidFreq = 2500;
    } else if (Math.hypot(x - lowX, y - lowY) <= HIT_RADIUS) {
      updated.eqLow = 0;
    } else if (Math.hypot(x - highX, y - highY) <= HIT_RADIUS) {
      updated.eqHigh = 0;
    } else {
      // Double clicking anywhere on EQ background resets all 3 bands to flat
      updated.eqLow = 0;
      updated.eqMid = 0;
      updated.eqMidFreq = 2500;
      updated.eqHigh = 0;
    }
    onUpdateChannel(selectedChannelIndex, updated);
  };

  const updateSelectedField = <K extends keyof ChannelSettings>(field: K, val: ChannelSettings[K]) => {
    const updated = { ...selectedCh, [field]: val };
    onUpdateChannel(selectedChannelIndex, updated);
  };

  const canvasCursor = activeDragNode
    ? 'cursor-grabbing'
    : hoveredNode === 'mid'
    ? 'cursor-move'
    : hoveredNode === 'low' || hoveredNode === 'high'
    ? 'cursor-ns-resize'
    : 'cursor-crosshair';

  return (
    <div className="w-full max-w-7xl mx-auto pb-4">
      {/* MAIN UNIFIED DIGITAL CONSOLE BAY */}
      <div className="bg-zinc-950 p-3 sm:p-4 rounded-2xl border border-zinc-800 shadow-2xl flex flex-col min-[980px]:flex-row gap-3 sm:gap-4 items-stretch overflow-x-auto">
        {/* LEFT COLUMN: PROCESSING BAY (TOP) + 6 CHANNEL FADER STRIPS (BOTTOM) */}
        <div className="flex-1 min-w-[620px] flex flex-col gap-3">
          {/* COMPACT DEDICATED PROCESSING BAY (DIGITAL CHANNEL STRIP) */}
          <div className="bg-zinc-900 border-2 border-meter-500/40 rounded-xl p-3 sm:p-3.5 shadow-xl flex flex-col gap-2.5">
            {/* Digital Processing Bay Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-mono font-bold text-meter-400">
                  Channel {selectedCh.id} — {selectedCh.name}
                </span>
                {onOpenXRay && (
                  <button
                    onClick={() => onOpenXRay(selectedCh.id, selectedCh.name)}
                    className="px-2 py-0.5 rounded text-[9.5px] font-mono font-bold bg-meter-950/80 text-meter-300 border border-meter-700/60 hover:bg-meter-900 transition-colors flex items-center gap-1.5"
                    title="Open interactive Signal Flow diagram"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-meter-400 animate-pulse"></span>
                    SIGNAL FLOW
                  </button>
                )}
              </div>

              {/* Channel Preamp Quick Toggles */}
              <div className={`flex items-center gap-1.5 flex-wrap justify-end${matchMode ? ' opacity-25 grayscale pointer-events-none' : ''}`}>
                <button
                  onClick={() => updateSelectedField('phantom48V', !selectedCh.phantom48V)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    updateSelectedField('phantom48V', false);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors ${
                    selectedCh.phantom48V
                      ? 'bg-red-600 text-white border-red-400'
                      : 'bg-zinc-850 text-zinc-400 border-zinc-750 hover:border-zinc-600'
                  }`}
                  title="+48V Phantom Power · Double-click to turn off (default)"
                >
                  +48V PHANTOM
                </button>

                {selectedCh.id <= 2 && (
                  <button
                    onClick={() => updateSelectedField('hiZ', !selectedCh.hiZ)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      updateSelectedField('hiZ', false);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors ${
                      selectedCh.hiZ
                        ? 'bg-amber-600 text-white border-amber-400'
                        : 'bg-zinc-850 text-zinc-400 border-zinc-750 hover:border-zinc-600'
                    }`}
                    title="Hi-Z Instrument Preamp · Double-click to turn off (default)"
                  >
                    Hi-Z INSTRUMENT
                  </button>
                )}

                <button
                  onClick={() => updateSelectedField('phaseInvert', !selectedCh.phaseInvert)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    updateSelectedField('phaseInvert', false);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors ${
                    selectedCh.phaseInvert
                      ? 'bg-sky-600 text-white border-sky-400'
                      : 'bg-zinc-850 text-zinc-400 border-zinc-750 hover:border-zinc-600'
                  }`}
                  title="Phase Invert (Ø) · Double-click to turn off (default)"
                >
                  PHASE (Ø)
                </button>

                <button
                  onClick={() => updateSelectedField('lowCut100Hz', !selectedCh.lowCut100Hz)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    updateSelectedField('lowCut100Hz', false);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors ${
                    selectedCh.lowCut100Hz
                      ? 'bg-emerald-600 text-white border-emerald-400'
                      : 'bg-zinc-850 text-zinc-400 border-zinc-750 hover:border-zinc-600'
                  }`}
                  title="100Hz High-Pass Filter · Double-click to turn off (default)"
                >
                  100Hz LOW CUT
                </button>
              </div>
            </div>

            {/* Interactive Parametric EQ Canvas & Preamp Controls */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 items-stretch">
              {/* Left: Preamp & Sends Encoders */}
              <div className="md:col-span-1 bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 flex flex-col justify-between items-center gap-2">
                <div className="w-full flex items-center justify-between border-b border-zinc-850 pb-1">
                  <span className="text-[10px] font-mono font-bold text-zinc-300 uppercase tracking-wider">
                    PREAMP & SENDS
                  </span>
                  <span className="text-[10px] font-mono text-meter-400 font-bold">CH {selectedCh.id}</span>
                </div>

                <div className="w-full flex flex-col items-center justify-around flex-1 gap-2">
                  {/* GAIN + COMPRESSOR side by side */}
                  <div className="w-full grid grid-cols-2 gap-1.5">
                  {/* DIGITAL PREAMP GAIN */}
                  <div
                    onDoubleClick={() => updateSelectedField('gain', 0)}
                    className={`w-full flex flex-col items-center bg-zinc-900/50 p-1.5 rounded border border-zinc-850 cursor-pointer${matchMode ? ' opacity-25 grayscale pointer-events-none' : ''}`}
                    title="Double-click to reset Preamp Gain to 0.0 dB (Default)"
                  >
                    <div className="flex items-center gap-1 justify-center w-full">
                      <Knob
                        label="GAIN"
                        value={selectedCh.gain}
                        min={-60}
                        max={20}
                        step={0.5}
                        unit="dB"
                        color="red"
                        size="sm"
                        isGain
                        defaultValue={0}
                        formatValue={(v) => (v <= -59 ? '-∞ dB' : `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`)}
                        onChange={(v) => updateSelectedField('gain', v)}
                      />
                      <div className="flex flex-col gap-1 items-center justify-center">
                        <div
                          className={`px-1 py-0.5 rounded text-[6.5px] font-mono font-bold border transition-all ${
                            meterLevels.channels[selectedChannelIndex]?.hasSignal
                              ? 'bg-emerald-500 text-zinc-950 border-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                              : 'bg-zinc-900 text-zinc-600 border-zinc-800'
                          }`}
                          title={meterLevels.channels[selectedChannelIndex]?.hasSignal ? 'Signal Active (-24dB or higher)' : 'No Signal'}
                        >
                          SIG
                        </div>
                        <div
                          className={`px-1 py-0.5 rounded text-[6.5px] font-mono font-bold border transition-all ${
                            meterLevels.channels[selectedChannelIndex]?.clipped
                              ? 'bg-red-600 text-white border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse'
                              : 'bg-zinc-900 text-zinc-600 border-zinc-800'
                          }`}
                          title={meterLevels.channels[selectedChannelIndex]?.clipped ? 'PEAK / CLIPPING DETECTED' : 'Peak Indicator (Normal)'}
                        >
                          PEAK
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ONE-KNOB COMPRESSOR (next to the gain knob) */}
                  <div
                    onDoubleClick={() => updateSelectedField('comp', 0)}
                    className={`w-full flex flex-col items-center bg-zinc-900/50 p-1.5 rounded border border-zinc-850 cursor-pointer${matchMode ? ' opacity-25 grayscale pointer-events-none' : ''}`}
                    title="Double-click to turn the compressor off"
                  >
                    <CompKnob
                      label="COMP"
                      value={selectedCh.comp ?? 0}
                      gainReductionDb={meterLevels.channels[selectedChannelIndex]?.compGr ?? 0}
                      onChange={(v) => updateSelectedField('comp', v)}
                    />
                  </div>
                  </div>

                  {/* AUX & FX + PAN side by side */}
                  <div className="w-full grid grid-cols-3 gap-1.5">
                  {/* AUX & FX SENDS */}
                  <div
                    className={`col-span-2 flex flex-col items-center bg-zinc-900/50 p-1.5 rounded border border-zinc-850 gap-1${matchMode ? ' opacity-25 grayscale pointer-events-none' : ''}`}
                    title="Aux & FX Sends"
                  >
                    <span className="text-[9px] font-mono text-zinc-400 font-bold">AUX & FX</span>
                    <div className="flex items-center justify-around w-full gap-1">
                      <Knob
                        label="AUX"
                        value={selectedCh.aux1Pre}
                        min={-60}
                        max={10}
                        step={1}
                        unit="dB"
                        color="green"
                        size="sm"
                        defaultValue={-60}
                        formatValue={(v) => (v <= -59 ? '-∞' : `${v > 0 ? '+' : ''}${v}`)}
                        onChange={(v) => updateSelectedField('aux1Pre', v)}
                      />
                      <Knob
                        label="FX"
                        value={selectedCh.fxPost}
                        min={-60}
                        max={10}
                        step={1}
                        unit="dB"
                        color="purple"
                        size="sm"
                        defaultValue={-60}
                        formatValue={(v) => (v <= -59 ? '-∞' : `${v > 0 ? '+' : ''}${v}`)}
                        onChange={(v) => updateSelectedField('fxPost', v)}
                      />
                    </div>
                  </div>

                  {/* PAN */}
                  <div
                    onDoubleClick={() => updateSelectedField('pan', 0)}
                    className="flex flex-col items-center justify-center bg-zinc-900/50 p-1.5 rounded border border-zinc-850 cursor-pointer"
                    title="Double-click to reset Pan to Center (Default)"
                  >
                    <Knob
                      label="PAN"
                      value={Math.round((selectedCh.pan || 0) * 64)}
                      min={-64}
                      max={64}
                      step={1}
                      color="yellow"
                      size="sm"
                      centerDetent
                      defaultValue={0}
                      formatValue={(v) => (Math.abs(v) < 0.5 ? 'C' : v < 0 ? `L${Math.abs(Math.round(v))}` : `R${Math.round(v)}`)}
                      onChange={(v) => updateSelectedField('pan', v / 64)}
                    />
                  </div>
                  </div>
                </div>
              </div>

              {/* Right: Interactive Parametric EQ Canvas (3 cols) */}
              <div
                className={`md:col-span-3 bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 flex flex-col gap-1.5${eqLocked ? ' opacity-25 grayscale pointer-events-none' : ''}`}
                title={eqLocked ? 'EQ is locked for this scenario' : undefined}
              >
                <div className="flex items-center justify-between px-1 flex-wrap gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-meter-400">
                      INTERACTIVE PARAMETRIC EQ
                    </span>
                    <span className="text-[9px] text-zinc-400 font-mono hidden sm:inline">
                      [Drag nodes to sculpt · double-click to reset]
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] font-mono">
                    <button
                      onClick={() => {
                        const updated = { ...selectedCh, eqLow: 0, eqMid: 0, eqMidFreq: 2500, eqHigh: 0 };
                        onUpdateChannel(selectedChannelIndex, updated);
                      }}
                      onDoubleClick={() => {
                        const updated = { ...selectedCh, eqLow: 0, eqMid: 0, eqMidFreq: 2500, eqHigh: 0 };
                        onUpdateChannel(selectedChannelIndex, updated);
                      }}
                      className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 text-[8px] font-mono transition-colors"
                      title="Reset all EQ bands to 0 dB Flat & 2.5k Center"
                    >
                      RESET ALL EQ
                    </button>
                    <span className="text-cyan-400">● LOW {CONSOLE_LOW_HZ}Hz</span>
                    <span className="text-teal-400">● MID SWEEP</span>
                    <span className="text-sky-400">● HIGH {CONSOLE_HIGH_HZ / 1000}kHz</span>
                  </div>
                </div>

                {/* Canvas */}
                <canvas
                  ref={canvasRef}
                  width={680}
                  height={160}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  onDoubleClick={handleCanvasDoubleClick}
                  title="Double-click a band node to reset to 0 dB (or background to reset all EQ)"
                  className={`w-full h-36 rounded border border-zinc-800 bg-zinc-950 touch-none select-none ${canvasCursor}`}
                />

                {/* EQ Numerical Readouts & Adjusters with Dedicated Knobs and Sliders */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-zinc-900/80 p-2 rounded-lg border border-zinc-800 text-[11px] font-mono">
                  {/* LOW shelf */}
                  <div
                    onDoubleClick={() => updateSelectedField('eqLow', 0)}
                    className="flex flex-col items-center justify-between gap-1 p-1.5 bg-zinc-950/60 rounded border border-zinc-850 cursor-pointer"
                    title="Double-click anywhere to reset Low Shelf to 0.0 dB Flat"
                  >
                    <div className="flex items-center justify-between w-full px-1 border-b border-zinc-850 pb-0.5">
                      <span className="text-cyan-400 font-bold text-[10px]">● LOW ({CONSOLE_LOW_HZ}Hz)</span>
                      <span className="font-bold text-zinc-200 text-[10px] hover:text-cyan-300">
                        {selectedCh.eqLow > 0 ? '+' : ''}{selectedCh.eqLow.toFixed(1)} dB
                      </span>
                    </div>
                    <Knob
                      label="LOW GAIN"
                      value={selectedCh.eqLow}
                      min={-15}
                      max={15}
                      step={0.5}
                      unit="dB"
                      color="blue"
                      size="sm"
                      centerDetent
                      defaultValue={0}
                      formatValue={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`}
                      onChange={(v) => updateSelectedField('eqLow', v)}
                    />
                  </div>

                  {/* MID (Parametric Sweepable Center & Gain) */}
                  <div
                    onDoubleClick={() => {
                      updateSelectedField('eqMid', 0);
                      updateSelectedField('eqMidFreq', 2500);
                    }}
                    className={`flex flex-col items-center justify-between gap-1 p-1.5 bg-zinc-950/60 rounded border border-amber-900/40 cursor-pointer${matchMode ? ' opacity-25 grayscale pointer-events-none' : ''}`}
                    title="Double-click anywhere to reset Mid to 0.0 dB and 2.50 kHz Center"
                  >
                    <div className="flex items-center justify-between w-full px-1 border-b border-zinc-850 pb-0.5">
                      <span className="text-amber-400 font-bold text-[10px]">● MID SWEEP</span>
                      <div className="flex items-center gap-1.5 text-[9.5px]">
                        <span className="font-bold text-zinc-200">
                          {selectedCh.eqMid > 0 ? '+' : ''}{selectedCh.eqMid.toFixed(1)} dB
                        </span>
                        <span className="text-amber-300 font-bold">
                          {selectedCh.eqMidFreq >= 1000 ? `${(selectedCh.eqMidFreq / 1000).toFixed(2)}k` : `${Math.round(selectedCh.eqMidFreq || 2500)}Hz`}
                        </span>
                      </div>
                    </div>

                    {/* Dual Rotary Knobs for Mid Gain & Mid Frequency Selector */}
                    <div className="flex items-center justify-around w-full gap-1">
                      <Knob
                        label="MID GAIN"
                        value={selectedCh.eqMid}
                        min={-15}
                        max={15}
                        step={0.5}
                        unit="dB"
                        color="teal"
                        size="sm"
                        centerDetent
                        defaultValue={0}
                        formatValue={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`}
                        onChange={(v) => updateSelectedField('eqMid', v)}
                      />
                      <Knob
                        label="FREQ SELECT"
                        value={selectedCh.eqMidFreq || 2500}
                        min={100}
                        max={8000}
                        step={25}
                        color="indigo"
                        size="sm"
                        defaultValue={2500}
                        centerValue={2500}
                        formatValue={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)} Hz`)}
                        onChange={(v) => updateSelectedField('eqMidFreq', v)}
                      />
                    </div>

                  </div>

                  {/* HIGH (12kHz Shelf) */}
                  <div
                    onDoubleClick={() => updateSelectedField('eqHigh', 0)}
                    className="flex flex-col items-center justify-between gap-1 p-1.5 bg-zinc-950/60 rounded border border-zinc-850 cursor-pointer"
                    title="Double-click anywhere to reset High Shelf to 0.0 dB Flat"
                  >
                    <div className="flex items-center justify-between w-full px-1 border-b border-zinc-850 pb-0.5">
                      <span className="text-sky-400 font-bold text-[10px]">● HIGH ({CONSOLE_HIGH_HZ / 1000}kHz)</span>
                      <span className="font-bold text-zinc-200 text-[10px] hover:text-sky-300">
                        {selectedCh.eqHigh > 0 ? '+' : ''}{selectedCh.eqHigh.toFixed(1)} dB
                      </span>
                    </div>
                    <Knob
                      label="HIGH GAIN"
                      value={selectedCh.eqHigh}
                      min={-15}
                      max={15}
                      step={0.5}
                      unit="dB"
                      color="light-blue"
                      size="sm"
                      centerDetent
                      defaultValue={0}
                      formatValue={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`}
                      onChange={(v) => updateSelectedField('eqHigh', v)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 6 CHANNEL FADER STRIPS (PLACED DIRECTLY UNDERNEATH PROCESSING BAY) */}
          <div className="bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800 flex items-center justify-between gap-1.5 overflow-x-auto">
            {channels.map((ch, idx) => {
              const isSelected = idx === selectedChannelIndex;
              const meter = meterLevels.channels[idx] || { level: 0, clipped: false };

              return (
                <div
                  key={ch.id}
                  onClick={() => onSelectChannel(idx)}
                  className={`flex-1 min-w-[72px] max-w-[92px] flex flex-col items-center bg-zinc-900 p-1 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-meter-400 shadow-[0_0_15px_color-mix(in_srgb,var(--acc-500)_30%,transparent)] bg-zinc-850'
                      : 'border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="w-full flex items-center justify-between gap-0.5 mb-1 bg-zinc-950 px-1 py-0.5 rounded border border-zinc-800">
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <span className="text-[10px] font-mono text-meter-400 font-bold whitespace-nowrap">Ch {ch.id}</span>
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          meter.clipped ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-ping' : 'bg-zinc-800'
                        }`}
                        title={meter.clipped ? 'PEAK / CLIPPING' : 'Normal'}
                      />
                    </div>
                    <button
                      onClick={() => onSelectChannel(idx)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors whitespace-nowrap ${
                        isSelected
                          ? 'bg-meter-500 text-zinc-950 border-meter-300 font-extrabold shadow-md'
                          : 'bg-zinc-850 text-zinc-300 border-zinc-750 hover:bg-zinc-800'
                      }`}
                    >
                      SEL
                    </button>
                  </div>

                  {/* Mute & Solo Buttons */}
                  <div className="grid grid-cols-2 gap-1 w-full mb-2">
                    <button
                      onClick={() => {
                        const updated = { ...ch, mute: !ch.mute };
                        onUpdateChannel(idx, updated);
                      }}
                      className={`py-1 text-[9px] font-bold rounded border ${
                        ch.mute
                          ? 'bg-rose-600 text-white border-rose-400'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      MUTE
                    </button>
                    <button
                      onClick={() => {
                        const updated = { ...ch, soloPfl: !ch.soloPfl };
                        onUpdateChannel(idx, updated);
                      }}
                      className={`py-1 text-[9px] font-bold rounded border ${
                        ch.soloPfl
                          ? 'bg-amber-500 text-zinc-950 border-amber-300'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}
                      title="SOLO: Mutes all other channels in terms of audio playback for isolated auditing"
                    >
                      SOLO
                    </button>
                  </div>

                  {/* Instrument Name Label */}
                  <div className="w-full text-[9px] font-mono font-bold text-center text-zinc-100 bg-zinc-950 py-0.5 px-1 rounded border border-zinc-800 truncate mb-1" title={ch.name}>
                    {ch.name}
                  </div>

                  {/* Fader & Meter with Log Audio Taper & Aligned Scale */}
                  <div className="flex items-center justify-center bg-zinc-950 p-1.5 rounded border border-zinc-850 h-52 w-full">
                    <FaderScale heightClass="h-44" />
                    <div className="flex-1 flex justify-center items-center h-full px-1">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={0.1}
                        value={dbToSliderPos(ch.faderLevel)}
                        onChange={(e) => {
                          const updated = { ...ch, faderLevel: sliderPosToDb(parseFloat(e.target.value)) };
                          onUpdateChannel(idx, updated);
                        }}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          const updated = { ...ch, faderLevel: 0 };
                          onUpdateChannel(idx, updated);
                        }}
                        onTouchStart={handleTouchStartReset(0, (v) => {
                          const updated = { ...ch, faderLevel: v };
                          onUpdateChannel(idx, updated);
                        })}
                        className="fader-vertical h-44 w-8"
                        title={`Fader: ${ch.faderLevel > 0 ? '+' : ''}${ch.faderLevel.toFixed(1)} dB (Log Audio Taper)\n(double click or double tap to reset)`}
                      />
                    </div>
                  </div>

                  {/* Fader Readout */}
                  <span
                    onDoubleClick={() => {
                      const updated = { ...ch, faderLevel: 0 };
                      onUpdateChannel(idx, updated);
                    }}
                    onTouchStart={handleTouchStartReset(0, (v) => {
                      const updated = { ...ch, faderLevel: v };
                      onUpdateChannel(idx, updated);
                    })}
                    className="text-[9px] font-mono font-bold text-zinc-300 mt-1 cursor-pointer select-none hover:text-meter-300 transition-colors"
                    title="Double-click or double-tap to reset fader to 0.0 dB Unity"
                  >
                    {ch.faderLevel <= -59 ? '-∞' : `${ch.faderLevel > 0 ? '+' : ''}${ch.faderLevel.toFixed(1)} dB`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: MASTER SECTION (HEIGHT-BALANCED & WITHOUT X-RAY) */}
        <div className="w-full lg:w-56 min-[980px]:w-56 flex-shrink-0 flex flex-col justify-between bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border-2 border-red-900/60 rounded-xl p-2.5 gap-2 shadow-2xl">
          {/* Master Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-1">
            <span className="text-xs font-mono font-bold text-red-500 uppercase tracking-wider">
              MASTER SECTION
            </span>
            <div className="flex items-center gap-1.5">
              <div
                className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border transition-all ${
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

          {/* Internal FX Multi-Processor Controls */}
          <div className="flex flex-col gap-1.5 bg-zinc-950/70 p-2 rounded-lg border border-zinc-850">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono font-bold text-purple-400">
                DSP FX PROCESSOR
              </span>
              <button
                onClick={() => handleMasterField('fxMute', !master.fxMute)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleMasterField('fxMute', false);
                }}
                className={`text-[8px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                  master.fxMute
                    ? 'bg-rose-600 text-white border-rose-400 font-bold'
                    : 'bg-zinc-850 text-zinc-400 border-zinc-750 hover:text-zinc-200'
                }`}
                title="Click to toggle · Double-click to reset to ACTIVE (Unmuted)"
              >
                {master.fxMute ? 'MUTED' : 'ACTIVE'}
              </button>
            </div>

            <FxPanel master={master} onField={handleMasterField} />
          </div>

          {/* Aux Master & FX Return */}
          <div className="flex items-center justify-around bg-zinc-950/70 p-2 rounded-lg border border-zinc-850">
            <div
              onDoubleClick={() => handleMasterField('aux1Master', 0)}
              className="flex flex-col items-center cursor-pointer"
              title="Double-click to reset Aux Master to 0.0 dB Unity (Default)"
            >
              <Knob
                label="AUX MASTER"
                value={master.aux1Master}
                min={-60}
                max={10}
                color="green"
                size="sm"
                defaultValue={0}
                onChange={(v) => handleMasterField('aux1Master', v)}
              />
            </div>
            <div
              onDoubleClick={() => handleMasterField('fxReturn', 0)}
              className="flex flex-col items-center cursor-pointer"
              title="Double-click to reset FX Return to 0.0 dB Unity (Default)"
            >
              <Knob
                label="FX RETURN"
                value={master.fxReturn}
                min={-60}
                max={10}
                color="purple"
                size="sm"
                defaultValue={0}
                onChange={(v) => handleMasterField('fxReturn', v)}
              />
            </div>
          </div>

          {/* Master Stereo Meters */}
          <div className="flex flex-col bg-zinc-950 p-2 rounded-lg border border-zinc-850 gap-1 justify-center">
            <span className="text-[9px] font-mono text-center text-zinc-400 font-bold">
              STEREO VU METERS (L / R)
            </span>
            <div className="flex justify-center gap-3">
              <MeterLadder
                level={meterLevels.masterL}
                clipped={meterLevels.masterClipped}
                height={100}
                width={12}
                showLabels
              />
              <MeterLadder
                level={meterLevels.masterR}
                clipped={meterLevels.masterClipped}
                height={100}
                width={12}
              />
            </div>
          </div>

          {/* Main Mix Master Fader */}
          <div className="flex flex-col bg-zinc-950 p-2 rounded-lg border border-zinc-850 gap-1">
            <div
              onDoubleClick={() => handleMasterField('mainFader', 0)}
              onTouchStart={handleTouchStartReset(0, (v) => handleMasterField('mainFader', v))}
              className="flex items-center justify-between text-[10px] font-mono mb-0.5 cursor-pointer select-none"
              title="Double-click or double-tap to reset Main Mix to 0.0 dB Unity"
            >
              <span className="text-red-400 font-bold">MAIN MIX</span>
              <span className="font-bold text-zinc-200 hover:text-red-400 transition-colors">
                {master.mainFader <= -59 ? '-∞' : `${master.mainFader > 0 ? '+' : ''}${master.mainFader.toFixed(1)} dB`}
              </span>
            </div>
            <div className="flex justify-center items-center h-52 bg-zinc-950 p-1.5 rounded border border-zinc-850">
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
