/**
 * Builds the EQ Wizard clip library: short, ready-to-play clips cut from the songs, so the
 * EQ Wizard downloads one small file per question instead of every stem of every song.
 *
 *   bun scripts/make-eq-clips.ts          (needs ffmpeg; writes public/eq/)
 *
 * - Mix clips (Freq Band ID): all six stems mixed at the app's level trims.
 * - Stem clips (Freq Tweak): one instrument on its own.
 * A clip is only used where every moment has sound (no dropouts, no fade-ins), using the same
 * rules the app used when it picked clips live. Each file has a little extra audio before and
 * after the part that loops (`start` in the list says where the loop begins), so loop points
 * never land on the encoder's silent padding.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BUILTIN_SONGS } from '../src/audio/songs';

const ROOT = join(import.meta.dir, '..');
const OUT = join(ROOT, 'public', 'eq');
const SR = 44100;
const BLOCK = 0.25;
const MIX_SECONDS = 9; // Freq Band ID clip length
const STEM_SECONDS = 8; // Freq Tweak clip length
const PAD = 0.3; // extra audio either side of the loop
const MIX_PER_SONG = 8;
const MIX_SPACING = 3; // seconds between mix clip starts
const STEM_PER_PART = 3;
const STEM_SPACING = 6;
/** Sections that make confusing EQ examples (Tubular opens with ~6 s of filtered hi-hat). */
const SKIP_UNTIL: Record<string, number> = { song3: 6.5 };
/** Single-instrument parts that make poor Freq Tweak examples ("song:stemIndex", 0-based). */
const EXCLUDE_STEMS = new Set([
  'song6:4' // Free > Vox Dbl/AdLib: already heavily mid-boosted to sit behind the lead
]);
/** Latest clip start for a part, to keep clips off a long decay at the end ("song:stemIndex" -> seconds). */
const LAST_START: Record<string, number> = {
  'song2:2': 50 // Give My Heart > Dist E Guit: the last chord rings out from ~53 s
};

type Stereo = [Float32Array, Float32Array];

