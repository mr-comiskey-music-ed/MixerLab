import React, { useState, useEffect, useRef, useMemo } from 'react';
import { audioEngine } from '../audio/audioEngine';
import { ScenarioItem, ChannelSettings, MasterSettings } from '../types/audio';

interface ScenarioChallengesProps {
  channels: ChannelSettings[];
  master: MasterSettings;
  onApplyScenarioState: (setup: ScenarioItem['setupState']) => void;
  onRecordScenarioScore: (scenarioId: number, score: number) => void;
  completedScenarios: Record<number, number>;
  onScenarioChange?: (scenarioId: number) => void;
}

/*
 * Troubleshooting scenarios, written for Card Game (Indie):
 *   1 Drums · 2 Bass · 3 E Guits · 4 A Guit · 5 Piano & Organ · 6 Vocals
 * Each starts from a zeroed console plus the overrides in setupState.
 */
const near = (v: number, target: number, tol: number) => Math.abs(v - target) <= tol;
const ch = (chs: ChannelSettings[], id: number) => chs.find((c) => c.id === id)!;

export const SCENARIOS: ScenarioItem[] = [
  {
    id: 2,
    title: 'Everything Is in the Middle',
    problem: 'Every channel is panned to the center. The two guitar parts are stacked on top of each other and the whole mix sounds narrow.',
    note: "Good to know: on this recording, the singer's voice leaks into the acoustic guitar mic. If you hear a quiet vocal on the A Guit channel, that is normal. The track is not mislabeled.",
    hint: 'Think about which parts could move out to the sides, and which parts hold the song together and should stay in the middle.',
    setupState: { channels: [] },
    targetValidation: (chs) => {
      const e = ch(chs, 3).pan, a = ch(chs, 4).pan;
      if (Math.abs(e) < 0.3 || Math.abs(a) < 0.3) return { passed: false, score: 0, feedback: '' };
      if (Math.sign(e) === Math.sign(a)) return { passed: false, score: 50, feedback: 'Both guitars are on the same side now. Try giving each one its own side.' };
      const anchorsCentered = [1, 2, 6].every((id) => Math.abs(ch(chs, id).pan) <= 0.15);
      if (!anchorsCentered) return { passed: false, score: 60, feedback: 'The guitars are spread out nicely, but the mix feels lopsided. Some parts should stay right in the middle.' };
      return { passed: true, score: 100, feedback: 'Each guitar has its own side, and the drums, bass and vocal stay centered to anchor the mix.' };
    }
  },
  {
    id: 6,
    title: 'The Show Is Too Loud',
    problem: 'The venue manager says the show is about 6 dB too loud. The band\'s balance sounds perfect, so keep it exactly the same.',
    hint: "You don't need to move six faders to turn everything down evenly.",
    setupState: { channels: [], master: { mainFader: 0 } },
    targetValidation: (chs, m) => {
      const balanceKept = chs.every((c) => near(c.faderLevel, 0, 0.5) && !c.mute);
      if (m.mainFader > -4) {
        if (balanceKept) return { passed: false, score: 0, feedback: '' };
        const f = chs.map((c) => c.faderLevel);
        const allMovedTogether = Math.max(...f) - Math.min(...f) <= 0.5 && f[0] < -3;
        return {
          passed: false,
          score: 50,
          feedback: allMovedTogether
            ? 'That turns everything down, but it takes six moves and is easy to get uneven. One control can do it all at once.'
            : "The band's balance changed. Every channel was set right; the whole mix just needs to come down."
        };
      }
      if (!balanceKept) return { passed: false, score: 60, feedback: "The show is quieter, but the band's balance changed. Put the channel faders back where they were." };
      if (m.mainFader < -9) return { passed: false, score: 60, feedback: "That's quieter than the manager asked for. About 6 dB down is the goal." };
      return { passed: true, score: 100, feedback: 'The MAIN MIX fader turns the whole mix down at once, so every channel keeps its balance.' };
    }
  },
  {
    id: 3,
    title: 'Distorted Drums',
    problem: "The drums sound crunchy and distorted. Someone tried to fix it by pulling the Channel 1 fader down. Now the drums are quieter, but they're still distorted.",
    hint: "Watch Channel 1's PEAK light. The distortion happens at the top of the channel strip, before the sound ever reaches the fader.",
    setupState: { channels: [{ id: 1, gain: 18, faderLevel: -12 }] },
    targetValidation: (chs) => {
      const d = ch(chs, 1);
      if (d.gain > 8) return { passed: false, score: 0, feedback: '' };
      if (d.faderLevel < -6) return { passed: false, score: 60, feedback: 'The distortion is gone, but now the drums are buried. Bring them back up in the mix.' };
      if (d.faderLevel > 6) return { passed: false, score: 60, feedback: 'The distortion is gone, but the drums are now much louder than everything else.' };
      return { passed: true, score: 100, feedback: 'Fix distortion with the GAIN knob, not the fader. Gain sets how hot the signal comes in; the fader only sets its level in the mix.' };
    }
  },
  {
    id: 1,
    title: 'Condenser Mic Not Working',
    problem: "The singer is using a condenser mic on Channel 6 (Vocals). They're singing, but nothing is coming through that channel (other than the bleed from the acoustic guitar microphone).",
    hint: "Condenser mics are different from other mics: they can't work on their own. Look at Channel 6's input switches.",
    condenserChannel: 6,
    // A Guit down 6 dB so its vocal bleed doesn't mask the silent vocal channel
    setupState: { channels: [{ id: 6, phantom48V: false }, { id: 4, faderLevel: -6 }] },
    targetValidation: (chs) => {
      const v = ch(chs, 6);
      if (!v.phantom48V) return { passed: false, score: 0, feedback: '' };
      if (v.mute || v.faderLevel < -30) return { passed: false, score: 50, feedback: "The mic is working now, but something else on Channel 6 is still keeping the vocal quiet." };
      return { passed: true, score: 100, feedback: "+48V phantom power gives a condenser mic the power it needs. The vocal is back." };
    }
  },
  {
    id: 4,
    title: 'Muddy Mix',
    problem: "The mix sounds muddy and boomy, and the kick and bass are getting lost. The acoustic guitar mic is picking up low rumble from the stage, and the Piano & Organ has way too much low end. (The A Guit's EQ is greyed out for this one: fix that channel with a setting, not the EQ knobs.)",
    note: "Good to know: on this recording, the singer's voice leaks into the acoustic guitar mic. If you hear a quiet vocal on the A Guit channel, that is normal. The track is not mislabeled.",
    hint: "One channel needs its rumble filtered out with a switch. The other has EQ knobs turned up that should be flat or turned down.",
    lockEqChannels: [4],
    setupState: { channels: [{ id: 4, lowCut100Hz: false }, { id: 5, eqLow: 6, eqMid: 6, eqMidFreq: 400 }] },
    targetValidation: (chs) => {
      const g = ch(chs, 4), k = ch(chs, 5);
      const guitarFixed = g.lowCut100Hz;
      const keysFixed = k.eqLow <= 0 && k.eqMid <= 0;
      if (guitarFixed && keysFixed) return { passed: true, score: 100, feedback: "The low cut removes rumble the acoustic guitar doesn't need, and flattening the Piano & Organ's low EQ leaves room for the kick and bass." };
      if (guitarFixed || keysFixed) return { passed: false, score: 50, feedback: "That helped, but there's still extra low end coming from another channel." };
      return { passed: false, score: 0, feedback: '' };
    }
  },
  {
    id: 5,
    title: "Singer Can't Hear Themselves",
    problem: "The singer says they can't hear their own voice in their stage monitor (the speaker on the floor facing them). The audience mix already sounds great, so don't change it.",
    hint: "Stage monitors get their own mix from the AUX knobs, which work separately from the faders. There's an AUX control on each channel and one in the master section.",
    setupState: { channels: [{ id: 6, aux1Pre: -60 }], master: { aux1Master: -60 } },
    targetValidation: (chs, m) => {
      const v = ch(chs, 6);
      const audienceMixChanged = !near(v.faderLevel, 0, 2) || v.mute;
      if (audienceMixChanged) return { passed: false, score: 50, feedback: 'That changed the audience mix too, and it was already right. The monitor needs its own control.' };
      if (v.aux1Pre < -5) return { passed: false, score: 0, feedback: '' };
      if (m.aux1Master < -10) return { passed: false, score: 60, feedback: "The vocal is being sent to the monitor now, but the monitor's overall level is still all the way down." };
      return { passed: true, score: 100, feedback: "The AUX send feeds the stage monitor. It's pre-fader, so the singer's monitor and the audience mix can be set separately." };
    }
  },
  {
    id: 7,
    title: 'Mic Feedback',
    problem: 'A loud, high-pitched ring is coming out of the speakers: the vocal mic is feeding back. Stop it without losing the singer. (Press play to hear it.)',
    hint: "Feedback builds up when a mic is turned up too far and one frequency is boosted too much. Look at Channel 6's gain, fader and EQ.",
    feedbackChannel: 6,
    // The ring sits at the boosted mid frequency (4 kHz)
    setupState: { channels: [{ id: 6, gain: 16, faderLevel: 3, eqMid: 9, eqMidFreq: 4000 }] },
    targetValidation: (chs) => {
      const v = ch(chs, 6);
      if (v.mute || v.faderLevel < -30) return { passed: false, score: 50, feedback: 'The ringing stopped, but now nobody can hear the singer. Find what is causing the ring instead.' };
      if (isRinging(v)) return { passed: false, score: 0, feedback: '' };
      return { passed: true, score: 100, feedback: 'Feedback is a loop: the mic picks up its own sound from the speakers. Cutting the boosted frequency or bringing the level down breaks the loop.' };
    }
  },
  {
    id: 8,
    title: 'Dry and Flat',
    problem: 'The vocal and the Piano & Organ sound dry and flat, like they were recorded in a closet. Give them some space with the console\'s built-in effect.',
    hint: 'Each channel has an FX knob that sends it to the effect. The master section controls how much of the effect you hear.',
    setupState: { channels: [{ id: 5, fxPost: -60 }, { id: 6, fxPost: -60 }], master: { fxReturn: -60, fxMute: false } },
    targetValidation: (chs, m) => {
      const sent = [5, 6].filter((id) => ch(chs, id).fxPost >= -20).length;
      if (sent === 0) return { passed: false, score: 0, feedback: '' };
      if (m.fxReturn < -30 || m.fxMute) return { passed: false, score: 60, feedback: "The channels are being sent to the effect, but you can't hear the effect come back yet." };
      if (sent === 1) return { passed: false, score: 60, feedback: 'One of the two parts has some space now. The other still sounds dry.' };
      return { passed: true, score: 100, feedback: 'FX sends feed each channel into the effect, and the FX RETURN brings the effect back into the mix.' };
    }
  },
  {
    id: 9,
    title: 'Uneven Vocal',
    problem: "The lead vocal is inconsistent: the quiet words get lost behind the band, and the loud ones jump out. Make the vocal's level more consistent without touching its fader.",
    note: "(The actual vocal in this recording is mixed so it doesn't have this problem, but we are pretending it does for this scenario.)",
    hint: "Compressors turn down the loudest parts so the whole performance sits at a steadier level. Look at Channel 6's strip.",
    setupState: { channels: [] },
    targetValidation: (chs) => {
      const v = ch(chs, 6);
      if (v.comp < 25) return { passed: false, score: 0, feedback: '' };
      if (v.comp < 50) return { passed: false, score: 50, feedback: 'The compressor is working, but the vocal still jumps around. It needs more compression than that.' };
      if (v.mute || !near(v.faderLevel, 0, 6)) return { passed: false, score: 50, feedback: "The vocal's level is changing, but this one should be fixed without the fader. Let the compressor do the work." };
      if (v.comp > 85) return { passed: false, score: 60, feedback: 'That is a lot of compression. The vocal is steady, but it would sound flat and lifeless. Back it off until it still sounds natural.' };
      return { passed: true, score: 100, feedback: 'A compressor turns down the loudest parts, so quiet and loud words end up closer in level. A moderate amount keeps the vocal steady and still natural.' };
    }
  },
  {
    id: 10,
    title: 'Vocal Lost in the Mix',
    problem: "The vocal is at a good level, but the lyrics are hard to understand. The E Guits and the Piano & Organ are crowding the same range as the voice. Don't touch the vocal fader.",
    hint: "Parts that sit in the same frequency range cover each other up. Make some room for the voice, and give the voice itself a little extra clarity.",
    setupState: { channels: [{ id: 3, eqMid: 6, eqMidFreq: 2500 }, { id: 5, eqMid: 6, eqMidFreq: 2500 }] },
    targetValidation: (chs) => {
      const v = ch(chs, 6), g = ch(chs, 3), k = ch(chs, 5);
      const cleared = [g, k].filter((c) => c.eqMid <= 0).length;
      const lifted = (v.eqMid >= 2 && v.eqMidFreq >= 1500 && v.eqMidFreq <= 5000) || v.eqHigh >= 3;
      if (cleared === 0 && !lifted) return { passed: false, score: 0, feedback: '' };
      if (v.mute || !near(v.faderLevel, 0, 2)) return { passed: false, score: 50, feedback: 'The vocal fader moved. Its level was already right, so make it clearer with EQ instead.' };
      if (cleared === 2 && lifted) return { passed: true, score: 100, feedback: 'Cutting the mids on the instruments that compete with the voice, and adding a little presence to the voice itself, makes the words clear without making anything louder.' };
      if (cleared === 2) return { passed: false, score: 60, feedback: 'The guitars and keys are out of the way. The voice could use a little more presence of its own.' };
      if (lifted) return { passed: false, score: 60, feedback: 'The voice has more presence, but the E Guits and the Piano & Organ are still crowding it.' };
      return { passed: false, score: 60, feedback: 'Good start. Another part is still crowding the voice.' };
    }
  }
];

