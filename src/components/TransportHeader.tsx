import { LogoIcon, LogoWordmark } from './BrandLogo';
import React, { useRef } from 'react';
import { BUILTIN_SONGS } from '../audio/songs';
import { TabId, isChallengeTab, tabAccent } from '../types/audio';

interface TransportHeaderProps {
  currentSongId: string;
  onSelectSong: (songId: string) => void;
  songLoading?: boolean;
  songLoadProgress?: number;
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
  songLoading = false,
  songLoadProgress = 0,
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
          {/* Logo: meter-ring icon + meter-coloured wordmark */}
          <LogoIcon size={40} className="shrink-0" />

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <h1 className="leading-none select-none">
              <LogoWordmark height={30} className="h-6 sm:h-[30px] w-auto" />
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
                    ? 'bg-zinc-750 text-meter-400 shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Analog
              </button>
              <button
                onClick={() => onToggleConsoleView('digital')}
                className={`px-2.5 py-1 text-xs font-mono font-bold rounded transition-colors cursor-pointer ${
                  consoleView === 'digital'
                    ? 'bg-zinc-750 text-meter-400 shadow'
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
            .map((tab) => {
              const isActive = activeTab === tab.id || (tab.id === 'challenges' && isChallengeTab(activeTab));
              return (
                <button
                  key={tab.id}
                  data-accent={tabAccent(tab.id as TabId | 'challenges')}
                  onClick={() => onSelectTab(tab.id as TabId | 'challenges')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-display text-[15px] font-bold tracking-wider whitespace-nowrap transition-all shrink-0 ${
                    isActive
                      ? 'bg-meter-500 text-zinc-950 shadow-md'
                      : 'text-zinc-400 hover:text-meter-300 hover:bg-zinc-900'
                  }`}
                >
                  {/* Meter LED in the tab's colour (dim when not selected) */}
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-zinc-950/60' : 'bg-meter-500/60'}`} />
                  {tab.label}
                </button>
              );
            })}
        </nav>

        {/* Synchronized Transport Controls (wrapping on mobile) */}
        <div className="flex flex-wrap items-center gap-2 bg-zinc-900/90 px-2.5 py-1.5 rounded-lg border border-zinc-800">
          {/* Song Selector */}
          <select
            value={currentSongId}
            onChange={(e) => onSelectSong(e.target.value)}
            disabled={activeTab === 'match' || activeTab === 'whatchanged'}
            title={activeTab === 'match' ? 'In Match the Mix, the song is set by the reference you pick' : activeTab === 'whatchanged' ? 'What Changed? always uses Quack' : 'Choose a song'}
            className="disabled:opacity-60 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-200 focus:outline-none focus:border-meter-500"
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
          <div className="text-xs font-mono font-bold tabular-nums text-meter-400 bg-zinc-950 px-2 py-1 rounded border border-zinc-850">
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
            className="w-28 sm:w-44 accent-meter-400 cursor-pointer"
          />

          {/* Song loading bar: shown while the stems download so students know why there's no sound yet */}
          {songLoading && (
            <div
              className="basis-full flex items-center gap-2"
              role="progressbar"
              aria-label="Loading song"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(songLoadProgress * 100)}
            >
              <span className="text-[11px] font-mono font-bold text-meter-400 whitespace-nowrap">
                LOADING SONG… {Math.round(songLoadProgress * 100)}%
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-zinc-950 border border-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-meter-400 transition-[width] duration-150 ease-out"
                  style={{ width: `${Math.max(3, songLoadProgress * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
