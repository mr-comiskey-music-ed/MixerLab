import React, { useState, useEffect, useRef } from 'react';
import { ChannelSettings, MasterSettings } from '../types/audio';
import { audioEngine } from '../audio/audioEngine';
import { Knob } from './Knob';
import { FxPanel } from './FxPanel';
import { CompKnob } from './CompKnob';
import { MeterLadder } from './MeterLadder';
import { FaderScale } from './FaderScale';
import { DigitalConsole } from './DigitalConsole';
import { sliderPosToDb, dbToSliderPos } from '../utils/faderCurves';
import { CONSOLE_LOW_HZ, CONSOLE_HIGH_HZ, fmtCornerHz } from '../audio/eqCorners';

interface LearnMixerProps {
  channels: ChannelSettings[];
  master: MasterSettings;
  onUpdateChannel: (index: number, settings: ChannelSettings) => void;
  onUpdateMaster: (settings: MasterSettings) => void;
  meterLevels: {
    channels: { level: number; clipped: boolean; hasSignal?: boolean; compGr?: number }[];
    masterL: number;
    masterR: number;
    masterClipped: boolean;
    aux1: number;
    pflActive: boolean;
  };
  onOpenFlow: (channelId: number, channelName: string) => void;
  consoleView: 'analog' | 'digital';
  onToggleConsoleView: (view: 'analog' | 'digital') => void;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onGoToConsole?: () => void;
  onCompleteLearn?: () => void;
  learnCompleted?: boolean;
}

// Generate pink or white noise buffer for frequency/filter learning
function generateNoiseBuffer(ctx: AudioContext, type: 'white' | 'pink', duration: number = 4.0): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(2, numSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  if (type === 'white') {
    // Generate full-frequency white noise with audible lower-octave body (<150Hz)
    // so highpass filter changes are immediately obvious
    let lowAccum = 0;
    for (let i = 0; i < numSamples; i++) {
      const white = (Math.random() * 2 - 1);
      // Low-frequency weighted noise (<150Hz rumble component)
      lowAccum = lowAccum * 0.985 + white * 0.015;
      const sample = white * 0.22 + lowAccum * 2.2;
      left[i] = sample;
      right[i] = sample;
    }
  } else {
    // Paul Kellet's filter for pink noise with rich sub-bass & warmth
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < numSamples; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.09;
      b6 = white * 0.115926;
      left[i] = pink;
      right[i] = pink;
    }
  }
  return buffer;
}

