import { GEQ_10, GEQ_31 } from '../../audio/eqBands';
import { FilterSpec } from '../../audio/eqWizardAudio';

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */
export const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
export const logRand = (lo: number, hi: number) => Math.exp(rand(Math.log(lo), Math.log(hi)));
export const pickOne = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Answer-box colors (rgb triplets). */
export const COLORS = {
  low: '239,68,68',
  lowmid: '249,115,22',
  mid: '234,179,8',
  himid: '34,197,94',
  high: '56,189,248',
  band: '168,85,247'
};

export interface Region {
  id: string;
  label: string;
  sub?: string;
  from: number; // GEQ_31 index
  to: number;   // GEQ_31 index
  tone: [number, number]; // Hz range to pick test tones from
  color: string;
}

/* ------------------------------------------------------------------ */
/* FREQ ID: sine tones                                                 */
/* ------------------------------------------------------------------ */
export interface FreqIdLevel {
  title: string;
  blurb: string;
  kind: 'regions' | 'bands';
  regions?: Region[];
  focus?: [number, number];   // GEQ_31 indices to keep bright; the rest is dimmed
  bands?: number[];           // for kind 'bands': which EQ is shown (10 or 31 band)
  toneBands?: [number, number]; // for kind 'bands': index range tones are picked from
  headphones: boolean;
}

export const FREQ_ID_LEVELS: FreqIdLevel[] = [
  {
    title: 'Full Spectrum',
    blurb: 'Is the tone Low, Mid or High?',
    kind: 'regions',
    headphones: false,
    regions: [
      { id: 'low', label: 'Low', sub: 'under 250 Hz', from: 0, to: 10, tone: [55, 220], color: COLORS.low },
      { id: 'mid', label: 'Mid', sub: '250 Hz – 4 kHz', from: 11, to: 22, tone: [300, 3500], color: COLORS.mid },
      { id: 'high', label: 'High', sub: 'over 4 kHz', from: 23, to: 30, tone: [4600, 12000], color: COLORS.high }
    ]
  },
  {
    title: 'The Low End',
    blurb: 'Sub Bass, Bass or Upper Bass?',
    kind: 'regions',
    headphones: true,
    focus: [2, 10],
    regions: [
      { id: 'sub', label: 'Sub Bass', sub: '30–60 Hz', from: 2, to: 4, tone: [33, 56], color: COLORS.low },
      { id: 'bass', label: 'Bass', sub: '60–120 Hz', from: 5, to: 7, tone: [66, 112], color: COLORS.lowmid },
      { id: 'upper', label: 'Upper Bass', sub: '120–250 Hz', from: 8, to: 10, tone: [130, 235], color: COLORS.mid }
    ]
  },
  {
    title: 'The Mid Range',
    blurb: 'Low Mids, Mids or High Mids?',
    kind: 'regions',
    headphones: false,
    focus: [11, 22],
    regions: [
      { id: 'lowmid', label: 'Low Mids', sub: '250–500 Hz', from: 11, to: 13, tone: [265, 470], color: COLORS.lowmid },
      { id: 'mid', label: 'Mids', sub: '500 Hz – 2 kHz', from: 14, to: 19, tone: [540, 1850], color: COLORS.mid },
      { id: 'himid', label: 'High Mids', sub: '2–4 kHz', from: 20, to: 22, tone: [2150, 3750], color: COLORS.himid }
    ]
  },
  {
    title: 'The Highs',
    blurb: 'Presence, Brilliance or Air?',
    kind: 'regions',
    headphones: false,
    focus: [23, 29],
    regions: [
      { id: 'presence', label: 'Presence', sub: '4–6 kHz', from: 23, to: 24, tone: [4200, 5700], color: COLORS.himid },
      { id: 'brilliance', label: 'Brilliance', sub: '6–10 kHz', from: 25, to: 26, tone: [6400, 9400], color: COLORS.high },
      { id: 'air', label: 'Air', sub: '10–16 kHz', from: 27, to: 29, tone: [10500, 14500], color: COLORS.band }
    ]
  },
  {
    title: '10-Band Graphic EQ',
    blurb: 'Which octave band is the tone in?',
    kind: 'bands',
    headphones: true,
    bands: GEQ_10,
    toneBands: [1, 8] // 63 Hz – 8 kHz
  },
  {
    title: '31-Band Graphic EQ',
    blurb: 'Which third-octave band is the tone in?',
    kind: 'bands',
    headphones: true,
    bands: GEQ_31,
    toneBands: [5, 27] // 63 Hz – 10 kHz
  }
];

export interface FreqIdQuestion {
  freq: number;
  answer: string; // region id, or band index as a string
}

export function makeFreqIdQuestions(level: FreqIdLevel, count: number): FreqIdQuestion[] {
  const qs: FreqIdQuestion[] = [];
  let last = '';
  while (qs.length < count) {
    if (level.kind === 'regions') {
      const r = pickOne(level.regions!);
      if (r.id === last && Math.random() < 0.6) continue; // fewer repeats in a row
      last = r.id;
      qs.push({ freq: Math.round(logRand(r.tone[0], r.tone[1])), answer: r.id });
    } else {
      const [lo, hi] = level.toneBands!;
      const idx = lo + Math.floor(Math.random() * (hi - lo + 1));
      if (String(idx) === last) continue;
      last = String(idx);
      qs.push({ freq: level.bands![idx], answer: String(idx) });
    }
  }
  return qs;
}

