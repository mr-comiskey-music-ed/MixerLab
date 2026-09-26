import React, { useState, useEffect, useRef } from 'react';
import { ChannelSettings, MasterSettings } from '../types/audio';
import { audioEngine } from '../audio/audioEngine';
import { Knob } from './Knob';
import { MeterLadder } from './MeterLadder';
import { FaderScale } from './FaderScale';
import { DigitalConsole } from './DigitalConsole';
import { sliderPosToDb, dbToSliderPos } from '../utils/faderCurves';

interface LearnMixerProps {
  channels: ChannelSettings[];
  master: MasterSettings;
  onUpdateChannel: (index: number, settings: ChannelSettings) => void;
  onUpdateMaster: (settings: MasterSettings) => void;
  meterLevels: {
    channels: { level: number; clipped: boolean }[];
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

  // Master FX tap tempo state
  const [delayInfo, setDelayInfo] = useState(() => audioEngine.getDelayInfo());
  const [tapFlash, setTapFlash] = useState(false);

  const handleTap = () => {
    const res = audioEngine.tapTempo();
    setDelayInfo({ delayMs: Math.round(res.delaySec * 1000), bpm: res.bpm });
    setTapFlash(true);
    setTimeout(() => setTapFlash(false), 120);
  };

  // Channel 1 is the dedicated Interactive Learning Strip
  const chIdx = 0;
  const ch = channels[chIdx] || channels[0];
  const meter = meterLevels.channels[chIdx] || { level: 0, clipped: false };

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
        // EQ knobs adjusted
        return Math.abs(ch.eqHigh) >= 1.5 || Math.abs(ch.eqMid) >= 1.5 || Math.abs(ch.eqLow) >= 1.5 || ch.eqMidFreq !== 2500 || !!completedSteps[3];
      case 4:
        // Aux or FX send adjusted
        return ch.aux1Pre > -55 || ch.fxPost > -55 || master.fxReturn > -55 || !!completedSteps[4];
      case 5:
        // Pan adjusted
        return Math.abs(ch.pan) >= 0.15 || !!completedSteps[5];
      case 6:
        // Solo or Mute toggled
        return ch.soloPfl || ch.mute || !!completedSteps[6];
      case 7:
        // Channel Fader moved away from 0dB
        return Math.abs(ch.faderLevel) >= 2 || ch.faderLevel <= -10 || !!completedSteps[7];
      case 8:
        // Master Fader moved
        return Math.abs(master.mainFader) >= 1.5 || master.mainFader <= -5 || !!completedSteps[8];
      case 9:
        // Dragging/manipulating EQ controls on the digital board
        return step9EqInteracted || !!completedSteps[9];
      case 10:
        // Signal flow viewed
        return !!completedSteps[10];
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
    if (currentStep === 10 && onCompleteLearn) {
      onCompleteLearn();
    }
    if (currentStep < 10) {
      setCurrentStep(currentStep + 1);
    } else if (currentStep === 10 && onGoToConsole) {
      onGoToConsole();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const stepsInfo = [
    {
      step: 1,
      title: "Gain & Peak Indicator (Input Trim & Headroom)",
      subtitle: "The most critical step in live sound: setting proper input voltage without clipping.",
      summary: "Every channel strip starts with the Preamp Gain (Trim). Microphones and instruments output very weak electrical voltages (millivolts). The preamp amplifies this weak signal up to nominal line level (+4 dBu).",
      mechanics: "The Gain knob adjusts the pre-fader amplification factor. If you turn it too low, you'll have to crank the fader later, amplifying background noise/hiss. If you turn it too high, the signal exceeds preamp headroom (0 dBFS), triggering the red PEAK indicator box and causing harsh analog saturation and digital clipping distortion.",
      actionTask: "Drag the red GAIN knob between -20dB and +20dB while audio is playing. Notice how turning it all the way up triggers the glowing red PEAK box to warn of preamp overload!",
      proTip: "Set gain during sound check so the loudest transient hits peak around 0 to +6 on the meter, leaving plenty of headroom without ever lighting the red PEAK box."
    },
    {
      step: 2,
      title: "Utility Buttons",
      subtitle: "Conditioning the raw electrical signal before it reaches any equalization.",
      summary: "Directly below the input jack are essential hardware switches that configure electrical power, input impedance, and low-frequency filtering.",
      mechanics: "• +48V Phantom Power: Delivers 48V DC through the XLR cable to polarize active condenser microphone capsules and power active DI boxes. Dynamic mics (like Shure SM58) don't need it.\n• Hi-Z (High Impedance): Shifts input impedance to ~1MΩ so passive electric guitar and bass pickups aren't loaded down ('tone suck').\n• 100Hz Low Cut (HPF): An 18dB/octave high-pass filter that cleans out stage footstep thumps, AC hum, and microphone handling rumble.",
      actionTask: "Toggle the 100Hz LOW CUT button while listening to White Noise or Drums. Notice how the bottom-end weight immediately tightens up!",
      proTip: "Engage the 100Hz Low Cut on every single channel except Kick Drum and Bass Guitar to prevent muddy low-end buildup in your subwoofer system."
    },
    {
      step: 3,
      title: "Equalization",
      subtitle: "Sculpting the tonal balance of each sound source to sit harmoniously in the mix.",
      summary: "The 3-band EQ gives you frequency-shaping power: a Low shelf at 80Hz, a sweepable semi-parametric Mid peaking filter (100Hz to 8kHz, center frequency 2.5kHz default), and a High shelf at 10kHz.",
      mechanics: "• LOW (80Hz Shelf): Boosts deep thump or cleans bottom-end mud.\n• MID FREQ (100Hz - 8kHz): Sweeps the center target frequency across the critical midrange audio spectrum.\n• MID GAIN (-15dB to +15dB): Boosts or cuts the selected mid frequency. Ideal for carving out boxiness (300Hz-600Hz) or boosting vocal clarity (2.5kHz-4kHz).\n• HIGH (10kHz Shelf): Adds silky air and cymbal sheen, or tames harsh sibilance.",
      actionTask: "Listen to the White Noise or Drum stem while sweeping the MID FREQ knob with MID GAIN boosted. Hear how the resonant frequency glides across the spectrum!",
      proTip: "Cut before you boost. Instead of boosting highs and lows to make a track louder, cut muddy midrange frequencies to create space in your mix."
    },
    {
      step: 4,
      title: "Aux / Monitor Send & Master FX Processor",
      subtitle: "Creating independent stage monitor mixes and feeding reverb/delay effects.",
      summary: "Aux (Auxiliary) and FX sends allow you to branch copies of the audio off the channel strip to different destinations.",
      mechanics: "• Aux 1 (MON) is Pre-Fader: This means the monitor send is tapped BEFORE the channel fader. When you move the main channel fader to adjust the Front of House (FOH) volume for the audience, the musician's stage wedge or in-ear monitor (IEM) mix NEVER changes!\n• FX Send is Post-Fader: This is tapped AFTER the channel fader. When you pull the fader down, the reverb/delay send fades down with it, avoiding awkward lingering 'ghost' reverb from silenced channels.\n• Master FX Section: Receives all channel FX sends into professional Plate Reverb, Concert Hall, Tap Tempo Delay, or Stereo Chorus, returned via the FX Return control.",
      actionTask: "Turn up the FX SEND knob to 0 dB, then adjust the Master FX Return in the master section to hear rich studio plate reverb bloom!",
      proTip: "Never use post-fader sends for performer stage monitors, and never use pre-fader sends for reverbs."
    },
    {
      step: 5,
      title: "Stereo Panning (Pan Law & Spatial Placement)",
      subtitle: "Placing instruments across the stereo soundstage from Left to Right.",
      summary: "The PAN (Panoramic Potentiometer) control divides the channel's signal between the Left and Right master summing buses.",
      mechanics: "The mixer uses an industry-standard constant-power pan law: in the center position, both speakers receive equal power. Turning the knob left attenuates the right speaker, smoothly panning the perceived acoustic image.",
      actionTask: "Rotate the yellow PAN knob from Hard Left to Hard Right. Listen to how white noise or music glides cleanly between your headphones/monitors!",
      proTip: "Keep Kick Drum, Bass Guitar, Snare, and Lead Vocals dead center for punch and subwoofer efficiency. Pan guitars, synths, and backing vocals wide for stereo dimension."
    },
    {
      step: 6,
      title: "Mute & Solo Isolation",
      subtitle: "Instantly cutting channels or isolating tracks for focused troubleshooting.",
      summary: "The MUTE and SOLO buttons are your primary diagnostic switches during rehearsal and live performance.",
      mechanics: "• MUTE: Silences the channel immediately from the Main Mix bus, preventing unwanted microphone bleed or feedback when an instrument is not being played.\n• SOLO: Isolates only the selected channel(s) in playback, muting all non-soloed channels. You can solo multiple channels together (e.g. Kick + Bass) to inspect their rhythm groove in complete isolation.",
      actionTask: "Click the SOLO button on Channel 1. Notice how the amber SOLO LED lights up, isolating Channel 1 so no other channels interfere!",
      proTip: "Always mute open microphones when musicians leave the stage to prevent sudden feedback screech."
    },
    {
      step: 7,
      title: "Channel Fader",
      subtitle: "The primary volume control balancing this channel in the overall mix.",
      summary: "The channel fader is a long-throw linear potentiometer (60mm on compact consoles, 100mm on touring consoles) that determines how much signal feeds the stereo master bus.",
      mechanics: "Audio faders use a logarithmic taper matching human hearing: the fader provides high resolution around the 0 dB 'Unity' mark (a 1cm physical movement changes volume by only ~2dB), while at the bottom of the track a small movement drops volume rapidly to -infinity.",
      actionTask: "Move the channel fader up and down. Double-click the slider handle to immediately snap it back to 0.0 dB Unity!",
      proTip: "If your channel fader has to sit at -30 dB or +10 dB to get a balanced volume, your initial input Preamp Gain was set incorrectly. Re-adjust Gain so your faders can ride comfortably near 0 dB."
    },
    {
      step: 8,
      title: "Main Mix Master Section & FOH Summing Bus",
      subtitle: "Summing all channels together into the final stereo mix for the audience.",
      summary: "The Master section is where all individual channels, Aux returns, and FX returns combine into a single stereo signal feeding the PA system.",
      mechanics: "The Main Fader sets the overall volume sent to the main speakers. The Master VU Meters display Left and Right peak and RMS audio levels. If both meters flash RED continuously, the master summing bus is clipping and the master fader must be pulled down.",
      actionTask: "Inspect the Master Section on the left. Move the red Main Mix Master Fader up and down to observe how the stereo summing bus and master VU meters respond to master output volume!",
      proTip: "Always leave your master fader at 0 dB (Unity) and balance individual channel faders against it for optimal dynamic range and signal-to-noise ratio."
    },
    {
      step: 9,
      title: "Analog vs. Digital Consoles (Why the Workflow Changes)",
      subtitle: "Comparing 'One-Knob-Per-Function' hardware with modern digital touch screens.",
      summary: "Understanding why digital mixers look and feel different from classic analog mixing boards.",
      mechanics: "• Analog Consoles: Feature physical knobs and switches for every single control on every channel. What you see is what you get—fast, tactile, but physically huge and limited to fixed routing.\n• Digital Consoles: Use motorized faders and assignable layers. Selecting a channel displays its expanded digital processing bay on a central touchscreen with full visual parametric EQ curves, real-time spectrum analyzers (RTA), digital dynamics (compressor/gate), and instant scene recall.",
      actionTask: "Click and drag the circular EQ nodes (LOW, MID, HIGH) directly on the digital touchscreen graph to sculpt the frequency curve and observe how the live RTA spectrum adapts!",
      proTip: "In modern touring, digital consoles allow engineers to save entire concert mixes onto a USB drive and recall 100+ channels on any board in seconds."
    },
    {
      step: 10,
      title: "Signal Flow (The Audio Journey from Input to PA)",
      subtitle: "The master blueprint: tracing how sound moves through every circuit.",
      summary: "Signal Flow is the single most important concept in audio engineering. It is the exact sequence audio follows through the mixer.",
      mechanics: "Input Jack ➔ Preamp Gain ➔ Phantom Power / Hi-Z ➔ 100Hz Low Cut ➔ 3-Band EQ ➔ [Pre-Fade Tap for Aux/Mon] ➔ Mute Switch ➔ Solo Bus ➔ Pan Pot ➔ Channel Fader ➔ [Post-Fade Tap for FX] ➔ Master Bus ➔ Main Fader ➔ PA Speakers.\nWhen an issue occurs (e.g. distortion, missing vocal, feedback), tracing this flow step-by-step pinpoints the problem in seconds.",
      actionTask: "Click 'OPEN SIGNAL FLOW' to launch the interactive Signal Flow HUD and inspect the live route of your audio!",
      proTip: "Whenever there's no sound, check Signal Flow from the beginning: 1) Cable, 2) Gain & 48V, 3) EQ cuts, 4) Mute & Solo, 5) Channel Fader, 6) Master Fader."
    }
  ];

  const currentStepData = stepsInfo[currentStep - 1];

  // Helper to render the exact Channel 1 Strip from the mixer console
  const renderChannel1Strip = () => {
    const isGainHot = ch.gain >= 16;
    const isClipping = meter.clipped || isGainHot;

    return (
      <div className="w-36 flex flex-col bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-lg p-1.5 gap-1.5 shadow-xl relative">
        {/* Channel Strip Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-1">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-cyan-400 font-bold">
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
              markStepComplete(10);
            }}
            className="px-1 py-0.5 rounded bg-zinc-800 hover:bg-cyan-950 hover:text-cyan-400 text-zinc-400 text-[8px] font-mono border border-zinc-700 transition-colors"
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
        </div>

        {/* 3-Band EQ Section (Spotlighted on Step 3) */}
        <div
          className={`flex flex-col items-center gap-1 bg-zinc-950/40 p-1 rounded border transition-all ${
            currentStep === 3
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

        {/* Aux & FX Sends (Spotlighted on Step 4) */}
        <div
          className={`flex flex-col items-center gap-1 bg-zinc-950/40 p-1 rounded border transition-all ${
            currentStep === 4
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

        {/* Pan (-64 to +64 DAW coding, Spotlighted on Step 5) */}
        <div
          className={`flex flex-col items-center bg-zinc-950/40 p-1 rounded border transition-all ${
            currentStep === 5
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

        {/* Mute & Solo (Spotlighted on Step 6) */}
        <div
          className={`grid grid-cols-2 gap-1 p-0.5 rounded transition-all ${
            currentStep === 6 ? 'ring-2 ring-rose-500/60 bg-rose-950/20' : ''
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

        {/* Fader & Meter (Spotlighted on Step 7) */}
        <div
          className={`flex items-center justify-between bg-zinc-950 p-1.5 rounded border h-48 transition-all ${
            currentStep === 7
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
          <MeterLadder
            level={meter.level}
            clipped={isClipping}
            height={160}
            width={6}
          />
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

  // Helper to render the exact Master Section from the mixer console (Switched to on Step 8)
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

          {/* FX Type Selector */}
          <div className="grid grid-cols-4 gap-1">
            {(['plate', 'hall', 'delay', 'chorus'] as const).map((type) => (
              <button
                key={type}
                onClick={() => handleMasterField('fxType', type)}
                className={`text-[8px] font-mono uppercase py-1 rounded border transition-colors ${
                  master.fxType === type
                    ? 'bg-purple-600 text-white border-purple-400'
                    : 'bg-zinc-850 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Effect Description Tag */}
          <div className="text-[8px] font-mono text-center text-zinc-400 py-0.5 bg-zinc-900/90 rounded border border-zinc-850">
            {master.fxType === 'plate' && 'LUSH EMT 140 STEEL PLATE (2.0s)'}
            {master.fxType === 'hall' && 'CONCERT HALL BLOOM (3.4s)'}
            {master.fxType === 'delay' && `${delayInfo.delayMs}ms · ${delayInfo.bpm} BPM`}
            {master.fxType === 'chorus' && `DUAL LFO STEREO SHIMMER (${Math.round(master.chorusIntensity ?? 50)}%)`}
          </div>

          {/* Chorus Intensity Control */}
          {master.fxType === 'chorus' && (
            <div className="flex flex-col items-center justify-center p-1.5 bg-zinc-900/60 rounded border border-zinc-850 gap-0.5">
              <Knob
                label="INTENSITY"
                value={master.chorusIntensity ?? 50}
                min={0}
                max={100}
                step={1}
                color="purple"
                size="sm"
                unit="%"
                defaultValue={50}
                formatValue={(v) => `${Math.round(v)}%`}
                onChange={(v) => {
                  handleMasterField('chorusIntensity', v);
                  audioEngine.setChorusIntensity(v);
                }}
              />
              <div className="flex items-center justify-between w-full px-1.5 text-[7px] font-mono text-zinc-400">
                <span>SUBTLE</span>
                <span className="text-purple-300 font-bold">{Math.round(master.chorusIntensity ?? 50)}%</span>
                <span>DEEP</span>
              </div>
            </div>
          )}

          {/* Tap Tempo for Delay */}
          {master.fxType === 'delay' && (
            <div className="flex flex-col gap-1 pt-0.5">
              <button
                onClick={handleTap}
                className={`w-full text-[9px] font-mono py-1.5 rounded font-bold transition-all border ${
                  tapFlash
                    ? 'bg-purple-500 text-white border-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.8)] scale-[0.98]'
                    : 'bg-purple-950 hover:bg-purple-900 text-purple-300 border-purple-700'
                }`}
                title="Click rhythmically to set delay tempo"
              >
                TAP TEMPO · {delayInfo.delayMs}ms ({delayInfo.bpm} BPM)
              </button>
              <input
                type="range"
                min={80}
                max={1200}
                step={10}
                value={delayInfo.delayMs}
                onChange={(e) => {
                  const delayMs = parseInt(e.target.value, 10);
                  const sec = delayMs / 1000;
                  audioEngine.setDelayTime(sec);
                  setDelayInfo({ delayMs, bpm: Math.round(60 / sec) });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  audioEngine.setDelayTime(0.375);
                  setDelayInfo({ delayMs: 375, bpm: 160 });
                }}
                title="Double-click to reset to default 375ms (160 BPM)"
                className="w-full accent-purple-500 cursor-pointer h-1"
              />
            </div>
          )}
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

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-4 pb-12">
      {/* Top Learning Academy Header */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-cyan-950/40 p-4 rounded-xl border border-zinc-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-400 font-mono font-bold text-lg shadow-[0_0_15px_rgba(6,182,212,0.4)]">
            {currentStep}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                MIXER LAB ACADEMY // STEP {currentStep} OF 10
              </span>
              {completedSteps[currentStep] && (
                <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                  ✓ COMPLETED
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-zinc-100 font-mono tracking-tight mt-0.5">
              {currentStepData.title}
            </h2>
          </div>
        </div>

        {/* Audio Test Source Controller */}
        <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded-lg border border-zinc-850 text-xs font-mono">
          <span className="text-zinc-400 text-[10px] uppercase font-bold pl-1 hidden sm:inline">
            TEST AUDIO:
          </span>
          <button
            onClick={() => setNoiseSource('white_noise')}
            className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
              activeAudioSource === 'white_noise'
                ? 'bg-cyan-500 text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
            title="White Noise: Flat spectrum across all audible frequencies, ideal for hearing filters and EQ"
          >
            WHITE NOISE
          </button>
          <button
            onClick={() => setNoiseSource('pink_noise')}
            className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
              activeAudioSource === 'pink_noise'
                ? 'bg-pink-500 text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
            title="Pink Noise: Balanced acoustic energy per octave"
          >
            PINK NOISE
          </button>
          <button
            onClick={() => setNoiseSource('song')}
            className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
              activeAudioSource === 'song'
                ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
            title="Channel 1 Multitrack Stem"
          >
            DRUM STEM
          </button>

          {/* Quick Play/Pause */}
          <button
            onClick={isPlaying ? onPause : onPlay}
            className={`px-2.5 py-1 rounded font-bold text-xs flex items-center gap-1 transition-all ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isPlaying ? '❚❚ PAUSE' : '▶ PLAY'}
          </button>
        </div>
      </div>

      {/* Progress Chips Step Bar (Always navigable by clicking) */}
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
        {stepsInfo.map((s) => {
          const isCurrent = s.step === currentStep;
          const isDone = completedSteps[s.step];
          return (
            <button
              key={s.step}
              onClick={() => setCurrentStep(s.step)}
              className={`p-1.5 rounded-lg border text-center font-mono text-[10px] transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                isCurrent
                  ? 'bg-cyan-500 text-zinc-950 font-bold border-cyan-400 shadow-md ring-1 ring-cyan-400'
                  : isDone
                  ? 'bg-emerald-950/30 text-emerald-300 border-emerald-800/60 hover:border-emerald-700'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              <span className="text-[9px] opacity-75">STEP {s.step}</span>
              <span className="truncate w-full font-bold">
                {s.step === 1 && "Gain"}
                {s.step === 2 && "Buttons"}
                {s.step === 3 && "EQ"}
                {s.step === 4 && "Aux & FX"}
                {s.step === 5 && "Pan"}
                {s.step === 6 && "Mute/Solo"}
                {s.step === 7 && "Fader"}
                {s.step === 8 && "Master"}
                {s.step === 9 && "Digital"}
                {s.step === 10 && "Flow"}
              </span>
            </button>
          );
        })}
      </div>

      {/* MAIN INTERACTIVE STAGE */}
      {currentStep === 9 ? (
        /* STEP 9: RE-ORIENTED FULL-WIDTH DIGITAL VS ANALOG CONSOLE COMPARISON */
        <div className="flex flex-col gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-xl flex flex-col gap-4">
            {/* Step Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                  CHAPTER 9: {currentStepData.title}
                </span>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {currentStepData.subtitle}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrev}
                  className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-mono text-xs font-bold transition-colors cursor-pointer"
                >
                  ← PREV
                </button>
                <button
                  onClick={handleNext}
                  disabled={!isCurrentStepCompleted}
                  className={`px-3 py-1 rounded font-mono text-xs font-bold transition-all shadow-sm ${
                    isCurrentStepCompleted
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-zinc-950 cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                      : 'bg-zinc-800 text-zinc-500 opacity-40 cursor-not-allowed'
                  }`}
                  title={isCurrentStepCompleted ? 'Proceed to next step' : 'Complete the Hands-On Lab Task to enable'}
                >
                  NEXT →
                </button>
              </div>
            </div>

            {/* Core Explanation Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-zinc-300 text-xs leading-relaxed">
              <div className="bg-zinc-950/70 p-3 rounded-lg border border-zinc-850">
                <h4 className="font-mono font-bold text-zinc-100 text-xs mb-1 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                  Why The Console Layout Transforms:
                </h4>
                <p>{currentStepData.summary}</p>
              </div>

              <div className="bg-zinc-950/70 p-3 rounded-lg border border-zinc-850 whitespace-pre-line">
                <h4 className="font-mono font-bold text-zinc-100 text-xs mb-1 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  Tactile Knobs vs. Digital Processing Bays:
                </h4>
                <p>{currentStepData.mechanics}</p>
              </div>
            </div>

            {/* Hands-On Lab Task */}
            <div className="bg-cyan-950/30 border border-cyan-800/60 p-3.5 rounded-lg flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  isCurrentStepCompleted ? 'bg-emerald-500 text-zinc-950' : 'bg-amber-500 text-zinc-950 animate-pulse'
                }`}>
                  {isCurrentStepCompleted ? '✓ LAB TASK COMPLETE' : 'ACTION REQUIRED'}
                </span>
                <span className="text-xs font-bold text-cyan-300 font-mono">
                  {isCurrentStepCompleted ? 'Digital EQ adjusted! Ready to continue to Step 10.' : 'Manipulate the EQ on the digital screen below to unlock Next:'}
                </span>
              </div>
              <p className="text-xs text-zinc-200">
                {currentStepData.actionTask}
              </p>
            </div>

            {/* View Selector Tabs */}
            <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-zinc-400">
                  ACTIVE DISPLAY MODE:
                </span>
                <button
                  onClick={() => {
                    setStep9View('digital');
                    onToggleConsoleView('digital');
                  }}
                  className={`px-3 py-1.5 rounded font-mono text-xs font-bold transition-all cursor-pointer ${
                    step9View === 'digital'
                      ? 'bg-cyan-500 text-zinc-950 shadow-md ring-1 ring-cyan-400'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-750'
                  }`}
                >
                  DIGITAL CONSOLE (TOUCHSCREEN PROCESSING BAY)
                </button>
                <button
                  onClick={() => {
                    setStep9View('analog');
                    onToggleConsoleView('analog');
                  }}
                  className={`px-3 py-1.5 rounded font-mono text-xs font-bold transition-all cursor-pointer ${
                    step9View === 'analog'
                      ? 'bg-amber-500 text-zinc-950 shadow-md ring-1 ring-amber-400'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-750'
                  }`}
                >
                  ANALOG CHANNEL STRIP (PHYSICAL KNOBS)
                </button>
              </div>

              <div className="text-[11px] font-mono text-zinc-400 hidden sm:block">
                Interactive Multi-touch RTA & Encoders
              </div>
            </div>

            {/* Re-oriented Interactive Display Box */}
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
                        markStepComplete(9);
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

            {/* Bottom Progress Tracker */}
            <div className="flex items-center justify-between border-t border-zinc-800 pt-3 text-xs font-mono text-zinc-400">
              <span>Step 9 of 10</span>
              <button
                onClick={handleNext}
                disabled={!isCurrentStepCompleted}
                className={`font-bold transition-colors cursor-pointer ${
                  isCurrentStepCompleted
                    ? 'text-cyan-400 hover:text-cyan-300'
                    : 'text-zinc-600 cursor-not-allowed'
                }`}
              >
                {isCurrentStepCompleted ? 'I Understand Now! Next →' : '🔒 Complete Lab Task to Continue'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* STEPS 1 TO 8 & 10: 2-COLUMN LAYOUT (Hardware Strip on Left, Pedagogy on Right) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT COLUMN: Hardware Strip (Switches to Master Section on Step 8) */}
          <div className="lg:col-span-5 flex flex-col items-center gap-2">
            <div className="w-full flex items-center justify-between px-1">
              <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wide">
                {currentStep === 8 ? 'MASTER CONSOLE SECTION' : 'CHANNEL STRIP 1 (LABORATORY)'}
              </span>
              <span className="text-[10px] font-mono text-cyan-400">
                Live Audio Engine Active
              </span>
            </div>

            {/* The Hardware Section: Step 8 switches to Master Section, others render Channel 1 */}
            {currentStep === 8 ? renderMasterSection() : renderChannel1Strip()}
          </div>

          {/* RIGHT COLUMN: Detailed Pedagogy, Step Explanations, Hands-on Lab Task */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-xl flex flex-col gap-4">
              {/* Step Header & Navigation */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div>
                  <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                    CHAPTER {currentStep}: {currentStepData.title}
                  </span>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {currentStepData.subtitle}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrev}
                    disabled={currentStep === 1}
                    className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-750 disabled:opacity-30 disabled:hover:bg-zinc-800 text-zinc-300 font-mono text-xs font-bold transition-colors cursor-pointer"
                  >
                    ← PREV
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!isCurrentStepCompleted}
                    className={`px-3 py-1 rounded font-mono text-xs font-bold transition-all shadow-sm ${
                      isCurrentStepCompleted
                        ? 'bg-cyan-500 hover:bg-cyan-400 text-zinc-950 cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                        : 'bg-zinc-800 text-zinc-500 opacity-40 cursor-not-allowed'
                    }`}
                    title={
                      currentStep === 10
                        ? 'Go to Mix Console'
                        : isCurrentStepCompleted
                        ? 'Proceed to next step'
                        : 'Complete the Hands-On Lab Task to enable Next'
                    }
                  >
                    {currentStep === 10 ? 'GO TO MIX CONSOLE →' : 'NEXT →'}
                  </button>
                </div>
              </div>

              {/* Core Explanation Box */}
              <div className="flex flex-col gap-2.5 text-zinc-300 text-xs leading-relaxed">
                <div className="bg-zinc-950/70 p-3 rounded-lg border border-zinc-850">
                  <h4 className="font-mono font-bold text-zinc-100 text-xs mb-1 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                    What It Is & Why It Matters:
                  </h4>
                  <p>{currentStepData.summary}</p>
                </div>

                <div className="bg-zinc-950/70 p-3 rounded-lg border border-zinc-850 whitespace-pre-line">
                  <h4 className="font-mono font-bold text-zinc-100 text-xs mb-1 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    How It Operates Internally:
                  </h4>
                  <p>{currentStepData.mechanics}</p>
                </div>
              </div>

              {/* Action Task (Hands-on Exploration with unlock requirement) */}
              <div className="bg-cyan-950/30 border border-cyan-800/60 p-3.5 rounded-lg flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    isCurrentStepCompleted ? 'bg-emerald-500 text-zinc-950' : 'bg-amber-500 text-zinc-950 animate-pulse'
                  }`}>
                    {isCurrentStepCompleted ? '✓ LAB TASK COMPLETE' : 'ACTION REQUIRED'}
                  </span>
                  <span className="text-xs font-bold text-cyan-300 font-mono">
                    {isCurrentStepCompleted ? 'Requirement met! You can now proceed.' : 'Perform this action on the mixer to unlock Next:'}
                  </span>
                </div>
                <p className="text-xs text-zinc-200">
                  {currentStepData.actionTask}
                </p>
              </div>

              {/* Pro Audio Engineering Tip */}
              <div className="bg-amber-950/20 border border-amber-800/40 p-3 rounded-lg flex items-start gap-2.5">
                <span className="text-amber-400 text-base">💡</span>
                <div>
                  <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wide block">
                    PRO ENGINEER'S GOLDEN RULE
                  </span>
                  <p className="text-xs text-zinc-300 mt-0.5">
                    {currentStepData.proTip}
                  </p>
                </div>
              </div>

              {/* STEP 4: EXACT MASTER FX SECTION COMPANION (Matching AnalogConsole.tsx) */}
              {currentStep === 4 && (
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

                  {/* FX Type Selector */}
                  <div className="grid grid-cols-4 gap-1">
                    {(['plate', 'hall', 'delay', 'chorus'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => handleMasterField('fxType', type)}
                        className={`text-[8px] font-mono uppercase py-1 rounded border transition-colors cursor-pointer ${
                          master.fxType === type
                            ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                            : 'bg-zinc-850 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  {/* Effect Description Tag */}
                  <div className="text-[8px] font-mono text-center text-zinc-400 py-0.5 bg-zinc-900/90 rounded border border-zinc-850">
                    {master.fxType === 'plate' && 'LUSH EMT 140 STEEL PLATE (2.0s)'}
                    {master.fxType === 'hall' && 'CONCERT HALL BLOOM (3.4s)'}
                    {master.fxType === 'delay' && `${delayInfo.delayMs}ms · ${delayInfo.bpm} BPM`}
                    {master.fxType === 'chorus' && `DUAL LFO STEREO SHIMMER (${Math.round(master.chorusIntensity ?? 50)}%)`}
                  </div>

                  {/* Chorus Intensity Control */}
                  {master.fxType === 'chorus' && (
                    <div className="flex flex-col items-center justify-center p-1.5 bg-zinc-900/60 rounded border border-zinc-850 gap-0.5">
                      <Knob
                        label="INTENSITY"
                        value={master.chorusIntensity ?? 50}
                        min={0}
                        max={100}
                        step={1}
                        color="purple"
                        size="sm"
                        unit="%"
                        defaultValue={50}
                        formatValue={(v) => `${Math.round(v)}%`}
                        onChange={(v) => {
                          handleMasterField('chorusIntensity', v);
                          audioEngine.setChorusIntensity(v);
                        }}
                      />
                      <div className="flex items-center justify-between w-full px-1.5 text-[7px] font-mono text-zinc-400">
                        <span>SUBTLE</span>
                        <span className="text-purple-300 font-bold">{Math.round(master.chorusIntensity ?? 50)}%</span>
                        <span>DEEP</span>
                      </div>
                    </div>
                  )}

                  {/* Tap Tempo for Delay */}
                  {master.fxType === 'delay' && (
                    <div className="flex flex-col gap-1 pt-0.5">
                      <button
                        onClick={handleTap}
                        className={`w-full text-[9px] font-mono py-1.5 rounded font-bold transition-all border cursor-pointer ${
                          tapFlash
                            ? 'bg-purple-500 text-white border-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.8)] scale-[0.98]'
                            : 'bg-purple-950 hover:bg-purple-900 text-purple-300 border-purple-700'
                        }`}
                        title="Click rhythmically to set delay tempo"
                      >
                        TAP TEMPO · {delayInfo.delayMs}ms ({delayInfo.bpm} BPM)
                      </button>
                      <input
                        type="range"
                        min={80}
                        max={1200}
                        step={10}
                        value={delayInfo.delayMs}
                        onChange={(e) => {
                          const delayMs = parseInt(e.target.value, 10);
                          const sec = delayMs / 1000;
                          audioEngine.setDelayTime(sec);
                          setDelayInfo({ delayMs, bpm: Math.round(60 / sec) });
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          audioEngine.setDelayTime(0.375);
                          setDelayInfo({ delayMs: 375, bpm: 160 });
                        }}
                        title="Double-click to reset to default 375ms (160 BPM)"
                        className="w-full accent-purple-500 cursor-pointer h-1"
                      />
                    </div>
                  )}

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

              {/* STEP 10: SIGNAL FLOW HUD LAUNCHER */}
              {currentStep === 10 && (
                <div className="bg-zinc-950 p-4 rounded-lg border border-cyan-400 flex flex-col gap-2.5">
                  <span className="text-xs font-mono font-bold text-cyan-400">
                    INTERACTIVE SIGNAL FLOW HUD:
                  </span>
                  <p className="text-xs text-zinc-300">
                    Open the live Signal Flow modal to inspect how audio flows sequentially through every stage of the mixer:
                  </p>
                  <button
                    onClick={() => {
                      onOpenFlow(ch.id, ch.name);
                      markStepComplete(10);
                      if (onCompleteLearn) onCompleteLearn();
                    }}
                    className="px-4 py-2.5 rounded bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-mono font-extrabold text-xs shadow-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-zinc-950 animate-ping"></span>
                    OPEN SIGNAL FLOW DIAGRAM
                  </button>
                </div>
              )}

              {/* Bottom Progress Tracker & Unlock Indicator */}
              <div className="flex items-center justify-between border-t border-zinc-800 pt-3 text-xs font-mono text-zinc-400">
                <span>Step {currentStep} of 10</span>
                <button
                  onClick={handleNext}
                  disabled={!isCurrentStepCompleted}
                  className={`font-bold transition-colors cursor-pointer ${
                    isCurrentStepCompleted
                      ? 'text-cyan-400 hover:text-cyan-300'
                      : 'text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  {currentStep === 10
                    ? isCurrentStepCompleted
                      ? 'Go to Mix Console →'
                      : '🔒 Open Flow to Complete'
                    : isCurrentStepCompleted
                    ? 'I Understand Now! Next →'
                    : '🔒 Complete Lab Task to Continue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
