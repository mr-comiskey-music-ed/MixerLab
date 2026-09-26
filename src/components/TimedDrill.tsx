import React, { useState, useEffect, useRef } from 'react';
import { ChannelSettings, MasterSettings } from '../types/audio';

interface TimedDrillProps {
  channels: ChannelSettings[];
  master: MasterSettings;
  onApplyEmergency: (emergencyType: string) => void;
  onResolveDrillScore: (score: number, avgReactionMs: number) => void;
  highScore: number;
  onCrisisChange?: (crisisType: string) => void;
}

interface EmergencyStep {
  id: string;
  stage: 1 | 2 | 3 | 4;
  stageName: string;
  title: string;
  type: string;
  instruction: string;
  checkResolved: (channels: ChannelSettings[], master: MasterSettings) => boolean;
}

// Full library of 12 distinct signal-flow crisis examples
const ALL_CRISES: EmergencyStep[] = [
  // --- STAGE 1: Prerequisites (Phantom Power, Hi-Z, Preamp Gain) ---
  {
    id: 'phantom_drop',
    stage: 1,
    stageName: 'Stage 1: Input & Power Prerequisite',
    title: 'VOCAL CONDENSER POWER DROPOUT',
    type: 'phantom_drop',
    instruction: "Singer's condenser mic went completely dead! Flip ON +48V PHANTOM POWER on Channel 3!",
    checkResolved: (chs) => {
      const ch3 = chs.find(c => c.id === 3);
      return Boolean(ch3 && ch3.phantom48V && !ch3.mute);
    }
  },
  {
    id: 'hiz_mismatch',
    stage: 1,
    stageName: 'Stage 1: Input & Power Prerequisite',
    title: 'PASSIVE BASS IMPEDANCE LOADING',
    type: 'hiz_mismatch',
    instruction: "Passive bass plugged into line input sounds dull, muffled, and loaded down! Engage the HI-Z instrument switch on Channel 2!",
    checkResolved: (chs) => {
      const ch2 = chs.find(c => c.id === 2);
      return Boolean(ch2 && ch2.hiZ);
    }
  },
  {
    id: 'kick_preamp_clip',
    stage: 1,
    stageName: 'Stage 1: Input & Power Prerequisite',
    title: 'KICK/SNARE PREAMP REDLINE CLIPPING',
    type: 'kick_preamp_clip',
    instruction: "Channel 1 preamp is severely overloaded (+36dB redlining into harsh digital distortion)! Lower Channel 1 GAIN to under +8dB!",
    checkResolved: (chs) => {
      const ch1 = chs.find(c => c.id === 1);
      return Boolean(ch1 && ch1.gain <= 8);
    }
  },
  {
    id: 'vocal_preamp_hot',
    stage: 1,
    stageName: 'Stage 1: Input & Power Prerequisite',
    title: 'LEAD VOCAL PREAMP OVERLOAD',
    type: 'vocal_preamp_hot',
    instruction: "Lead vocalist is screaming into a hot preamp (+35dB clipping)! Dial Channel 3 GAIN back down to +12dB or lower!",
    checkResolved: (chs) => {
      const ch3 = chs.find(c => c.id === 3);
      return Boolean(ch3 && ch3.gain <= 12);
    }
  },

  // --- STAGE 2: Filters & EQ (Low Cut, Mud, Treble Harshness, Feedback) ---
  {
    id: 'sub_rumble',
    stage: 2,
    stageName: 'Stage 2: Filtering & EQ',
    title: 'STAGE FOOTSTEP SUBWOOFER RUMBLE',
    type: 'sub_rumble',
    instruction: "Heavy footstep thumps on the wooden stage are rumbling the auditorium subwoofers! Engage the 100Hz LOW-CUT HPF on Channel 3!",
    checkResolved: (chs) => {
      const ch3 = chs.find(c => c.id === 3);
      return Boolean(ch3 && ch3.lowCut100Hz);
    }
  },
  {
    id: 'bass_mud',
    stage: 2,
    stageName: 'Stage 2: Filtering & EQ',
    title: 'BASS LOW-END MASKING KICK DRUM',
    type: 'bass_mud',
    instruction: "Bass Low EQ is boosted to +14dB, drowning out the kick drum and muddying the low end! Cut Channel 2 LOW EQ down to 0dB or lower!",
    checkResolved: (chs) => {
      const ch2 = chs.find(c => c.id === 2);
      return Boolean(ch2 && ch2.eqLow <= 0);
    }
  },
  {
    id: 'guitar_harsh',
    stage: 2,
    stageName: 'Stage 2: Filtering & EQ',
    title: 'PIERCING GUITAR TREBLE FATIGUE',
    type: 'guitar_harsh',
    instruction: "Electric guitar High EQ is dialed to +14dB causing painful ear fatigue and piercing treble! Lower Channel 4 HIGH EQ to 0dB or lower!",
    checkResolved: (chs) => {
      const ch4 = chs.find(c => c.id === 4);
      return Boolean(ch4 && ch4.eqHigh <= 0);
    }
  },
  {
    id: 'vocal_feedback',
    stage: 2,
    stageName: 'Stage 2: Filtering & EQ',
    title: 'STAGE ACOUSTIC FEEDBACK SCREECH',
    type: 'vocal_feedback',
    instruction: "Channel 3 vocal mic is screeching in feedback at 2.5kHz! Cut Channel 3 MID EQ below -2dB, or lower fader / press mute!",
    checkResolved: (chs) => {
      const ch3 = chs.find(c => c.id === 3);
      if (!ch3) return false;
      return ch3.mute || ch3.faderLevel < -5 || ch3.eqMid < -2 || ch3.gain < 16;
    }
  },

  // --- STAGE 3: Aux Sends & FX Routing ---
  {
    id: 'aux1_wedge_spill',
    stage: 3,
    stageName: 'Stage 3: Aux & FX Routing',
    title: 'STAGE WEDGE DEAFENING DRUMMER',
    type: 'aux1_wedge_spill',
    instruction: "Drummer's Aux (Mon) foldback wedge send is blasting at +10dB! Reduce Channel 1 AUX (MON) send to -10dB or lower!",
    checkResolved: (chs) => {
      const ch1 = chs.find(c => c.id === 1);
      return Boolean(ch1 && ch1.aux1Pre <= -10);
    }
  },
  {
    id: 'reverb_washout',
    stage: 3,
    stageName: 'Stage 3: Aux & FX Routing',
    title: 'VOCAL DROWNED IN EXCESSIVE REVERB',
    type: 'reverb_washout',
    instruction: "Master FX Return is redlined at +6dB washing out vocal lyrics in an echo chamber! Pull Master FX RETURN down to -6dB or lower, or press FX MUTE!",
    checkResolved: (_chs, m) => {
      return Boolean(m.fxMute || m.fxReturn <= -6);
    }
  },
  {
    id: 'vocal_fx_spill',
    stage: 3,
    stageName: 'Stage 3: Aux & FX Routing',
    title: 'LEAD VOCAL FX SEND OVERDRIVE',
    type: 'vocal_fx_spill',
    instruction: "Channel 3 FX send is cranked to +10dB overloading the digital reverb processor! Lower Channel 3 FX send to -10dB or lower!",
    checkResolved: (chs) => {
      const ch3 = chs.find(c => c.id === 3);
      return Boolean(ch3 && ch3.fxPost <= -10);
    }
  },

  // --- STAGE 4: Panning & Master Bus Faders ---
  {
    id: 'vocal_pan_drift',
    stage: 4,
    stageName: 'Stage 4: Stereo Panning & Master Bus',
    title: 'LEAD VOCAL LOP-SIDED PAN DRIFT',
    type: 'vocal_pan_drift',
    instruction: "Lead vocal was accidentally knocked hard Left (L0.9), unbalancing the audience stereo image! Re-center Channel 3 PAN knob to Center (C)!",
    checkResolved: (chs) => {
      const ch3 = chs.find(c => c.id === 3);
      return Boolean(ch3 && Math.abs(ch3.pan) <= 0.15);
    }
  },
  {
    id: 'foh_master_overload',
    stage: 4,
    stageName: 'Stage 4: Stereo Panning & Master Bus',
    title: 'FOH MAIN PA SYSTEM OVERLOAD',
    type: 'foh_master_overload',
    instruction: "Auditorium volume spiked +8dB into the red clipping the main PA speakers! Lower the MAIN MASTER FADER to 0dB (Unity) or lower!",
    checkResolved: (_chs, m) => {
      return Boolean(m.mainFader <= 0.5);
    }
  }
];