/** Band levels: exact = 100, one band off = 66, two off = 33. */
export function bandScore(picked: number, answer: number): number {
  const d = Math.abs(picked - answer);
  return d === 0 ? 100 : d === 1 ? 66 : d === 2 ? 33 : 0;
}

/* ------------------------------------------------------------------ */
/* FREQ BAND ID: what was boosted or cut in the music                  */
/* ------------------------------------------------------------------ */
export interface BandDef {
  id: string;
  label: string;
  from: number;
  to: number;
  center: number;
  q: number;
  color: string;
  vocab?: string;
}

const THREE_BANDS: BandDef[] = [
  { id: 'low', label: 'Low', from: 0, to: 10, center: 100, q: 0.9, color: COLORS.low },
  { id: 'mid', label: 'Mid', from: 11, to: 22, center: 1000, q: 0.9, color: COLORS.mid },
  { id: 'high', label: 'High', from: 23, to: 30, center: 8000, q: 0.9, color: COLORS.high }
];

const FIVE_BANDS: BandDef[] = [
  { id: 'low', label: 'Low', from: 0, to: 8, center: 80, q: 1.2, color: COLORS.low, vocab: 'Punchy / Boomy' },
  { id: 'lowmid', label: 'Low-Mid', from: 9, to: 14, center: 300, q: 1.2, color: COLORS.lowmid, vocab: 'Warmth / Mud' },
  { id: 'mid', label: 'Mid', from: 15, to: 19, center: 1000, q: 1.2, color: COLORS.mid, vocab: 'Fullness / Boxiness' },
  { id: 'himid', label: 'Hi-Mid', from: 20, to: 24, center: 3000, q: 1.2, color: COLORS.himid, vocab: 'Clarity / Harshness' },
  { id: 'high', label: 'High', from: 25, to: 30, center: 10000, q: 1.2, color: COLORS.high, vocab: 'Airy / Piercing' }
];

export interface FreqBandLevel {
  title: string;
  blurb: string;
  bands: BandDef[];
  amount: number;        // dB
  cutsToo: boolean;      // false = boosts only
  vocab: boolean;
}

export const FREQ_BAND_LEVELS: FreqBandLevel[] = [
  { title: 'Big Boosts', blurb: 'Low, Mid or High boosted +10 dB', bands: THREE_BANDS, amount: 10, cutsToo: false, vocab: false },
  { title: 'Smaller Boosts', blurb: 'Low, Mid or High boosted +5 dB', bands: THREE_BANDS, amount: 5, cutsToo: false, vocab: false },
  { title: 'Boost or Cut?', blurb: '3 bands, boosted or cut 10 dB', bands: THREE_BANDS, amount: 10, cutsToo: true, vocab: false },
  { title: 'Subtle Boost or Cut', blurb: '3 bands, boosted or cut 5 dB', bands: THREE_BANDS, amount: 5, cutsToo: true, vocab: false },
  { title: 'Five Bands', blurb: '5 bands, boosted or cut 10 dB', bands: FIVE_BANDS, amount: 10, cutsToo: true, vocab: true },
  { title: 'Five Bands, Subtle', blurb: '5 bands, boosted or cut 5 dB', bands: FIVE_BANDS, amount: 5, cutsToo: true, vocab: true }
];

export interface FreqBandQuestion {
  bandId: string;
  dir: 'boost' | 'cut';
  songId: string;
}

export function freqBandChange(level: FreqBandLevel, q: FreqBandQuestion): FilterSpec[] {
  const b = level.bands.find((x) => x.id === q.bandId)!;
  return [{ type: 'peaking', freq: b.center, gain: q.dir === 'boost' ? level.amount : -level.amount, q: b.q }];
}

export function makeFreqBandQuestions(level: FreqBandLevel, count: number, songIds: string[]): FreqBandQuestion[] {
  const qs: FreqBandQuestion[] = [];
  let lastKey = '';
  for (let i = 0; qs.length < count; i++) {
    const band = pickOne(level.bands);
    const dir: 'boost' | 'cut' = level.cutsToo && Math.random() < 0.5 ? 'cut' : 'boost';
    const key = `${band.id}${dir}`;
    if (key === lastKey) continue;
    lastKey = key;
    qs.push({ bandId: band.id, dir, songId: songIds[qs.length % songIds.length] });
  }
  return qs;
}

/* ------------------------------------------------------------------ */
/* FREQ TWEAK: undo an EQ change with the channel EQ                   */
/* ------------------------------------------------------------------ */
export type TweakKnob = 'low' | 'mid' | 'freq' | 'high';

export interface FreqTweakLevel {
  title: string;
  blurb: string;
  active: TweakKnob[];
  range: [number, number]; // dB size of each change
}

