import { ChannelSettings, MasterSettings } from '../types/audio';
import { generateSyntheticSongStems, BUILTIN_SONGS } from './stemSynthesizer';

export interface ChannelNodes {
  preampGain: GainNode;
  saturator: WaveShaperNode;
  hizFilter: BiquadFilterNode;
  phantomGain: GainNode;
  lowCut: BiquadFilterNode;
  lowCut2: BiquadFilterNode;
  phaseGain: GainNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  preFadeTap: GainNode;
  aux1Send: GainNode;
  muteGain: GainNode;
  soloGain: GainNode;
  panner: StereoPannerNode;
  channelFader: GainNode;
  postFadeTap: GainNode;
  fxSend: GainNode;
  postFaderOut: GainNode;
  analyser: AnalyserNode;
  rtaAnalyser: AnalyserNode;
  pflAnalyser: AnalyserNode;
  peakAnalyser: AnalyserNode;
  sourceNode: AudioBufferSourceNode | null;
}

export class AudioEngine {
  public ctx: AudioContext | null = null;
  public channels: ChannelNodes[] = [];
  public channelSettings: ChannelSettings[] = [];
  public currentSongId: string = 'song1';
  public stemBuffers: AudioBuffer[] = [];
  public isPlaying: boolean = false;
  public isLooping: boolean = true;
  public startTime: number = 0;
  public pauseOffset: number = 0;
  public loopDuration: number = 8.0;

  // Master nodes
  public masterFader: GainNode | null = null;
  public masterAnalyserL: AnalyserNode | null = null;
  public masterAnalyserR: AnalyserNode | null = null;
  public masterSplitter: ChannelSplitterNode | null = null;
  public aux1MasterGain: GainNode | null = null;
  public aux1Analyser: AnalyserNode | null = null;
  public phonesGain: GainNode | null = null;

  // DSP FX Multi-Processor
  public fxBusGain: GainNode | null = null;
  public fxReturnGain: GainNode | null = null;
  public fxMuteGain: GainNode | null = null;
  public currentFxType: 'plate' | 'hall' | 'delay' | 'chorus' = 'plate';

  // Plate Reverb nodes
  public plateSendGain: GainNode | null = null;
  public plateConvolver: ConvolverNode | null = null;
  public plateFilter: BiquadFilterNode | null = null;

  // Hall Reverb nodes
  public hallSendGain: GainNode | null = null;
  public hallConvolver: ConvolverNode | null = null;
  public hallFilter: BiquadFilterNode | null = null;

  // Delay nodes
  public delaySendGain: GainNode | null = null;
  public fxDelayNode: DelayNode | null = null;
  public fxFeedbackGain: GainNode | null = null;
  public fxFilterNode: BiquadFilterNode | null = null;
  public currentDelayTime: number = 0.375; // 375ms (160 BPM / dotted eighth at 120)
  private tapHistory: number[] = [];

  // Chorus nodes
  public chorusSendGain: GainNode | null = null;
  public chorusDelayNode: DelayNode | null = null;
  public chorusLfo: OscillatorNode | null = null;
  public chorusLfoGain: GainNode | null = null;
  public chorusFilterNode: BiquadFilterNode | null = null;
  public chorusFeedbackGain: GainNode | null = null;
  public currentChorusIntensity: number = 50; // 0 to 100%

  // Feedback simulator nodes
  public feedbackGain: GainNode | null = null;
  public feedbackFilter: BiquadFilterNode | null = null;

  // Phantom power enforcement for troubleshooting scenarios & drills
  public enforcePhantomPower: boolean = false;

  public setEnforcePhantomPower(val: boolean) {
    this.enforcePhantomPower = val;
  }

  // Isolated channel playback for Learn section (plays only specified channel e.g. Channel 1)
  public isolatedChannel: number | null = null;

  public setIsolatedChannel(channel: number | null) {
    this.isolatedChannel = channel;
    this.updateSoloState();
  }

  // Clip state trackers (1.5 second hold)
  public channelClipTimes: number[] = [0, 0, 0, 0, 0, 0];
  public masterClipTime: number = 0;

  constructor() {
    // Lazy initialized on first user gesture
  }

  public init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();

