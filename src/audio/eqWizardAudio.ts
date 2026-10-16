import { audioEngine } from './audioEngine';
import { Clip, getSongStems } from './clipFinder';

/** One EQ filter: the same shapes the console uses (low shelf, peaking mid, high shelf). */
export interface FilterSpec {
  type: BiquadFilterType;
  freq: number;
  gain: number;
  q?: number;
}

/** The console's channel EQ, as filter specs (low shelf 80 Hz, sweepable mid, high shelf 10 kHz). */
export function channelEqSpecs(low: number, mid: number, midFreq: number, high: number): FilterSpec[] {
  return [
    { type: 'lowshelf', freq: 80, gain: low },
    { type: 'peaking', freq: midFreq, gain: mid, q: 1.4 },
    { type: 'highshelf', freq: 10000, gain: high }
  ];
}

/**
 * Plays EQ Wizard audio on its own path (separate from the console):
 *   clip sources ─┬─────────────────────────────▶ A ─┐
 *                 └─▶ change filters ─▶ student filters ─▶ B ─┴─▶ output
 * Flipping between A and B is instant and stays in time because both
 * hear the same sources. Clips loop until stopped.
 */
class EqWizardPlayer {
  private sources: AudioBufferSourceNode[] = [];
  private out: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private gainA: GainNode | null = null;
  private gainB: GainNode | null = null;
  private changeFilters: BiquadFilterNode[] = [];
  private studentFilters: BiquadFilterNode[] = [];
  private tone: { osc: OscillatorNode; gain: GainNode } | null = null;
  private token = 0; // bumps on every stop, so a slow-loading clip can't start after being cancelled
  public which: 'A' | 'B' = 'A';
  public isPlaying = false;
  public onChange?: () => void;

  private get ctx(): AudioContext {
    if (!audioEngine.ctx) audioEngine.init();
    if (audioEngine.ctx!.state === 'suspended') audioEngine.ctx!.resume();
    return audioEngine.ctx!;
  }