export const LearnMixer: React.FC<LearnMixerProps> = ({
  channels,
  master,
  onUpdateChannel,
  onUpdateMaster,
  meterLevels,
  onOpenFlow,
  consoleView,
  onToggleConsoleView,
  isPlaying,
  onPlay,
  onPause,
  onGoToConsole,
  onCompleteLearn,
  learnCompleted
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [activeAudioSource, setActiveAudioSource] = useState<'white_noise' | 'pink_noise' | 'song'>('white_noise');
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [step9View, setStep9View] = useState<'analog' | 'digital'>('digital');
  const [step9EqInteracted, setStep9EqInteracted] = useState<boolean>(false);
  const [compReachedSolid, setCompReachedSolid] = useState<boolean>(false);

  // Channel 1 is the dedicated Interactive Learning Strip
  const chIdx = 0;
  const ch = channels[chIdx] || channels[0];
  const meter = meterLevels.channels[chIdx] || { level: 0, clipped: false };
  const compGr = meter.compGr ?? 0;

  // Step 3 unlocks once the compressor light has reached yellow (6 dB+ of gain reduction)
  useEffect(() => {
    if (currentStep === 3 && compGr >= 6 && !compReachedSolid) {
      setCompReachedSolid(true);
    }
  }, [currentStep, compGr, compReachedSolid]);

  // Load selected noise or song into Channel 1
  const setNoiseSource = (type: 'white_noise' | 'pink_noise' | 'song') => {
    setActiveAudioSource(type);
    if (!audioEngine.ctx) audioEngine.init();

    if (type === 'white_noise' || type === 'pink_noise') {
      const buffer = generateNoiseBuffer(audioEngine.ctx!, type === 'white_noise' ? 'white' : 'pink');
      audioEngine.loadCustomStem(0, buffer);
    } else {
      audioEngine.loadSong(audioEngine.currentSongId);
    }
  };

  // Ensure solo is cleared, test channel is unmuted, and low cut starts disengaged
  useEffect(() => {
    audioEngine.setIsolatedChannel(0);
    if (ch.mute || ch.lowCut100Hz) {
      onUpdateChannel(chIdx, { ...ch, mute: false, lowCut100Hz: false });
    }
    // Auto-generate white noise on mount so student can immediately hear filters and EQ
    if (activeAudioSource === 'white_noise' && audioEngine.ctx) {
      const buffer = generateNoiseBuffer(audioEngine.ctx, 'white');
      audioEngine.loadCustomStem(0, buffer);
    }
    return () => {
      // Return to normal multitrack when unmounting
      audioEngine.setIsolatedChannel(null);
    };
  }, []);

  const handleChannelField = <K extends keyof ChannelSettings>(
    field: K,
    val: ChannelSettings[K]
  ) => {
    const updated = { ...ch, [field]: val };
    onUpdateChannel(chIdx, updated);
  };

  const handleMasterField = <K extends keyof MasterSettings>(
    field: K,
    val: MasterSettings[K]
  ) => {
    onUpdateMaster({ ...master, [field]: val });
  };

  // Check if current step task is completed
  const isTaskDoneForStep = (step: number): boolean => {
    switch (step) {
      case 1:
        // Gain adjusted away from unity, or driven hot into peak clipping
        return (ch.gain >= 6 || ch.gain <= -6) || !!completedSteps[1];
      case 2:
        // Strictly require 100Hz Low Cut button to be ON.
        // +48V and Hi-Z do NOT satisfy this task!
        return Boolean(ch.lowCut100Hz);
      case 3:
        // Compressor turned up far enough (while audio plays) to light up yellow or red
        return compReachedSolid || !!completedSteps[3];
      case 4:
        // EQ knobs adjusted
        return Math.abs(ch.eqHigh) >= 1.5 || Math.abs(ch.eqMid) >= 1.5 || Math.abs(ch.eqLow) >= 1.5 || ch.eqMidFreq !== 2500 || !!completedSteps[4];
      case 5:
        // Aux or FX send adjusted
        return ch.aux1Pre > -55 || ch.fxPost > -55 || master.fxReturn > -55 || !!completedSteps[5];
      case 6:
        // Pan adjusted
        return Math.abs(ch.pan) >= 0.15 || !!completedSteps[6];
      case 7:
        // Solo or Mute toggled
        return ch.soloPfl || ch.mute || !!completedSteps[7];
      case 8:
        // Channel Fader moved away from 0dB
        return Math.abs(ch.faderLevel) >= 2 || ch.faderLevel <= -10 || !!completedSteps[8];
      case 9:
        // Master Fader moved
        return Math.abs(master.mainFader) >= 1.5 || master.mainFader <= -5 || !!completedSteps[9];
      case 10:
        // Dragging/manipulating EQ controls on the digital board
        return step9EqInteracted || !!completedSteps[10];
      case 11:
        // Signal flow viewed
        return !!completedSteps[11];
      default:
        return false;
    }
  };

  const isCurrentStepCompleted = isTaskDoneForStep(currentStep);

  const markStepComplete = (stepNum: number) => {
    setCompletedSteps(prev => ({ ...prev, [stepNum]: true }));
  };

  const handleNext = () => {
    if (!isCurrentStepCompleted) return;
    markStepComplete(currentStep);
    if (currentStep === 11 && onCompleteLearn) {
      onCompleteLearn();
    }
    if (currentStep < 11) {
      setCurrentStep(currentStep + 1);
    } else if (currentStep === 11 && onGoToConsole) {
      onGoToConsole();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  /*
   * The 11 Learn steps. Channel 1 (Card Game's drums, or a noise test signal) is the practice channel.
   * Keep text short and plain: what it is, the few facts that matter, one thing to try, one tip.
   */
  const stepsInfo: { step: number; chip: string; title: string; what: string; details?: string[]; task: string; tip: string }[] = [
    {
      step: 1,
      chip: 'Gain',
      title: 'Gain & the PEAK Light',
      what: 'Mics and instruments put out a very weak signal. The GAIN knob at the top of each channel boosts it to a healthy working level before anything else happens to it.',
      details: [
        "Too little gain: you'll have to push the fader way up, and hiss and noise come up with it.",
        'Too much gain: the signal overloads the channel, the red PEAK light comes on, and the sound distorts.',
        "The fader can't fix distortion. It happens before the sound ever reaches the fader."
      ],
      task: 'Press PLAY. Turn GAIN up until the PEAK light comes on and listen to the distortion, then bring it back down until the light stays off.',
      tip: 'Set gain at soundcheck while the musician plays their loudest: a strong signal, with the PEAK light never coming on.'
    },
    {
      step: 2,
      chip: 'Buttons',
      title: 'Input Buttons',
      what: 'Under the gain knob are switches that get the signal ready before it gets shaped.',
      details: [
        "+48V (phantom power) sends power up the mic cable. Condenser mics need it to work; dynamic mics like the SM58 don't.",
        'Hi-Z (channels 1-2) is for an electric guitar or bass plugged straight in.',
        'Ø INV (phase invert) flips the signal. It fixes two mics on one instrument canceling each other out.',
        '100Hz LOW CUT removes rumble and boom below about 100 Hz: stage thumps, handling noise, hum.'
      ],
      task: 'With WHITE NOISE or the drums playing, switch the 100Hz LOW CUT on and off. Listen to the bottom end.',
      tip: "Use the low cut on parts that don't need deep bass, like vocals, guitars and keys. Leave it off for kick drum and bass."
    },
    {
      step: 3,
      chip: 'Comp',
      title: 'Compressor',
      what: "A compressor automatically turns down the loudest moments so a performance sits at a steadier level, then turns the channel back up. The result sounds more even and up-front instead of just quieter.",
      details: [
        'Turning COMP up makes it start sooner and push harder.',
        "The light shows how much it's turning the sound down right now: GREEN light (1-6 dB), YELLOW medium (6-15 dB), RED heavy (15 dB or more)."
      ],
      task: 'Choose DRUMS, press PLAY, and turn COMP up until the light turns yellow. Flip between OFF and your setting: what happens to the hits and the space between them?',
      tip: 'Green to yellow is the normal range for vocals and bass. Red squashes the life out of a sound. That can be a cool effect, but make it a choice.'
    },
    {
      step: 4,
      chip: 'EQ',
      title: 'EQ',
      what: "EQ turns specific frequency ranges up or down to shape a sound's tone.",
      details: [
        `LOW (${fmtCornerHz(CONSOLE_LOW_HZ)}): weight and boom.`,
        'MID with MID FREQ: boost or cut one range you choose, from 100 Hz to 8 kHz. Low mids (300-600 Hz) sound boxy or muddy; upper mids (2-4 kHz) add presence and bite.',
        `HIGH (${fmtCornerHz(CONSOLE_HIGH_HZ)}): air, sparkle and cymbal shimmer.`
      ],
      task: 'With WHITE NOISE playing, turn MID up, then sweep MID FREQ from left to right. Hear the boosted range move from low to high.',
      tip: "Cut before you boost. Taking out what's muddy or harsh often helps more than turning up what you like."
    },
    {
      step: 5,
      chip: 'Aux & FX',
      title: 'Aux & FX Sends',
      what: 'Sends make a copy of the channel and send it somewhere besides the main speakers.',
      details: [
        "AUX (MON) feeds the stage monitors. It's pre-fader: moving the channel fader doesn't change what the musician hears.",
        "FX feeds the console's built-in effect (reverb, delay or chorus). It's post-fader: pull the fader down and the effect goes with it.",
        'FX RETURN, in the master section, sets how much of the effect comes back into the mix.'
      ],
      task: "Turn up this channel's FX send, then turn up FX RETURN below. Try PLATE, HALL, DELAY and CHORUS.",
      tip: 'AUX (pre-fader) for monitors, FX (post-fader) for effects.'
    },
    {
      step: 6,
      chip: 'Pan',
      title: 'Pan',
      what: 'PAN places a sound anywhere from the left speaker to the right.',
      details: ['In the center, it plays equally in both speakers.', 'Two similar parts are easier to hear apart when they sit on opposite sides.'],
      task: 'With headphones on, turn PAN from all the way left to all the way right.',
      tip: 'Keep kick, snare, bass and lead vocal in the center. Spread guitars, keys and backing vocals to the sides.'
    },
    {
      step: 7,
      chip: 'Mute/Solo',
      title: 'Mute & Solo',
      what: 'Two buttons for quick checks.',
      details: ['MUTE silences the channel.', 'SOLO plays only the soloed channels. Solo two or more to hear how they fit together.'],
      task: 'Press SOLO on Channel 1, then try MUTE.',
      tip: "Mute mics that aren't being used so they don't pick up noise or start feeding back."
    },
    {
      step: 8,
      chip: 'Fader',
      title: 'Channel Fader',
      what: 'The fader sets how loud this channel is in the mix compared to the others.',
      details: ['0 dB (unity) is the home position.', 'The fader is most precise near 0 dB. Near the bottom, small moves make big changes.'],
      task: 'Move the fader up and down. Double-click it to snap back to 0 dB.',
      tip: 'If a fader has to sit way down or way up to sound right, fix the gain instead so the fader can stay near 0 dB.'
    },
    {
      step: 9,
      chip: 'Master',
      title: 'Master Section',
      what: 'Every channel, plus the effect return, adds up in the master section and goes out to the main speakers.',
      details: [
        'The MAIN MIX fader turns the whole mix up or down without changing the balance.',
        'The meters show the level of the whole mix. If they reach the top and the PEAK light flashes, the mix is too hot.'
      ],
      task: 'Move the MAIN MIX fader and watch the meters respond.',
      tip: 'Build your mix with the channel faders while the master sits at 0 dB. Use the master to turn the whole show up or down.'
    },
    {
      step: 10,
      chip: 'Digital',
      title: 'Analog vs. Digital',
      what: "Both consoles do the same jobs. They're just laid out differently.",
      details: [
        'Analog: a knob for every job on every channel. Quick to grab, but big.',
        "Digital: select a channel and all of its controls appear on one screen, with an EQ graph you can drag and a live display of the sound's frequencies."
      ],
      task: 'On the digital console below, drag the LOW, MID and HIGH dots on the EQ graph.',
      tip: "Digital consoles can save a whole show's settings and bring them back in seconds."
    },
    {
      step: 11,
      chip: 'Flow',
      title: 'Signal Flow',
      what: 'Signal flow is the path sound takes through the console, in order. When something goes wrong, following the path step by step finds the problem fast.',
      details: ['Input → Gain → +48V / Hi-Z → Low Cut → Compressor → EQ → AUX send → Mute → Pan → Fader → FX send → Main Mix → speakers'],
      task: 'Open the signal flow diagram and follow the path for Channel 1.',
      tip: 'No sound? Work down the path: cable, gain and +48V, mute and solo, channel fader, master fader.'
    }
  ];

  const currentStepData = stepsInfo[currentStep - 1];

  // Helper to render the exact Channel 1 Strip from the mixer console
  const renderChannel1Strip = () => {
    const isGainHot = ch.gain >= 16;
    const isClipping = meter.clipped || isGainHot;

    return (
      <div className="w-28 flex flex-col bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-lg p-1 gap-1 shadow-xl relative">
        {/* Channel Strip Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-1">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-meter-400 font-bold">
                Ch 1
              </span>
              <div
                className={`w-2 h-2 rounded-full ${
                  isClipping ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-ping' : 'bg-zinc-800'
                }`}
                title={isClipping ? 'PEAK / CLIPPING' : 'Normal'}
              />
            </div>
            <span className="text-[11px] font-semibold text-zinc-100 truncate max-w-[70px]" title={ch.name}>
              {activeAudioSource === 'white_noise' ? 'White Noise' : activeAudioSource === 'pink_noise' ? 'Pink Noise' : ch.name}
            </span>
          </div>
          <button
            onClick={() => {
              onOpenFlow(ch.id, ch.name);
              markStepComplete(11);
            }}
            className="px-1 py-0.5 rounded bg-zinc-800 hover:bg-meter-950 hover:text-meter-400 text-zinc-400 text-[8px] font-mono border border-zinc-700 transition-colors"
            title="Signal Flow"
          >
            FLOW
          </button>
        </div>

        {/* Preamp & Input Section (Spotlighted on Step 1) */}
        <div
          className={`flex flex-col items-center gap-1 bg-zinc-950/60 p-1 rounded border transition-all ${
            currentStep === 1
              ? 'border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)] ring-2 ring-red-500/50'
              : 'border-zinc-850'
          }`}
        >
          <div className="flex items-center gap-1.5 w-full justify-center">
            <Knob
              label="GAIN"
              value={ch.gain}
              min={-60}
              max={20}
              step={0.5}
              color="red"
              size="sm"
              isGain
              defaultValue={0}
              formatValue={(v) => (v <= -59 ? '-∞ dB' : `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`)}
              onChange={(v) => handleChannelField('gain', v)}
            />
            {/* The updated red PEAK Indicator Box */}
            <div
              className={`px-1 py-2 rounded text-[7px] font-mono font-bold border transition-all ${
                isClipping
                  ? 'bg-red-600 text-white border-red-400 shadow-[0_0_10px_rgba(239,68,68,0.9)] animate-pulse'
                  : 'bg-zinc-900 text-zinc-600 border-zinc-800'
              }`}
              title={isClipping ? 'PEAK / CLIPPING DETECTED' : 'Peak Indicator (Normal)'}
            >
              PEAK
            </div>
          </div>

          {/* Input Switches (Spotlighted on Step 2) */}
          <div
            className={`grid grid-cols-2 gap-1 w-full mt-0.5 p-0.5 rounded transition-all ${
              currentStep === 2 ? 'ring-2 ring-emerald-500/60 bg-emerald-950/20' : ''
            }`}
          >
            <button
              onClick={() => handleChannelField('phantom48V', !ch.phantom48V)}
              className={`text-[8px] font-mono font-bold py-1 px-0.5 rounded border transition-all ${
                ch.phantom48V
                  ? 'bg-red-600 text-white border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.7)]'
                  : 'bg-zinc-850 text-zinc-400 border-zinc-750 hover:bg-zinc-800'
              }`}
            >
              +48V
            </button>

            <button
              onClick={() => handleChannelField('hiZ', !ch.hiZ)}
              className={`text-[8px] font-mono font-bold py-1 px-0.5 rounded border transition-all ${
                ch.hiZ
                  ? 'bg-amber-600 text-white border-amber-400 shadow-[0_0_8px_rgba(217,119,6,0.7)]'
                  : 'bg-zinc-850 text-zinc-400 border-zinc-750 hover:bg-zinc-800'
              }`}
            >
              Hi-Z
            </button>

            <button
              onClick={() => handleChannelField('lowCut100Hz', !ch.lowCut100Hz)}
              className={`col-span-2 text-[8px] font-mono font-bold py-1 px-0.5 rounded border transition-all ${
                ch.lowCut100Hz
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                  : 'bg-zinc-850 text-zinc-400 border-zinc-750 hover:bg-zinc-800'
              }`}
            >
              100Hz LOW CUT
            </button>
          </div>

          {/* One-knob Compressor (Spotlighted on Step 3) */}
          <div
            className={`w-full rounded p-0.5 transition-all ${
              currentStep === 3 ? 'ring-2 ring-orange-500/70 bg-orange-950/20 shadow-[0_0_12px_rgba(249,115,22,0.4)]' : ''
            }`}
          >
            <CompKnob
              value={ch.comp ?? 0}
              gainReductionDb={compGr}
              onChange={(v) => handleChannelField('comp', v)}
            />
          </div>
        </div>

        {/* 3-Band EQ Section (Spotlighted on Step 4) */}
        <div
          className={`flex flex-col items-center gap-1 bg-zinc-950/40 p-1 rounded border transition-all ${
            currentStep === 4
              ? 'border-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.4)] ring-2 ring-sky-400/50'
              : 'border-zinc-850'
          }`}
        >
          <span className="text-[8px] font-mono font-bold text-sky-400 uppercase tracking-wider">
            EQ
          </span>
          {/* HIGH EQ knob is BLUE! */}
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
            onChange={(v) => handleChannelField('eqHigh', v)}
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
            onChange={(v) => handleChannelField('eqMidFreq', v)}
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
            onChange={(v) => handleChannelField('eqMid', v)}
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
            onChange={(v) => handleChannelField('eqLow', v)}
          />
        </div>

        {/* Aux & FX Sends (Spotlighted on Step 5) */}
        <div
          className={`flex flex-col items-center gap-1 bg-zinc-950/40 p-1 rounded border transition-all ${
            currentStep === 5
              ? 'border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.4)] ring-2 ring-purple-400/50'
              : 'border-zinc-850'
          }`}
        >
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
            onChange={(v) => handleChannelField('aux1Pre', v)}
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
            onChange={(v) => handleChannelField('fxPost', v)}
          />
        </div>

        {/* Pan (-64 to +64 DAW coding, Spotlighted on Step 6) */}
        <div
          className={`flex flex-col items-center bg-zinc-950/40 p-1 rounded border transition-all ${
            currentStep === 6
              ? 'border-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.4)] ring-2 ring-yellow-400/50'
              : 'border-zinc-850'
          }`}
        >
          <Knob
            label="PAN"
            value={Math.round(ch.pan * 64)}
            min={-64}
            max={64}
            step={1}
            color="yellow"
            size="sm"
            centerDetent
            defaultValue={0}
            formatValue={(v) => (Math.abs(v) < 0.5 ? 'C' : v < 0 ? `L${Math.abs(Math.round(v))}` : `R${Math.round(v)}`)}
            onChange={(v) => handleChannelField('pan', v / 64)}
          />
        </div>

        {/* Mute & Solo (Spotlighted on Step 7) */}
        <div
          className={`grid grid-cols-2 gap-1 p-0.5 rounded transition-all ${
            currentStep === 7 ? 'ring-2 ring-rose-500/60 bg-rose-950/20' : ''
          }`}
        >
          <button
            onClick={() => handleChannelField('mute', !ch.mute)}
            className={`text-[9px] font-bold py-1 rounded border transition-all ${
              ch.mute
                ? 'bg-rose-600 text-white border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.8)]'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-750'
            }`}
          >
            MUTE
          </button>
          <button
            onClick={() => handleChannelField('soloPfl', !ch.soloPfl)}
            className={`text-[9px] font-bold py-1 rounded border transition-all ${
              ch.soloPfl
                ? 'bg-amber-500 text-zinc-950 border-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.9)]'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-750'
            }`}
            title="SOLO: Isolates Channel 1 for dedicated auditing"
          >
            SOLO
          </button>
        </div>

        {/* Fader & Meter (Spotlighted on Step 8) */}
        <div
          className={`flex items-center justify-center bg-zinc-950 p-1.5 rounded border h-48 transition-all ${
            currentStep === 8
              ? 'border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.4)] ring-2 ring-indigo-500/50'
              : 'border-zinc-850'
          }`}
        >
          <FaderScale heightClass="h-40" />
          <div className="flex-1 flex justify-center items-center h-full px-0.5">
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={dbToSliderPos(ch.faderLevel)}
              onChange={(e) => handleChannelField('faderLevel', sliderPosToDb(parseFloat(e.target.value)))}
              onDoubleClick={(e) => {
                e.preventDefault();
                handleChannelField('faderLevel', 0);
              }}
              className="fader-vertical h-40 w-8"
              title={`Fader: ${ch.faderLevel > 0 ? '+' : ''}${ch.faderLevel.toFixed(1)} dB\n(double click to reset)`}
            />
          </div>
        </div>

        {/* Fader Readout */}
        <div className="flex items-center justify-between text-[9px] font-mono px-0.5">
          <span className="text-zinc-500">LEVEL</span>
          <span className="font-bold text-zinc-200">
            {ch.faderLevel <= -59 ? '-∞' : `${ch.faderLevel > 0 ? '+' : ''}${ch.faderLevel.toFixed(1)}`}
          </span>
        </div>
      </div>
    );
  };

  // Helper to render the exact Master Section from the mixer console (Switched to on Step 9)
  const renderMasterSection = () => {
    return (
      <div className="w-64 flex flex-col bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border-2 border-red-900/60 rounded-lg p-2 gap-2 shadow-2xl">
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

        {/* Internal FX Engine Controls */}
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

        {/* Aux Master & FX Return */}
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

        {/* Master Stereo Meters */}
        <div className="flex flex-col bg-zinc-950 p-2 rounded border border-zinc-850 gap-1 flex-1 justify-center">
          <span className="text-[9px] font-mono text-center text-zinc-400 font-bold">
            STEREO VU METERS (L / R)
          </span>
          <div className="flex justify-center gap-4">
            <MeterLadder
              level={meterLevels.masterL}
              clipped={meterLevels.masterClipped}
              height={180}
              width={12}
              showLabels
            />
            <MeterLadder
              level={meterLevels.masterR}
              clipped={meterLevels.masterClipped}
              height={180}
              width={12}
            />
          </div>
        </div>

        {/* Main Mix Master Fader */}
        <div className="flex flex-col bg-zinc-950 p-2 rounded border border-zinc-850 gap-1">
          <div className="flex items-center justify-between text-[9px] font-mono mb-0.5">
            <span className="text-red-400 font-bold">MAIN MIX</span>
            <span className="font-bold text-zinc-200">
              {master.mainFader <= -59 ? '-∞' : `${master.mainFader > 0 ? '+' : ''}${master.mainFader.toFixed(1)} dB`}
            </span>
          </div>
          <div className="flex justify-center items-center h-48 bg-zinc-950 p-1 rounded border border-zinc-850">
            <FaderScale heightClass="h-40" isMaster />
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
              className="fader-vertical fader-master h-40 w-10"
              title={`Main Mix: ${master.mainFader > 0 ? '+' : ''}${master.mainFader.toFixed(1)} dB\n(double click to reset)`}
            />
          </div>
        </div>
      </div>
    );
  };

  const done = isCurrentStepCompleted;

  /** What Channel 1 plays: a test noise or Card Game's drums. */
  const sourcePicker = (
    <div className="w-full flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
      <span className="text-zinc-400 font-bold mr-0.5">CH 1 PLAYS:</span>
      {([
        ['white_noise', 'White noise'],
        ['pink_noise', 'Pink noise'],
        ['song', 'Drums']
      ] as const).map(([id, label]) => (
        <button
          key={id}
          onClick={() => setNoiseSource(id)}
          className={`px-2 py-1 rounded border font-bold transition-colors ${
            activeAudioSource === id ? 'bg-meter-500 text-zinc-950 border-meter-400' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
          }`}
        >
          {label}
        </button>
      ))}
      <button
        onClick={isPlaying ? onPause : onPlay}
        className={`ml-auto px-3 py-1 rounded font-bold text-white transition-colors ${isPlaying ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
      >
        {isPlaying ? '❚❚ PAUSE' : '▶ PLAY'}
      </button>
    </div>
  );

  const lesson = (
    <div className="flex flex-col gap-3">
      <div>
        <span className="font-mono text-[11px] font-bold text-meter-400">STEP {currentStep} OF {stepsInfo.length}</span>
        <h2 className="text-2xl font-bold text-zinc-100 leading-tight">{currentStepData.title}</h2>
      </div>
      <p className="font-mono text-sm leading-relaxed text-zinc-200">{currentStepData.what}</p>
      {currentStepData.details && (
        <ul className="flex flex-col gap-1.5 font-mono text-[13px] leading-relaxed text-zinc-300">
          {currentStepData.details.map((d) => (
            <li key={d} className="relative pl-4">
              <span className="absolute left-0 text-meter-400">•</span>
              {d}
            </li>
          ))}
        </ul>
      )}
      <div className={`rounded-r-lg border-l-2 px-3 py-2.5 ${done ? 'border-emerald-500 bg-emerald-950/30' : 'border-meter-400 bg-meter-500/10'}`}>
        <span className={`font-mono text-[11px] font-bold ${done ? 'text-emerald-300' : 'text-meter-300'}`}>{done ? '✓ DONE' : 'TRY IT'}</span>
        <p className="font-mono text-[13px] leading-relaxed text-zinc-100 mt-0.5">{currentStepData.task}</p>
      </div>
      <p className="font-mono text-xs leading-relaxed text-zinc-400">
        <span className="font-bold text-zinc-300">Tip: </span>
        {currentStepData.tip}
      </p>
    </div>
  );

  const nav = (
    <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
      <button
        onClick={handlePrev}
        disabled={currentStep === 1}
        className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-750 disabled:opacity-30 text-zinc-300 font-mono text-xs font-bold transition-colors"
      >
        ← BACK
      </button>
      <button
        onClick={handleNext}
        disabled={!done}
        title={done ? undefined : 'Do the TRY IT task to continue'}
        className={`px-4 py-1.5 rounded font-mono text-xs font-bold transition-colors ${
          done ? 'bg-meter-500 hover:bg-meter-400 text-zinc-950' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
        }`}
      >
        {currentStep === stepsInfo.length ? 'GO TO MIX CONSOLE →' : 'NEXT →'}
      </button>
    </div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-3 pb-12">
      {/* Steps */}
      <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
        {stepsInfo.map((s) => {
          const isCurrent = s.step === currentStep;
          const isDone = completedSteps[s.step];
          return (
            <button
              key={s.step}
              onClick={() => setCurrentStep(s.step)}
              className={`px-1 py-1.5 rounded-lg border text-center transition-colors ${
                isCurrent ? 'bg-meter-500/15 border-meter-400' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
              }`}
            >
              <span className={`block font-mono text-[10px] ${isCurrent ? 'text-meter-300' : 'text-zinc-500'}`}>
                {isDone ? '✓' : s.step}
              </span>
              <span className={`block truncate font-display text-[14px] font-semibold tracking-wide ${isCurrent ? 'text-meter-300' : 'text-zinc-300'}`}>
                {s.chip}
              </span>
            </button>
          );
        })}
      </div>

      {currentStep === 10 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-5 flex flex-col gap-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {lesson}
            <div className="flex flex-col gap-3">
              {sourcePicker}
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <span className="text-zinc-400 font-bold mr-0.5">SHOW:</span>
                {(['digital', 'analog'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => {
                      setStep9View(v);
                      onToggleConsoleView(v);
                    }}
                    className={`px-2.5 py-1 rounded border font-bold transition-colors ${
                      step9View === v ? 'bg-meter-500 text-zinc-950 border-meter-400' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {v === 'digital' ? 'Digital' : 'Analog'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-zinc-950 p-3 sm:p-4 rounded-xl border border-zinc-800 overflow-x-auto flex justify-center">
              {step9View === 'digital' ? (
                <div className="w-full">
                  <DigitalConsole
                    channels={channels}
                    master={master}
                    selectedChannelIndex={0}
                    onSelectChannel={() => {}}
                    meterLevels={meterLevels}
                    onUpdateChannel={(idx, settings) => {
                      if (
                        settings.eqLow !== ch.eqLow ||
                        settings.eqMid !== ch.eqMid ||
                        settings.eqMidFreq !== ch.eqMidFreq ||
                        settings.eqHigh !== ch.eqHigh
                      ) {
                        setStep9EqInteracted(true);
                        markStepComplete(10);
                      }
                      onUpdateChannel(idx, settings);
                    }}
                    onUpdateMaster={onUpdateMaster}
                    onOpenXRay={onOpenFlow}
                  />
                </div>
              ) : (
                <div className="flex justify-center p-4">
                  {renderChannel1Strip()}
                </div>
              )}
          </div>
          {nav}
        </div>
      ) : (
        <>
        {/* On small screens the source buttons get their own row, so the strip and the lesson can sit side by side */}
        <div className="lg:hidden">{sourcePicker}</div>
        <div className={`grid gap-2 sm:gap-4 items-start lg:grid-cols-12 ${currentStep === 9 ? 'grid-cols-1' : 'grid-cols-[7rem_minmax(0,1fr)]'}`}>
          {/* Hardware: Channel 1, or the master section on step 9 */}
          <div className="lg:col-span-5 self-stretch">
            <div className="sticky top-2 lg:static flex flex-col items-center gap-2">
              <div className="hidden lg:block w-full">{sourcePicker}</div>
              {currentStep === 9 ? renderMasterSection() : renderChannel1Strip()}
            </div>
          </div>

          <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-5 flex flex-col gap-4 min-w-0">
            {lesson}

      {/* Step 5: the master FX section, so the send can be heard */}
          {currentStep === 5 && (
            <div className="w-full bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border-2 border-purple-900/60 rounded-lg p-2.5 flex flex-col gap-2 shadow-2xl">
              {/* Master FX Header */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-1">
                <span className="text-xs font-mono font-bold text-purple-400 uppercase tracking-wider">
                  INTERNAL FX (DSP)
                </span>
                <button
                  onClick={() => handleMasterField('fxMute', !master.fxMute)}
                  className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${
                    master.fxMute
                      ? 'bg-rose-600 text-white border-rose-400'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  {master.fxMute ? 'MUTED' : 'ACTIVE'}
                </button>
              </div>

              <FxPanel master={master} onField={handleMasterField} />

              {/* Aux Master & FX Return Knobs */}
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
            </div>
          )}

          {currentStep === 11 && (
            <button
              onClick={() => {
                onOpenFlow(ch.id, ch.name);
                markStepComplete(11);
                if (onCompleteLearn) onCompleteLearn();
              }}
              className="self-start px-4 py-2 rounded bg-meter-500 hover:bg-meter-400 text-zinc-950 font-mono font-extrabold text-xs transition-colors"
            >
              OPEN SIGNAL FLOW
            </button>
          )}

            {nav}
          </div>
        </div>
        </>
      )}
    </div>
  );
};