export const FREQ_TWEAK_LEVELS: FreqTweakLevel[] = [
  { title: 'Highs & Lows', blurb: 'HIGH and LOW knobs, changes of 6–10 dB', active: ['high', 'low'], range: [6, 10] },
  { title: 'Highs & Lows, Subtle', blurb: 'HIGH and LOW knobs, changes of 3–6 dB', active: ['high', 'low'], range: [3, 6] },
  { title: 'Add the Mid', blurb: 'HIGH, MID (fixed at 2.5 kHz) and LOW, 4–8 dB', active: ['high', 'mid', 'low'], range: [4, 8] },
  { title: 'Find the Frequency', blurb: 'MID and MID FREQ only, 4–8 dB', active: ['mid', 'freq'], range: [4, 8] },
  { title: 'Full EQ', blurb: 'Every EQ knob, changes of 6–10 dB', active: ['high', 'mid', 'freq', 'low'], range: [6, 10] },
  { title: 'Full EQ, Subtle', blurb: 'Every EQ knob, changes of 3–6 dB', active: ['high', 'mid', 'freq', 'low'], range: [3, 6] }
];

export interface TweakSettings {
  low: number;
  mid: number;
  freq: number;
  high: number;
}

export const FLAT_TWEAK: TweakSettings = { low: 0, mid: 0, freq: 2500, high: 0 };

/** Bands a question can change. MID covers both MID and MID FREQ (one peaking band). */
export type TweakBand = 'low' | 'mid' | 'high';

export interface TweakQuestion {
  bands: TweakBand[];      // which bands were knocked out of shape
  fix: TweakSettings;      // the knob settings that exactly undo it
  multi: boolean;          // more than one knob changed (questions 7-8)
}

/**
 * Questions 1-6 change ONE band; questions 7-8 change two or more (when the level
 * has more than one band to work with). `freqRange` picks a sensible MID FREQ
 * for the instrument, and `canUse` says which bands the instrument can show off.
 */
export function makeTweakQuestion(
  level: FreqTweakLevel,
  qIndex: number,
  canUse: (b: TweakBand) => boolean,
  freqRange: [number, number]
): TweakQuestion {
  const levelBands = (['low', 'mid', 'high'] as TweakBand[]).filter((b) => level.active.includes(b));
  const usable = levelBands.filter(canUse);
  const pool = usable.length ? usable : levelBands;
  const wantMulti = qIndex >= 6 && pool.length > 1;
  let bands: TweakBand[];
  if (wantMulti) {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    bands = shuffled.slice(0, pool.length === 2 ? 2 : Math.random() < 0.5 ? 2 : 3);
  } else {
    bands = [pickOne(pool)];
  }
  const size = () => Math.round(rand(level.range[0], level.range[1]) * 2) / 2 * (Math.random() < 0.5 ? -1 : 1);
  const fix: TweakSettings = { ...FLAT_TWEAK };
  for (const b of bands) fix[b] = size();
  if (bands.includes('mid') && level.active.includes('freq')) {
    fix.freq = Math.round(logRand(freqRange[0], freqRange[1]) / 25) * 25;
  }
  return { bands, fix, multi: bands.length > 1 };
}

/** Score one question: gains within 0.5 dB = 100%, fading to 0 at 6 dB off;
 *  MID FREQ within 1/6 octave = 100%, fading to 0 at one octave off. */
export function tweakScore(level: FreqTweakLevel, answer: TweakSettings, fix: TweakSettings): { total: number; parts: Record<string, number> } {
  const parts: Record<string, number> = {};
  const gainPct = (a: number, b: number) => {
    const e = Math.abs(a - b);
    return e <= 0.5 ? 100 : e >= 6 ? 0 : Math.round(100 * (1 - (e - 0.5) / 5.5));
  };
  for (const k of level.active) {
    // MID FREQ only matters when the mid band was actually changed
    if (k === 'freq' && fix.mid === 0) continue;
    if (k === 'freq') {
      const oct = Math.abs(Math.log2(answer.freq / fix.freq));
      parts.freq = oct <= 1 / 6 ? 100 : oct >= 1 ? 0 : Math.round(100 * (1 - (oct - 1 / 6) / (5 / 6)));
    } else {
      parts[k] = gainPct(answer[k], fix[k]);
    }
  }
  // The knobs that were actually changed decide the score. Knobs that should have been
  // left alone scale it down if they were moved (so leaving everything flat scores 0,
  // and grabbing the wrong knob costs credit).
  // A changed MID band only counts as found when both its gain AND its frequency are right.
  const bandScore = (k: string) => (k === 'mid' && parts.freq !== undefined ? (parts.mid * parts.freq) / 100 : parts[k]);
  const bandKeys = Object.keys(parts).filter((k) => k !== 'freq');
  const changedKeys = bandKeys.filter((k) => fix[k as keyof TweakSettings] !== 0);
  const untouchedKeys = bandKeys.filter((k) => !changedKeys.includes(k));
  const avg = (keys: string[]) => (keys.length ? keys.reduce((a, k) => a + bandScore(k), 0) / keys.length : 100);
  const total = Math.round(avg(changedKeys) * (avg(untouchedKeys) / 100));
  return { total, parts };
}
