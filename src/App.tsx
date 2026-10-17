import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChannelSettings, MasterSettings, MyMix, ScenarioItem, TabId, ChallengeTabId, isChallengeTab, CHALLENGE_TABS, tabAccent, EqSectionId, EqWizardScores, emptyEqScores } from './types/audio';
import { EqWizard } from './components/eqwizard/EqWizard';
import { GeqFoldout } from './components/GeqFoldout';
import { readAssignmentFromUrl, isEverything, matchAverage } from './utils/assignment';
import { audioEngine } from './audio/audioEngine';
import { BUILTIN_SONGS, DEFAULT_SONG_ID } from './audio/songs';
import { TransportHeader } from './components/TransportHeader';
import { AnalogConsole } from './components/AnalogConsole';
import { DigitalConsole } from './components/DigitalConsole';
import { SignalFlowXRay } from './components/SignalFlowXRay';
import { ScenarioChallenges, SCENARIOS } from './components/ScenarioChallenges';
import { WhatChanged, WHAT_CHANGED_QUESTIONS } from './components/WhatChanged';
import { ChallengeTabs } from './components/ChallengeTabs';
import { MatchTheMix, REFERENCE_PROFILES, ReferenceProfile, buildReferenceMix } from './components/MatchTheMix';
import { MyMix as MyMixPanel, MY_MIX_MIN_WORDS } from './components/MyMix';
import { GradeReport } from './components/GradeReport';
import { LearnMixer } from './components/LearnMixer';
import { makeDefaultChannels, makeDefaultMaster } from './utils/mixDefaults';

type MixState = { channels: ChannelSettings[]; master: MasterSettings };

