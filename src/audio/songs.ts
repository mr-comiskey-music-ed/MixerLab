import { SongDefinition } from '../types/audio';

/** dB to a gain multiplier. */
const dB = (db: number) => Math.pow(10, db / 20);

/*
 * The six recorded songs, in dropdown order. Card Game is the default song and the one the
 * Learn steps and Scenarios are written around.
 *
 * Channel order: drums, other percussion, bass, chords / pads / synths / guitars, melody on channel 6.
 * Names are what shows on the channel strip: about 13 characters fit on the digital console.
 *
 * Every stem is trimmed before the mixer (gainFactor) so each song's full mix, with all faders at 0,
 * peaks near -12 dBFS and nothing clips the master.
 */
export const BUILTIN_SONGS: SongDefinition[] = [
  {
    id: 'song1',
    title: 'Card Game (Indie)',
    bpm: 145,
    key: 'Indie',
    durationSec: 26.568,
    // Base -3 dB trim plus a balance set by ear on the console faders (Drums +3, Bass -2.5, E Guits -2,
    // A Guit -3.5, Piano & Organ -5, Vocals +0.5), baked in so the faders start at 0 on a balanced mix.
    // Full mix peaks near -13.4 dBFS with all faders at 0.
    stems: [
      { id: 1, name: 'Drums', type: 'drums', color: '#f87171', url: '/audio/Drums_CardGame.mp3', gainFactor: dB(-3 + 3.0) },
      { id: 2, name: 'Bass', type: 'bass', color: '#60a5fa', url: '/audio/Bass_CardGame.mp3', gainFactor: dB(-3 - 2.5) },
      { id: 3, name: 'E Guits', type: 'guitar', color: '#f97316', url: '/audio/EGuits_CardGame.mp3', gainFactor: dB(-3 - 2.0) },
      { id: 4, name: 'A Guit', type: 'guitar', color: '#4ade80', url: '/audio/AGuit_CardGame.mp3', gainFactor: dB(-3 - 3.5) },
      { id: 5, name: 'Piano & Organ', type: 'synth', color: '#c084fc', url: '/audio/PnoOrg_CardGame.mp3', gainFactor: dB(-3 - 5.0) },
      { id: 6, name: 'Vocals', type: 'vocal', color: '#facc15', url: '/audio/Vocals_CardGame.mp3', gainFactor: dB(-3 + 0.5) }
    ]
  },
  {
    id: 'song6',
    title: 'Free (Hip Hop)',
    bpm: 96,
    key: 'Hip Hop',
    durationSec: 40.032,
    stems: [
      { id: 1, name: 'Drums', type: 'drums', color: '#f87171', url: '/audio/Drums_Free.mp3', gainFactor: dB(-3) },
      { id: 2, name: '808', type: 'bass', color: '#60a5fa', url: '/audio/808_Free.mp3', gainFactor: dB(-3) },
      { id: 3, name: 'Other', type: 'synth', color: '#c084fc', url: '/audio/Other_Free.mp3', gainFactor: dB(-3) },
      { id: 4, name: 'Hums', type: 'vocal', color: '#2dd4bf', url: '/audio/Hums_Free.mp3', gainFactor: dB(-3) },
      { id: 5, name: 'Vox Dbl/AdLib', type: 'vocal', color: '#fb923c', url: '/audio/VocalDblAdLib_Free.mp3', gainFactor: dB(-3) },
      { id: 6, name: 'Lead Vocal', type: 'vocal', color: '#facc15', url: '/audio/LeadVocal_Free.mp3', gainFactor: dB(-3) }
    ]
  },
  {
    id: 'song2',
    title: 'Give My Heart (Rock)',
    bpm: 125,
    key: 'Rock',
    durationSec: 65.856,
    // drums -2 dB, vocals -4.5 dB, everything else -3 dB on top of a -5.5 dB base trim
    stems: [
      { id: 1, name: 'Drums', type: 'drums', color: '#f87171', url: '/audio/Drums_GMH.mp3', gainFactor: 0.95 * dB(-5.5 - 2) },
      { id: 2, name: 'Bass', type: 'bass', color: '#60a5fa', url: '/audio/Bass_GMH.mp3', gainFactor: 0.95 * dB(-5.5 - 3) },
      { id: 3, name: 'Dist E Guit', type: 'guitar', color: '#f97316', url: '/audio/DistEGuit_GMH.mp3', gainFactor: 0.95 * dB(-5.5 - 3) },
      { id: 4, name: 'Clean E Guit', type: 'guitar', color: '#4ade80', url: '/audio/CleanEGuit_GMH.mp3', gainFactor: 0.95 * dB(-5.5 - 3) },
      { id: 5, name: 'A Guit', type: 'guitar', color: '#facc15', url: '/audio/AGuit_GMH.mp3', gainFactor: 0.95 * dB(-5.5 - 3) },
      { id: 6, name: 'Vocals', type: 'vocal', color: '#c084fc', url: '/audio/Vocals_GMH.mp3', gainFactor: 0.95 * dB(-5.5 - 4.5) }
    ]
  },
  {
    id: 'song3',
    title: 'Tubular (Modern Hip Hop Beat)',
    bpm: 140,
    key: 'Hip Hop',
    durationSec: 28.68,
    stems: [
      { id: 1, name: '808 & Kick', type: 'drums', color: '#f87171', url: '/audio/808 Kick_HipHop.mp3', gainFactor: dB(-3.5) },
      { id: 2, name: 'Snares', type: 'drums', color: '#fb923c', url: '/audio/Snares_HipHop.mp3', gainFactor: dB(-3.5) },
      { id: 3, name: 'Hi-Hats', type: 'perc', color: '#facc15', url: '/audio/Hi-Hats_HipHop.mp3', gainFactor: dB(-3.5) },
      { id: 4, name: 'Bell', type: 'perc', color: '#2dd4bf', url: '/audio/Bell_HipHop.mp3', gainFactor: dB(-3.5) },
      // extra -5 dB so the synths & strings sit behind the other parts
      { id: 5, name: 'Synths & Strings', type: 'synth', color: '#c084fc', url: '/audio/SynthsStrings_HipHop.mp3', gainFactor: dB(-3.5 - 5) },
      { id: 6, name: 'Piano', type: 'synth', color: '#60a5fa', url: '/audio/Piano_HipHop.mp3', gainFactor: dB(-3.5) }
    ]
  },
  {
    id: 'song4',
    title: 'Summertime (Afrobeat)',
    bpm: 96,
    key: 'Afrobeat',
    durationSec: 20.062,
    // per-stem gains set by ear in the console
    stems: [
      { id: 1, name: 'Drums', type: 'drums', color: '#f87171', url: '/audio/Drums_Summertime.mp3', gainFactor: dB(-7) },
      { id: 2, name: 'Perc', type: 'perc', color: '#fb923c', url: '/audio/Perc_Summertime.mp3', gainFactor: dB(-6.5) },
      { id: 3, name: 'Bass', type: 'bass', color: '#60a5fa', url: '/audio/Bass_Summertime.mp3', gainFactor: dB(-6.5) },
      { id: 4, name: 'Synths', type: 'synth', color: '#c084fc', url: '/audio/Synths_Summertime.mp3', gainFactor: dB(-6.5) },
      { id: 5, name: 'Ear Candy', type: 'synth', color: '#4ade80', url: '/audio/Riffs_Summertime.mp3', gainFactor: dB(-6.5) },
      { id: 6, name: 'Vocals', type: 'vocal', color: '#facc15', url: '/audio/Vocals_Summertime.mp3', gainFactor: dB(-8) }
    ]
  },
  {
    id: 'song5',
    title: 'Quack (Funk Groove)',
    bpm: 104,
    key: 'Funk',
    durationSec: 36.989,
    stems: [
      { id: 1, name: 'Drums', type: 'drums', color: '#f87171', url: '/audio/Drums_Quack.mp3', gainFactor: dB(-10) },
      { id: 2, name: 'Bass', type: 'bass', color: '#60a5fa', url: '/audio/Bass_Quack.mp3', gainFactor: dB(-10) },
      { id: 3, name: 'Synth Swells', type: 'synth', color: '#c084fc', url: '/audio/Synth Swells_Quack.mp3', gainFactor: dB(-10) },
      { id: 4, name: 'Synth Wobbles', type: 'synth', color: '#2dd4bf', url: '/audio/Synth Wobbles_Quack.mp3', gainFactor: dB(-10) },
      { id: 5, name: 'E Guit', type: 'guitar', color: '#4ade80', url: '/audio/EGuit_Quack.mp3', gainFactor: dB(-10) },
      { id: 6, name: 'Melody&Quack', type: 'synth', color: '#facc15', url: '/audio/Melody&Quack_Quack.mp3', gainFactor: dB(-10) }
    ]
  }
];

/** The song the app opens with, and the one the Learn steps and Scenarios use. */
export const DEFAULT_SONG_ID = 'song1';