// Helper to choose 4 ordered crises (1 from each stage)
function pickOrderedCrises(): EmergencyStep[] {
  const stage1 = ALL_CRISES.filter(c => c.stage === 1);
  const stage2 = ALL_CRISES.filter(c => c.stage === 2);
  const stage3 = ALL_CRISES.filter(c => c.stage === 3);
  const stage4 = ALL_CRISES.filter(c => c.stage === 4);

  const pickRandom = (arr: EmergencyStep[]) => arr[Math.floor(Math.random() * arr.length)];

  return [
    pickRandom(stage1),
    pickRandom(stage2),
    pickRandom(stage3),
    pickRandom(stage4)
  ];
}

const playSuccessDing = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // Audio context policy
  }
};

export const TimedDrill: React.FC<TimedDrillProps> = ({
  channels,
  master,
  onApplyEmergency,
  onResolveDrillScore,
  highScore,
  onCrisisChange
}) => {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [activeDrillSteps, setActiveDrillSteps] = useState<EmergencyStep[]>(() => pickOrderedCrises());
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [drillCompleted, setDrillCompleted] = useState<boolean>(false);
  const [finalScore, setFinalScore] = useState<number>(0);
  const [solvedPopup, setSolvedPopup] = useState<{ title: string; reactionMs: number } | null>(null);
  const [isSolving, setIsSolving] = useState<boolean>(false);

  const stepStartTime = useRef<number>(0);

  const currentEmergency = activeDrillSteps[currentStepIndex] || activeDrillSteps[0];

  useEffect(() => {
    if (onCrisisChange) {
      onCrisisChange(isActive ? currentEmergency.type : '');
    }
  }, [isActive, currentEmergency?.type, onCrisisChange]);

  const startDrill = () => {
    // Generate fresh ordered set of 4 crises
    const selected = pickOrderedCrises();
    setActiveDrillSteps(selected);
    setIsActive(true);
    setTimeLeft(60);
    setCurrentStepIndex(0);
    setReactionTimes([]);
    setDrillCompleted(false);
    setFinalScore(0);
    setSolvedPopup(null);
    setIsSolving(false);
    stepStartTime.current = performance.now();
    onApplyEmergency(selected[0].type);

    // Keep user at the top to read the emergency instructions first!
    // (Do not auto-scroll down to mixer yet)
  };

  // 60-second countdown timer
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          finishDrill(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive]);

  // Continuous verification loop during active drill
  useEffect(() => {
    if (!isActive || drillCompleted || isSolving || !currentEmergency) return;

    if (currentEmergency.checkResolved(channels, master)) {
      setIsSolving(true);
      // Step resolved!
      const reactionMs = Math.round(performance.now() - stepStartTime.current);
      const newReactionTimes = [...reactionTimes, reactionMs];
      setReactionTimes(newReactionTimes);

      playSuccessDing();
      setSolvedPopup({ title: currentEmergency.title, reactionMs });

      setTimeout(() => {
        setSolvedPopup(null);
        setIsSolving(false);
        if (currentStepIndex + 1 < activeDrillSteps.length) {
          const nextIdx = currentStepIndex + 1;
          setCurrentStepIndex(nextIdx);
          stepStartTime.current = performance.now();
          onApplyEmergency(activeDrillSteps[nextIdx].type);

          // Smooth scroll back up to the top so student reads the next crisis immediately!
          window.scrollTo({ top: 0, behavior: 'smooth' });
          document.getElementById('timed-drill-hud')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          // All 4 emergencies resolved!
          finishDrill(true, newReactionTimes);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 1400);
    }
  }, [channels, master, isActive, currentStepIndex, drillCompleted, isSolving, reactionTimes, currentEmergency, activeDrillSteps, onApplyEmergency]);

  const finishDrill = (passedAll: boolean, reactions: number[] = reactionTimes) => {
    setIsActive(false);
    setDrillCompleted(true);

    const stepsSolved = reactions.length;
    const baseScore = stepsSolved * 75; // 300 pts max base
    const timeBonus = passedAll ? timeLeft * 3 : 0; // up to ~180 bonus
    const total = baseScore + timeBonus;
    setFinalScore(total);

    const avgMs = reactions.length > 0 ? Math.round(reactions.reduce((a, b) => a + b, 0) / reactions.length) : 0;
    onResolveDrillScore(total, avgMs);
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 pb-6">
      {/* Drill Header Card */}
      <div id="timed-drill-hud" className="relative bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col gap-4 overflow-hidden">
        {/* Success Popup Overlay */}
        {solvedPopup && (
          <div className="absolute inset-0 bg-emerald-950/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 rounded-xl border-2 border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.5)] animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center font-extrabold text-3xl mb-3 shadow-lg animate-bounce">
              ✓
            </div>
            <h3 className="text-xl font-bold text-emerald-200 font-mono tracking-wider">
              CRISIS NEUTRALIZED!
            </h3>
            <p className="text-sm text-emerald-300 font-mono mt-1 text-center">
              {solvedPopup.title}
            </p>
            <span className="text-xs font-mono bg-emerald-900/80 text-emerald-200 px-3 py-1 rounded-full border border-emerald-500/60 mt-3">
              Reaction Time: {(solvedPopup.reactionMs / 1000).toFixed(2)}s
            </span>
          </div>
        )}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
            <h2 className="text-xl font-bold text-zinc-100 font-mono">
              60-SECOND LIVE SOUND EMERGENCY DRILL
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-zinc-400">
              HIGH SCORE: <strong className="text-amber-400">{highScore} PTS</strong>
            </span>
            {!isActive && (
              <button
                onClick={startDrill}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-xs rounded-lg shadow-lg border border-rose-400/50 transition-all"
              >
                START EMERGENCY DRILL
              </button>
            )}
          </div>
        </div>

        {/* Drill In-Progress HUD */}
        {isActive && (
          <div className="bg-zinc-950 p-6 rounded-lg border-2 border-rose-600/80 shadow-[0_0_20px_rgba(244,63,94,0.3)] flex flex-col gap-4 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-rose-900/60 border border-rose-500 text-rose-300 font-mono font-bold text-xs rounded">
                  CRISIS {currentStepIndex + 1} OF 4
                </span>
                <span className="text-sm font-bold text-rose-400 font-mono">
                  {currentEmergency.title}
                </span>
              </div>
              <div className="text-2xl font-mono font-extrabold text-rose-400">
                {timeLeft}s
              </div>
            </div>

            <div className="bg-zinc-900 p-4 rounded border border-rose-900/50 text-sm text-zinc-200">
              {currentEmergency.instruction}
            </div>

            {/* Direct Link to Console Bay */}
            <div className="flex flex-wrap items-center justify-between bg-rose-950/80 px-3 py-2 rounded border border-rose-600/60 text-xs text-rose-200 font-mono gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping" />
                <span className="font-bold uppercase">Hardware Console Strip Below:</span>
                <span className="text-zinc-300">Turn knobs, faders, or mute switches directly on the console below!</span>
              </div>
              <button
                onClick={() => document.getElementById('audio-console-bay')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-rose-300 hover:text-white underline font-bold"
              >
                ↓ Jump to Console
              </button>
            </div>
          </div>
        )}

        {/* Post-Drill Results */}
        {drillCompleted && (
          <div className="bg-zinc-950 p-6 rounded-lg border border-emerald-500/60 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-emerald-400 font-mono">
                DRILL COMPLETE // EVALUATION SUMMARY
              </span>
              <span className="text-2xl font-mono font-extrabold text-emerald-400">
                {finalScore} PTS
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 border-t border-zinc-800 pt-3 text-xs font-mono">
              <div>
                <span className="text-zinc-500">Crises Saved:</span>
                <div className="text-sm font-bold text-zinc-200 mt-1">
                  {reactionTimes.length} / 4
                </div>
              </div>
              <div>
                <span className="text-zinc-500">Time Remaining:</span>
                <div className="text-sm font-bold text-zinc-200 mt-1">
                  {timeLeft} seconds
                </div>
              </div>
              <div>
                <span className="text-zinc-500">Avg Reaction Time:</span>
                <div className="text-sm font-bold text-cyan-400 mt-1">
                  {reactionTimes.length > 0 ? `${(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length / 1000).toFixed(2)}s` : 'N/A'}
                </div>
              </div>
            </div>
          </div>
        )}

        {!isActive && !drillCompleted && (
          <div className="bg-zinc-950 p-5 rounded-lg border border-zinc-800 text-xs text-zinc-300 leading-relaxed flex flex-col gap-2">
            <h4 className="font-bold text-zinc-100 font-mono uppercase">
              How the Live Emergency Drill Works:
            </h4>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>Once you click <strong>Start Emergency Drill</strong>, a 60-second timer begins.</li>
              <li>Four unexpected console crises will trigger randomly: ear-piercing feedback, redline preamp distortion, dead phantom power, or FOH main overload.</li>
              <li>You must quickly diagnose the issue and turn the correct knob, switch, or fader on the console to eliminate the crisis.</li>
              <li>Your reaction speed and live saves determine your final score!</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
