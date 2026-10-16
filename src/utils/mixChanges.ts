import { ChannelSettings, MasterSettings, MyMix } from '../types/audio';
import { CHANNEL_DEFAULTS, MASTER_DEFAULTS } from './mixDefaults';

const db = (v: number) => (v <= -59 ? '-∞ dB' : `${v > 0 ? '+' : ''}${Math.round(v * 10) / 10} dB`);
const pan = (p: number) => (Math.abs(p) < 0.02 ? 'C' : p < 0 ? `L${Math.round(-p * 64)}` : `R${Math.round(p * 64)}`);
const hz = (f: number) => (f >= 1000 ? `${(f / 1000).toFixed(1)}k` : `${Math.round(f)} Hz`);

/** Plain-language list of every setting that differs from a fresh, zeroed console. */
function channelChanges(c: ChannelSettings): string[] {
  const d = CHANNEL_DEFAULTS;
  const out: string[] = [];
  if (c.faderLevel !== d.faderLevel) out.push(`fader ${db(c.faderLevel)}`);
  if (c.pan !== d.pan) out.push(`pan ${pan(c.pan)}`);
  if (c.mute) out.push('MUTED');
  if (c.gain !== d.gain) out.push(`gain ${db(c.gain)}`);
  if (c.comp !== d.comp) out.push(`comp ${Math.round(c.comp)}`);
  if (c.lowCut100Hz) out.push('low cut on');
  if (c.phaseInvert) out.push('phase flipped');
  if (c.eqHigh !== d.eqHigh) out.push(`high ${db(c.eqHigh)}`);
  if (c.eqMid !== d.eqMid) out.push(`mid ${db(c.eqMid)} @ ${hz(c.eqMidFreq)}`);
  if (c.eqLow !== d.eqLow) out.push(`low ${db(c.eqLow)}`);
  if (c.fxPost !== d.fxPost) out.push(`FX send ${db(c.fxPost)}`);
  if (c.aux1Pre !== d.aux1Pre) out.push(`aux ${db(c.aux1Pre)}`);
  return out;
}

function masterChanges(m: MasterSettings): string[] {
  const d = MASTER_DEFAULTS;
  const out: string[] = [];
  if (m.mainFader !== d.mainFader) out.push(`main fader ${db(m.mainFader)}`);
  if (m.fxType !== d.fxType) out.push(`FX type ${m.fxType}`);
  if (m.fxReturn !== d.fxReturn) out.push(`FX return ${db(m.fxReturn)}`);
  if (m.fxMute) out.push('FX muted');
  if ((m.fxDecay ?? 50) !== 50) out.push(`reverb decay ${Math.round(m.fxDecay!)}%`);
  if ((m.chorusIntensity ?? 50) !== 50) out.push(`chorus ${Math.round(m.chorusIntensity!)}%`);
  if (m.geqMode && m.geqMode !== 'off') {
    const bands = (m.geqMode === '10' ? m.geq10 : m.geq31) ?? [];
    out.push(`${m.geqMode}-band graphic EQ (${bands.filter((x) => x !== 0).length} bands moved)`);
  }
  return out;
}

export interface MixChangeSummary {
  count: number;
  rows: { name: string; changes: string[] }[];
}

export function summarizeMixChanges(mix: MyMix): MixChangeSummary {
  const rows = mix.channels.map((c) => ({ name: `${c.id}. ${c.name}`, changes: channelChanges(c) }));
  rows.push({ name: 'Master', changes: masterChanges(mix.master) });
  return { count: rows.reduce((a, r) => a + r.changes.length, 0), rows };
}