    this.setupMasterNodes();
    this.setupFeedbackSimulator();
    this.setupChannels();
    this.loadSong(this.currentSongId);
  }

  private setupMasterNodes() {
    if (!this.ctx) return;

    // Master Bus
    this.masterFader = this.ctx.createGain();
    this.masterFader.gain.value = 1.0; // 0 dB

    this.masterSplitter = this.ctx.createChannelSplitter(2);
    this.masterAnalyserL = this.ctx.createAnalyser();
    this.masterAnalyserR = this.ctx.createAnalyser();
    this.masterAnalyserL.fftSize = 128;
    this.masterAnalyserL.smoothingTimeConstant = 0.0;
    this.masterAnalyserR.fftSize = 128;
    this.masterAnalyserR.smoothingTimeConstant = 0.0;

    this.masterFader.connect(this.masterSplitter);
    this.masterSplitter.connect(this.masterAnalyserL, 0);
    this.masterSplitter.connect(this.masterAnalyserR, 1);

    // Phones / Control Room
    this.phonesGain = this.ctx.createGain();
    this.phonesGain.gain.value = 0.8;
    this.masterFader.connect(this.phonesGain);
    this.phonesGain.connect(this.ctx.destination);

    // Aux 1 Master Bus
    this.aux1MasterGain = this.ctx.createGain();
    this.aux1MasterGain.gain.value = 1.0;
    this.aux1Analyser = this.ctx.createAnalyser();
    this.aux1Analyser.fftSize = 128;
    this.aux1Analyser.smoothingTimeConstant = 0.0;
    this.aux1MasterGain.connect(this.aux1Analyser);

    // FX Master Return & Mute
    this.fxBusGain = this.ctx.createGain();
    this.fxReturnGain = this.ctx.createGain();
    this.fxReturnGain.gain.value = 0.7;
    this.fxMuteGain = this.ctx.createGain();
    this.fxMuteGain.gain.value = 1.0;
    this.fxReturnGain.connect(this.fxMuteGain);
    this.fxMuteGain.connect(this.masterFader);

    // 1. Plate Reverb Engine (Authentic Shimmering Steel Plate Diffusion)
    this.plateSendGain = this.ctx.createGain();
    this.plateSendGain.gain.value = 1.0;
    this.plateConvolver = this.ctx.createConvolver();
    this.plateConvolver.buffer = this.createPlateImpulseResponse(this.ctx);
    this.plateFilter = this.ctx.createBiquadFilter();
    this.plateFilter.type = 'highpass';
    this.plateFilter.frequency.value = 180;

    this.fxBusGain.connect(this.plateSendGain);
    this.plateSendGain.connect(this.plateFilter);
    this.plateFilter.connect(this.plateConvolver);
    this.plateConvolver.connect(this.fxReturnGain);

    // 2. Hall Reverb Engine (Spacious Concert Hall with Air Absorption Damping)
    this.hallSendGain = this.ctx.createGain();
    this.hallSendGain.gain.value = 0.0;
    this.hallConvolver = this.ctx.createConvolver();
    this.hallConvolver.buffer = this.createHallImpulseResponse(this.ctx);
    this.hallFilter = this.ctx.createBiquadFilter();
    this.hallFilter.type = 'lowpass';
    this.hallFilter.frequency.value = 4500;

    this.fxBusGain.connect(this.hallSendGain);
    this.hallSendGain.connect(this.hallFilter);
    this.hallFilter.connect(this.hallConvolver);
    this.hallConvolver.connect(this.fxReturnGain);

    // 3. Dedicated Warm Analog Delay Engine (Responsive Tap Tempo)
    this.delaySendGain = this.ctx.createGain();
    this.delaySendGain.gain.value = 0.0;
    this.fxDelayNode = this.ctx.createDelay(2.5);
    this.fxDelayNode.delayTime.value = this.currentDelayTime;
    this.fxFeedbackGain = this.ctx.createGain();
    this.fxFeedbackGain.gain.value = 0.44;
    this.fxFilterNode = this.ctx.createBiquadFilter();
    this.fxFilterNode.type = 'lowpass';
    this.fxFilterNode.frequency.value = 4200;
    const delayHp = this.ctx.createBiquadFilter();
    delayHp.type = 'highpass';
    delayHp.frequency.value = 130;

    this.fxBusGain.connect(this.delaySendGain);
    this.delaySendGain.connect(this.fxDelayNode);
    this.fxDelayNode.connect(this.fxFilterNode);
    this.fxFilterNode.connect(delayHp);
    delayHp.connect(this.fxFeedbackGain);
    this.fxFeedbackGain.connect(this.fxDelayNode);
    delayHp.connect(this.fxReturnGain);

    // 4. Stereo Modulated Chorus Engine (Dual LFO Shimmer)
    this.chorusSendGain = this.ctx.createGain();
    this.chorusSendGain.gain.value = 0.0;
    this.chorusDelayNode = this.ctx.createDelay(0.1);
    this.chorusDelayNode.delayTime.value = 0.022;
    this.chorusLfo = this.ctx.createOscillator();
    this.chorusLfo.type = 'sine';
    this.chorusLfo.frequency.value = 1.15;
    this.chorusLfoGain = this.ctx.createGain();
    this.chorusLfoGain.gain.value = 0.0035;
    this.chorusLfo.connect(this.chorusLfoGain);
    this.chorusLfoGain.connect(this.chorusDelayNode.delayTime);
    this.chorusLfo.start();

    this.chorusFilterNode = this.ctx.createBiquadFilter();
    this.chorusFilterNode.type = 'lowpass';
    this.chorusFilterNode.frequency.value = 7500;
    this.chorusFeedbackGain = this.ctx.createGain();
    this.chorusFeedbackGain.gain.value = 0.22;

    this.fxBusGain.connect(this.chorusSendGain);
    this.chorusSendGain.connect(this.chorusDelayNode);
    this.chorusDelayNode.connect(this.chorusFilterNode);
    this.chorusFilterNode.connect(this.chorusFeedbackGain);
    this.chorusFeedbackGain.connect(this.chorusDelayNode);
    this.chorusFilterNode.connect(this.fxReturnGain);
  }

  private setupFeedbackSimulator() {
    if (!this.ctx) return;
    // Acoustic Feedback Resonator Node (screech at 3.15 kHz)
    this.feedbackFilter = this.ctx.createBiquadFilter();
    this.feedbackFilter.type = 'peaking';
    this.feedbackFilter.frequency.value = 3150;
    this.feedbackFilter.Q.value = 18;
    this.feedbackFilter.gain.value = 24;

    this.feedbackGain = this.ctx.createGain();
    this.feedbackGain.gain.value = 0.0; // Muted by default

    // Connect feedback to master bus
    this.feedbackFilter.connect(this.feedbackGain);
    if (this.masterFader) {
      this.feedbackGain.connect(this.masterFader);
    }
  }

  private makeDistortionCurve(amount: number = 10): Float32Array<ArrayBuffer> {
    const n_samples = 256;
    const buffer = new ArrayBuffer(n_samples * 4);
    const curve = new Float32Array(buffer);
    const deg = Math.PI / 180;
    const maxVal = ((3 + amount) * 20 * deg) / (Math.PI + amount);
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      // Soft saturation curve with hard clipping at high overdrive, normalized
      const raw = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
      curve[i] = raw / maxVal;
    }
    return curve;
  }

  private setupChannels() {
    if (!this.ctx) return;
    this.channels = [];

    const distortionCurve = this.makeDistortionCurve(10);

    for (let i = 0; i < 6; i++) {
      // Preamp Gain (-20dB to +40dB)
      const preampGain = this.ctx.createGain();
      preampGain.gain.value = 1.0;

      // Saturator WaveShaper
      const saturator = this.ctx.createWaveShaper();
      saturator.curve = distortionCurve;
      saturator.oversample = '2x';

      // 48V Phantom Power switch (Ch 3 Vocal by default simulates condenser)
      const phantomGain = this.ctx.createGain();
      phantomGain.gain.value = i === 2 ? 1.0 : 1.0;

      // Hi-Z filter (Ch 1-2 instrument impedance simulation)
      const hizFilter = this.ctx.createBiquadFilter();
      hizFilter.type = 'lowpass';
      hizFilter.frequency.value = 20000; // default fully open

      // 100Hz Low Cut (Highpass with cascaded 2-stage filter for true console steep roll-off)
      const lowCut = this.ctx.createBiquadFilter();
      lowCut.type = 'highpass';
      lowCut.frequency.value = 10; // bypassed initially
      lowCut.Q.value = 0.707;

      const lowCut2 = this.ctx.createBiquadFilter();
      lowCut2.type = 'highpass';
      lowCut2.frequency.value = 10;
      lowCut2.Q.value = 0.707;

      // Phase Inverter (Ø)
      const phaseGain = this.ctx.createGain();
      phaseGain.gain.value = 1.0;

      // 3-Band EQ: Low and High operate as gentle shelving filters with fixed Q ~ 0.7
      const eqLow = this.ctx.createBiquadFilter();
      eqLow.type = 'lowshelf';
      eqLow.frequency.value = 80;
      eqLow.Q.value = 0.7;
      eqLow.gain.value = 0;

      const eqMid = this.ctx.createBiquadFilter();
      eqMid.type = 'peaking';
      eqMid.frequency.value = 2500;
      eqMid.Q.value = 1.4;
      eqMid.gain.value = 0;

      const eqHigh = this.ctx.createBiquadFilter();
      eqHigh.type = 'highshelf';
      eqHigh.frequency.value = 10000;
      eqHigh.Q.value = 0.7;
      eqHigh.gain.value = 0;

      // Pre-Fade Tap for Aux 1 & PFL (tapped post-EQ, pre-mute/fader)
      const preFadeTap = this.ctx.createGain();
      preFadeTap.gain.value = 1.0;

      const aux1Send = this.ctx.createGain();
      aux1Send.gain.value = 0.0; // Off by default (-inf)

      // PFL Analyser (measures pre-fader signal)
      const pflAnalyser = this.ctx.createAnalyser();
      pflAnalyser.fftSize = 128;
      pflAnalyser.smoothingTimeConstant = 0.0;
      preFadeTap.connect(pflAnalyser);

      // Connect pre-fade Aux 1 to Aux 1 master
      preFadeTap.connect(aux1Send);
      if (this.aux1MasterGain) {
        aux1Send.connect(this.aux1MasterGain);
      }

      // Channel Mute & Dedicated Solo Bus Isolation Nodes
      const muteGain = this.ctx.createGain();
      muteGain.gain.value = 1.0;

      const soloGain = this.ctx.createGain();
      soloGain.gain.value = 1.0;

      const panner = this.ctx.createStereoPanner();
      panner.pan.value = 0;

      // Channel Fader
      const channelFader = this.ctx.createGain();
      channelFader.gain.value = 1.0; // 0 dB Unity

      // Post-Fade Tap for FX
      const postFadeTap = this.ctx.createGain();
      postFadeTap.gain.value = 1.0;

      const fxSend = this.ctx.createGain();
      fxSend.gain.value = 0.0; // Off by default

      if (this.fxBusGain) {
        fxSend.connect(this.fxBusGain);
      }

      const postFaderOut = this.ctx.createGain();
      postFaderOut.gain.value = 1.0;

      // Peak / Post-Fader Analyser
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.3;

      // Pre-fader peak analyser for preamp clip detection
      const peakAnalyser = this.ctx.createAnalyser();
      peakAnalyser.fftSize = 128;
      peakAnalyser.smoothingTimeConstant = 0.0;
      preampGain.connect(peakAnalyser);

      // Ultra-low latency RTA analyser for Parametric EQ spectrum view
      const rtaAnalyser = this.ctx.createAnalyser();
      rtaAnalyser.fftSize = 512;
      rtaAnalyser.smoothingTimeConstant = 0.0;
      rtaAnalyser.minDecibels = -90;
      rtaAnalyser.maxDecibels = -10;

      // Connect audio chain
      preampGain.connect(saturator);
      saturator.connect(phantomGain);
      phantomGain.connect(hizFilter);
      hizFilter.connect(lowCut);
      lowCut.connect(lowCut2);
      lowCut2.connect(phaseGain);
      phaseGain.connect(eqLow);
      eqLow.connect(eqMid);
      eqMid.connect(eqHigh);

      // Post-EQ splits to preFadeTap and rtaAnalyser
      eqHigh.connect(preFadeTap);
      eqHigh.connect(rtaAnalyser);

      // Main signal path: preFadeTap -> muteGain -> soloGain -> panner -> channelFader
      preFadeTap.connect(muteGain);
      muteGain.connect(soloGain);
      soloGain.connect(panner);
      panner.connect(channelFader);
      channelFader.connect(postFadeTap);

      postFadeTap.connect(fxSend);
      postFadeTap.connect(postFaderOut);
      postFaderOut.connect(analyser);

      if (this.masterFader) {
        postFaderOut.connect(this.masterFader);
      }

      this.channels.push({
        preampGain,
        saturator,
        hizFilter,
        phantomGain,
        lowCut,
        lowCut2,
        phaseGain,
        eqLow,
        eqMid,
        eqHigh,
        preFadeTap,
        aux1Send,
        muteGain,
        soloGain,
        panner,
        channelFader,
        postFadeTap,
        fxSend,
        postFaderOut,
        analyser,
        rtaAnalyser,
        pflAnalyser,
        peakAnalyser,
        sourceNode: null
      });
    }
  }

  public loadSong(songId: string) {
    if (!this.ctx) return;
    this.currentSongId = songId;
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.stop();
    }

    // Synthesize buffers for the selected song
    this.stemBuffers = generateSyntheticSongStems(this.ctx, songId);
    this.loopDuration = this.stemBuffers[0]?.duration || 8.0;

    if (wasPlaying) {
      this.play();
    }
  }

  public loadCustomStem(channelIndex: number, audioBuffer: AudioBuffer) {
    if (channelIndex < 0 || channelIndex >= 6) return;
    this.stemBuffers[channelIndex] = audioBuffer;
    if (audioBuffer.duration > this.loopDuration) {
      this.loopDuration = audioBuffer.duration;
    }
    if (this.isPlaying) {
      this.stop();
      this.play();
    }
  }

  public async decodeAudioFile(file: File): Promise<AudioBuffer> {
    if (!this.ctx) this.init();
    const arrayBuffer = await file.arrayBuffer();
    return await this.ctx!.decodeAudioData(arrayBuffer);
  }

  public play(offsetSec: number = 0) {
    if (!this.ctx) this.init();
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }

    this.stopSources();

    const startTime = this.ctx!.currentTime;
    this.startTime = startTime - (offsetSec % this.loopDuration);
    this.isPlaying = true;
    this.updateSoloState();

    for (let i = 0; i < 6; i++) {
      if (this.isolatedChannel !== null && i !== this.isolatedChannel) {
        continue;
      }
      const buffer = this.stemBuffers[i];
      if (!buffer) continue;

      const source = this.ctx!.createBufferSource();
      source.buffer = buffer;
      source.loop = this.isLooping;
      source.loopStart = 0;
      source.loopEnd = this.loopDuration;

      source.connect(this.channels[i].preampGain);
      source.start(0, offsetSec % this.loopDuration);

      this.channels[i].sourceNode = source;
    }
  }

  public pause() {
    if (!this.isPlaying) return;
    this.pauseOffset = this.getCurrentTime();
    this.stopSources();
    this.isPlaying = false;
  }

  public stop() {
    this.stopSources();
    this.pauseOffset = 0;
    this.isPlaying = false;
  }

  private stopSources() {
    for (let i = 0; i < this.channels.length; i++) {
      if (this.channels[i].sourceNode) {
        try {
          this.channels[i].sourceNode!.stop();
          this.channels[i].sourceNode!.disconnect();
        } catch {
          // Already stopped
        }
        this.channels[i].sourceNode = null;
      }
    }
  }

  public getCurrentTime(): number {
    if (!this.isPlaying || !this.ctx) return this.pauseOffset;
    const elapsed = this.ctx.currentTime - this.startTime;
    return this.isLooping ? elapsed % this.loopDuration : Math.min(elapsed, this.loopDuration);
  }

  public seek(targetSec: number) {
    const wasPlaying = this.isPlaying;
    this.pauseOffset = targetSec;
    if (wasPlaying) {
      this.play(targetSec);
    }
  }

  // Update channel hardware parameters from UI
  public updateChannel(index: number, s: ChannelSettings) {
    if (!this.ctx || !this.channels[index]) return;
    this.channelSettings[index] = s;
    const ch = this.channels[index];

    // Preamp Gain (-60dB to +20dB -> linear factor, -60dB = 0 / -inf)
    const preampLinear = s.gain <= -59 ? 0 : Math.pow(10, s.gain / 20);
    ch.preampGain.gain.setTargetAtTime(preampLinear, this.ctx.currentTime, 0.02);

    // True Solo logic: isolated playback of soloed channel(s)
    this.updateSoloState();

    // 48V Phantom Power: If condenser mic (Ch 3 Vocal) and 48V is off, attenuate to ~0 only when enforcePhantomPower is true
    if (s.id === 3) {
      const phantomLevel = (this.enforcePhantomPower && !s.phantom48V) ? 0.0001 : 1.0;
      ch.phantomGain.gain.setTargetAtTime(phantomLevel, this.ctx.currentTime, 0.02);
    } else {
      ch.phantomGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.02);
    }

    // Hi-Z Switch: Ensure clean and transparent frequency response (20kHz) by default for all channels
    if (s.id <= 2) {
      ch.hizFilter.frequency.setTargetAtTime(20000, this.ctx.currentTime, 0.02);
    }

    // Low Cut (Highpass Filter):
    // In Learn Section: 150Hz cutoff with cascaded steep roll-off (24dB/octave) so bottom-end drop
    // is immediately obvious on White Noise, Pink Noise, and drums.
    // In Standard Console: 100Hz cutoff (24dB/octave standard console HPF).
    const isLearnCh1 = this.isolatedChannel !== null && index === 0;
    const cutFreq = s.lowCut100Hz ? (isLearnCh1 ? 150 : 100) : 10;
    const cutQ = s.lowCut100Hz ? (isLearnCh1 ? 1.05 : 0.707) : 0.707;
    ch.lowCut.frequency.setTargetAtTime(cutFreq, this.ctx.currentTime, 0.02);
    ch.lowCut.Q.setTargetAtTime(cutQ, this.ctx.currentTime, 0.02);
    ch.lowCut2.frequency.setTargetAtTime(cutFreq, this.ctx.currentTime, 0.02);
    ch.lowCut2.Q.setTargetAtTime(cutQ, this.ctx.currentTime, 0.02);

    // Phase Invert (Ø)
    ch.phaseGain.gain.setTargetAtTime(s.phaseInvert ? -1.0 : 1.0, this.ctx.currentTime, 0.02);

    // 3-Band EQ: Low and High operate as shelving filters with gentle fixed Q ~ 0.7
    ch.eqLow.type = 'lowshelf';
    ch.eqLow.frequency.setTargetAtTime(80, this.ctx.currentTime, 0.02);
    ch.eqLow.Q.setTargetAtTime(0.7, this.ctx.currentTime, 0.02);
    ch.eqLow.gain.setTargetAtTime(s.eqLow, this.ctx.currentTime, 0.02);

    ch.eqMid.type = 'peaking';
    ch.eqMid.gain.setTargetAtTime(s.eqMid, this.ctx.currentTime, 0.02);
    ch.eqMid.frequency.setTargetAtTime(s.eqMidFreq || 2500, this.ctx.currentTime, 0.02);

    ch.eqHigh.type = 'highshelf';
    ch.eqHigh.frequency.setTargetAtTime(10000, this.ctx.currentTime, 0.02);
    ch.eqHigh.Q.setTargetAtTime(0.7, this.ctx.currentTime, 0.02);
    ch.eqHigh.gain.setTargetAtTime(s.eqHigh, this.ctx.currentTime, 0.02);

    // Aux 1 Pre-Fade Send
    const aux1Linear = s.aux1Pre <= -59 ? 0 : Math.pow(10, s.aux1Pre / 20);
    ch.aux1Send.gain.setTargetAtTime(aux1Linear, this.ctx.currentTime, 0.02);

    // Channel Mute: sets manual channel mute gain
    ch.muteGain.gain.setTargetAtTime(s.mute ? 0.0 : 1.0, this.ctx.currentTime, 0.02);

    // Pan
    ch.panner.pan.setTargetAtTime(s.pan, this.ctx.currentTime, 0.02);

    // Channel Fader
    const faderLinear = s.faderLevel <= -59 ? 0 : Math.pow(10, s.faderLevel / 20);
    ch.channelFader.gain.setTargetAtTime(faderLinear, this.ctx.currentTime, 0.02);

    // FX Post-Fade Send
    const fxLinear = s.fxPost <= -59 ? 0 : Math.pow(10, s.fxPost / 20);
    ch.fxSend.gain.setTargetAtTime(fxLinear, this.ctx.currentTime, 0.02);

    this.checkFeedbackCondition(index, s);
  }

  public updateMaster(m: MasterSettings) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Main Fader
    const mainLinear = m.mainFader <= -59 ? 0 : Math.pow(10, m.mainFader / 20);
    this.masterFader?.gain.setTargetAtTime(mainLinear, now, 0.02);

    // Aux 1 Master
    const aux1Linear = m.aux1Master <= -59 ? 0 : Math.pow(10, m.aux1Master / 20);
    this.aux1MasterGain?.gain.setTargetAtTime(aux1Linear, now, 0.02);

    // FX Return
    const fxReturnLinear = m.fxReturn <= -59 ? 0 : Math.pow(10, m.fxReturn / 20);
    this.fxReturnGain?.gain.setTargetAtTime(fxReturnLinear, now, 0.02);
    this.fxMuteGain?.gain.setTargetAtTime(m.fxMute ? 0 : 1.0, now, 0.02);

    // Phones
    const phonesLinear = (m.phonesLevel / 100) * 1.2;
    this.phonesGain?.gain.setTargetAtTime(phonesLinear, now, 0.02);

    // FX Algorithm Emulation (Plate, Hall, Delay, Chorus)
    this.setFxType(m.fxType);
    if (m.chorusIntensity !== undefined) {
      this.setChorusIntensity(m.chorusIntensity);
    }
  }

  // Procedural Reverb Impulse Response Synthesizers
  // EMT 140 Style Lush Studio Plate Reverb
  private createPlateImpulseResponse(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const duration = 2.4;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(2, length, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    // 20ms gentle diffusion bloom envelope (eliminates harsh "struck metal" transient click)
    const attackSamples = Math.floor(sampleRate * 0.020);

    // Highpass filter coefficients (~220 Hz biquad Butterworth to eliminate tubby rumble and metallic boing)
    const hpCutoff = 220;
    const hpW = (2 * Math.PI * hpCutoff) / sampleRate;
    const hpAlpha = Math.sin(hpW) / 2;
    const hpCos = Math.cos(hpW);
    const hpB0 = (1 + hpCos) / 2;
    const hpB1 = -(1 + hpCos);
    const hpB2 = (1 + hpCos) / 2;
    const hpA0 = 1 + hpAlpha;
    const hpA1 = -2 * hpCos;
    const hpA2 = 1 - hpAlpha;

    let lpL = 0, lpR = 0;
    let lX1 = 0, lX2 = 0, lY1 = 0, lY2 = 0;
    let rX1 = 0, rX2 = 0, rY1 = 0, rY2 = 0;

    let energySum = 0;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;

      // Soft cosine-squared onset for smooth, transparent plate excitation
      const attack = i < attackSamples 
        ? Math.sin((i / attackSamples) * (Math.PI / 2)) 
        : 1.0;

      // Silky exponential decay curve (~2.0s tail)
      const decay = Math.exp(-t * 2.15);
      const env = attack * decay;

      // High-density Gaussian random noise (4-sample central limit theorem)
      // Eliminates discrete graininess and provides continuous, shimmering diffusion
      const nL = (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 0.5;
      const nR = (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 0.5;

      // Smooth time-dependent damping (high frequencies gently absorb into warmth)
      const damp = Math.min(0.80, 0.18 + (t / duration) * 0.62);
      lpL += (1 - damp) * (nL - lpL);
      lpR += (1 - damp) * (nR - lpR);

      // Apply 220Hz high-pass filter
      const lOut = (hpB0 / hpA0) * lpL + (hpB1 / hpA0) * lX1 + (hpB2 / hpA0) * lX2 - (hpA1 / hpA0) * lY1 - (hpA2 / hpA0) * lY2;
      lX2 = lX1; lX1 = lpL; lY2 = lY1; lY1 = lOut;

      const rOut = (hpB0 / hpA0) * lpR + (hpB1 / hpA0) * rX1 + (hpB2 / hpA0) * rX2 - (hpA1 / hpA0) * rY1 - (hpA2 / hpA0) * rY2;
      rX2 = rX1; rX1 = lpR; rY2 = rY1; rY1 = rOut;

      const sampleL = lOut * env;
      const sampleR = rOut * env;

      left[i] = sampleL;
      right[i] = sampleR;

      energySum += sampleL * sampleL + sampleR * sampleR;
    }

    // Energy normalization to smooth musical reverb level
    const rms = Math.sqrt(energySum / (length * 2));
    const targetRms = 0.085;
    const gainFactor = rms > 0 ? targetRms / rms : 1.0;

    for (let i = 0; i < length; i++) {
      left[i] *= gainFactor;
      right[i] *= gainFactor;
    }

    return buffer;
  }

  private createHallImpulseResponse(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const duration = 3.6;
    const decayTime = 3.4;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(2, length, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    const predelaySamples = Math.floor(sampleRate * 0.028); // 28ms predelay
    const bloomSamples = Math.floor(sampleRate * 0.050); // 50ms reflection bloom

    const earlyReflections = [
      { delay: Math.floor(sampleRate * 0.032), l: 0.5, r: 0.25 },
      { delay: Math.floor(sampleRate * 0.046), l: 0.3, r: 0.45 },
      { delay: Math.floor(sampleRate * 0.060), l: -0.38, r: 0.32 },
      { delay: Math.floor(sampleRate * 0.076), l: 0.32, r: -0.35 },
      { delay: Math.floor(sampleRate * 0.095), l: -0.26, r: 0.26 },
      { delay: Math.floor(sampleRate * 0.120), l: 0.20, r: -0.22 },
    ];

    let lLowPass = 0;
    let rLowPass = 0;

    for (let i = 0; i < length; i++) {
      if (i < predelaySamples) {
        left[i] = 0;
        right[i] = 0;
        continue;
      }

      const t = (i - predelaySamples) / sampleRate;
      const attack = Math.min(1.0, (i - predelaySamples) / bloomSamples);
      const decay = Math.exp(-t * (2.6 / decayTime));
      const env = attack * decay;

      const rawL = Math.random() * 2 - 1;
      const rawR = Math.random() * 2 - 1;

      // Strong air absorption: concert halls absorb high frequencies over distance
      const damp = Math.min(0.92, 0.40 + (t / duration) * 0.52);
      lLowPass += (1 - damp) * (rawL - lLowPass);
      rLowPass += (1 - damp) * (rawR - rLowPass);

      left[i] = lLowPass * env * 1.3;
      right[i] = rLowPass * env * 1.3;
    }

    for (const er of earlyReflections) {
      if (er.delay < length) {
        left[er.delay] += er.l * 0.4;
        right[er.delay] += er.r * 0.4;
      }
    }

    return buffer;
  }

  public tapTempo(): { delaySec: number; bpm: number } {
    if (!this.ctx) {
      this.init();
    }
    const now = performance.now();
    // If more than 2.2 seconds since previous tap, reset tap sequence
    if (this.tapHistory.length > 0 && (now - this.tapHistory[this.tapHistory.length - 1] > 2200)) {
      this.tapHistory = [];
    }
    this.tapHistory.push(now);
    if (this.tapHistory.length > 5) {
      this.tapHistory.shift();
    }

    if (this.tapHistory.length >= 2) {
      let totalDiff = 0;
      for (let i = 1; i < this.tapHistory.length; i++) {
        totalDiff += (this.tapHistory[i] - this.tapHistory[i - 1]) / 1000;
      }
      const avgInterval = totalDiff / (this.tapHistory.length - 1);
      // Clamp between 0.06s (1000 BPM) and 1.8s (33.3 BPM)
      const clamped = Math.min(1.8, Math.max(0.06, avgInterval));
      this.setDelayTime(clamped);
    }

    const bpm = Math.round(60 / this.currentDelayTime);
    return {
      delaySec: this.currentDelayTime,
      bpm
    };
  }

  public setDelayTime(seconds: number) {
    this.currentDelayTime = Math.min(1.8, Math.max(0.06, seconds));
    if (this.fxDelayNode && this.ctx) {
      this.fxDelayNode.delayTime.setTargetAtTime(this.currentDelayTime, this.ctx.currentTime, 0.02);
    }
  }

  public getDelayInfo(): { delayMs: number; bpm: number } {
    return {
      delayMs: Math.round(this.currentDelayTime * 1000),
      bpm: Math.round(60 / this.currentDelayTime)
    };
  }

  public setChorusIntensity(intensity: number) {
    this.currentChorusIntensity = Math.max(0, Math.min(100, intensity));
    if (!this.ctx || !this.chorusLfoGain || !this.chorusLfo || !this.chorusFeedbackGain) return;
    const now = this.ctx.currentTime;
    const norm = this.currentChorusIntensity / 100;

    // Depth: 0.0006s (0.6ms) to 0.0062s (6.2ms)
    const depth = 0.0006 + norm * (0.0062 - 0.0006);
    this.chorusLfoGain.gain.setTargetAtTime(depth, now, 0.03);

    // Rate: 0.8 Hz (slow lush sweep) to 1.8 Hz (faster shimmer)
    const rate = 0.8 + norm * 1.0;
    this.chorusLfo.frequency.setTargetAtTime(rate, now, 0.03);

    // Feedback: 0.05 to 0.35 (thickens the chorus body)
    const fb = 0.05 + norm * 0.30;
    this.chorusFeedbackGain.gain.setTargetAtTime(fb, now, 0.03);
  }

  public setFxType(type: 'plate' | 'hall' | 'delay' | 'chorus', customDelay?: number) {
    if (!this.ctx) return;
    this.currentFxType = type;
    const now = this.ctx.currentTime;
    const fade = 0.03;

    this.plateSendGain?.gain.setTargetAtTime(type === 'plate' ? 1.0 : 0.0, now, fade);
    this.hallSendGain?.gain.setTargetAtTime(type === 'hall' ? 1.0 : 0.0, now, fade);
    this.delaySendGain?.gain.setTargetAtTime(type === 'delay' ? 1.0 : 0.0, now, fade);
    this.chorusSendGain?.gain.setTargetAtTime(type === 'chorus' ? 1.0 : 0.0, now, fade);

    if (type === 'delay') {
      if (customDelay) {
        this.setDelayTime(customDelay);
      } else {
        this.setDelayTime(this.currentDelayTime);
      }
    } else if (type === 'chorus') {
      this.setChorusIntensity(this.currentChorusIntensity);
    }
  }

  // Acoustic feedback loop simulation
  private checkFeedbackCondition(chIndex: number, s: ChannelSettings) {
    if (chIndex !== 2) return; // Ch 3 vocal mic is the feedback culprit
    if (!this.feedbackGain || !this.feedbackFilter || !this.ctx) return;

    // Feedback occurs if Vocal Gain > 24dB + Fader > +3dB + Mid EQ > 3dB and NOT muted
    const dangerousGain = s.gain > 24 && s.faderLevel > 2 && s.eqMid > 2 && !s.mute;
    if (dangerousGain) {
      // Build up screech
      this.feedbackGain.gain.setTargetAtTime(0.35, this.ctx.currentTime, 0.2);
    } else {
      // Rapid dampening
      this.feedbackGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.05);
    }
  }

  // Real-time peak meter & 1.5s clip-hold extraction
  public getMeterLevels(activePflIndex: number | null): {
    channels: { level: number; clipped: boolean; hasSignal: boolean }[];
    masterL: number;
    masterR: number;
    masterClipped: boolean;
    aux1: number;
    pflActive: boolean;
  } {
    const now = performance.now();

    const channelMeters = this.channels.map((ch, idx) => {
      // Measure pre-fader input gain level via peakAnalyser for clip detection
      const preData = new Uint8Array(ch.peakAnalyser.fftSize);
      ch.peakAnalyser.getByteTimeDomainData(preData);
      let prePeak = 0;
      for (let i = 0; i < preData.length; i++) {
        const val = Math.abs(preData[i] - 128) / 128;
        if (val > prePeak) prePeak = val;
      }

      // Check clip: triggers when pre-fader peak exceeds ~0.88 or preamp gain is driven hot (gain linear >= 5.0 with signal)
      if (prePeak >= 0.88 || (ch.preampGain.gain.value >= 5.0 && prePeak > 0.02)) {
        this.channelClipTimes[idx] = now + 1500; // 1.5s clip hold
      }
      const clipped = now < this.channelClipTimes[idx];

      // Measure pre/post level for signal presence (-24dB corresponds to linear approx 0.063)
      const hasSignal = prePeak >= 0.063 || this.isPlaying;

      // Measure post-fader level for meter display
      const postData = new Uint8Array(ch.analyser.fftSize);
      ch.analyser.getByteTimeDomainData(postData);
      let postPeak = 0;
      for (let i = 0; i < postData.length; i++) {
        const val = Math.abs(postData[i] - 128) / 128;
        if (val > postPeak) postPeak = val;
      }

      const effectiveSignal = hasSignal || postPeak >= 0.063;

      return {
        level: Math.min(postPeak * 1.3, 1.0),
        clipped,
        hasSignal: effectiveSignal
      };
    });

    // Master stereo playback meter (reflects true solo isolation on master bus)
    let mL = 0;
    let mR = 0;

    if (this.masterAnalyserL && this.masterAnalyserR) {
      const dataL = new Uint8Array(this.masterAnalyserL.fftSize);
      this.masterAnalyserL.getByteTimeDomainData(dataL);
      for (let i = 0; i < dataL.length; i++) {
        const val = Math.abs(dataL[i] - 128) / 128;
        if (val > mL) mL = val;
      }
      const dataR = new Uint8Array(this.masterAnalyserR.fftSize);
      this.masterAnalyserR.getByteTimeDomainData(dataR);
      for (let i = 0; i < dataR.length; i++) {
        const val = Math.abs(dataR[i] - 128) / 128;
        if (val > mR) mR = val;
      }
      mL = Math.min(mL * 1.3, 1.0);
      mR = Math.min(mR * 1.3, 1.0);
    }

    if (mL > 0.96 || mR > 0.96) {
      this.masterClipTime = now + 1500;
    }
    const masterClipped = now < this.masterClipTime;

    // Aux 1 Meter
    let aux1 = 0;
    if (this.aux1Analyser) {
      const auxData = new Uint8Array(this.aux1Analyser.frequencyBinCount);
      this.aux1Analyser.getByteTimeDomainData(auxData);
      for (let i = 0; i < auxData.length; i++) {
        const val = Math.abs(auxData[i] - 128) / 128;
        if (val > aux1) aux1 = val;
      }
      aux1 = Math.min(aux1 * 1.3, 1.0);
    }

    return {
      channels: channelMeters,
      masterL: mL,
      masterR: mR,
      masterClipped,
      aux1,
      pflActive: activePflIndex !== null
    };
  }

  // True Solo Isolation: when any solo is active, strictly isolates the selected channel(s)
  public updateSoloState() {
    if (!this.ctx || this.channels.length === 0) return;
    const now = this.ctx.currentTime;
    const anySoloed = this.channelSettings.some(c => Boolean(c && c.soloPfl));

    for (let i = 0; i < this.channels.length; i++) {
      const cSet = this.channelSettings[i];
      const ch = this.channels[i];
      if (!ch) continue;

      let soloMultiplier = 1.0;
      if (this.isolatedChannel !== null) {
        // Strict single-channel isolation for Learn section
        soloMultiplier = (i === this.isolatedChannel) ? 1.0 : 0.0;
      } else if (anySoloed) {
        // Only channels with solo active pass audio through the solo bus
        soloMultiplier = (cSet && cSet.soloPfl) ? 1.0 : 0.0;
      }
      ch.soloGain.gain.setTargetAtTime(soloMultiplier, now, 0.015);
    }
  }

  // Get frequency spectrum for Parametric EQ canvas RTA
  public getChannelFrequencyData(channelIndex: number, array: Uint8Array<ArrayBuffer>) {
    if (this.channels[channelIndex]) {
      this.channels[channelIndex].rtaAnalyser.getByteFrequencyData(array);
    }
  }

  public updateAllChannels(channels: ChannelSettings[]) {
    this.channelSettings = [...channels];
    channels.forEach((ch, idx) => {
      this.updateChannel(idx, ch);
    });
    this.updateSoloState();
  }
}

export const audioEngine = new AudioEngine();
