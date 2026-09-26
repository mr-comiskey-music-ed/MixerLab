import { useState, useEffect, useRef, useCallback } from 'react';
import { ChannelSettings, MasterSettings, ScenarioItem } from './types/audio';
import { audioEngine } from './audio/audioEngine';
import { BUILTIN_SONGS } from './audio/stemSynthesizer';
import { TransportHeader } from './components/TransportHeader';
import { AnalogConsole } from './components/AnalogConsole';
import { DigitalConsole } from './components/DigitalConsole';
import { SignalFlowXRay } from './components/SignalFlowXRay';
import { ScenarioChallenges, SCENARIOS } from './components/ScenarioChallenges';
import { TimedDrill } from './components/TimedDrill';
import { MatchTheMix } from './components/MatchTheMix';
import { GradeReport } from './components/GradeReport';
import { LearnMixer } from './components/LearnMixer';

export default function App() {
  const [currentSongId, setCurrentSongId] = useState<string>('song1');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(8.0);
  const [consoleView, setConsoleView] = useState<'analog' | 'digital'>('analog');
  const [activeTab, setActiveTab] = useState<'console' | 'learn' | 'scenarios' | 'drill' | 'match' | 'grades'>('console');
  const [selectedDigitalChannelIndex, setSelectedDigitalChannelIndex] = useState<number>(0);

  // Signal Flow Modal State
  const [xrayState, setXrayState] = useState<{ isOpen: boolean; channelId: number; channelName: string }>({
    isOpen: false,
    channelId: 1,
    channelName: 'Kick / Snare'
  });

  // Scorecard state
  const [scenariosCompleted, setScenariosCompleted] = useState<Record<number, number>>({});
  const [drillHighScore, setDrillHighScore] = useState<number>(0);
  const [drillBestReactionMs, setDrillBestReactionMs] = useState<number>(0);
  const [matchScore, setMatchScore] = useState<number>(0);
  const [learnCompleted, setLearnCompleted] = useState<boolean>(false);
  const [activeScenarioId, setActiveScenarioId] = useState<number>(1);
  const [currentCrisisType, setCurrentCrisisType] = useState<string>('');

  useEffect(() => {
    if (activeTab === 'learn') {
      audioEngine.setIsolatedChannel(0);
    } else {
      audioEngine.setIsolatedChannel(null);
    }

    if (activeTab === 'scenarios') {
      audioEngine.setEnforcePhantomPower(activeScenarioId === 1);
      const currentSc = SCENARIOS.find(s => s.id === activeScenarioId) || SCENARIOS[0];
      handleApplyScenarioState(currentSc.setupState);
    } else if (activeTab === 'drill') {
      audioEngine.setEnforcePhantomPower(currentCrisisType === 'phantom_drop');
    } else {
      audioEngine.setEnforcePhantomPower(false);
      // Ensure channel 3 phantom power is enabled outside scenarios/drills so audio plays freely
      setChannels(prev => {
        const next = [...prev];
        if (next[2] && !next[2].phantom48V) {
          next[2] = { ...next[2], phantom48V: true };
          audioEngine.updateChannel(2, next[2]);
        }
        return next;
      });
    }
  }, [activeTab, activeScenarioId, currentCrisisType]);

  // Initial Mixer Channel Settings
  const [channels, setChannels] = useState<ChannelSettings[]>([
    {
      id: 1,
      name: "Kick / Snare",
      type: "drums",
      gain: 0,
      phantom48V: false,
      hiZ: false,
      phaseInvert: false,
      lowCut100Hz: false,
      eqHigh: 0,
      eqMid: 0,
      eqMidFreq: 2500,
      eqLow: 0,
      aux1Pre: -60,
      fxPost: -60,
      pan: 0,
      mute: false,
      soloPfl: false,
      faderLevel: 0
    },
    {
      id: 2,
      name: "E. Bass",
      type: "bass",
      gain: 0,
      phantom48V: false,
      hiZ: false,
      phaseInvert: false,
      lowCut100Hz: false,
      eqHigh: 0,
      eqMid: 0,
      eqMidFreq: 2500,
      eqLow: 0,
      aux1Pre: -60,
      fxPost: -60,
      pan: 0,
      mute: false,
      soloPfl: false,
      faderLevel: 0
    },
    {
      id: 3,
      name: "Lead Vocal",
      type: "vocal",
      gain: 0,
      phantom48V: false,
      hiZ: false,
      phaseInvert: false,
      lowCut100Hz: false,
      eqHigh: 0,
      eqMid: 0,
      eqMidFreq: 2500,
      eqLow: 0,
      aux1Pre: -60,
      fxPost: -60,
      pan: 0,
      mute: false,
      soloPfl: false,
      faderLevel: 0
    },
    {
      id: 4,
      name: "E. Guitar",
      type: "guitar",
      gain: 0,
      phantom48V: false,
      hiZ: false,
      phaseInvert: false,
      lowCut100Hz: false,
      eqHigh: 0,
      eqMid: 0,
      eqMidFreq: 2500,
      eqLow: 0,
      aux1Pre: -60,
      fxPost: -60,
      pan: 0,
      mute: false,
      soloPfl: false,
      faderLevel: 0
    },
    {
      id: 5,
      name: "Synth Pad",
      type: "synth",
      gain: 0,
      phantom48V: false,
      hiZ: false,
      phaseInvert: false,
      lowCut100Hz: false,
      eqHigh: 0,
      eqMid: 0,
      eqMidFreq: 2500,
      eqLow: 0,
      aux1Pre: -60,
      fxPost: -60,
      pan: 0,
      mute: false,
      soloPfl: false,
      faderLevel: 0
    },
    {
      id: 6,
      name: "Perc / Aux",
      type: "perc",
      gain: 0,
      phantom48V: false,
      hiZ: false,
      phaseInvert: false,
      lowCut100Hz: false,
      eqHigh: 0,
      eqMid: 0,
      eqMidFreq: 2500,
      eqLow: 0,
      aux1Pre: -60,
      fxPost: -60,
      pan: 0,
      mute: false,
      soloPfl: false,
      faderLevel: 0
    }
  ]);

  // Master Section Settings
  const [master, setMaster] = useState<MasterSettings>({
    mainFader: 0,
    aux1Master: 0,
    fxReturn: 0,
    fxMute: false,
    fxType: 'plate',
    phonesLevel: 75
  });

  // Real-time meter visuals
  const [meterLevels, setMeterLevels] = useState<{
    channels: { level: number; clipped: boolean }[];
    masterL: number;
    masterR: number;
    masterClipped: boolean;
    aux1: number;
    pflActive: boolean;
  }>({
    channels: Array(6).fill({ level: 0, clipped: false }),
    masterL: 0,
    masterR: 0,
    masterClipped: false,
    aux1: 0,
    pflActive: false
  });

  const channelsRef = useRef(channels);
  channelsRef.current = channels;
  const masterRef = useRef(master);
  masterRef.current = master;

  // Initialize engine on first gesture / mount
  useEffect(() => {
    audioEngine.init();
    channels.forEach((ch, idx) => audioEngine.updateChannel(idx, ch));
    audioEngine.updateMaster(master);
    setDuration(audioEngine.loopDuration);
  }, []);

  // Real-time animation loop for VU meters & playback scrubber
  useEffect(() => {
    let animId: number;
    const updateLoop = () => {
      // Check active PFL solo channel index
      const activePflIdx = channelsRef.current.findIndex(c => c.soloPfl);
      const levels = audioEngine.getMeterLevels(activePflIdx >= 0 ? activePflIdx : null);
      setMeterLevels(levels);

      if (audioEngine.isPlaying) {
        setCurrentTime(audioEngine.getCurrentTime());
      }

      animId = requestAnimationFrame(updateLoop);
    };

    animId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Update channel parameters
  const handleUpdateChannel = useCallback((index: number, newSettings: ChannelSettings) => {
    setChannels(prev => {
      const next = [...prev];
      next[index] = newSettings;
      audioEngine.updateAllChannels(next);
      return next;
    });
  }, []);

  // Update master parameters
  const handleUpdateMaster = useCallback((newSettings: MasterSettings) => {
    setMaster(newSettings);
    audioEngine.updateMaster(newSettings);
  }, []);

  // Transport actions
  const handlePlay = () => {
    audioEngine.play(currentTime);
    setIsPlaying(true);
  };

  const handlePause = () => {
    audioEngine.pause();
    setIsPlaying(false);
  };

  const handleStop = () => {
    audioEngine.stop();
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleToggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    audioEngine.isLooping = next;
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    audioEngine.seek(time);
  };

  // Song switching
  const handleSelectSong = (songId: string) => {
    setCurrentSongId(songId);
    audioEngine.loadSong(songId);
    setDuration(audioEngine.loopDuration);
    // Update channel names to match selected song stems
    const song = BUILTIN_SONGS.find(s => s.id === songId);
    if (song) {
      setChannels(prev =>
        prev.map((ch, idx) => ({
          ...ch,
          name: song.stems[idx]?.name || ch.name,
          type: song.stems[idx]?.type || ch.type
        }))
      );
    }
  };

  // Custom stem file dropping per channel
  const handleLoadCustomStem = async (channelIndex: number, file: File) => {
    try {
      const buffer = await audioEngine.decodeAudioFile(file);
      audioEngine.loadCustomStem(channelIndex, buffer);
      setDuration(audioEngine.loopDuration);
      setChannels(prev => {
        const next = [...prev];
        next[channelIndex] = {
          ...next[channelIndex],
          name: file.name.replace(/\.[^/.]+$/, '').slice(0, 16)
        };
        return next;
      });
    } catch (e) {
      console.error("Failed to decode audio stem file:", e);
    }
  };

  // Custom multitrack dropzone (loads up to 6 audio stems simultaneously)
  const handleLoadCustomMultitrack = async (files: FileList) => {
    const count = Math.min(files.length, 6);
    for (let i = 0; i < count; i++) {
      const file = files[i];
      try {
        const buffer = await audioEngine.decodeAudioFile(file);
        audioEngine.loadCustomStem(i, buffer);
        setChannels(prev => {
          const next = [...prev];
          next[i] = {
            ...next[i],
            name: file.name.replace(/\.[^/.]+$/, '').slice(0, 16)
          };
          return next;
        });
      } catch (e) {
        console.error("Error loading multitrack stem:", e);
      }
    }
    setDuration(audioEngine.loopDuration);
  };

  // Apply scenario state (fully resets mixer to clean defaults first, then applies scenario overrides)
  const handleApplyScenarioState = (setup: ScenarioItem['setupState']) => {
    if (setup.songId && setup.songId !== currentSongId) {
      handleSelectSong(setup.songId);
    }

    const defaultChannels: ChannelSettings[] = [1, 2, 3, 4, 5, 6].map((id, idx) => ({
      id,
      name: ["Kick / Snare", "E. Bass", "Lead Vocal", "E. Guitar", "Synth Pad", "Perc / Aux"][idx],
      type: ["drums", "bass", "vocal", "guitar", "synth", "perc"][idx] as any,
      gain: 0,
      phantom48V: false,
      hiZ: false,
      phaseInvert: false,
      lowCut100Hz: false,
      eqHigh: 0,
      eqMid: 0,
      eqMidFreq: 2500,
      eqLow: 0,
      aux1Pre: -60,
      fxPost: -60,
      pan: 0,
      mute: false,
      soloPfl: false,
      faderLevel: 0
    }));

    const defaultMaster: MasterSettings = {
      mainFader: 0,
      aux1Master: 0,
      fxReturn: 0,
      fxMute: false,
      fxType: 'plate',
      phonesLevel: 75
    };

    let nextChannels = defaultChannels;
    let nextMaster = defaultMaster;

    if (setup.channels) {
      setup.channels.forEach((override) => {
        const idx = nextChannels.findIndex(c => c.id === override.id);
        if (idx !== -1) {
          nextChannels[idx] = { ...nextChannels[idx], ...override } as ChannelSettings;
        }
      });
    }

    if (setup.master) {
      nextMaster = { ...nextMaster, ...setup.master };
    }

    setChannels(nextChannels);
    audioEngine.updateAllChannels(nextChannels);
    setMaster(nextMaster);
    audioEngine.updateMaster(nextMaster);

    if (!isPlaying) {
      handlePlay();
    }
  };

  // Tab selection with audio pause
  const handleSelectTab = (tab: 'console' | 'learn' | 'scenarios' | 'drill' | 'match' | 'grades') => {
    if (isPlaying) {
      handlePause();
    }
    setActiveTab(tab);
  };

  // Global Spacebar hotkey for Play / Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) {
          handlePause();
        } else {
          handlePlay();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  // Apply emergency drill crisis across 12 distinct signal flow crises
  const handleApplyEmergency = (type: string) => {
    // Stage 1: Prerequisites (Phantom, Hi-Z, Gain)
    if (type === 'phantom_drop' || type === 'phantom') {
      const idx = 2; // Ch 3 Vocal
      handleUpdateChannel(idx, { ...channels[idx], phantom48V: false });
    } else if (type === 'hiz_mismatch') {
      const idx = 1; // Ch 2 Bass
      handleUpdateChannel(idx, { ...channels[idx], hiZ: false, gain: 10 });
    } else if (type === 'kick_preamp_clip' || type === 'clip') {
      const idx = 0; // Ch 1 Kick/Snare
      handleUpdateChannel(idx, { ...channels[idx], gain: 18, faderLevel: 0, mute: false });
    } else if (type === 'vocal_preamp_hot') {
      const idx = 2; // Ch 3 Vocal
      handleUpdateChannel(idx, { ...channels[idx], gain: 18, faderLevel: 0, mute: false });
    }
    // Stage 2: Filters & EQ
    else if (type === 'sub_rumble') {
      const idx = 2; // Ch 3
      handleUpdateChannel(idx, { ...channels[idx], lowCut100Hz: false });
    } else if (type === 'bass_mud') {
      const idx = 1; // Ch 2 Bass
      handleUpdateChannel(idx, { ...channels[idx], eqLow: 14 });
    } else if (type === 'guitar_harsh') {
      const idx = 3; // Ch 4 Guitar
      handleUpdateChannel(idx, { ...channels[idx], eqHigh: 14 });
    } else if (type === 'vocal_feedback' || type === 'feedback') {
      const idx = 2; // Ch 3 Vocal
      handleUpdateChannel(idx, { ...channels[idx], gain: 18, faderLevel: 3, eqMid: 9, mute: false });
    }
    // Stage 3: Aux & FX Sends
    else if (type === 'aux1_wedge_spill') {
      const idx = 0; // Ch 1
      handleUpdateChannel(idx, { ...channels[idx], aux1Pre: 10 });
    } else if (type === 'reverb_washout') {
      handleUpdateMaster({ ...master, fxReturn: 6, fxMute: false });
    } else if (type === 'vocal_fx_spill') {
      const idx = 2; // Ch 3
      handleUpdateChannel(idx, { ...channels[idx], fxPost: 10 });
    }
    // Stage 4: Pan & Master Faders
    else if (type === 'vocal_pan_drift') {
      const idx = 2; // Ch 3
      handleUpdateChannel(idx, { ...channels[idx], pan: -0.9 });
    } else if (type === 'foh_master_overload' || type === 'master') {
      handleUpdateMaster({ ...master, mainFader: 8 });
    }

    if (!isPlaying) {
      handlePlay();
    }
  };

  // Match the Mix Audition handler
  const handleAuditionReferenceMix = (
    isRef: boolean,
    refState?: { channels: Partial<ChannelSettings>[]; master: Partial<MasterSettings> }
  ) => {
    if (isRef && refState) {
      // Audition reference
      if (refState.channels) {
        refState.channels.forEach((override) => {
          const idx = channels.findIndex(c => c.id === override.id);
          if (idx !== -1) {
            const temp = { ...channels[idx], ...override } as ChannelSettings;
            audioEngine.updateChannel(idx, temp);
          }
        });
      }
      if (refState.master) {
        audioEngine.updateMaster({ ...master, ...refState.master });
      }
    } else {
      // Restore student's active console mix
      channels.forEach((ch, idx) => audioEngine.updateChannel(idx, ch));
      audioEngine.updateMaster(master);
    }
  };

  // Load student mix from Teacher Batch Verifier
  const handleLoadStudentMix = (loadedChannels: ChannelSettings[], loadedMaster: MasterSettings) => {
    setChannels(loadedChannels);
    setMaster(loadedMaster);
    loadedChannels.forEach((ch, idx) => audioEngine.updateChannel(idx, ch));
    audioEngine.updateMaster(loadedMaster);
    setActiveTab('console');
  };

  // Helper to render the interactive audio console bay
  const renderConsoleBay = (title?: string) => (
    <div id="audio-console-bay" className="w-full flex flex-col items-center mt-6">
      {title && (
        <div className="w-full max-w-6xl mb-3 flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wide">
              {title}
            </span>
          </div>
          <span className="text-[11px] font-mono text-zinc-400">
            Live Audio Console ({consoleView === 'analog' ? 'Mackie ProFX Analog' : 'Digital Touch Console'})
          </span>
        </div>
      )}
      {consoleView === 'analog' ? (
        <AnalogConsole
          channels={channels}
          master={master}
          meterLevels={meterLevels}
          onUpdateChannel={handleUpdateChannel}
          onUpdateMaster={handleUpdateMaster}
          onLoadCustomStem={handleLoadCustomStem}
          onOpenXRay={(channelId, channelName) => setXrayState({ isOpen: true, channelId, channelName })}
        />
      ) : (
        <DigitalConsole
          channels={channels}
          master={master}
          selectedChannelIndex={selectedDigitalChannelIndex}
          onSelectChannel={setSelectedDigitalChannelIndex}
          meterLevels={meterLevels}
          onUpdateChannel={handleUpdateChannel}
          onUpdateMaster={handleUpdateMaster}
          onOpenXRay={(channelId, channelName) => setXrayState({ isOpen: true, channelId, channelName })}
        />
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* Global Transport Header */}
      <TransportHeader
        currentSongId={currentSongId}
        onSelectSong={handleSelectSong}
        isPlaying={isPlaying}
        isLooping={isLooping}
        currentTime={currentTime}
        duration={duration}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onToggleLoop={handleToggleLoop}
        onSeek={handleSeek}
        consoleView={consoleView}
        onToggleConsoleView={setConsoleView}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onLoadCustomMultitrack={handleLoadCustomMultitrack}
      />

      {/* Main Workspace Canvas */}
      <main className="flex-1 p-4 flex flex-col justify-start">
        {/* TAB 0: LEARN (MIXER ACADEMY) */}
        {activeTab === 'learn' && (
          <div className="w-full flex flex-col items-center">
            <LearnMixer
              channels={channels}
              master={master}
              onUpdateChannel={handleUpdateChannel}
              onUpdateMaster={handleUpdateMaster}
              meterLevels={meterLevels}
              onOpenFlow={(channelId, channelName) => setXrayState({ isOpen: true, channelId, channelName })}
              consoleView={consoleView}
              onToggleConsoleView={setConsoleView}
              isPlaying={isPlaying}
              onPlay={handlePlay}
              onPause={handlePause}
              onGoToConsole={() => handleSelectTab('console')}
              learnCompleted={learnCompleted}
              onCompleteLearn={() => setLearnCompleted(true)}
            />
          </div>
        )}

        {/* TAB 1: MIX CONSOLE (ANALOG / DIGITAL) */}
        {activeTab === 'console' && (
          <div className="w-full flex flex-col items-center">
            {renderConsoleBay()}
          </div>
        )}

        {/* TAB 2: TROUBLESHOOTING SCENARIO CHALLENGES */}
        {activeTab === 'scenarios' && (
          <div className="w-full flex flex-col items-center">
            <ScenarioChallenges
              channels={channels}
              master={master}
              onApplyScenarioState={handleApplyScenarioState}
              onRecordScenarioScore={(scId, score) =>
                setScenariosCompleted(prev => ({ ...prev, [scId]: score }))
              }
              completedScenarios={scenariosCompleted}
              onScenarioChange={setActiveScenarioId}
            />
            {renderConsoleBay("Troubleshooting Console — Adjust Knobs, Faders & Switches to Resolve")}
          </div>
        )}

        {/* TAB 3: TIMED EMERGENCY DRILL */}
        {activeTab === 'drill' && (
          <div className="w-full flex flex-col items-center">
            <TimedDrill
              channels={channels}
              master={master}
              onApplyEmergency={handleApplyEmergency}
              onResolveDrillScore={(score, reactionMs) => {
                if (score > drillHighScore) setDrillHighScore(score);
                setDrillBestReactionMs(reactionMs);
              }}
              highScore={drillHighScore}
              onCrisisChange={setCurrentCrisisType}
            />
            {renderConsoleBay("Emergency Station Console — Act Quickly to Neutralize Crises")}
          </div>
        )}

        {/* TAB 4: MATCH THE MIX (A/B CRITICAL LISTENING) */}
        {activeTab === 'match' && (
          <div className="w-full flex flex-col items-center">
            <MatchTheMix
              channels={channels}
              master={master}
              onAuditionReferenceMix={handleAuditionReferenceMix}
              onSaveMatchScore={(pct) => setMatchScore(pct)}
              currentMatchScore={matchScore}
            />
            {renderConsoleBay("Match The Mix Console — Adjust Levels, Pan & EQ to Match Reference")}
          </div>
        )}

        {/* TAB 5: GRADE REPORT & INSTRUCTOR BATCH VERIFIER */}
        {activeTab === 'grades' && (
          <GradeReport
            channels={channels}
            master={master}
            scenariosCompleted={scenariosCompleted}
            drillHighScore={drillHighScore}
            drillBestReactionMs={drillBestReactionMs}
            matchScore={matchScore}
            learnCompleted={learnCompleted}
            onLoadStudentMix={handleLoadStudentMix}
          />
        )}
      </main>

      {/* Interactive Signal Flow X-Ray HUD Modal */}
      <SignalFlowXRay
        isOpen={xrayState.isOpen}
        onClose={() => setXrayState(prev => ({ ...prev, isOpen: false }))}
        channelId={xrayState.channelId}
        channelName={xrayState.channelName}
      />
    </div>
  );
}