/** While the feedback problem is active, the boosted vocal is pulled down this much so starting the scenario isn't a jolt. */
const FEEDBACK_VOCAL_TRIM_DB = -12;

/** Feedback rings while the vocal channel's gain, fader and mid EQ are all pushed and it isn't muted. */
const isRinging = (c: ChannelSettings) => c.gain > 14 && c.faderLevel > 2 && c.eqMid > 2 && !c.mute;

export const ScenarioChallenges: React.FC<ScenarioChallengesProps> = ({
  channels,
  master,
  onApplyScenarioState,
  onRecordScenarioScore,
  completedScenarios,
  onScenarioChange
}) => {
  const [activeScenarioId, setActiveScenarioId] = useState<number>(SCENARIOS[0].id);
  const [showHint, setShowHint] = useState(false);
  const [solved, setSolved] = useState<{ score: number; feedback: string } | null>(null);
  const prevPassedRef = useRef<boolean>(false);
  const recordScoreRef = useRef(onRecordScenarioScore);
  recordScoreRef.current = onRecordScenarioScore;

  const currentScenario = SCENARIOS.find((s) => s.id === activeScenarioId) || SCENARIOS[0];
  const result = useMemo(() => currentScenario.targetValidation(channels, master), [channels, master, currentScenario]);

  // Start Scenario 1 in its broken state when the tab opens
  useEffect(() => {
    onScenarioChange?.(activeScenarioId);
    if (!completedScenarios[SCENARIOS[0].id]) onApplyScenarioState(SCENARIOS[0].setupState);
  }, []);

  const handleLoadScenario = (sc: ScenarioItem) => {
    setActiveScenarioId(sc.id);
    setSolved(null);
    setShowHint(false);
    prevPassedRef.current = false;
    onScenarioChange?.(sc.id);
    onApplyScenarioState(sc.setupState);
  };

  const idx = SCENARIOS.findIndex((s) => s.id === activeScenarioId);
  const nextScenario = SCENARIOS[idx + 1];

  // Feedback scenario: the vocal rings while the problem is unsolved
  useEffect(() => {
    const id = currentScenario.feedbackChannel;
    const c = id ? channels.find((x) => x.id === id) : undefined;
    audioEngine.setFeedbackScreech(!!c && isRinging(c), c?.eqMidFreq || 2500, id, FEEDBACK_VOCAL_TRIM_DB);
  }, [channels, currentScenario]);
  useEffect(() => () => audioEngine.setFeedbackScreech(false), []);

  // Check the console whenever it changes
  useEffect(() => {
    if (!result.passed) {
      if (!prevPassedRef.current) setSolved(null);
      return;
    }
    setSolved({ score: result.score, feedback: result.feedback });
    recordScoreRef.current(currentScenario.id, result.score);
    if (prevPassedRef.current) return;
    prevPassedRef.current = true;

    // Just solved: end any knob or fader drag so a still-moving hand can't un-solve it, then show the result.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.getSelection()?.removeAllRanges();
    const sliders = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="range"]'));
    sliders.forEach((sl) => { sl.disabled = true; sl.blur(); });
    const swallow = (e: Event) => { e.stopImmediatePropagation(); e.preventDefault(); };
    const blocked = ['mousemove', 'pointermove', 'touchmove', 'input', 'change'] as const;
    blocked.forEach((evt) => window.addEventListener(evt, swallow, { capture: true }));
    ['pointerup', 'mouseup', 'touchend', 'pointercancel'].forEach((t) => {
      window.dispatchEvent(new Event(t, { bubbles: true, cancelable: true }));
      document.dispatchEvent(new Event(t, { bubbles: true, cancelable: true }));
    });
    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      blocked.forEach((evt) => window.removeEventListener(evt, swallow, { capture: true }));
      sliders.forEach((sl) => { sl.disabled = false; });
      ['pointerup', 'mouseup', 'touchend'].forEach((t) => window.removeEventListener(t, restore, { capture: true }));
    };
    ['pointerup', 'mouseup', 'touchend'].forEach((t) => window.addEventListener(t, restore, { capture: true }));
    setTimeout(restore, 1000);
    document.getElementById('scenarios-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [result, currentScenario]);

  const nudge = !solved && !result.passed && result.score >= 50 ? result.feedback : null;

  return (
    <div id="scenarios-top" className="w-full max-w-5xl mx-auto flex flex-col gap-3 pb-4 scroll-mt-4">
      <div>
        <span className="font-mono text-xs font-bold text-yellow-400 uppercase tracking-wider">Real-World Problem Solving</span>
        <p className="font-mono text-xs text-zinc-500 mt-0.5">Something is wrong with the mix. Find it and fix it on the console.</p>
      </div>

      {/* Scenario picker */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-1.5">
        {SCENARIOS.map((sc, i) => {
          const isCurrent = sc.id === activeScenarioId;
          const isSolved = (completedScenarios[sc.id] ?? 0) >= 100;
          return (
            <button
              key={sc.id}
              onClick={() => handleLoadScenario(sc)}
              className={`px-2 py-1.5 rounded-lg border text-left transition-colors ${
                isCurrent ? 'bg-meter-500/15 border-meter-400' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
              }`}
            >
              <div className="flex items-center justify-between font-mono text-[10px] font-bold">
                <span className={isCurrent ? 'text-meter-300' : 'text-zinc-500'}>{i + 1}</span>
                {isSolved && <span className="text-zinc-400">✓</span>}
              </div>
              <span className={`block font-display text-[15px] font-semibold leading-tight tracking-wide ${isCurrent ? 'text-meter-300' : 'text-zinc-300'}`}>
                {sc.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* Briefing */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="font-mono text-[11px] font-bold text-meter-400">SCENARIO {idx + 1} OF {SCENARIOS.length}</span>
            <h2 className="text-2xl font-bold text-zinc-100 leading-tight">{currentScenario.title}</h2>
          </div>
          <button
            onClick={() => handleLoadScenario(currentScenario)}
            className="shrink-0 px-2.5 py-1 rounded border border-zinc-700 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-mono text-[11px] font-bold transition-colors"
            title="Put the console back the way this scenario started"
          >
            RESET
          </button>
        </div>

        <p className="font-mono text-sm leading-relaxed text-zinc-200 max-w-3xl">{currentScenario.problem}</p>

        {currentScenario.note && <p className="font-mono text-[12px] leading-relaxed text-zinc-400 max-w-3xl">{currentScenario.note}</p>}

        {showHint ? (
          <p className="font-mono text-[13px] leading-relaxed text-zinc-300 border-l-2 border-meter-400 bg-meter-500/10 rounded-r px-3 py-2 max-w-3xl">
            <span className="font-bold text-meter-300">Hint: </span>
            {currentScenario.hint}
          </p>
        ) : (
          !solved && (
            <button
              onClick={() => setShowHint(true)}
              className="self-start px-3 py-1.5 rounded-lg border border-meter-600/70 text-meter-300 hover:bg-meter-500/10 font-mono text-xs font-bold transition-colors"
            >
              Show a hint
            </button>
          )
        )}

        {nudge && (
          <p className="font-mono text-[13px] text-orange-300 max-w-3xl">
            <span className="font-bold">Almost: </span>
            {nudge}
          </p>
        )}

        {solved && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-600/70 bg-emerald-950/50 px-3 py-2.5">
            <p className="font-mono text-[13px] text-zinc-200 max-w-3xl">
              <span className="font-bold text-emerald-300">✓ Solved. </span>
              {solved.feedback}
            </p>
            {nextScenario ? (
              <button
                onClick={() => handleLoadScenario(nextScenario)}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-mono font-extrabold text-xs transition-colors"
              >
                NEXT SCENARIO →
              </button>
            ) : (
              <span className="font-mono text-xs font-bold text-emerald-300">That's all {SCENARIOS.length}!</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
