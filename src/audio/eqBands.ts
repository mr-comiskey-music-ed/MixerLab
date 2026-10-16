/** Standard ISO graphic EQ band centers (Hz). */
export const GEQ_10 = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const GEQ_31 = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000,
  1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000
];
// Bandwidths: one octave (10-band) and one-third octave (31-band)
export const GEQ_10_Q = 1.41;
export const GEQ_31_Q = 4.32;
export const GEQ_RANGE_DB = 12;

export const formatHz = (f: number) =>
  f >= 1000 ? `${Number((f / 1000).toFixed(f % 1000 === 0 ? 0 : f >= 10000 ? 1 : 2))}k` : `${f}`;