export default function App() {
  const [currentSongId, setCurrentSongId] = useState<string>(DEFAULT_SONG_ID);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(8.0);
  const [consoleView, setConsoleView] = useState<'analog' | 'digital'>('analog');
  const [activeTab, setActiveTab] = useState<TabId>('console');

  // The assignment comes from the link the teacher posted (no ?a= means everything).
  // Unassigned challenges are hidden.
  const assignment = useMemo(() => readAssignmentFromUrl(), []);
  const visibleChallenges = CHALLENGE_TABS.filter(t => assignment.items.includes(t.id));
  const visibleEqSections = (['freqid', 'freqband', 'freqtweak'] as EqSectionId[]).filter(s => assignment.items.includes(s));

  // Which challenge the CHALLENGES tab returns to
  const [lastChallengeTab, setLastChallengeTab] = useState<ChallengeTabId>(visibleChallenges[0]?.id ?? 'scenarios');
  const [selectedDigitalChannelIndex, setSelectedDigitalChannelIndex] = useState<number>(0);

  // Signal Flow Modal State
  const [xrayState, setXrayState] = useState<{ isOpen: boolean; channelId: number; channelName: string }>({
    isOpen: false,
    channelId: 1,
    channelName: 'Kick / Snare'
  });

  // Scorecard state (lives only in this browser tab; the submission code is the only record)
  const [scenariosCompleted, setScenariosCompleted] = useState<Record<number, number>>({});
  const [whatChangedBest, setWhatChangedBest] = useState<number>(0);
  const [whatChangedFinished, setWhatChangedFinished] = useState<boolean>(false);
  const [matchScores, setMatchScores] = useState<Record<string, number>>({});
  const [learnCompleted, setLearnCompleted] = useState<boolean>(false);
  const [eqScores, setEqScores] = useState<EqWizardScores>(() => emptyEqScores());
  const [activeScenarioId, setActiveScenarioId] = useState<number>(1);

  // Mixer state
  const [channels, setChannels] = useState<ChannelSettings[]>(() => makeDefaultChannels(DEFAULT_SONG_ID));
  const [master, setMaster] = useState<MasterSettings>(() => makeDefaultMaster());

  // Match the Mix: which reference is open, A/B state, and each reference's in-progress mix
  const [matchProfileId, setMatchProfileId] = useState<string | null>(null);
  const [matchListening, setMatchListening] = useState<'A' | 'B'>('B');
  const matchWorkRef = useRef<Record<string, MixState>>({});

  // My Mix: the student's own creative mix (kept separate so other tabs can't overwrite it)
  const [myMix, setMyMix] = useState<MyMix | null>(null);

  // Real-time meter visuals
  const [meterLevels, setMeterLevels] = useState<{
    channels: { level: number; clipped: boolean; hasSignal?: boolean; compGr?: number }[];
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

  // When non-null, the speakers play this mix instead of the console (blind A/B listening).
  const auditionRef = useRef<MixState | null>(null);

  const applyAudition = useCallback((mix: MixState | null) => {
    auditionRef.current = mix;
    const target = mix || { channels: channelsRef.current, master: masterRef.current };
    audioEngine.updateAllChannels(target.channels);
    audioEngine.updateMaster(target.master);
  }, []);

  // Load a whole mix into the console (and the speakers)
  const loadMixIntoConsole = useCallback((mix: MixState) => {
    channelsRef.current = mix.channels;
    masterRef.current = mix.master;
    setChannels(mix.channels);
    setMaster(mix.master);
    auditionRef.current = null;
    audioEngine.updateAllChannels(mix.channels);
    audioEngine.updateMaster(mix.master);
  }, []);

  useEffect(() => {
    if (activeTab === 'learn') {
      audioEngine.setIsolatedChannel(0);
    } else {
      audioEngine.setIsolatedChannel(null);
    }

    if (activeTab === 'scenarios') {
      const currentSc = SCENARIOS.find(s => s.id === activeScenarioId) || SCENARIOS[0];
      audioEngine.setCondenserChannel(currentSc.condenserChannel ?? null);
      handleApplyScenarioState(currentSc.setupState);
    } else {
      audioEngine.setCondenserChannel(null);
    }
  }, [activeTab, activeScenarioId]);

  // Initialize engine on mount
  useEffect(() => {
    audioEngine.init();
    audioEngine.onDurationChange = (dur) => setDuration(dur);
    channels.forEach((ch, idx) => audioEngine.updateChannel(idx, ch));
    audioEngine.updateMaster(master);
    setDuration(audioEngine.loopDuration);
  }, []);

  // Real-time animation loop for meters & playback scrubber
  useEffect(() => {
    let animId: number;
    const updateLoop = () => {
      if (!audioEngine.isPlaying) {
        setMeterLevels({
          channels: Array(6).fill({ level: 0, clipped: false }),
          masterL: 0,
          masterR: 0,
          masterClipped: false,
          aux1: 0,
          pflActive: false
        });
      } else {
        const activePflIdx = channelsRef.current.findIndex(c => c.soloPfl);
        const levels = audioEngine.getMeterLevels(activePflIdx >= 0 ? activePflIdx : null);
        setMeterLevels(levels);
        setCurrentTime(audioEngine.getCurrentTime());
      }
      animId = requestAnimationFrame(updateLoop);
    };
    animId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Touching the console always means "I want to hear MY mix", so it ends any A/B audition.
  const endAuditionForEdit = () => {
    if (auditionRef.current) {
      auditionRef.current = null;
      setMatchListening('B');
      audioEngine.updateMaster(masterRef.current);
    }
  };

  const handleUpdateChannel = useCallback((index: number, newSettings: ChannelSettings) => {
    const next = [...channelsRef.current];
    next[index] = newSettings;
    channelsRef.current = next;
    setChannels(next);
    endAuditionForEdit();
    audioEngine.updateAllChannels(next);
  }, []);

  const handleUpdateMaster = useCallback((newSettings: MasterSettings) => {
    masterRef.current = newSettings;
    setMaster(newSettings);
    endAuditionForEdit();
    audioEngine.updateAllChannels(channelsRef.current);
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

  // Song switching (keeps every knob where it is, renames channels to match the new stems)
  const handleSelectSong = async (songId: string) => {
    setCurrentSongId(songId);
    setCurrentTime(0);
    const song = BUILTIN_SONGS.find(s => s.id === songId);
    if (song) {
      const renamed = channelsRef.current.map((ch, idx) => ({
        ...ch,
        name: song.stems[idx]?.name || ch.name,
        type: song.stems[idx]?.type || ch.type
      }));
      channelsRef.current = renamed;
      setChannels(renamed);
    }
    await audioEngine.loadSong(songId);
    setDuration(audioEngine.loopDuration);
  };

  // Custom stem file dropping per channel
  const handleLoadCustomStem = async (channelIndex: number, file: File) => {
    try {
      const buffer = await audioEngine.decodeAudioFile(file);
      audioEngine.loadCustomStem(channelIndex, buffer);
      setDuration(audioEngine.loopDuration);
      const next = [...channelsRef.current];
      next[channelIndex] = { ...next[channelIndex], name: file.name.replace(/\.[^/.]+$/, '').slice(0, 16) };
      channelsRef.current = next;
      setChannels(next);
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
        const next = [...channelsRef.current];
        next[i] = { ...next[i], name: file.name.replace(/\.[^/.]+$/, '').slice(0, 16) };
        channelsRef.current = next;
        setChannels(next);
      } catch (e) {
        console.error("Error loading multitrack stem:", e);
      }
    }
    setDuration(audioEngine.loopDuration);
  };

  // Apply scenario state (resets mixer to clean defaults first, then applies scenario overrides).
  // Scenarios are written for Card Game's channel layout (Vocals on Ch 6, etc.).
  const handleApplyScenarioState = (setup: ScenarioItem['setupState']) => {
    const songId = setup.songId || DEFAULT_SONG_ID;
    if (songId !== currentSongId) {
      handleSelectSong(songId);
    }

    const nextChannels = makeDefaultChannels(songId);
    if (setup.channels) {
      setup.channels.forEach((override) => {
        const idx = nextChannels.findIndex(c => c.id === override.id);
        if (idx !== -1) {
          nextChannels[idx] = { ...nextChannels[idx], ...override } as ChannelSettings;
        }
      });
    }
    const nextMaster = { ...makeDefaultMaster(), ...(setup.master || {}) };
    loadMixIntoConsole({ channels: nextChannels, master: nextMaster });
  };

  // ---------- Match the Mix ----------
  const openMatchProfile = (profile: ReferenceProfile) => {
    // Park the mix for the reference we're leaving so the student can come back to it
    if (matchProfileId) {
      matchWorkRef.current[matchProfileId] = { channels: channelsRef.current, master: masterRef.current };
    }
    if (profile.songId !== currentSongId) {
      handleSelectSong(profile.songId);
    }
    const saved = matchWorkRef.current[profile.id];
    loadMixIntoConsole(saved || { channels: makeDefaultChannels(profile.songId), master: makeDefaultMaster() });
    setMatchProfileId(profile.id);
    setMatchListening('B');
  };

  /** Start the current reference over from a fresh, zeroed console (the best score is kept). */
  const restartMatchProfile = () => {
    const profile = REFERENCE_PROFILES.find(p => p.id === matchProfileId);
    if (!profile) return;
    delete matchWorkRef.current[profile.id];
    loadMixIntoConsole({ channels: makeDefaultChannels(profile.songId), master: makeDefaultMaster() });
    setMatchListening('B');
  };

  const handleMatchListen = (which: 'A' | 'B') => {
    const profile = REFERENCE_PROFILES.find(p => p.id === matchProfileId);
    if (!profile) return;
    setMatchListening(which);
    applyAudition(which === 'A' ? buildReferenceMix(profile) : null);
  };

  // ---------- My Mix ----------
  const openMyMix = () => {
    if (myMix) {
      if (myMix.songId !== currentSongId) handleSelectSong(myMix.songId);
      loadMixIntoConsole({ channels: myMix.channels, master: myMix.master });
    } else {
      const fresh = { channels: makeDefaultChannels(currentSongId), master: makeDefaultMaster() };
      loadMixIntoConsole(fresh);
      setMyMix({ songId: currentSongId, ...fresh, explanation: '' });
    }
  };

  // Keep My Mix in sync with the console while the student is working on it
  useEffect(() => {
    if (activeTab !== 'mymix') return;
    setMyMix(prev => (prev ? { ...prev, channels, master, songId: currentSongId } : prev));
  }, [activeTab, channels, master, currentSongId]);

  // Teacher: listen to a student's submitted My Mix
  const handleListenToStudentMix = (mix: MyMix) => {
    if (isPlaying) handlePause();
    if (mix.songId !== currentSongId) handleSelectSong(mix.songId);
    loadMixIntoConsole({ channels: mix.channels, master: mix.master });
    setActiveTab('console');
  };

  // ---------- Tabs ----------
  const handleSelectTab = (requested: TabId | 'challenges') => {
    const tab: TabId = requested === 'challenges' ? lastChallengeTab : requested;
    if (tab === activeTab) return;
    if (isChallengeTab(tab) && !assignment.items.includes(tab)) return; // not part of this assignment
    if (tab === 'eqwizard' && visibleEqSections.length === 0) return;
    if (isChallengeTab(tab)) setLastChallengeTab(tab);
    if (isPlaying) {
      handlePause();
    }

    // Leaving a tab
    if (activeTab === 'match' && matchProfileId) {
      matchWorkRef.current[matchProfileId] = { channels: channelsRef.current, master: masterRef.current };
    }
    if (activeTab === 'match' || activeTab === 'whatchanged') {
      applyAudition(null);
      setMatchListening('B');
    }
    if (activeTab === 'learn') {
      // Learn loads test noise into Channel 1; put the real song back
      audioEngine.loadSong(currentSongId);
    }

    // Entering a tab
    if (tab === 'match') {
      const profile = REFERENCE_PROFILES.find(p => p.id === matchProfileId) || REFERENCE_PROFILES[0];
      const saved = matchWorkRef.current[profile.id];
      if (profile.songId !== currentSongId) handleSelectSong(profile.songId);
      loadMixIntoConsole(saved || { channels: makeDefaultChannels(profile.songId), master: makeDefaultMaster() });
      setMatchProfileId(profile.id);
      setMatchListening('B');
    } else if (tab === 'mymix') {
      openMyMix();
    }

    setActiveTab(tab);
  };

  // An assignment link opens straight onto the first assigned challenge
  useEffect(() => {
    if (!isEverything(assignment)) {
      if (visibleChallenges.length) handleSelectTab(visibleChallenges[0].id);
      else if (visibleEqSections.length) handleSelectTab('eqwizard');
    }
  }, []);

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
        if (activeTab === 'eqwizard') return; // EQ Wizard has its own play buttons
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
  }, [isPlaying, currentTime, activeTab]);

  // Helper to render the interactive audio console bay
  const renderConsoleBay = (title?: string, matchMode = false) => (
    <div id="audio-console-bay" className="w-full flex flex-col items-center mt-6">
      {title && (
        <div className="w-full max-w-6xl mb-3 flex flex-wrap items-center justify-between gap-1 px-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-meter-400 animate-pulse" />
            <span className="text-sm font-display font-bold text-meter-400 uppercase tracking-wider">
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
          matchMode={matchMode}
        />
      ) : (
        <DigitalConsole
          matchMode={matchMode}
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
      <GeqFoldout master={master} onUpdateMaster={handleUpdateMaster} />
    </div>
  );

  return (
    <div data-accent={tabAccent(activeTab)} className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-meter-500 selection:text-black">
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
        showChallenges={visibleChallenges.length > 0}
        showEqWizard={visibleEqSections.length > 0}
        onLoadCustomMultitrack={handleLoadCustomMultitrack}
      />

      <main className="flex-1 p-4 flex flex-col justify-start">
        {/* CHALLENGES SUB-TABS */}
        {isChallengeTab(activeTab) && (
          <ChallengeTabs
            tabs={visibleChallenges}
            assignmentTitle={isEverything(assignment) && !assignment.title ? '' : assignment.title || 'Your assignment'}
            active={activeTab}
            onSelect={handleSelectTab}
            progress={{
              scenarios: {
                text: `${Object.values(scenariosCompleted).filter(p => p >= 100).length}/${SCENARIOS.length} solved`,
                done: SCENARIOS.every(sc => (scenariosCompleted[sc.id] || 0) >= 100)
              },
              whatchanged: {
                text: whatChangedFinished ? `best ${whatChangedBest}/${WHAT_CHANGED_QUESTIONS}` : 'not tried',
                done: whatChangedFinished
              },
              match: {
                text: Object.keys(matchScores).length ? `${matchAverage(matchScores)}% avg match` : 'not tried',
                done: REFERENCE_PROFILES.every(p => matchScores[p.id] !== undefined)
              },
              mymix: (() => {
                const words = myMix?.explanation.trim() ? myMix.explanation.trim().split(/\s+/).length : 0;
                const done = words >= MY_MIX_MIN_WORDS;
                return { text: myMix ? (done ? 'ready' : 'in progress') : 'not started', done };
              })()
            }}
          />
        )}

        {/* LEARN (MIXER ACADEMY) */}
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

        {/* MIX CONSOLE (ANALOG / DIGITAL) */}
        {activeTab === 'console' && (
          <div className="w-full flex flex-col items-center">
            {renderConsoleBay()}
          </div>
        )}

        {/* TROUBLESHOOTING SCENARIOS */}
        {activeTab === 'scenarios' && (
          <div className="w-full flex flex-col items-center">
            <ScenarioChallenges
              channels={channels}
              master={master}
              onApplyScenarioState={handleApplyScenarioState}
              onRecordScenarioScore={(scId, score) =>
                setScenariosCompleted(prev => ({ ...prev, [scId]: Math.max(prev[scId] || 0, score) }))
              }
              completedScenarios={scenariosCompleted}
              onScenarioChange={setActiveScenarioId}
            />
            {renderConsoleBay("Fix it on the console")}
          </div>
        )}

        {/* WHAT CHANGED? EAR TRAINING (no console on screen, so nothing gives the answer away) */}
        {activeTab === 'whatchanged' && (
          <div className="w-full flex flex-col items-center">
            <WhatChanged
              currentSongId={currentSongId}
              isPlaying={isPlaying}
              onPlay={handlePlay}
              onPause={handlePause}
              onAudition={applyAudition}
              bestScore={whatChangedBest}
              onFinish={(correct) => {
                setWhatChangedBest(prev => Math.max(prev, correct));
                setWhatChangedFinished(true);
              }}
            />
          </div>
        )}

        {/* MATCH THE MIX (BLIND A/B) */}
        {activeTab === 'match' && (
          <div className="w-full flex flex-col items-center">
            <MatchTheMix
              channels={channels}
              activeProfileId={matchProfileId}
              listening={matchListening}
              isPlaying={isPlaying}
              matchScores={matchScores}
              onStartProfile={openMatchProfile}
              onTryAgain={restartMatchProfile}
              onListen={handleMatchListen}
              onPlay={handlePlay}
              onPause={handlePause}
              onSaveMatchScore={(id, pct) => setMatchScores(prev => ({ ...prev, [id]: Math.max(prev[id] || 0, pct) }))}
            />
            {renderConsoleBay("Your Mix (B) — Match the Reference by Ear", true)}
          </div>
        )}

        {/* MY MIX (CREATIVE PROJECT) */}
        {activeTab === 'mymix' && myMix && (
          <div className="w-full flex flex-col items-center">
            <MyMixPanel
              songId={currentSongId}
              explanation={myMix.explanation}
              onExplanationChange={(text) => setMyMix(prev => (prev ? { ...prev, explanation: text } : prev))}
              onStartOver={() => loadMixIntoConsole({ channels: makeDefaultChannels(currentSongId), master: makeDefaultMaster() })}
              isPlaying={isPlaying}
              onPlay={handlePlay}
              onPause={handlePause}
            />
            {renderConsoleBay("My Mix — Make It Sound the Way You Want")}
          </div>
        )}

        {/* EQ WIZARD (frequency ear training) */}
        {activeTab === 'eqwizard' && (
          <EqWizard
            sections={visibleEqSections}
            assignmentTitle={isEverything(assignment) && !assignment.title ? '' : assignment.title || 'Your assignment'}
            scores={eqScores}
            onRecord={(section, level, pct) =>
              setEqScores(prev => {
                const next = { ...prev, [section]: [...prev[section]] };
                next[section][level] = Math.max(prev[section][level], pct);
                return next;
              })
            }
          />
        )}

        {/* GRADE REPORT & TEACHER BATCH GRADING */}
        {activeTab === 'grades' && (
          <GradeReport
            scenariosCompleted={scenariosCompleted}
            whatChangedBest={whatChangedBest}
            matchScores={matchScores}
            learnCompleted={learnCompleted}
            myMix={myMix}
            eqScores={eqScores}
            assignment={assignment}
            onListenToMix={handleListenToStudentMix}
          />
        )}
      </main>

      <SignalFlowXRay
        isOpen={xrayState.isOpen}
        onClose={() => setXrayState(prev => ({ ...prev, isOpen: false }))}
        channelId={xrayState.channelId}
        channelName={xrayState.channelName}
      />
    </div>
  );
}
