import { ChannelSettings, MasterSettings } from '../types/audio';
import { BUILTIN_SONGS, DEFAULT_SONG_ID } from '../audio/songs';

/** Starting settings for one channel strip (a "zeroed" console). */
export const CHANNEL_DEFAULTS: Omit<ChannelSettings, 'id' | 'name' | 'type'> = {
  gain: 0,
  phantom48V: false,
  hiZ: false,
  phaseInvert: false,
  lowCut100Hz: false,
  comp: 0,
  eqHigh: 0,
  eqMid: 0,
  eqMidFreq: 2500,
  eqLow: 0,
  aux1Pre: -60,
  fxPost: -60,
  pan: 0,
  mute: false,
  soloPfl: false,
  faderLevel: 0
};

export const MASTER_DEFAULTS: MasterSettings = {
  mainFader: 0,
  aux1Master: 0,
  fxReturn: 0,
  fxMute: false,
  fxType: 'plate',
  phonesLevel: 75
};

/** Six zeroed channels, named after the stems of the given song. */
export function makeDefaultChannels(songId: string = DEFAULT_SONG_ID): ChannelSettings[] {
  const song = BUILTIN_SONGS.find(s => s.id === songId) || BUILTIN_SONGS[0];
  return song.stems.map((stem, idx) => ({
    id: idx + 1,
    name: stem.name,
    type: stem.type,
    ...CHANNEL_DEFAULTS
  }));
}

export function makeDefaultMaster(): MasterSettings {
  return { ...MASTER_DEFAULTS };
}
