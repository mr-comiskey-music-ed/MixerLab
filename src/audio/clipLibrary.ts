import { audioEngine } from './audioEngine';
import { BUILTIN_SONGS } from './songs';

/*
 * EQ Wizard clip library. Short clips are cut ahead of time (scripts/make-eq-clips.ts) and listed in
 * /eq/clips.json, so the EQ Wizard downloads one small file per question instead of whole songs.
 */

/** One playable clip. `start` and `duration` are the looping part, in seconds into the file. */
export interface Clip {
  file: string;
  songId: string;
  start: number;
  duration: number;
  stemIndex?: number; // set for single-instrument clips
}

/** A single-instrument clip, with how much of its sound is in the low and high bands. */
export interface StemClip extends Clip {
  stemIndex: number;
  stemName: string;
  songTitle: string;
  lowShare: number;  // share of energy below ~150 Hz (0-1)
  highShare: number; // share of energy above ~5 kHz (0-1)
}

interface Manifest {
  mix: Clip[];
  stems: StemClip[];
}

let manifestPromise: Promise<Manifest> | null = null;

/** Loads the clip list (a small JSON file), once. */
export function loadClipLibrary(): Promise<Manifest> {
  if (!manifestPromise) {
    manifestPromise = fetch('/eq/clips.json')
      .then((r) => {
        if (!r.ok) throw new Error(`clips.json: ${r.status}`);
        return r.json() as Promise<{ mix: Clip[]; stems: Omit<StemClip, 'songTitle'>[] }>;
      })
      .then((m) => ({
        mix: m.mix,
        stems: m.stems.map((s) => ({ ...s, songTitle: songTitle(s.songId) }))
      }))
      .catch((err) => {
        manifestPromise = null; // let a later visit try again
        throw err;
      });
  }
  return manifestPromise;
}

export const songTitle = (id: string) => BUILTIN_SONGS.find((s) => s.id === id)?.title ?? id;

/** Songs that have clips in the library, in dropdown order. */
export const songsWithClips = (m: Manifest) => BUILTIN_SONGS.filter((s) => m.mix.some((c) => c.songId === s.id));

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** A random full-mix clip of a song, avoiding recently used ones. */
export function pickMixClip(m: Manifest, songId: string, avoid: Clip[] = []): Clip | null {
  const all = m.mix.filter((c) => c.songId === songId);
  const fresh = all.filter((c) => !avoid.some((a) => a.file === c.file));
  const list = fresh.length ? fresh : all;
  return list.length ? pick(list) : null;
}

// Decoded clips, most recent last. Only a handful are kept so memory stays small on Chromebooks.
const MAX_BUFFERS = 6;
const buffers = new Map<string, Promise<AudioBuffer>>();

/** Downloads and decodes a clip (cached). Call it early to have the next question ready. */
export function getClipBuffer(file: string): Promise<AudioBuffer> {
  const hit = buffers.get(file);
  if (hit) {
    buffers.delete(file);
    buffers.set(file, hit);
    return hit;
  }
  const p = audioEngine.fetchAndDecodeAudio(file).catch((err) => {
    buffers.delete(file);
    throw err;
  });
  buffers.set(file, p);
  while (buffers.size > MAX_BUFFERS) buffers.delete(buffers.keys().next().value as string);
  return p;
}
