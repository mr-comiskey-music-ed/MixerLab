import { ChannelSettings, MasterSettings, MyMix, StudentSubmission } from '../types/audio';
import { CHANNEL_DEFAULTS, MASTER_DEFAULTS, makeDefaultChannels } from './mixDefaults';

/**
 * Compact submission codes.
 *
 * A student's work is packed into a small structure before it is compressed:
 *   - mixer settings still at their starting values are left out
 *   - short keys replace long field names, booleans travel as 1/0
 *   - channel names are rebuilt from the song on unpack
 * Then the JSON is deflate-compressed (built into every modern browser) and
 * written as URL-safe text with a checksum on the end, so a mistyped or edited
 * code is caught. Nothing leaves the browser and nothing is stored anywhere.
 *
 *   ML3d.<compressed data>.<checksum>     (normal)
 *   ML3j.<uncompressed data>.<checksum>   (fallback for browsers without CompressionStream)
 *
 * Older plain-base64 codes from before this change are still accepted.
 */

const SALT = 'AudioEng2026Salt';

export function fnv1aHash(str: string, salt: string = SALT): string {
  let hash = 0x811c9dc5;
  const combined = salt + str;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ---------- Short keys ----------
type ChannelKey = keyof typeof CHANNEL_DEFAULTS;
const CHANNEL_KEYS: Record<ChannelKey, string> = {
  gain: 'g', phantom48V: 'p', hiZ: 'z', phaseInvert: 'i', lowCut100Hz: 'c', comp: 'k',
  eqHigh: 'h', eqMid: 'm', eqMidFreq: 'f', eqLow: 'l', aux1Pre: 'a', fxPost: 'x',
  pan: 'n', mute: 'u', soloPfl: 's', faderLevel: 'v'
};
const MASTER_KEYS: Record<keyof MasterSettings, string> = {
  mainFader: 'm', aux1Master: 'a', fxReturn: 'r', fxMute: 'u', fxType: 't', phonesLevel: 'p', chorusIntensity: 'c'
};
const invert = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]));
const CHANNEL_LONG = invert(CHANNEL_KEYS);
const MASTER_LONG = invert(MASTER_KEYS);

const round2 = (n: number) => Math.round(n * 100) / 100;
const packVal = (v: unknown) => (v === true ? 1 : v === false ? 0 : typeof v === 'number' ? round2(v) : v);
const unpackLike = (defaultVal: unknown, v: unknown) => (typeof defaultVal === 'boolean' ? v === 1 || v === true : v);

// ---------- Pack ----------
function packChannels(channels: ChannelSettings[], songId: string): unknown[] {
  const defaults = makeDefaultChannels(songId);
  const rows: unknown[] = [];
  channels.forEach((ch, idx) => {
    const diff: Record<string, unknown> = {};
    for (const k of Object.keys(CHANNEL_KEYS) as ChannelKey[]) {
      const v = ch[k] ?? CHANNEL_DEFAULTS[k];
      if (v !== CHANNEL_DEFAULTS[k]) diff[CHANNEL_KEYS[k]] = packVal(v);
    }
    if (defaults[idx] && ch.name !== defaults[idx].name) diff.N = ch.name;
    if (Object.keys(diff).length) rows.push([idx, diff]);
  });
  return rows;
}

function packMaster(master: MasterSettings): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(MASTER_KEYS) as (keyof MasterSettings)[]) {
    const v = master[k];
    if (v === undefined) continue;
    if (v !== MASTER_DEFAULTS[k]) out[MASTER_KEYS[k]] = packVal(v);
  }
  return out;
}

export function packSubmission(sub: StudentSubmission): Record<string, unknown> {
  const out: Record<string, unknown> = {
    t: Math.round(new Date(sub.timestamp).getTime() / 1000),
    n: sub.student.name,
    g: sub.scores.totalPercentage
  };
  if (Object.keys(sub.scores.scenarios).length) out.s = sub.scores.scenarios;
  if (sub.scores.whatChanged) out.w = sub.scores.whatChanged;
  if (Object.keys(sub.scores.matchScores).length) out.m = sub.scores.matchScores;
  if (sub.scores.learnCompleted) out.l = 1;
  if (sub.myMix) {
    const mm: Record<string, unknown> = { s: sub.myMix.songId };
    const ch = packChannels(sub.myMix.channels, sub.myMix.songId);
    if (ch.length) mm.c = ch;
    const ms = packMaster(sub.myMix.master);
    if (Object.keys(ms).length) mm.M = ms;
    if (sub.myMix.explanation.trim()) mm.e = sub.myMix.explanation.trim();
    out.x = mm;
  }
  return out;
}

