import { ChannelSettings, MasterSettings, MyMix, EqWizardScores, EQ_LEVELS, emptyEqScores } from '../types/audio';
import { BUILTIN_SONGS } from '../audio/songs';
import { CHANNEL_DEFAULTS, makeDefaultChannels, makeDefaultMaster } from './mixDefaults';

/**
 * Autosave: keeps a student's work in THEIR OWN browser (localStorage) so closing the tab or
 * reloading doesn't lose it. Nothing is sent anywhere and no name is saved. The submission
 * code is still the only thing a student hands in.
 */

export interface WorkSnapshot {
  scenarios: Record<number, number>;
  whatChangedBest: number;
  whatChangedFinished: boolean;
  matchScores: Record<string, number>;
  learnCompleted: boolean;
  eqScores: EqWizardScores;
  myMix: MyMix | null;
}

const KEY = 'mixerlab:v1:autosave';
const VERSION = 1;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const clampNum = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

// ---------- Cleaning (anything read back from storage is checked before it is used) ----------
function cleanMyMix(raw: unknown): MyMix | null {
  if (!isObj(raw) || typeof raw.songId !== 'string') return null;
  if (!BUILTIN_SONGS.some(s => s.id === raw.songId)) return null;
  const songId = raw.songId;

  const channels: ChannelSettings[] = makeDefaultChannels(songId);
  if (Array.isArray(raw.channels)) {
    raw.channels.slice(0, channels.length).forEach((saved, i) => {
      if (!isObj(saved)) return;
      const target = channels[i] as unknown as Record<string, unknown>;
      for (const [k, def] of Object.entries(CHANNEL_DEFAULTS)) {
        const v = saved[k];
        if (typeof def === 'number' && typeof v === 'number' && Number.isFinite(v)) target[k] = v;
        else if (typeof def === 'boolean' && typeof v === 'boolean') target[k] = v;
      }
      if (typeof saved.name === 'string') target.name = saved.name.slice(0, 16);
    });
  }

  const master: MasterSettings = makeDefaultMaster();
  if (isObj(raw.master)) {
    const m = raw.master;
    const target = master as unknown as Record<string, unknown>;
    for (const k of ['mainFader', 'aux1Master', 'fxReturn', 'phonesLevel', 'chorusIntensity', 'fxDecay']) {
      if (typeof m[k] === 'number' && Number.isFinite(m[k] as number)) target[k] = m[k];
    }
    if (typeof m.fxMute === 'boolean') master.fxMute = m.fxMute;
    if (m.fxType === 'plate' || m.fxType === 'hall' || m.fxType === 'delay' || m.fxType === 'chorus') master.fxType = m.fxType;
    if (m.geqMode === 'off' || m.geqMode === '10' || m.geqMode === '31') master.geqMode = m.geqMode;
    const bands = (v: unknown, n: number) =>
      Array.isArray(v) && v.length === n && v.every(x => typeof x === 'number' && Number.isFinite(x)) ? (v as number[]) : undefined;
    const g10 = bands(m.geq10, 10);
    const g31 = bands(m.geq31, 31);
    if (g10) master.geq10 = g10;
    if (g31) master.geq31 = g31;
  }

  return { songId, channels, master, explanation: typeof raw.explanation === 'string' ? raw.explanation : '' };
}

function cleanEqScores(raw: unknown): EqWizardScores {
  const out = emptyEqScores();
  if (!isObj(raw)) return out;
  for (const section of ['freqid', 'freqband', 'freqtweak'] as const) {
    const arr = raw[section];
    if (Array.isArray(arr)) arr.slice(0, EQ_LEVELS).forEach((v, i) => (out[section][i] = clampNum(v, -1, 100, -1)));
  }
  return out;
}

function cleanSnapshot(raw: unknown): WorkSnapshot | null {
  if (!isObj(raw)) return null;
  const scenarios: Record<number, number> = {};
  if (isObj(raw.scenarios)) {
    for (const [k, v] of Object.entries(raw.scenarios)) {
      const id = Number(k);
      if (Number.isInteger(id)) scenarios[id] = clampNum(v, 0, 1000, 0);
    }
  }
  const matchScores: Record<string, number> = {};
  if (isObj(raw.matchScores)) {
    for (const [k, v] of Object.entries(raw.matchScores)) matchScores[k] = clampNum(v, 0, 100, 0);
  }
  return {
    scenarios,
    whatChangedBest: clampNum(raw.whatChangedBest, 0, 100, 0),
    whatChangedFinished: raw.whatChangedFinished === true,
    matchScores,
    learnCompleted: raw.learnCompleted === true,
    eqScores: cleanEqScores(raw.eqScores),
    myMix: cleanMyMix(raw.myMix)
  };
}

// ---------- Is there anything worth saving? ----------
/** Used so an empty, brand-new session never overwrites a good save. */
export function hasWork(s: WorkSnapshot): boolean {
  if (Object.keys(s.scenarios).length || Object.keys(s.matchScores).length) return true;
  if (s.whatChangedFinished || s.whatChangedBest > 0 || s.learnCompleted) return true;
  if (Object.values(s.eqScores).some(levels => levels.some(v => v >= 0))) return true;
  if (s.myMix) {
    if (s.myMix.explanation.trim()) return true;
    const defaults = { channels: makeDefaultChannels(s.myMix.songId), master: makeDefaultMaster() };
    if (JSON.stringify(s.myMix.channels) !== JSON.stringify(defaults.channels)) return true;
    if (JSON.stringify(s.myMix.master) !== JSON.stringify(defaults.master)) return true;
  }
  return false;
}

// ---------- Storage (every call is wrapped: storage can be blocked, full, or wiped) ----------
export function loadSaved(): { snapshot: WorkSnapshot; savedAt: number } | null {
  try {
    const text = window.localStorage.getItem(KEY);
    if (!text) return null;
    const parsed = JSON.parse(text);
    if (!isObj(parsed) || parsed.v !== VERSION) return null;
    const snapshot = cleanSnapshot(parsed.data);
    if (!snapshot || !hasWork(snapshot)) return null;
    return { snapshot, savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now() };
  } catch {
    return null;
  }
}

/** Returns true if the save worked. */
export function writeSaved(snapshot: WorkSnapshot): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ v: VERSION, savedAt: Date.now(), data: snapshot }));
    return true;
  } catch {
    return false;
  }
}

export function clearSaved(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
