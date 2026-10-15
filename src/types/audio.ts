export interface StemDefinition {
  id: number;
  name: string;
  type: 'drums' | 'bass' | 'vocal' | 'guitar' | 'synth' | 'perc';
  color: string;
  data?: string; // Optional Base64 data URL if provided by user
  url?: string; // Optional static audio file path/URL
  gainFactor?: number; // Optional gain scaling factor (e.g. 10^(-3/20) for -3dB)
}

export interface SongDefinition {
  id: string;
  title: string;
  bpm: number;
  key: string;
  stems: StemDefinition[];
  stemGainDb?: number; // Optional default gain adjustment in dB
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
  // One-knob compressor (0 = off, 100 = maximum squash)
  comp: number;
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

/** A student's own creative mix, built in the My Mix tab. */
export interface MyMix {
  songId: string;
  channels: ChannelSettings[];
  master: MasterSettings;
  explanation: string;
}

/** Everything a student's submission code carries. Nothing is stored anywhere else. */
export interface StudentSubmission {
  timestamp: string;
  student: {
    name: string;
  };
  scores: {
    scenarios: Record<number, number>; // scenario id -> points
    whatChanged: number;               // best correct answers out of 8 (What Changed? drill)
    matchScores: Record<string, number>; // reference id -> best % match
    learnCompleted: boolean;
    totalPercentage: number;
  };
  myMix?: MyMix;
  legacy?: boolean; // decoded from an older (pre-compression) code
}

/** The app's main tabs, in the order they appear. */
export type TabId = 'learn' | 'console' | 'scenarios' | 'whatchanged' | 'match' | 'mymix' | 'grades';

/** The tabs grouped under CHALLENGES (shown as sub-tabs). */
export type ChallengeTabId = 'scenarios' | 'whatchanged' | 'match' | 'mymix';
export const CHALLENGE_TABS: { id: ChallengeTabId; label: string }[] = [
  { id: 'scenarios', label: 'SCENARIOS' },
  { id: 'whatchanged', label: 'WHAT CHANGED?' },
  { id: 'match', label: 'MATCH THE MIX' },
  { id: 'mymix', label: 'MY MIX' }
];
export const isChallengeTab = (t: TabId): t is ChallengeTabId => CHALLENGE_TABS.some(c => c.id === t);
