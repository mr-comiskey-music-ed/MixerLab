import { SongDefinition } from '../types/audio';

/**
 * AUDIO_LIBRARY_BASE64_TEMPLATE
 * Instructors and audio engineers can paste downsampled 64/96kbps Base64 MP3 or WAV
 * data strings here (e.g., 'data:audio/mp3;base64,...').
 * When present, the engine automatically decodes and prioritizes these real audio files!
 */
export const AUDIO_LIBRARY_BASE64_TEMPLATE: Record<string, string[]> = {
  song1: [
    "", // Ch 1 Kick/Snare
    "", // Ch 2 Electric Bass
    "", // Ch 3 Lead Vocal
    "", // Ch 4 Electric Guitar
    "", // Ch 5 Analog Synth Pad
    ""  // Ch 6 Percussion/Aux
  ],
  song2: ["", "", "", "", "", ""],
  song3: ["", "", "", "", "", ""]
};

export const BUILTIN_SONGS: SongDefinition[] = [
  {
    id: "song1",
    title: "Funk Groove in Em (110 BPM)",
    bpm: 110,
    key: "Em",
    stems: [
      { id: 1, name: "Kick / Snare", type: "drums", color: "#f87171" },
      { id: 2, name: "E. Bass", type: "bass", color: "#60a5fa" },
      { id: 3, name: "Lead Vocal", type: "vocal", color: "#facc15" },
      { id: 4, name: "E. Guitar", type: "guitar", color: "#4ade80" },
      { id: 5, name: "Synth Pad", type: "synth", color: "#c084fc" },
      { id: 6, name: "Perc / Aux", type: "perc", color: "#fb923c" }
    ]
  },
  {
    id: "song2",
    title: "Give My Heart",
    bpm: 125,
    key: "Rock",
    stemGainDb: -5.95,
    // Extra trim before the mixer so all six stems together no longer peak the master:
    // drums -2 dB, vocals -4.5 dB, everything else -3 dB
    stems: [
      { id: 1, name: "Drums", type: "drums", color: "#f87171", url: "/audio/Drums_GMH.mp3", gainFactor: 0.95 * Math.pow(10, -5.5 / 20) * Math.pow(10, -2 / 20) },
      { id: 2, name: "Bass", type: "bass", color: "#60a5fa", url: "/audio/Bass_GMH.mp3", gainFactor: 0.95 * Math.pow(10, -5.5 / 20) * Math.pow(10, -3 / 20) },
      { id: 3, name: "Dist E Guit", type: "guitar", color: "#f97316", url: "/audio/DistEGuit_GMH.mp3", gainFactor: 0.95 * Math.pow(10, -5.5 / 20) * Math.pow(10, -3 / 20) },
      { id: 4, name: "Clean E Guit", type: "guitar", color: "#4ade80", url: "/audio/CleanEGuit_GMH.mp3", gainFactor: 0.95 * Math.pow(10, -5.5 / 20) * Math.pow(10, -3 / 20) },
      { id: 5, name: "A Guit", type: "guitar", color: "#facc15", url: "/audio/AGuit_GMH.mp3", gainFactor: 0.95 * Math.pow(10, -5.5 / 20) * Math.pow(10, -3 / 20) },
      { id: 6, name: "Vocals", type: "vocal", color: "#c084fc", url: "/audio/Vocals_GMH.mp3", gainFactor: 0.95 * Math.pow(10, -5.5 / 20) * Math.pow(10, -4.5 / 20) }
    ]
  },
  {
    id: "song3",
    title: "Tubular (Modern Hip Hop Beat)",
    bpm: 140,
    key: "Hip Hop",
    stemGainDb: -3.5,
    stems: [
      { id: 1, name: "808 & Kick", type: "drums", color: "#f87171", url: "/audio/808 Kick_HipHop.mp3", gainFactor: Math.pow(10, -3.5 / 20) },
      { id: 2, name: "Snares", type: "drums", color: "#fb923c", url: "/audio/Snares_HipHop.mp3", gainFactor: Math.pow(10, -3.5 / 20) },
      { id: 3, name: "Hi-Hats", type: "perc", color: "#facc15", url: "/audio/Hi-Hats_HipHop.mp3", gainFactor: Math.pow(10, -3.5 / 20) },
      { id: 4, name: "Bell", type: "perc", color: "#2dd4bf", url: "/audio/Bell_HipHop.mp3", gainFactor: Math.pow(10, -3.5 / 20) },
      { id: 5, name: "Synths & Strings", type: "synth", color: "#c084fc", url: "/audio/SynthsStrings_HipHop.mp3", gainFactor: Math.pow(10, (-3.5 - 5) / 20) }, // extra -5 dB so it sits behind the other parts
      { id: 6, name: "Piano", type: "synth", color: "#60a5fa", url: "/audio/Piano_HipHop.mp3", gainFactor: Math.pow(10, -3.5 / 20) }
    ]
  },
  /*
   * Channel order for the recorded songs: drums, other percussion, bass, chords / pads / synths / guitars,
   * and the melody on channel 6. Names are what shows on the channel strip (10 characters or so fit on
   * the digital console, 13 on the analog one, so keep new names short).
   * Every stem is trimmed before the mixer so each song's mix peaks near -12 dBFS like the others
   * (Summertime has a trim per stem; Quack and Floating use one stemGainDb for all six).
   */
  {
    id: "song4",
    title: "Summertime (Afrobeat)",
    bpm: 96,
    key: "Afrobeat",
    durationSec: 20.062,
    stems: [
      { id: 1, name: "Drums", type: "drums", color: "#f87171", url: "/audio/Drums_Summertime.mp3", gainFactor: Math.pow(10, -7 / 20) },
      { id: 2, name: "Perc", type: "perc", color: "#fb923c", url: "/audio/Perc_Summertime.mp3", gainFactor: Math.pow(10, -6.5 / 20) },
      { id: 3, name: "Bass", type: "bass", color: "#60a5fa", url: "/audio/Bass_Summertime.mp3", gainFactor: Math.pow(10, -6.5 / 20) },
      { id: 4, name: "Synths", type: "synth", color: "#c084fc", url: "/audio/Synths_Summertime.mp3", gainFactor: Math.pow(10, -6.5 / 20) },
      { id: 5, name: "Riffs", type: "guitar", color: "#4ade80", url: "/audio/Riffs_Summertime.mp3", gainFactor: Math.pow(10, -6.5 / 20) },
      { id: 6, name: "Vocals", type: "vocal", color: "#facc15", url: "/audio/Vocals_Summertime.mp3", gainFactor: Math.pow(10, -8 / 20) }
    ]
  },
  {
    id: "song5",
    title: "Quack (Funk Groove)",
    bpm: 104,
    key: "Funk",
    stemGainDb: -10,
    durationSec: 36.989,
    stems: [
      { id: 1, name: "Drums", type: "drums", color: "#f87171", url: "/audio/Drums_Quack.mp3" },
      { id: 2, name: "Bass", type: "bass", color: "#60a5fa", url: "/audio/Bass_Quack.mp3" },
      { id: 3, name: "Synth Swells", type: "synth", color: "#c084fc", url: "/audio/Synth Swells_Quack.mp3" },
      { id: 4, name: "Synth Wobbles", type: "synth", color: "#2dd4bf", url: "/audio/Synth Wobbles_Quack.mp3" },
      { id: 5, name: "E Guit", type: "guitar", color: "#4ade80", url: "/audio/EGuit_Quack.mp3" },
      { id: 6, name: "Melody&Quack", type: "synth", color: "#facc15", url: "/audio/Melody&Quack_Quack.mp3" }
    ]
  },
  {
    id: "song6",
    title: "Floating (R&B Groove)",
    bpm: 90,
    key: "R&B",
    stemGainDb: -6.5,
    durationSec: 42.72,
    stems: [
      { id: 1, name: "Drums", type: "drums", color: "#f87171", url: "/audio/Drums_Float.mp3" },
      { id: 2, name: "Shaker", type: "perc", color: "#fb923c", url: "/audio/Shaker_Float.mp3" },
      { id: 3, name: "E Guit Chords", type: "guitar", color: "#4ade80", url: "/audio/EGuitChords_Float.mp3" },
      { id: 4, name: "SK-5 Samples", type: "synth", color: "#c084fc", url: "/audio/SK-5Samples_Float.mp3" },
      { id: 5, name: "E Guit Plucks", type: "guitar", color: "#60a5fa", url: "/audio/EGuitPlucks_Float.mp3" },
      { id: 6, name: "E Guit Melody", type: "guitar", color: "#facc15", url: "/audio/EGuitMelody_Float.mp3" }
    ]
  }
];

