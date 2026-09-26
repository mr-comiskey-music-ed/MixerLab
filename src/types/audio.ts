export interface StemDefinition {
  id: number;
  name: string;
  type: 'drums' | 'bass' | 'vocal' | 'guitar' | 'synth' | 'perc';
  color: string;
  data?: string; // Optional Base64 data URL if provided by user
}

export interface SongDefinition {
  id: string;
  title: string;
  bpm: number;
  key: string;
  stems: StemDefinition[];
}

export interface ChannelSettings {
  id: number;
  name: string;
  type: string;
  // Preamp & Input
  gain: number; // -20dB to +40dB
  phantom48V: boolean;
  hiZ: boolean;
  phaseInvert: boolean;
  lowCut100Hz: boolean;
  // 3-Band EQ
  eqHigh: number; // -15 to +15 dB (12kHz shelf)
  eqMid: number;  // -15 to +15 dB (peaking)
  eqMidFreq: number; // 200Hz to 8000Hz (sweepable)
  eqLow: number;  // -15 to +15 dB (80Hz shelf)
  // Sends
  aux1Pre: number; // -60 to +10 dB (Pre-fader monitor send)
  fxPost: number;  // -60 to +10 dB (Post-fader internal FX send)
  // Master routing
  pan: number; // -1 (Full L) to +1 (Full R)
  mute: boolean;
  soloPfl: boolean;
  faderLevel: number; // -60 to +10 dB (0 = Unity)
}

export interface MasterSettings {
  mainFader: number; // -60 to +10 dB
  aux1Master: number; // -60 to +10 dB
  fxReturn: number; // -60 to +10 dB
  fxMute: boolean;
  fxType: 'plate' | 'hall' | 'delay' | 'chorus';
  phonesLevel: number; // 0 to 100%
  chorusIntensity?: number; // 0 to 100% (Modulation depth & rate)
}

export interface ScenarioItem {
  id: number;
  title: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  context: string;
  problemSummary: string;
  objective: string;
  hint: string;
  setupState: {
    channels: Partial<ChannelSettings>[];
    master?: Partial<MasterSettings>;
    songId?: string;
  };
  targetValidation: (channels: ChannelSettings[], master: MasterSettings) => {
    passed: boolean;
    score: number;
    feedback: string;
  };
}

export interface StudentScorecard {
  studentName: string;
  periodId: string;
  scenariosCompleted: number[];
  scenarioScores: Record<number, number>;
  drillHighScore: number;
  drillBestReactionTimeMs: number;
  matchScore: number;
  timestamp: string;
  saltHash?: string;
}

export interface SerializedMixerState {
  version: string;
  timestamp: string;
  student: {
    name: string;
    period: string;
  };
  scores: {
    scenarios: Record<number, number>;
    drillScore: number;
    drillReactionMs: number;
    matchScore: number;
    learnCompleted: boolean;
    totalPercentage: number;
  };
  mixerState: {
    channels: ChannelSettings[];
    master: MasterSettings;
  };
}
