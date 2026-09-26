import React, { useState, useEffect, useRef } from 'react';
import { ScenarioItem, ChannelSettings, MasterSettings } from '../types/audio';

interface ScenarioChallengesProps {
  channels: ChannelSettings[];
  master: MasterSettings;
  onApplyScenarioState: (setup: ScenarioItem['setupState']) => void;
  onRecordScenarioScore: (scenarioId: number, score: number) => void;
  completedScenarios: Record<number, number>;
  onScenarioChange?: (scenarioId: number) => void;
}

export const SCENARIOS: ScenarioItem[] = [
  {
    id: 1,
    title: "Condenser Mic Not Working!",
    category: "Preamp & Power",
    difficulty: "Beginner",
    context: "The lead vocalist is using a high-end condenser microphone plugged into Channel 3 (XLR). The drummer is playing, but there is complete silence from the vocal track despite the singer singing loudly.",
    problemSummary: "Condenser capsules require active electrostatic polarization power to function.",
    objective: "Diagnose why Channel 3 has zero signal output and supply the necessary hardware power.",
    hint: "Check the +48V Phantom Power switch on Channel 3.",
    setupState: {
      channels: [
        { id: 3, phantom48V: false, gain: 18, faderLevel: 0, mute: false }
      ]
    },
    targetValidation: (chs) => {
      const ch3 = chs.find(c => c.id === 3);
      if (!ch3) return { passed: false, score: 0, feedback: "Channel 3 not found." };
      if (!ch3.phantom48V) {
        return { passed: false, score: 0, feedback: "Incorrect: +48V Phantom Power is still disengaged on Channel 3." };
      }
      if (ch3.mute) {
        return { passed: false, score: 30, feedback: "+48V is engaged, but Channel 3 is currently MUTED." };
      }
      return { passed: true, score: 100, feedback: "Excellent! +48V Phantom Power is supplied to the condenser mic capsule. Full vocal signal is restored." };
    }
  },
  {
    id: 2,
    title: "Create Stereo Width!",
    category: "Spatial Imaging & Panning",
    difficulty: "Intermediate",
    context: "Everything in the mix is panned dead center (mono), making it sound congested and narrow. We need to create a wide stereo soundstage by panning out the Electric Guitar (Channel 4) and Percussion (Channel 6) to opposite sides.",
    problemSummary: "Hard-centering all instruments collapses the soundstage into a narrow mono column.",
    objective: "Pan Channel 4 and Channel 6 away from center by at least ±0.20 in opposite directions (one left, one right).",
    hint: "Adjust the PAN knob on Channel 4 and Channel 6 to opposite sides.",
    setupState: {
      channels: [
        { id: 4, pan: 0 },
        { id: 6, pan: 0 }
      ]
    },
    targetValidation: (chs) => {
      const ch4 = chs.find(c => c.id === 4);
      const ch6 = chs.find(c => c.id === 6);
      if (!ch4 || !ch6) return { passed: false, score: 0, feedback: "Channels not found." };
      if (Math.abs(ch4.pan) < 0.20 || Math.abs(ch6.pan) < 0.20) {
        return { passed: false, score: 40, feedback: "Both Channel 4 and Channel 6 must be panned out by at least ±0.20 from center." };
      }
      if (Math.sign(ch4.pan) === Math.sign(ch6.pan)) {
        return { passed: false, score: 60, feedback: "Channel 4 and Channel 6 must be panned to opposite sides (one left, one right) to create stereo width." };
      }
      return { passed: true, score: 100, feedback: "Fantastic stereo imaging! Panning guitar and percussion to opposite sides opens up a wide, professional mix soundstage." };
    }
  },
  {
    id: 3,
    title: "Clipping Drums!",
    category: "Gain Staging",
    difficulty: "Intermediate",
    context: "Channel 1 (Kick / Snare) is severely clipping! The red CLIP LED is pegged on continuously with harsh digital distortion, but the sound tech tried to fix it by dragging the channel fader down to -25dB. That doesn't stop the preamp from distorting!",
    problemSummary: "Pulling down a post-fader does NOT prevent an overdriven analog preamp from clipping.",
    objective: "Properly gain-stage Channel 1: lower the input Preamp GAIN to nominal (0 to +8 dB) and raise the channel fader to near unity (-3 to +3 dB).",
    hint: "Lower GAIN to ~+4dB, and bring the channel fader up to 0dB (Unity).",
    setupState: {
      channels: [
        { id: 1, gain: 18, faderLevel: -25, mute: false }
      ]
    },
    targetValidation: (chs) => {
      const ch1 = chs.find(c => c.id === 1);
      if (!ch1) return { passed: false, score: 0, feedback: "Channel 1 not found." };
      if (ch1.gain > 10) {
        return { passed: false, score: 20, feedback: `Preamp Gain is still too high (+${ch1.gain} dB). Lower it into the 0 to +8 dB range to eliminate clipping distortion.` };
      }
      if (ch1.faderLevel < -6 || ch1.faderLevel > 6) {
        return { passed: false, score: 60, feedback: `Gain is fixed, but the channel fader is at ${ch1.faderLevel} dB. Move it to unity (~0 dB) for proper fader resolution.` };
      }
      return { passed: true, score: 100, feedback: "Masterful gain staging! Preamp headroom is preserved with zero clipping, and the fader operates at its optimal unity resolution." };
    }
  },
  {
    id: 4,
    title: "Cleanup the Mud!",
    category: "Filtering & EQ",
    difficulty: "Intermediate",
    context: "The rhythm guitar (Channel 4) has sub-rumble, and the Analog Synth Pad (Channel 5) has boxy low-mids around 300-500Hz crowding the mix.",
    problemSummary: "Uncontrolled low-end and boxy low-mids make the overall mix muddy and unclear.",
    objective: "Engage the 100Hz Low Cut on Channel 4, and cut the Low EQ or Mid EQ on Channel 5 by at least -3dB.",
    hint: "Hit the 100Hz LOW CUT button on Ch 4 and attenuate Low/Mid EQ on Ch 5.",
    setupState: {
      channels: [
        { id: 4, lowCut100Hz: false },
        { id: 5, eqLow: 4, eqMid: 4 }
      ]
    },
    targetValidation: (chs) => {
      const ch4 = chs.find(c => c.id === 4);
      const ch5 = chs.find(c => c.id === 5);
      if (!ch4 || !ch5) return { passed: false, score: 0, feedback: "Channel 4 or 5 not found." };
      if (!ch4.lowCut100Hz) {
        return { passed: false, score: 35, feedback: "100Hz Low Cut filter is not engaged on Channel 4." };
      }
      if (ch5.eqLow > 0 && ch5.eqMid > 0) {
        return { passed: false, score: 70, feedback: "Channel 4 low-cut is active, but Channel 5 (Analog Synth Pad) still has boosted low/mid EQ. Cut Low or Mid EQ on Ch 5 by at least -3dB." };
      }
      return { passed: true, score: 100, feedback: "Superb! Engaging the 100Hz highpass filter on guitar and scooping boxy low-mids on the synth pad cleared up the mud and opened space for kick and bass." };
    }
  },
  {
    id: 5,
    title: "Singer Can't Hear Themselves!",
    category: "Monitor Mixing",
    difficulty: "Intermediate",
    context: "During soundcheck, the lead singer asks for significantly more vocal in their stage floor wedge (Aux Mon). However, the house mix in the auditorium PA is already perfectly balanced. You must boost their vocal monitor by at least +4dB without altering the house main fader.",
    problemSummary: "Monitors must be mixed via Pre-Fader Aux sends so house fader adjustments do not change stage volume.",
    objective: "Boost Channel 3 Aux (Mon) send to between +3dB and +8dB, while keeping Channel 3 Main Fader at 0dB unity.",
    hint: "Turn up AUX (MON) knob on Channel 3 and verify Aux (Mon) Master is up.",
    setupState: {
      channels: [
        { id: 3, aux1Pre: -60, faderLevel: 0 }
      ],
      master: { aux1Master: 0 }
    },
    targetValidation: (chs, m) => {
      const ch3 = chs.find(c => c.id === 3);
      if (!ch3) return { passed: false, score: 0, feedback: "Channel 3 not found." };
      if (ch3.aux1Pre < 2) {
        return { passed: false, score: 30, feedback: `Channel 3 Aux (Mon) send is only ${ch3.aux1Pre} dB. Raise it to +3 dB to +8 dB.` };
      }
      if (Math.abs(ch3.faderLevel) > 2) {
        return { passed: false, score: 50, feedback: "Warning: You changed the Channel 3 main fader! The audience PA mix was disturbed. Keep main fader near 0dB." };
      }
      if (m.aux1Master < -10) {
        return { passed: false, score: 70, feedback: "Channel 3 Aux send is up, but the AUX (MON) MASTER knob in the master section is turned down!" };
      }
      return { passed: true, score: 100, feedback: "Perfect! The lead singer has plenty of vocal in their floor wedge, and because Aux (Mon) is pre-fader, the house mix remains untouched." };
    }
  },
  {
    id: 6,
    title: "The Show Is Too Loud!",
    category: "Master Routing",
    difficulty: "Beginner",
    context: "The club manager rushes over: 'The overall volume is about 6dB too loud for local noise ordinances!' A beginner might run and pull down all 6 individual channel faders, destroying their carefully dialed balance. How should a professional engineer handle this?",
    problemSummary: "Global room volume must be adjusted on the Master Fader to preserve inter-channel balance.",
    objective: "Lower the Main Master Fader to between -5dB and -8dB without altering individual channel faders.",
    hint: "Pull down the red MAIN MIX Master Fader.",
    setupState: {
      channels: [],
      master: { mainFader: 0 }
    },
    targetValidation: (_chs, m) => {
      if (m.mainFader > -4) {
        return { passed: false, score: 20, feedback: `Master Fader is still at ${m.mainFader} dB. Lower it to around -6 dB.` };
      }
      if (m.mainFader < -9) {
        return { passed: false, score: 50, feedback: `Master Fader is pulled down too low (${m.mainFader} dB). Target -5 dB to -8 dB.` };
      }
      return { passed: true, score: 100, feedback: "Spot on! Lowering the Main Master Fader brought the venue SPL down 6dB while preserving all multi-track channel balances." };
    }
  },
  {
    id: 7,
    title: "Mic Feedback!",
    category: "Emergency Troubleshooting",
    difficulty: "Advanced",
    context: "EMERGENCY: Channel 3 vocal mic is on the verge of a piercing 3.15kHz acoustic feedback screech! Preamp gain is dangerously high (+30dB), Mid EQ is boosted (+8dB), and fader is pushed. The loop is threatening to blow the tweeters!",
    problemSummary: "Acoustic feedback happens when a mic picks up its own amplified sound in a runaway loop.",
    objective: "Suppress the feedback loop immediately: cut Mid EQ (2.5k) to -3dB or lower, or lower Channel 3 gain/fader to safe levels, or mute the channel.",
    hint: "Cut MID EQ on Channel 3 or lower Preamp Gain below +20dB.",
    setupState: {
      channels: [
        { id: 3, gain: 18, faderLevel: 4, eqMid: 9, mute: false }
      ]
    },
    targetValidation: (chs) => {
      const ch3 = chs.find(c => c.id === 3);
      if (!ch3) return { passed: false, score: 0, feedback: "Channel 3 not found." };
      const feedbackCondition = ch3.gain > 14 && ch3.faderLevel > 2 && ch3.eqMid > 2 && !ch3.mute;
      if (feedbackCondition) {
        return { passed: false, score: 0, feedback: "Feedback is still screaming! Cut Mid EQ, lower gain/fader, or hit MUTE!" };
      }
      return { passed: true, score: 100, feedback: "Crisis averted! Offending frequencies were notched and loop gain reduced below unity. The feedback screech stopped instantly." };
    }
  },
  {
    id: 8,
    title: "Adding Depth!",
    category: "Master Effects & Depth",
    difficulty: "Intermediate",
    context: "The lead vocal (Channel 3) and analog synth pad (Channel 5) are dry and lack emotional space. Let's send them into the Master Stereo Delay processor to add lush spatial depth.",
    problemSummary: "Dry tracks lack emotional dimension and professional studio polish.",
    objective: "Turn up the FX Post send on Channel 3 and Channel 5 to at least -15dB, and ensure Master FX Return is up.",
    hint: "Turn up the FX send knob on Ch 3 and Ch 5, and verify Master FX Return.",
    setupState: {
      channels: [
        { id: 3, fxPost: -60 },
        { id: 5, fxPost: -60 }
      ],
      master: { fxReturn: -20 }
    },
    targetValidation: (chs, m) => {
      const ch3 = chs.find(c => c.id === 3);
      const ch5 = chs.find(c => c.id === 5);
      if (!ch3 || !ch5) return { passed: false, score: 0, feedback: "Channel 3 or 5 not found." };
      if (ch3.fxPost < -20 || ch5.fxPost < -20) {
        return { passed: false, score: 40, feedback: "Raise the FX Post send knob on Channel 3 and Channel 5 to at least -15dB." };
      }
      if (m.fxReturn < -35) {
        return { passed: false, score: 70, feedback: "FX sends are up, but the Master FX Return knob in the master section is too low." };
      }
      return { passed: true, score: 100, feedback: "Gorgeous! Routing vocals and synth pads into the stereo delay creates an immersive, professional three-dimensional mix depth." };
    }
  }
];