/**
 * Procedurally generates high-quality audio buffers for the 6 stems of a given song.
 * Guarantees zero external network dependencies and immediate playback anywhere.
 */
export function generateSyntheticSongStems(
  ctx: AudioContext,
  songId: string
): AudioBuffer[] {
  const song = BUILTIN_SONGS.find(s => s.id === songId) || BUILTIN_SONGS[0];
  const bpm = song.bpm;
  const sampleRate = ctx.sampleRate;
  const beatSec = 60 / bpm;
  const totalBeats = 16; // 4 bars loop
  const totalDuration = totalBeats * beatSec;
  const bufferLen = Math.floor(sampleRate * totalDuration);

  const buffers: AudioBuffer[] = [];

  for (let ch = 0; ch < 6; ch++) {
    const buffer = ctx.createBuffer(2, bufferLen, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    switch (ch) {
      case 0: // Drums
        renderDrums(left, right, sampleRate, beatSec, totalBeats, song.id);
        break;
      case 1: // Bass
        renderBass(left, right, sampleRate, beatSec, totalBeats, song.id);
        break;
      case 2: // Vocal
        renderVocal(left, right, sampleRate, beatSec, totalBeats, song.id);
        break;
      case 3: // Guitar
        renderGuitar(left, right, sampleRate, beatSec, totalBeats, song.id);
        break;
      case 4: // Synth
        renderSynth(left, right, sampleRate, beatSec, totalBeats, song.id);
        break;
      case 5: // Percussion
        renderPercussion(left, right, sampleRate, beatSec, totalBeats, song.id);
        break;
    }

    buffers.push(buffer);
  }

  return buffers;
}

// Helpers for procedural stem generation
function renderDrums(
  l: Float32Array,
  r: Float32Array,
  sr: number,
  beatSec: number,
  totalBeats: number,
  songId: string
) {
  for (let b = 0; b < totalBeats; b++) {
    const t0 = b * beatSec;

    // Kick on beat 0, 2, and syncopated kicks
    const isKick = b % 4 === 0 || (songId === 'song1' && (b % 4 === 2.5 || b % 4 === 3.5));
    if (isKick) {
      addKick(l, r, sr, t0);
    }

    // Snare on beat 1 and 3 (beats 2 & 4 in 4/4 counting)
    if (b % 2 === 1) {
      addSnare(l, r, sr, t0);
    }

    // Hi-Hats every 16th or 8th
    const subDivs = songId === 'song3' ? 2 : 4;
    for (let s = 0; s < subDivs; s++) {
      const ht = t0 + (s * beatSec) / subDivs;
      addHiHat(l, r, sr, ht, s % 2 === 0 ? 0.3 : 0.15);
    }
  }
}

function addKick(l: Float32Array, r: Float32Array, sr: number, startTime: number) {
  const dur = 0.35;
  const numSamples = Math.floor(dur * sr);
  const startIdx = Math.floor(startTime * sr);

  for (let i = 0; i < numSamples; i++) {
    const idx = startIdx + i;
    if (idx >= l.length) break;
    const progress = i / numSamples;
    // Pitch envelope dropping from 140Hz down to deep 48Hz sub
    const freq = 48 + 92 * Math.exp(-progress * 18);
    const env = Math.exp(-progress * 6.5);
    const phase = 2 * Math.PI * freq * (i / sr);
    // Sub fundamental + beater click transient at 3.2kHz
    const beater = progress < 0.08 ? Math.sin(2 * Math.PI * 3200 * (i / sr)) * Math.exp(-progress * 70) * 0.35 : 0;
    const sample = (Math.sin(phase) + beater) * env * 0.85;
    l[idx] += sample;
    r[idx] += sample;
  }
}

function addSnare(l: Float32Array, r: Float32Array, sr: number, startTime: number) {
  const dur = 0.32;
  const numSamples = Math.floor(dur * sr);
  const startIdx = Math.floor(startTime * sr);

  for (let i = 0; i < numSamples; i++) {
    const idx = startIdx + i;
    if (idx >= l.length) break;
    const progress = i / numSamples;
    const env = Math.exp(-progress * 11);
    // Body fundamental (185Hz) + shell ring (340Hz) + crisp high-frequency snare sizzle (5k-15k)
    const t = i / sr;
    const tone = Math.sin(2 * Math.PI * 185 * t) * Math.exp(-progress * 22) * 0.45;
    const ring = Math.sin(2 * Math.PI * 340 * t) * Math.exp(-progress * 30) * 0.2;
    const noise = (Math.random() * 2 - 1) * env * 0.55;
    const sample = tone + ring + noise;
    l[idx] += sample * 0.75;
    r[idx] += sample * 0.75;
  }
}

function addHiHat(l: Float32Array, r: Float32Array, sr: number, startTime: number, vol: number) {
  const dur = 0.09;
  const numSamples = Math.floor(dur * sr);
  const startIdx = Math.floor(startTime * sr);

  for (let i = 0; i < numSamples; i++) {
    const idx = startIdx + i;
    if (idx >= l.length) break;
    const progress = i / numSamples;
    const env = Math.exp(-progress * 32);
    const t = i / sr;
    // Metallic chime ringing frequencies + white noise burst
    const chime = (Math.sin(2 * Math.PI * 7800 * t) + Math.sin(2 * Math.PI * 10500 * t) + Math.sin(2 * Math.PI * 13200 * t)) * 0.15;
    const noise = (Math.random() * 2 - 1) * 0.85;
    const sample = (noise + chime) * env * vol;
    l[idx] += sample * 0.85;
    r[idx] += sample * 0.95;
  }
}

function renderBass(
  l: Float32Array,
  r: Float32Array,
  sr: number,
  beatSec: number,
  totalBeats: number,
  songId: string
) {
  // Notes in Hz for Em (41.2Hz E1, 49.0 G1, 55.0 A1, 61.7 B1, 73.4 D2)
  const notesEm = [41.2, 41.2, 49.0, 55.0, 61.7, 41.2, 73.4, 61.7];
  const notesD = [36.7, 36.7, 55.0, 49.0, 36.7, 36.7, 55.0, 65.4];
  const notes = songId === 'song2' ? notesD : notesEm;

  for (let b = 0; b < totalBeats; b += 0.5) {
    const noteIdx = Math.floor(b) % notes.length;
    const freq = notes[noteIdx];
    const t0 = b * beatSec;
    const dur = beatSec * 0.45;
    const numSamples = Math.floor(dur * sr);
    const startIdx = Math.floor(t0 * sr);

    for (let i = 0; i < numSamples; i++) {
      const idx = startIdx + i;
      if (idx >= l.length) break;
      const progress = i / numSamples;
      const env = Math.exp(-progress * 4.2);
      const t = i / sr;
      // Rich bass with deep sub fundamental (low shelf response) + 2nd harmonic + 3rd harmonic pickup growl
      const sub = Math.sin(2 * Math.PI * (freq * 0.5) * t) * 0.3;
      const f1 = Math.sin(2 * Math.PI * freq * t) * 0.75;
      const f2 = Math.sin(2 * Math.PI * (freq * 2) * t) * 0.45;
      const f3 = Math.sin(2 * Math.PI * (freq * 3) * t) * 0.22;
      const f4 = Math.sin(2 * Math.PI * (freq * 4) * t) * 0.1;
      const sample = (sub + f1 + f2 + f3 + f4) * env * 0.75;
      l[idx] += sample;
      r[idx] += sample;
    }
  }
}

function renderVocal(
  l: Float32Array,
  r: Float32Array,
  sr: number,
  beatSec: number,
  totalBeats: number,
  songId: string
) {
  // Simple warm analog-style synth lead (melodic lead line with dual detuned oscillators and gentle envelope)
  interface LeadNote {
    beat: number;
    durationBeats: number;
    freq: number;
  }

  // Melodic phrases tailored to each song's key & groove
  let leadNotes: LeadNote[] = [];

  if (songId === 'song2') {
    // Song 2: D Major (D4 = 293.7, F#4 = 370.0, G4 = 392.0, A4 = 440.0, B4 = 493.9, D5 = 587.3)
    leadNotes = [
      { beat: 0.5, durationBeats: 0.8, freq: 293.66 }, // D4
      { beat: 1.5, durationBeats: 0.8, freq: 369.99 }, // F#4
      { beat: 2.5, durationBeats: 1.2, freq: 440.00 }, // A4
      { beat: 4.5, durationBeats: 0.8, freq: 493.88 }, // B4
      { beat: 5.5, durationBeats: 0.8, freq: 440.00 }, // A4
      { beat: 6.5, durationBeats: 1.2, freq: 369.99 }, // F#4
      { beat: 8.5, durationBeats: 0.8, freq: 329.63 }, // E4
      { beat: 9.5, durationBeats: 0.8, freq: 369.99 }, // F#4
      { beat: 10.5, durationBeats: 1.2, freq: 293.66 }, // D4
      { beat: 12.5, durationBeats: 0.6, freq: 440.00 }, // A4
      { beat: 13.5, durationBeats: 2.2, freq: 293.66 }, // D4 sustained
    ];
  } else if (songId === 'song3') {
    // Song 3: Lo-Fi F Minor / C Minor (C4 = 261.6, Eb4 = 311.1, F4 = 349.2, G4 = 392.0, Bb4 = 466.2)
    leadNotes = [
      { beat: 0.5, durationBeats: 0.9, freq: 261.63 }, // C4
      { beat: 1.5, durationBeats: 0.9, freq: 311.13 }, // Eb4
      { beat: 2.5, durationBeats: 1.3, freq: 349.23 }, // F4
      { beat: 4.5, durationBeats: 0.9, freq: 392.00 }, // G4
      { beat: 5.5, durationBeats: 0.9, freq: 349.23 }, // F4
      { beat: 6.5, durationBeats: 1.3, freq: 311.13 }, // Eb4
      { beat: 8.5, durationBeats: 0.9, freq: 349.23 }, // F4
      { beat: 9.5, durationBeats: 0.9, freq: 392.00 }, // G4
      { beat: 10.5, durationBeats: 1.3, freq: 466.16 }, // Bb4
      { beat: 12.5, durationBeats: 2.5, freq: 349.23 }, // F4 sustained
    ];
  } else {
    // Song 1 (Default): E Minor Pentatonic (E4 = 329.6, G4 = 392.0, A4 = 440.0, B4 = 493.9, D5 = 587.3)
    leadNotes = [
      { beat: 0.5, durationBeats: 0.8, freq: 329.63 }, // E4
      { beat: 1.5, durationBeats: 0.8, freq: 392.00 }, // G4
      { beat: 2.5, durationBeats: 1.3, freq: 440.00 }, // A4
      { beat: 4.5, durationBeats: 0.8, freq: 493.88 }, // B4
      { beat: 5.5, durationBeats: 0.8, freq: 587.33 }, // D5
      { beat: 6.5, durationBeats: 1.3, freq: 493.88 }, // B4
      { beat: 8.5, durationBeats: 0.8, freq: 440.00 }, // A4
      { beat: 9.5, durationBeats: 0.8, freq: 392.00 }, // G4
      { beat: 10.5, durationBeats: 1.3, freq: 329.63 }, // E4
      { beat: 12.5, durationBeats: 0.6, freq: 392.00 }, // G4
      { beat: 13.5, durationBeats: 2.2, freq: 329.63 }, // E4 sustained
    ];
  }

  // Render each lead note with smooth dual-oscillator synth texture
  leadNotes.forEach((note) => {
    const t0 = note.beat * beatSec;
    const noteDuration = note.durationBeats * beatSec;
    const numSamples = Math.floor(noteDuration * sr);
    const startIdx = Math.floor(t0 * sr);
    const freq = note.freq;

    // Dual oscillator frequencies (slight 2-cent detune for lush stereo width)
    const freqL = freq * 0.9985;
    const freqR = freq * 1.0015;

    for (let i = 0; i < numSamples; i++) {
      const idx = startIdx + i;
      if (idx >= l.length) break;

      const progress = i / numSamples;
      const t = i / sr;

      // Smooth ADSR envelope: 20ms attack, gentle sustain, 50ms release
      let ampEnv = 1.0;
      const attackSec = 0.02;
      const releaseSec = 0.05;
      const attackSamples = Math.floor(attackSec * sr);
      const releaseSamples = Math.floor(releaseSec * sr);

      if (i < attackSamples) {
        ampEnv = i / attackSamples;
      } else if (i > numSamples - releaseSamples) {
        ampEnv = (numSamples - i) / releaseSamples;
      } else {
        ampEnv = 1.0 - (progress * 0.25); // gentle decay across sustain
      }

      // Subtle delayed vibrato for natural musicality - minimal pitch wobble
      const vibDelay = 0.15;
      const vibFactor = t > vibDelay ? Math.min(1.0, (t - vibDelay) * 2) : 0;
      const vibrato = 1 + vibFactor * 0.0015 * Math.sin(2 * Math.PI * 4.5 * t);

      // Clean subtractive oscillator stack (Fundamental + 2nd + 3rd harmonic)
      const phaseL = 2 * Math.PI * freqL * vibrato * t;
      const phaseR = 2 * Math.PI * freqR * vibrato * t;

      const oscL = Math.sin(phaseL) + 0.35 * Math.sin(phaseL * 2) + 0.15 * Math.sin(phaseL * 3) + 0.05 * Math.sin(phaseL * 4);
      const oscR = Math.sin(phaseR) + 0.35 * Math.sin(phaseR * 2) + 0.15 * Math.sin(phaseR * 3) + 0.05 * Math.sin(phaseR * 4);

      // Modest, balanced output level (-2dB adjustment)
      const gainScale = 0.182;
      const sampleL = (oscL * 0.85 + oscR * 0.15) * ampEnv * gainScale;
      const sampleR = (oscR * 0.85 + oscL * 0.15) * ampEnv * gainScale;

      l[idx] += sampleL;
      r[idx] += sampleR;
    }
  });
}

function renderGuitar(
  l: Float32Array,
  r: Float32Array,
  sr: number,
  beatSec: number,
  totalBeats: number,
  songId: string
) {
  // Synth pluck sound synthesizing guitar chord strums
  // Chord voicings tailored to each song
  const chordsSong1 = [
    [164.81, 196.00, 246.94, 329.63], // Em (E3, G3, B3, E4)
    [164.81, 196.00, 246.94, 392.00], // Em7 (E3, G3, B3, G4)
    [146.83, 185.00, 220.00, 293.66], // D (D3, F#3, A3, D4)
    [164.81, 196.00, 246.94, 329.63]  // Em
  ];
  const chordsSong2 = [
    [146.83, 185.00, 220.00, 293.66], // D (D3, F#3, A3, D4)
    [196.00, 246.94, 293.66, 392.00], // G (G3, B3, D4, G4)
    [220.00, 277.18, 329.63, 440.00], // A (A3, C#4, E4, A4)
    [146.83, 185.00, 220.00, 293.66]  // D
  ];
  const chordsSong3 = [
    [174.61, 207.65, 261.63, 311.13], // Fm7 (F3, Ab3, C4, Eb4)
    [130.81, 164.81, 196.00, 246.94], // C7 (C3, E3, G3, Bb3)
    [174.61, 207.65, 261.63, 349.23], // Fm (F3, Ab3, C4, F4)
    [155.56, 196.00, 233.08, 311.13]  // Eb (Eb3, G3, Bb3, Eb4)
  ];

  const chordSet = songId === 'song2' ? chordsSong2 : songId === 'song3' ? chordsSong3 : chordsSong1;

  // Strum on rhythm chops across beats (offbeats and syncopations)
  for (let b = 0; b < totalBeats; b++) {
    const isStrum = b % 1 === 0 || b % 2 === 0.5 || b % 4 === 2.5;
    if (!isStrum) continue;

    const measure = Math.floor(b / 4) % chordSet.length;
    const chord = chordSet[measure];
    const t0 = (b + 0.5) * beatSec;
    const isDownbeatStrum = b % 2 === 0;
    const strumDur = beatSec * 0.42;
    const strumSamples = Math.floor(strumDur * sr);

    // Strum across each chord note with a slight 7ms string delay (down-strum effect)
    chord.forEach((noteFreq, stringIdx) => {
      const stringDelaySec = stringIdx * 0.007;
      const noteStartIdx = Math.floor((t0 + stringDelaySec) * sr);

      for (let i = 0; i < strumSamples; i++) {
        const idx = noteStartIdx + i;
        if (idx >= l.length) break;

        const t = i / sr;
        const progress = i / strumSamples;

        // Exponential pluck decay envelope: instant attack + crisp decay
        const pluckEnv = Math.exp(-progress * 8.2);

        // Harmonic pluck: fundamental + 2nd + 3rd harmonic decaying progressively faster (low-pass filter effect)
        const harm1 = Math.sin(2 * Math.PI * noteFreq * t);
        const harm2 = Math.sin(2 * Math.PI * (noteFreq * 2) * t) * Math.exp(-progress * 14) * 0.4;
        const harm3 = Math.sin(2 * Math.PI * (noteFreq * 3) * t) * Math.exp(-progress * 22) * 0.2;

        // Tactile pick attack click in the first 6ms
        const click = progress < 0.04 ? (Math.random() * 2 - 1) * Math.exp(-progress * 55) * 0.18 : 0;

        const pluckSignal = (harm1 + harm2 + harm3 + click) * pluckEnv;

        // Velocity scaling: downbeats punchier, offbeats lighter groove
        const velocity = isDownbeatStrum ? 0.22 : 0.17;
        const totalSample = pluckSignal * velocity;

        // Subtle stereo spread across chord strings
        const panL = 0.55 - stringIdx * 0.08;
        const panR = 0.45 + stringIdx * 0.08;

        l[idx] += totalSample * panL;
        r[idx] += totalSample * panR;
      }
    });
  }
}

function renderSynth(
  l: Float32Array,
  r: Float32Array,
  sr: number,
  beatSec: number,
  totalBeats: number,
  songId: string
) {
  // Lush stereo analog pad chords with rich overtone stack (-3dB trimmed)
  const chordLength = 4 * beatSec;
  const numChords = Math.ceil(totalBeats / 4);

  for (let c = 0; c < numChords; c++) {
    const t0 = c * chordLength;
    const numSamples = Math.floor(chordLength * sr);
    const startIdx = Math.floor(t0 * sr);
    const root = songId === 'song2' ? 220 : 196; // A or G
    const freqs = [root, root * 1.25, root * 1.5, root * 1.875];

    for (let i = 0; i < numSamples; i++) {
      const idx = startIdx + i;
      if (idx >= l.length) break;
      const progress = i / numSamples;
      const env = Math.sin(progress * Math.PI) * 0.55;
      const t = i / sr;
      let leftSamp = 0;
      let rightSamp = 0;

      freqs.forEach((f, fi) => {
        // Multi-saw harmonics for analog richness across entire 80Hz - 12kHz range
        const fL = f * 0.997;
        const fR = f * 1.003;
        const h1L = Math.sin(2 * Math.PI * fL * t + fi);
        const h1R = Math.sin(2 * Math.PI * fR * t + fi);
        const h2L = Math.sin(2 * Math.PI * (fL * 2) * t + fi) * 0.45;
        const h2R = Math.sin(2 * Math.PI * (fR * 2) * t + fi) * 0.45;
        const h3L = Math.sin(2 * Math.PI * (fL * 3) * t) * 0.25;
        const h3R = Math.sin(2 * Math.PI * (fR * 3) * t) * 0.25;
        const h4L = Math.sin(2 * Math.PI * (fL * 4) * t) * 0.15;
        const h4R = Math.sin(2 * Math.PI * (fR * 4) * t) * 0.15;

        leftSamp += (h1L + h2L + h3L + h4L) * 0.18;
        rightSamp += (h1R + h2R + h3R + h4R) * 0.18;
      });

      l[idx] += leftSamp * env * 0.35;
      r[idx] += rightSamp * env * 0.35;
    }
  }
}

function renderPercussion(
  l: Float32Array,
  r: Float32Array,
  sr: number,
  beatSec: number,
  totalBeats: number,
  songId: string
) {
  // Tambourine / Shaker 16th notes with groove and rich high-shelf sizzle
  const subDivs = 4;
  for (let b = 0; b < totalBeats; b++) {
    for (let s = 0; s < subDivs; s++) {
      const t0 = (b + s / subDivs) * beatSec;
      const dur = 0.05;
      const numSamples = Math.floor(dur * sr);
      const startIdx = Math.floor(t0 * sr);
      const accent = (s === 2 || s === 0) ? 0.38 : 0.2;

      for (let i = 0; i < numSamples; i++) {
        const idx = startIdx + i;
        if (idx >= l.length) break;
        const progress = i / numSamples;
        const env = Math.exp(-progress * 38);
        const t = i / sr;
        // Jingle metal ring + noise
        const jingle = (Math.sin(2 * Math.PI * 6500 * t) + Math.sin(2 * Math.PI * 9200 * t) + Math.sin(2 * Math.PI * 12500 * t)) * 0.2;
        const noise = (Math.random() * 2 - 1) * 0.8;
        const sample = (noise + jingle) * env * accent;
        l[idx] += sample * 0.55;
        r[idx] += sample * 0.75;
      }
    }
  }
}
