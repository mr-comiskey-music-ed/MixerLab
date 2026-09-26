/**
 * Authentic Logarithmic Audio-Taper Fader Mapping & Scale Alignment.
 *
 * Modeled on physical mixing console fader throws:
 * [+10, +5, 0, -5, -10, -20, -30, -∞]
 *
 * Distributed across 7 uniform faceplate intervals:
 * - +10 dB : 100.0% (Top of throw)
 * -  +5 dB : 85.71% (6/7)
 * -   0 dB : 71.43% (5/7) -> Unity gain
 * -  -5 dB : 57.14% (4/7)
 * - -10 dB : 42.86% (3/7)
 * - -20 dB : 28.57% (2/7)
 * - -30 dB : 14.29% (1/7)
 * -  -∞ dB : 0.00%  (0/7) -> Cutoff (-60 dB)
 *
 * Crucial Audio Engineering Advantages:
 * 1. Wide resolution near unity: +10 dB to -10 dB spans 57.1% of the entire fader travel.
 * 2. Natural negative taper: moving from 0 dB to -20 dB covers ~42.9% of the stroke,
 *    eliminating the sudden drop-off.
 * 3. Exact alignment: the slider thumb indicator line directly matches the faceplate markings.
 */

export interface FaderScalePoint {
  pos: number; // Normalized 0..100
  db: number;
  label: string;
  isUnity?: boolean;
}

export const FADER_SCALE_POINTS: readonly FaderScalePoint[] = [
  { pos: 100, db: 10, label: '+10' },
  { pos: (6 / 7) * 100, db: 5, label: '+5' },
  { pos: (5 / 7) * 100, db: 0, label: '0', isUnity: true },
  { pos: (4 / 7) * 100, db: -5, label: '-5' },
  { pos: (3 / 7) * 100, db: -10, label: '-10' },
  { pos: (2 / 7) * 100, db: -20, label: '-20' },
  { pos: (1 / 7) * 100, db: -30, label: '-30' },
  { pos: 0, db: -60, label: '-∞' },
] as const;

// Normalized position 0..100 -> dB value (-60 to +10 dB)
export function sliderPosToDb(pos: number): number {
  if (pos <= 0.5) return -60;
  if (pos >= 99.5) return 10;

  // Check near-calibration points for exact integer landing
  for (const pt of FADER_SCALE_POINTS) {
    if (Math.abs(pos - pt.pos) < 0.4) {
      return pt.db;
    }
  }

  // Linear interpolation between bounding calibration points
  for (let i = 0; i < FADER_SCALE_POINTS.length - 1; i++) {
    const pUpper = FADER_SCALE_POINTS[i];
    const pLower = FADER_SCALE_POINTS[i + 1];

    if (pos >= pLower.pos && pos <= pUpper.pos) {
      const span = pUpper.pos - pLower.pos;
      if (span <= 0) return pLower.db;
      const t = (pos - pLower.pos) / span;
      const rawDb = pLower.db + t * (pUpper.db - pLower.db);
      // Snap to 0.5 dB
      return Math.round(rawDb * 2) / 2;
    }
  }

  return 0;
}

// dB value (-60 to +10 dB) -> Normalized position 0..100
export function dbToSliderPos(db: number): number {
  if (db <= -59.5) return 0;
  if (db >= 10) return 100;

  // Exact match with calibration points
  for (const pt of FADER_SCALE_POINTS) {
    if (Math.abs(db - pt.db) < 0.05) {
      return Math.round(pt.pos * 10) / 10;
    }
  }

  for (let i = 0; i < FADER_SCALE_POINTS.length - 1; i++) {
    const pUpper = FADER_SCALE_POINTS[i];
    const pLower = FADER_SCALE_POINTS[i + 1];

    if (db >= pLower.db && db <= pUpper.db) {
      const dbSpan = pUpper.db - pLower.db;
      if (dbSpan <= 0) return pLower.pos;
      const t = (db - pLower.db) / dbSpan;
      const rawPos = pLower.pos + t * (pUpper.pos - pLower.pos);
      return Math.round(rawPos * 10) / 10;
    }
  }

  return Math.round((5 / 7) * 1000) / 10; // default to unity (71.4%)
}