export const ScenarioChallenges: React.FC<ScenarioChallengesProps> = ({
  channels,
  master,
  onApplyScenarioState,
  onRecordScenarioScore,
  completedScenarios,
  onScenarioChange
}) => {
  const [activeScenarioId, setActiveScenarioId] = useState<number>(1);
  const [validationResult, setValidationResult] = useState<{ passed: boolean; score: number; feedback: string } | null>(null);
  const [showObjective, setShowObjective] = useState<boolean>(false);
  const prevPassedRef = useRef<boolean>(false);
  const recordScoreRef = useRef(onRecordScenarioScore);
  recordScoreRef.current = onRecordScenarioScore;

  const currentScenario = SCENARIOS.find(s => s.id === activeScenarioId) || SCENARIOS[0];

  // Apply initial uncompleted scenario setup state on component mount so Scenario 1 starts in its unpassed state
  useEffect(() => {
    if (onScenarioChange) {
      onScenarioChange(activeScenarioId);
    }
    if (!completedScenarios[1]) {
      onApplyScenarioState(SCENARIOS[0].setupState);
    }
  }, []);

  const handleLoadScenario = (sc: ScenarioItem) => {
    setActiveScenarioId(sc.id);
    setValidationResult(null);
    setShowObjective(false);
    prevPassedRef.current = false;
    if (onScenarioChange) {
      onScenarioChange(sc.id);
    }
    onApplyScenarioState(sc.setupState);
    // Clicking on scenario buttons does not scroll the page at all
  };

  const handleNextScenario = () => {
    const nextIdx = SCENARIOS.findIndex(s => s.id === activeScenarioId) + 1;
    if (nextIdx < SCENARIOS.length) {
      handleLoadScenario(SCENARIOS[nextIdx]);
    }
  };

  // Real-time automatic validation whenever channels or master change
  useEffect(() => {
    const result = currentScenario.targetValidation(channels, master);
    if (result.passed) {
      setValidationResult(result);
      recordScoreRef.current(currentScenario.id, result.score);

      // When the scenario transitions from unpassed to passed, immediately terminate any active mouse drag/hold
      if (!prevPassedRef.current) {
        prevPassedRef.current = true;

        // 1. Force blur active element and clear text/cursor selections
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        window.getSelection()?.removeAllRanges();

        // 2. Disable all range sliders immediately to force the browser to abort native drag tracking
        const rangeSliders = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="range"]'));
        rangeSliders.forEach(slider => {
          slider.disabled = true;
          slider.blur();
        });

        // 3. Capture-phase blocker on window: swallow all input, change, and pointer/mouse move events
        const swallowCapture = (e: Event) => {
          e.stopImmediatePropagation();
          e.preventDefault();
        };

        const capturedEventNames = ['mousemove', 'pointermove', 'touchmove', 'input', 'change'] as const;
        capturedEventNames.forEach(evt => {
          window.addEventListener(evt, swallowCapture, { capture: true });
        });

        // 4. Dispatch release events to cancel any custom JS drag listeners (e.g. rotary knobs)
        ['pointerup', 'mouseup', 'touchend', 'pointercancel'].forEach(eventType => {
          window.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
          document.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
        });

        // 5. Restore interactions once the physical mouse button is released or after scroll completes
        let isCleanedUp = false;
        const restoreInteractions = () => {
          if (isCleanedUp) return;
          isCleanedUp = true;

          capturedEventNames.forEach(evt => {
            window.removeEventListener(evt, swallowCapture, { capture: true });
          });
          rangeSliders.forEach(slider => {
            slider.disabled = false;
          });
          window.removeEventListener('pointerup', restoreInteractions, { capture: true });
          window.removeEventListener('mouseup', restoreInteractions, { capture: true });
          window.removeEventListener('touchend', restoreInteractions, { capture: true });
        };

        window.addEventListener('pointerup', restoreInteractions, { capture: true });
        window.addEventListener('mouseup', restoreInteractions, { capture: true });
        window.addEventListener('touchend', restoreInteractions, { capture: true });
        setTimeout(restoreInteractions, 1000);

        // 6. Smooth scroll to top scenario banner
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.getElementById('scenarios-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else if (!prevPassedRef.current) {
      // Only clear validation if it has not yet passed in this round
      setValidationResult(null);
    }
  }, [channels, master, currentScenario]);

  return (
    <div id="scenarios-top" className="w-full max-w-5xl mx-auto flex flex-col gap-3 pb-4">
      {/* Compact Scenario Selection Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-1.5">
        {SCENARIOS.map((sc) => {
          const score = completedScenarios[sc.id];
          const isCurrent = sc.id === activeScenarioId;
          const isSolved = score !== undefined && score > 0;

          return (
            <button
              key={sc.id}
              onClick={() => handleLoadScenario(sc)}
              className={`p-2 rounded-lg border text-left flex flex-col justify-between transition-all ${
                isCurrent
                  ? 'bg-zinc-800 border-cyan-400 shadow-md ring-1 ring-cyan-400'
                  : isSolved
                  ? 'bg-emerald-950/20 border-emerald-800/40 hover:border-emerald-700'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] font-mono font-bold text-cyan-400">
                  #{sc.id}
                </span>
                {isSolved && (
                  <span className="text-[9px] font-mono font-bold text-emerald-400">
                    ✓ PASS
                  </span>
                )}
              </div>
              <span className="text-[11px] font-semibold text-zinc-200 line-clamp-1 mt-0.5">
                {sc.title.split(' - ')[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Streamlined Scenario Briefing Card */}
      <div className="bg-zinc-900 border border-zinc-750 rounded-xl p-4 shadow-xl flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 pb-2 gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-600 text-cyan-400 text-xs font-mono font-bold">
              SCENARIO #{currentScenario.id}
            </span>
            <h2 className="text-base sm:text-lg font-bold text-zinc-100">
              {currentScenario.title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleLoadScenario(currentScenario)}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-750 text-cyan-400 text-xs font-mono font-bold rounded border border-cyan-800/60 transition-colors"
              title="Reset console to this scenario's initial faulty state"
            >
              RESET SCENARIO
            </button>
          </div>
        </div>

        {/* Real-World Situation & Objective (Compact Grid, No Hints) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 flex flex-col gap-1">
            <span className="font-mono font-bold text-amber-400 text-[11px] uppercase">
              PROBLEM:
            </span>
            <p className="text-zinc-300 leading-relaxed text-[11px]">
              {currentScenario.context}
            </p>
            <div className="text-[10px] text-zinc-400 font-mono mt-1 pt-1 border-t border-zinc-850">
              <strong>Symptom:</strong> {currentScenario.problemSummary}
            </div>
          </div>

          <div
            onClick={() => setShowObjective(!showObjective)}
            className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
              showObjective
                ? 'bg-zinc-950 border-zinc-800'
                : 'bg-gradient-to-br from-emerald-950/40 via-zinc-950 to-zinc-950 border-emerald-600/70 shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:border-emerald-500'
            }`}
            title={showObjective ? "Click to conceal objective" : "Click anywhere to reveal mission objective hint"}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-emerald-400 text-[11px] uppercase flex items-center gap-2">
                <span>MISSION OBJECTIVE:</span>
              </span>
            </div>
            {showObjective ? (
              <p className="text-zinc-300 leading-relaxed text-[11px] mt-2">
                {currentScenario.objective}
              </p>
            ) : (
              <div className="py-3 flex items-center justify-center text-center">
                <span className="text-emerald-300 font-mono font-bold text-xs bg-emerald-950/80 px-4 py-2 rounded-lg border border-emerald-500/60 shadow animate-pulse">
                  💡 Click to Reveal Hint
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Real-Time Status / Passed Banner */}
        {validationResult?.passed && (
          <div className="bg-emerald-950/80 border-2 border-emerald-500 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-emerald-950/40">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center font-extrabold text-base">
                ✓
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-300 font-mono font-extrabold text-sm">
                    PASSED ({validationResult.score} PTS)
                  </span>
                  <span className="text-[10px] bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700/60 font-mono">
                    VERIFIED
                  </span>
                </div>
                <p className="text-xs text-zinc-200 mt-0.5">{validationResult.feedback}</p>
              </div>
            </div>

            {activeScenarioId < SCENARIOS.length ? (
              <button
                onClick={handleNextScenario}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-mono font-extrabold text-xs rounded-lg shadow-md transition-all flex items-center gap-1.5 animate-pulse"
              >
                <span>NEXT SCENARIO</span>
                <span className="text-sm">→</span>
              </button>
            ) : (
              <div className="px-3 py-1.5 bg-emerald-900/80 border border-emerald-500/80 rounded text-emerald-200 text-xs font-mono font-bold">
                🎉 ALL 8 SCENARIOS COMPLETE!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