  private makeFilter(spec: FilterSpec): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter();
    f.type = spec.type;
    f.frequency.value = spec.freq;
    f.gain.value = spec.gain;
    if (spec.q !== undefined) f.Q.value = spec.q;
    return f;
  }

  /** Start a looping clip. `change` is the hidden EQ move; `student` is the student's own EQ (FreqTweak). */
  async playClip(clip: Clip, change: FilterSpec[], student: FilterSpec[] = [], fadeSeconds = 0) {
    this.stopAll();
    const myToken = this.token;
    const ctx = this.ctx;
    const stems = await getSongStems(clip.songId);
    if (myToken !== this.token) return;
    const buffers = clip.stemIndex !== undefined ? [stems[clip.stemIndex].buffer] : stems.map((s) => s.buffer);

    this.out = ctx.createGain();
    this.out.gain.value = 0;
    // A fast limiter on the way out keeps big EQ boosts from clipping. A and B both go
    // through it, so it never gives the answer away.
    const limiter = (this.limiter = ctx.createDynamicsCompressor());
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.1;
    this.out.connect(limiter);
    limiter.connect(ctx.destination);
    const input = ctx.createGain();
    // Solo stems are quieter than the full mix, so give them a little lift; leave headroom for boosts
    input.gain.value = clip.stemIndex !== undefined ? 1.2 : 0.6;

    this.gainA = ctx.createGain();
    this.gainB = ctx.createGain();
    this.gainA.gain.value = this.which === 'A' ? 1 : 0;
    this.gainB.gain.value = this.which === 'B' ? 1 : 0;

    this.changeFilters = change.map((s) => this.makeFilter(s));
    this.studentFilters = student.map((s) => this.makeFilter(s));
    const chain = [...this.changeFilters, ...this.studentFilters];

    input.connect(this.gainA);
    chain.reduce<AudioNode>((prev, f) => { prev.connect(f); return f; }, input).connect(this.gainB);
    this.gainA.connect(this.out);
    this.gainB.connect(this.out);

    const now = ctx.currentTime + 0.05;
    const loopEnd = Math.min(clip.start + clip.duration, ...buffers.map((b) => b.duration));

    // Optional long fade in/out on every pass of the loop, so the clip's edges never click or jump.
    // The envelope sits ahead of the A/B split, so ORIGINAL and CHANGED fade identically.
    let env: AudioNode = input;
    if (fadeSeconds > 0) {
      const period = loopEnd - clip.start;
      const f = Math.min(fadeSeconds, period / 2.5);
      const e = ctx.createGain();
      e.connect(input);
      e.gain.setValueAtTime(0, now);
      const cycles = Math.ceil(1200 / period); // about 20 minutes of looping
      for (let k = 0; k < cycles; k++) {
        const t0 = now + k * period;
        e.gain.setValueAtTime(0, t0);
        e.gain.linearRampToValueAtTime(1, t0 + f);
        e.gain.setValueAtTime(1, t0 + period - f);
        e.gain.linearRampToValueAtTime(0, t0 + period);
      }
      env = e;
    }

    this.sources = buffers.map((buf) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.loopStart = clip.start;
      src.loopEnd = loopEnd;
      src.connect(env);
      src.start(now, clip.start);
      return src;
    });
    this.out.gain.setTargetAtTime(1, now, 0.05);
    this.isPlaying = true;
    this.onChange?.();
  }

  setWhich(which: 'A' | 'B') {
    this.which = which;
    if (this.gainA && this.gainB && audioEngine.ctx) {
      const t = audioEngine.ctx.currentTime;
      this.gainA.gain.setTargetAtTime(which === 'A' ? 1 : 0, t, 0.01);
      this.gainB.gain.setTargetAtTime(which === 'B' ? 1 : 0, t, 0.01);
    }
    this.onChange?.();
  }

  /** Update the student's EQ while the clip plays. */
  updateStudent(specs: FilterSpec[]) {
    if (!audioEngine.ctx) return;
    const t = audioEngine.ctx.currentTime;
    specs.forEach((s, i) => {
      const f = this.studentFilters[i];
      if (!f) return;
      f.frequency.setTargetAtTime(s.freq, t, 0.02);
      f.gain.setTargetAtTime(s.gain, t, 0.02);
    });
  }

  /** A test tone for Freq Tone ID, with a gentle fade in and out. Low tones are louder so they can be heard at all. */
  playTone(freq: number, seconds = 1.8) {
    this.stopAll();
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    let level = 0.06;
    if (freq <= 60) level = 0.25;
    else if (freq <= 125) level = 0.18;
    else if (freq <= 250) level = 0.12;
    else if (freq <= 500) level = 0.09;
    const t = ctx.currentTime + 0.02;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.08);
    gain.gain.setValueAtTime(level, t + seconds - 0.25);
    gain.gain.linearRampToValueAtTime(0, t + seconds);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + seconds + 0.05);
    osc.onended = () => {
      if (this.tone?.osc === osc) {
        this.tone = null;
        this.isPlaying = false;
        this.onChange?.();
      }
    };
    this.tone = { osc, gain };
    this.isPlaying = true;
    this.onChange?.();
  }

  stopAll() {
    this.token++;
    this.sources.forEach((s) => {
      try { s.stop(); s.disconnect(); } catch { /* already stopped */ }
    });
    this.sources = [];
    if (this.out) {
      try { this.out.disconnect(); } catch { /* ignore */ }
      this.out = null;
    }
    if (this.limiter) {
      try { this.limiter.disconnect(); } catch { /* ignore */ }
      this.limiter = null;
    }
    if (this.tone) {
      try { this.tone.osc.stop(); this.tone.gain.disconnect(); } catch { /* ignore */ }
      this.tone = null;
    }
    this.changeFilters = [];
    this.studentFilters = [];
    if (this.isPlaying) {
      this.isPlaying = false;
      this.onChange?.();
    }
  }
}

export const eqWizardPlayer = new EqWizardPlayer();