// ---------- Unpack ----------
function unpackMyMix(mm: Record<string, any>): MyMix {
  const songId = typeof mm.s === 'string' ? mm.s : 'song1';
  const channels = makeDefaultChannels(songId);
  for (const [idx, diff] of (mm.c || []) as [number, Record<string, any>][]) {
    const ch: any = channels[idx];
    if (!ch) continue;
    for (const [k, v] of Object.entries(diff)) {
      if (k === 'N') { ch.name = String(v); continue; }
      const long = CHANNEL_LONG[k] as ChannelKey | undefined;
      if (long) ch[long] = unpackLike(CHANNEL_DEFAULTS[long], v);
    }
  }
  const master: any = { ...MASTER_DEFAULTS };
  for (const [k, v] of Object.entries((mm.M || {}) as Record<string, any>)) {
    const long = MASTER_LONG[k] as keyof MasterSettings | undefined;
    if (long) master[long] = unpackLike((MASTER_DEFAULTS as any)[long], v);
  }
  return { songId, channels, master, explanation: typeof mm.e === 'string' ? mm.e : '' };
}

export function unpackSubmission(packed: Record<string, any>): StudentSubmission {
  return {
    timestamp: new Date((Number(packed.t) || 0) * 1000).toISOString(),
    student: { name: String(packed.n ?? '') },
    scores: {
      scenarios: packed.s || {},
      whatChanged: Number(packed.w) || 0,
      matchScores: packed.m || {},
      learnCompleted: packed.l === 1,
      totalPercentage: Number(packed.g) || 0
    },
    myMix: packed.x ? unpackMyMix(packed.x) : undefined
  };
}

// ---------- Text <-> bytes ----------
function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipeThrough(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream as any);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

const canCompress = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

// ---------- Public API ----------
/** Student code: compressed submission + checksum. Safe to paste into Google Classroom. */
export async function encodeSubmission(sub: StudentSubmission): Promise<string> {
  const json = JSON.stringify(packSubmission(sub));
  const raw = new TextEncoder().encode(json);
  if (canCompress()) {
    const deflated = await pipeThrough(raw, new CompressionStream('deflate-raw'));
    return `ML3d.${bytesToBase64Url(deflated)}.${fnv1aHash(json)}`;
  }
  return `ML3j.${bytesToBase64Url(raw)}.${fnv1aHash(json)}`;
}

export interface DecodedSubmission {
  submission: StudentSubmission;
  isValid: boolean; // false when the checksum doesn't match (edited or damaged code)
}

/** Returns null if the code can't be read at all. */
export async function decodeSubmission(code: string): Promise<DecodedSubmission | null> {
  const raw = code.trim().replace(/\s+/g, '');
  if (!raw) return null;
  try {
    if (raw.startsWith('ML3d.') || raw.startsWith('ML3j.')) {
      const [, body, sum] = raw.split('.');
      if (!body) return null;
      let bytes = base64UrlToBytes(body);
      if (raw.startsWith('ML3d.')) {
        if (!canCompress()) return null;
        bytes = await pipeThrough(bytes, new DecompressionStream('deflate-raw'));
      }
      const json = new TextDecoder().decode(bytes);
      return { submission: unpackSubmission(JSON.parse(json)), isValid: fnv1aHash(json) === sum };
    }
    return decodeLegacy(raw);
  } catch {
    return null;
  }
}

/** Codes made before compression: base64 of {"d": <json>, "h": <checksum>}. */
function decodeLegacy(raw: string): DecodedSubmission | null {
  const envelope = JSON.parse(decodeURIComponent(escape(atob(raw))));
  const payload = JSON.parse(envelope.d);
  const scores = payload.scores || {};
  return {
    isValid: envelope.h === fnv1aHash(envelope.d),
    submission: {
      timestamp: payload.timestamp || new Date(0).toISOString(),
      student: { name: payload.student?.name ?? '' },
      scores: {
        scenarios: scores.scenarios || {},
        whatChanged: 0,
        matchScores: scores.matchScore ? { legacy: scores.matchScore } : {},
        learnCompleted: Boolean(scores.learnCompleted),
        totalPercentage: Number(scores.totalPercentage) || 0
      },
      legacy: true
    }
  };
}
