import { audioEngine } from './audioEngine';
import { BUILTIN_SONGS } from './stemSynthesizer';

/**
 * Finds listening clips for the EQ Wizard: stretches of a song (or a single stem)
 * that have sound all the way through, so nobody is asked to judge EQ on silence.
 * Also measures how much low and high end each stem has, so an EQ change is only
 * put on a part where it can actually be heard. Everything is worked out from the
 * audio itself, so new songs added to the app work without extra setup.
 */

const BLOCK = 0.25; // seconds per loudness block

export interface StemInfo {
  songId: string;
  songTitle: string;
  stemIndex: number;
  stemName: string;
  buffer: AudioBuffer;
  blocksDb: number[];  // loudness per 0.25 s block
  lowShare: number;    // share of energy below ~150 Hz (0-1)
  highShare: number;   // share of energy above ~5 kHz (0-1)
}

export interface Clip {
  songId: string;
  start: number;    // seconds
  duration: number; // seconds
  stemIndex?: number; // set for single-stem clips
}

/** Songs made from real recordings (the funk song is generated, so it's left out). */
export const EQ_WIZARD_SONGS = BUILTIN_SONGS.filter((s) => s.id !== 'song1' && s.stems.some((st) => !!st.url));

const stemCache = new Map<string, Promise<StemInfo[]>>();

function blockLevels(buf: AudioBuffer): number[] {
  const sr = buf.sampleRate;
  const blockLen = Math.floor(sr * BLOCK);
  const chans = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  const out: number[] = [];
  for (let start = 0; start + blockLen <= buf.length; start += blockLen) {
    let sum = 0;
    for (const d of chans) for (let i = start; i < start + blockLen; i += 2) sum += d[i] * d[i];
    const ms = sum / ((blockLen / 2) * chans.length);
    out.push(10 * Math.log10(ms + 1e-12));
  }
  return out;
}

function bandShares(buf: AudioBuffer): { low: number; high: number } {
  const sr = buf.sampleRate;
  const d = buf.getChannelData(0);
  const aLow = Math.exp((-2 * Math.PI * 150) / sr);
  const aHigh = Math.exp((-2 * Math.PI * 5000) / sr);
  let lp = 0, lp5k = 0, eTot = 0, eLow = 0, eHigh = 0;
  for (let i = 0; i < d.length; i++) {
    const x = d[i];
    lp = (1 - aLow) * x + aLow * lp;      // one-pole low-pass at 150 Hz
    lp5k = (1 - aHigh) * x + aHigh * lp5k; // one-pole low-pass at 5 kHz
    const hp = x - lp5k;                   // everything above ~5 kHz
    eTot += x * x;
    eLow += lp * lp;
    eHigh += hp * hp;
  }
  return { low: eTot ? eLow / eTot : 0, high: eTot ? eHigh / eTot : 0 };
}

/** Loads a song's stems and measures them (cached after the first call). */
export function getSongStems(songId: string): Promise<StemInfo[]> {
  if (!stemCache.has(songId)) {
    stemCache.set(
      songId,
      (async () => {
        const song = BUILTIN_SONGS.find((s) => s.id === songId)!;
        const buffers = await audioEngine.preloadSong(songId);
        return buffers.map((buffer, stemIndex) => {
          const shares = bandShares(buffer);
          return {
            songId,
            songTitle: song.title,
            stemIndex,
            stemName: song.stems[stemIndex]?.name || `Stem ${stemIndex + 1}`,
            buffer,
            blocksDb: blockLevels(buffer),
            lowShare: shares.low,
            highShare: shares.high
          };
        });
      })()
    );
  }
  return stemCache.get(songId)!;
}

export async function loadAllWizardStems(): Promise<StemInfo[]> {
  const all = await Promise.all(EQ_WIZARD_SONGS.map((s) => getSongStems(s.id)));
  return all.flat();
}

/**
 * Start times (s) where every 0.25 s block in the window is "awake": no more than
 * `dropDb` below the part's typical loud level, and above an absolute floor.
 */
export function goodStarts(blocksDb: number[], durationSec: number, dropDb = 18, floorDb = -55): number[] {
  if (blocksDb.length === 0) return [];
  const sorted = [...blocksDb].sort((a, b) => a - b);
  const typical = sorted[Math.floor(sorted.length * 0.85)];
  const threshold = Math.max(floorDb, typical - dropDb);
  const need = Math.ceil(durationSec / BLOCK);
  // Drums and other hits have short natural gaps; judge each moment by the loudest
  // block within about a second around it, so only real dropouts (silent stretches) count.
  const ok = blocksDb.map((_, i) => Math.max(...blocksDb.slice(Math.max(0, i - 2), i + 2)) >= threshold);
  const starts: number[] = [];
  let run = 0;
  for (let i = 0; i < ok.length; i++) {
    run = ok[i] ? run + 1 : 0;
    if (run >= need) starts.push((i - need + 1) * BLOCK);
  }
  // keep them spread out so clips don't all start at nearly the same place
  return starts.filter((_, i) => i % 4 === 0);
}

/** Loudness of the full mix per block (power sum of all stems). */
export function mixBlocks(stems: StemInfo[]): number[] {
  const len = Math.min(...stems.map((s) => s.blocksDb.length));
  return Array.from({ length: len }, (_, i) =>
    10 * Math.log10(stems.reduce((acc, s) => acc + Math.pow(10, s.blocksDb[i] / 10), 0) + 1e-12)
  );
}

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/**
 * Sections of a song that make confusing EQ examples. Tubular opens with about six
 * seconds of a heavily filtered hi-hat, so clips from it start after that.
 */
const SKIP_UNTIL: Record<string, number> = { song3: 6.5 };
const afterIntro = (songId: string, starts: number[]) => starts.filter((s) => s >= (SKIP_UNTIL[songId] ?? 0));

/** A random full-mix clip, avoiding recently used start points. */
export function pickMixClip(songStems: StemInfo[], duration: number, avoid: Clip[] = []): Clip | null {
  const starts = afterIntro(songStems[0].songId, goodStarts(mixBlocks(songStems), duration));
  const fresh = starts.filter((s) => !avoid.some((c) => c.songId === songStems[0].songId && Math.abs(c.start - s) < duration));
  const list = fresh.length ? fresh : starts;
  if (!list.length) return null;
  return { songId: songStems[0].songId, start: pick(list), duration };
}

/** A random clip of one stem with sound all the way through. */
export function pickStemClip(stem: StemInfo, duration: number): Clip | null {
  const starts = afterIntro(stem.songId, goodStarts(stem.blocksDb, duration));
  if (!starts.length) return null;
  return { songId: stem.songId, start: pick(starts), duration, stemIndex: stem.stemIndex };
}
