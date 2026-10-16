import React, { useRef } from 'react';
import { BUILTIN_SONGS } from '../audio/stemSynthesizer';
import { TabId, isChallengeTab } from '../types/audio';

interface TransportHeaderProps {
  currentSongId: string;
  onSelectSong: (songId: string) => void;
  isPlaying: boolean;
  isLooping: boolean;
  currentTime: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onToggleLoop: () => void;
  onSeek: (time: number) => void;
  consoleView: 'analog' | 'digital';
  onToggleConsoleView: (view: 'analog' | 'digital') => void;
  activeTab: TabId;
  onSelectTab: (tab: TabId | 'challenges') => void;
  showChallenges?: boolean;
  showEqWizard?: boolean;
  onLoadCustomMultitrack: (files: FileList) => void;
}

export const TransportHeader: React.FC<TransportHeaderProps> = ({
  currentSongId,
  onSelectSong,
  isPlaying,
  isLooping,
  currentTime,
  duration,
  onPlay,
  onPause,
  onStop,
  onToggleLoop,
  onSeek,
  consoleView,
  onToggleConsoleView,
  activeTab,
  onSelectTab,
  showChallenges = true,
  showEqWizard = true,
  onLoadCustomMultitrack
}) => {
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const tenths = Math.floor((sec % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${tenths}`;
  };

  return (
    <header className="w-full bg-zinc-950 border-b border-zinc-800 shadow-md flex flex-col gap-2 p-3">
      {/* Top Row: Title, Mode Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Hardware Console Icon: Fader + Rotary Knob */}
          <div
            className="flex items-center justify-center w-11 h-9 rounded-lg bg-zinc-900 border border-zinc-750 shadow-inner shrink-0 select-none group hover:border-cyan-500/50 transition-colors"
            title="MixerLab: Console Fader & Knob"
          >
            <svg
              className="w-10 h-7"
              viewBox="0 0 42 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="faderCapGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#52525b" />
                  <stop offset="50%" stopColor="#27272a" />
                  <stop offset="100%" stopColor="#18181b" />
                </linearGradient>
                <radialGradient id="knobFaceGrad" cx="40%" cy="40%" r="60%">
                  <stop offset="0%" stopColor="#3f3f46" />
                  <stop offset="70%" stopColor="#18181b" />
                  <stop offset="100%" stopColor="#09090b" />
                </radialGradient>
                <linearGradient id="cyanIndicator" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>

              {/* FADER SECTION (LEFT) */}
              {/* Fader scale hash marks */}
              <line x1="2" y1="8" x2="4.5" y2="8" stroke="#71717a" strokeWidth="0.8" strokeLinecap="round" />
              <line x1="2" y1="13" x2="5.5" y2="13" stroke="#22d3ee" strokeWidth="1.2" strokeLinecap="round" /> {/* Unity 0dB mark */}
              <line x1="2" y1="18" x2="4.5" y2="18" stroke="#71717a" strokeWidth="0.8" strokeLinecap="round" />
              <line x1="2" y1="24" x2="4" y2="24" stroke="#52525b" strokeWidth="0.8" strokeLinecap="round" />

              {/* Vertical Fader Track Slot */}
              <rect x="7" y="3" width="3.2" height="26" rx="1.6" fill="#09090b" stroke="#27272a" strokeWidth="0.8" />
              <line x1="8.6" y1="4.5" x2="8.6" y2="27.5" stroke="#18181b" strokeWidth="1" />

              {/* Fader Cap (positioned at Unity) */}
              <rect
                x="4"
                y="9"
                width="9.2"
                height="11"
                rx="1.5"
                fill="url(#faderCapGrad)"
                stroke="#71717a"
                strokeWidth="0.8"
              />
              <line x1="5.5" y1="11" x2="11.5" y2="11" stroke="#3f3f46" strokeWidth="0.6" />
              {/* White Center Indicator Stripe */}
              <line x1="4" y1="14.5" x2="13.2" y2="14.5" stroke="#f4f4f5" strokeWidth="1.3" />
              <line x1="5.5" y1="18" x2="11.5" y2="18" stroke="#27272a" strokeWidth="0.6" />

              {/* KNOB SECTION (RIGHT) */}
              {/* Outer Arc Dots / Indicator ticks */}
              <path
                d="M 21.5 24.5 A 10.5 10.5 0 1 1 36.5 24.5"
                fill="none"
                stroke="#52525b"
                strokeWidth="1"
                strokeDasharray="1.5 2.5"
                strokeLinecap="round"
              />
              {/* Center Top Detent Tick (12 o'clock) */}
              <line x1="29" y1="2.5" x2="29" y2="5" stroke="#38bdf8" strokeWidth="1.2" strokeLinecap="round" />

              {/* Knob Base Outer Ring */}
              <circle cx="29" cy="16" r="9" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
              {/* Knob Face with Radial Lighting */}
              <circle cx="29" cy="16" r="7.5" fill="url(#knobFaceGrad)" stroke="#27272a" strokeWidth="0.6" />

              {/* Pointer Line pointing to ~2 o'clock */}
              <line
                x1="29"
                y1="16"
                x2="34"
                y2="11"
                stroke="url(#cyanIndicator)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              {/* Center Cap Hub */}
              <circle cx="29" cy="16" r="2.2" fill="#09090b" stroke="#06b6d4" strokeWidth="0.8" />
            </svg>
          </div>

          <div className="flex flex-wrap items-baseline gap-2.5 sm:gap-3">
            <h1 className="font-bold tracking-tight text-zinc-100 font-mono flex items-baseline leading-none select-none">
              <span className="text-2xl sm:text-[32px] text-cyan-400 font-black tracking-tight">M</span>
              <span className="text-[17px] sm:text-[21px] font-bold tracking-tight text-zinc-100">ixer</span>
              <span className="text-2xl sm:text-[32px] text-cyan-400 font-black ml-0.5 tracking-tight">L</span>
              <span className="text-[17px] sm:text-[21px] font-bold tracking-tight text-zinc-100">ab</span>
            </h1>
            <span className="text-zinc-600 text-xs sm:text-sm hidden sm:inline select-none leading-none">|</span>
            <p className="text-[11px] sm:text-xs text-zinc-400 font-mono tracking-normal leading-none pb-0.5">
              Mixing Console Simulator & Training Lab
            </p>
          </div>
        </div>

        {/* Global Action Tools: Multitrack loader, Mixer Style switcher */}
        <div className="flex items-center gap-2">
          {/* Custom Multitrack Dropper */}
          <input
            type="file"
            multiple
            accept="audio/*"
            ref={multiFileInputRef}
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onLoadCustomMultitrack(e.target.files);
              }
            }}
          />
          <button
            onClick={() => multiFileInputRef.current?.click()}
            className="hidden md:inline-flex px-2.5 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-mono border border-zinc-700 transition-colors cursor-pointer"
            title="Load up to 6 audio stems simultaneously"
          >
            LOAD MULTITRACK
          </button>

          {/* Console View Switcher: Analog vs Digital */}
          {activeTab !== 'grades' && (
            <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
              <span className="text-[11px] font-mono font-bold text-zinc-400 pl-1 hidden sm:inline">
                Mixer Style:
              </span>
              <button
                onClick={() => onToggleConsoleView('analog')}
                className={`px-2.5 py-1 text-xs font-mono font-bold rounded transition-colors cursor-pointer ${
                  consoleView === 'analog'
                    ? 'bg-zinc-750 text-cyan-400 shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Analog
              </button>
              <button
                onClick={() => onToggleConsoleView('digital')}
                className={`px-2.5 py-1 text-xs font-mono font-bold rounded transition-colors cursor-pointer ${
                  consoleView === 'digital'
                    ? 'bg-zinc-750 text-cyan-400 shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Digital
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Middle Row: Transport Bar & Navigation Tabs */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 pt-2 border-t border-zinc-850">
        {/* Navigation Tabs (horizontally scrollable on mobile) */}
        <nav className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none shrink-0">
          {[
            { id: 'learn', label: 'LEARN' },
            { id: 'console', label: 'MIX CONSOLE' },
            { id: 'challenges', label: 'CHALLENGES' },
            { id: 'eqwizard', label: 'EQ WIZARD' },
            { id: 'grades', label: 'GRADE REPORT' }
          ]
            .filter((tab) => (showChallenges || tab.id !== 'challenges') && (showEqWizard || tab.id !== 'eqwizard'))
            .map((tab) => (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id as TabId | 'challenges')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold whitespace-nowrap transition-all shrink-0 ${
                activeTab === tab.id || (tab.id === 'challenges' && isChallengeTab(activeTab))
                  ? 'bg-cyan-500 text-zinc-950 shadow-md font-extrabold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Synchronized Transport Controls (wrapping on mobile) */}
        <div className="flex flex-wrap items-center gap-2 bg-zinc-900/90 px-2.5 py-1.5 rounded-lg border border-zinc-800">
          {/* Song Selector */}
          <select
            value={currentSongId}
            onChange={(e) => onSelectSong(e.target.value)}
            disabled={activeTab === 'match'}
            title={activeTab === 'match' ? 'In Match the Mix, the song is set by the reference you pick' : 'Choose a song'}
            className="disabled:opacity-60 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500"
          >
            {BUILTIN_SONGS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.key && !s.title.includes(s.key) ? `${s.title} (${s.key})` : s.title}
              </option>
            ))}
          </select>

          {/* Transport Buttons */}
          <div className="flex items-center gap-1.5">
            {isPlaying ? (
              <button
                onClick={onPause}
                className="w-8 h-8 rounded bg-amber-600 hover:bg-amber-500 text-white font-mono font-bold text-xs flex items-center justify-center transition-colors shadow-sm"
                title="Pause"
              >
                ❚❚
              </button>
            ) : (
              <button
                onClick={onPlay}
                className="w-8 h-8 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs flex items-center justify-center transition-colors shadow-sm"
                title="Play"
              >
                ▶
              </button>
            )}

            <button
              onClick={onStop}
              className="w-8 h-8 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono font-bold text-xs flex items-center justify-center transition-colors border border-zinc-700 shadow-sm"
              title="Stop"
            >
              ■
            </button>
          </div>

          {/* Timecode Readout */}
          <div className="text-xs font-mono font-bold tabular-nums text-cyan-400 bg-zinc-950 px-2 py-1 rounded border border-zinc-850">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          {/* Scrubber Progress Slider */}
          <input
            type="range"
            min={0}
            max={duration || 8}
            step={0.1}
            value={currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="w-28 sm:w-44 accent-cyan-400 cursor-pointer"
          />
        </div>
      </div>
    </header>
  );
};