function decode(url: string, gain: number): Stereo {
  const file = join(ROOT, 'public', decodeURI(url));
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg failed on ${file}: ${r.stderr}`);
  const all = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.byteLength / 4);
  const n = all.length / 2;
  const l = new Float32Array(n), rr = new Float32Array(n);
  for (let i = 0; i < n; i++) { l[i] = all[2 * i] * gain; rr[i] = all[2 * i + 1] * gain; }
  return [l, rr];
}

function blockLevels([l, r]: Stereo): number[] {
  const len = Math.floor(SR * BLOCK);
  const out: number[] = [];
  for (let s = 0; s + len <= l.length; s += len) {
    let sum = 0;
    for (let i = s; i < s + len; i += 2) sum += l[i] * l[i] + r[i] * r[i];
    out.push(10 * Math.log10(sum / len + 1e-12));
  }
  return out;
}

/**
 * Same rule as the app's old live picker: every moment has sound near the part's typical level within
 * `reach` blocks either side. Full mixes get a longer reach so stop-time grooves (like Quack) still count.
 */
function goodStarts(blocksDb: number[], seconds: number, reach = 2, dropDb = 18, floorDb = -55): number[] {
  if (!blocksDb.length) return [];
  const sorted = [...blocksDb].sort((a, b) => a - b);
  const typical = sorted[Math.floor(sorted.length * 0.85)];
  const threshold = Math.max(floorDb, typical - dropDb);
  const need = Math.ceil(seconds / BLOCK);
  const ok = blocksDb.map((_, i) => Math.max(...blocksDb.slice(Math.max(0, i - reach), i + reach)) >= threshold);
  const starts: number[] = [];
  let run = 0;
  for (let i = 0; i < ok.length; i++) {
    run = ok[i] ? run + 1 : 0;
    if (run >= need) starts.push((i - need + 1) * BLOCK);
  }
  return starts;
}

/** Up to `count` starts, spread across the song, at least `spacing` seconds apart. */
function spread(starts: number[], count: number, spacing: number): number[] {
  if (!starts.length) return [];
  const chosen: number[] = [];
  const span = starts[starts.length - 1] - starts[0];
  const n = Math.min(count, Math.floor(span / spacing) + 1);
  for (let k = 0; k < n; k++) {
    const target = starts[0] + (n === 1 ? 0 : (span * k) / (n - 1));
    const best = starts.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
    if (chosen.every((c) => Math.abs(c - best) >= spacing)) chosen.push(best);
  }
  return chosen.sort((a, b) => a - b);
}

/** Share of energy below ~150 Hz and above ~5 kHz (decides which EQ bands a part can be tested on). */
function bandShares(x: Float32Array): { low: number; high: number } {
  const aLow = Math.exp((-2 * Math.PI * 150) / SR), aHigh = Math.exp((-2 * Math.PI * 5000) / SR);
  let lp = 0, lp5k = 0, eTot = 0, eLow = 0, eHigh = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    lp = (1 - aLow) * v + aLow * lp;
    lp5k = (1 - aHigh) * v + aHigh * lp5k;
    const hp = v - lp5k;
    eTot += v * v; eLow += lp * lp; eHigh += hp * hp;
  }
  return { low: eTot ? eLow / eTot : 0, high: eTot ? eHigh / eTot : 0 };
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

function writeClip([l, r]: Stereo, start: number, seconds: number, name: string) {
  const a = Math.max(0, Math.round((start - PAD) * SR));
  const b = Math.min(l.length, Math.round((start + seconds + PAD) * SR));
  const inter = new Float32Array((b - a) * 2);
  for (let i = a; i < b; i++) { inter[2 * (i - a)] = l[i]; inter[2 * (i - a) + 1] = r[i]; }
  const res = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', '-', '-c:a', 'libmp3lame', '-q:a', '3', join(OUT, name)], { input: Buffer.from(inter.buffer) });
  if (res.status !== 0) throw new Error(`encode failed: ${res.stderr}`);
  return { file: `/eq/${name}`, start: round3(start - a / SR), duration: seconds };
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const mix: object[] = [];
const stems: object[] = [];

for (const song of BUILTIN_SONGS) {
  const parts = song.stems.map((st) => decode(st.url!, st.gainFactor ?? 1));
  const n = Math.min(...parts.map((p) => p[0].length));
  const sum: Stereo = [new Float32Array(n), new Float32Array(n)];
  for (const [l, r] of parts) for (let i = 0; i < n; i++) { sum[0][i] += l[i]; sum[1][i] += r[i]; }
  const skip = SKIP_UNTIL[song.id] ?? 0;
  const tag = song.id;

  const mixStarts = spread(goodStarts(blockLevels(sum), MIX_SECONDS, 4).filter((s) => s >= skip), MIX_PER_SONG, MIX_SPACING);
  mixStarts.forEach((s, k) => mix.push({ songId: song.id, ...writeClip(sum, s, MIX_SECONDS, `mix_${tag}_${k + 1}.mp3`) }));

  parts.forEach((p, idx) => {
    const key = `${song.id}:${idx}`;
    if (EXCLUDE_STEMS.has(key)) return;
    const last = LAST_START[key] ?? Infinity;
    const starts = spread(goodStarts(blockLevels(p), STEM_SECONDS).filter((s) => s >= skip && s <= last), STEM_PER_PART, STEM_SPACING);
    starts.forEach((s, k) => {
      const a = Math.round(s * SR), b = Math.round((s + STEM_SECONDS) * SR);
      const shares = bandShares(p[0].subarray(a, b));
      stems.push({
        songId: song.id, stemIndex: idx, stemName: song.stems[idx].name,
        lowShare: round3(shares.low), highShare: Math.round(shares.high * 1e5) / 1e5,
        ...writeClip(p, s, STEM_SECONDS, `stem_${tag}_${idx + 1}_${k + 1}.mp3`)
      });
    });
  });
  console.log(`${song.title}: ${mixStarts.length} mix clips, ${stems.filter((x: any) => x.songId === song.id).length} stem clips`);
}

writeFileSync(join(OUT, 'clips.json'), JSON.stringify({ mix, stems }, null, 1));
const total = [...mix, ...stems].reduce((t, c: any) => t + statSync(join(ROOT, 'public', c.file)).size, 0);
console.log(`total: ${mix.length} mix + ${stems.length} stem clips, ${(total / 1e6).toFixed(1)} MB`);
