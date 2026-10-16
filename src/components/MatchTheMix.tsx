import React, { useState } from 'react';
import { ChannelSettings, MasterSettings } from '../types/audio';
import { BUILTIN_SONGS } from '../audio/stemSynthesizer';
import { makeDefaultChannels, makeDefaultMaster } from '../utils/mixDefaults';

export interface ReferenceTarget {
  channelId: number;
  targetFader: number; // dB
  targetPan: number;   // -1 to 1
  targetLow: number;   // dB
  targetHigh: number;  // dB
}

export interface ReferenceProfile {
  id: string;
  name: string;
  songId: string;
  description: string;
  targets: ReferenceTarget[];
}

// Channel order follows each song's stems (see BUILTIN_SONGS).
export const REFERENCE_PROFILES: ReferenceProfile[] = [
  {
    id: "ref_funk",
    name: "Commercial Radio Funk Balance",
    songId: "song1",
    description: "A punchy, radio-ready funk balance. Listen for how loud each part is, where it sits left-to-right, and how bright or heavy it sounds.",
    targets: [
      { channelId: 1, targetFader: -3, targetPan: 0, targetLow: 4, targetHigh: 3 },     // Kick / Snare
      { channelId: 2, targetFader: -5, targetPan: 0, targetLow: 5, targetHigh: -4 },    // E. Bass
      { channelId: 3, targetFader: 3, targetPan: 0, targetLow: -5, targetHigh: 4 },     // Lead Vocal
      { channelId: 4, targetFader: -6, targetPan: -0.7, targetLow: -6, targetHigh: 2 }, // E. Guitar
      { channelId: 5, targetFader: -9, targetPan: 0.7, targetLow: -4, targetHigh: -3 }, // Synth Pad
      { channelId: 6, targetFader: -8, targetPan: 0.4, targetLow: -6, targetHigh: 5 }   // Perc / Aux
    ]
  },
  {
    id: "ref_rock",
    name: "Driving Modern Rock Staging",
    songId: "song2",
    description: "An aggressive modern rock mix. Listen for which guitars are wide and which are centered, how much snap the drums have, and how far forward the vocal sits.",
    targets: [
      { channelId: 1, targetFader: 0, targetPan: 0, targetLow: 3, targetHigh: 4 },      // Drums
      { channelId: 2, targetFader: -3, targetPan: 0, targetLow: 5, targetHigh: -3 },    // Bass
      { channelId: 3, targetFader: -4, targetPan: -0.8, targetLow: -4, targetHigh: 2 }, // Dist E Guit
      { channelId: 4, targetFader: -6, targetPan: 0.8, targetLow: -5, targetHigh: 3 },  // Clean E Guit
      { channelId: 5, targetFader: -10, targetPan: 0.4, targetLow: -6, targetHigh: 4 }, // A Guit
      { channelId: 6, targetFader: 3, targetPan: 0, targetLow: -4, targetHigh: 5 }      // Vocals
    ]
  }
];

/** Full console settings for a reference: a zeroed console with the targets applied. */
export function buildReferenceMix(profile: ReferenceProfile): { channels: ChannelSettings[]; master: MasterSettings } {
  const channels = makeDefaultChannels(profile.songId).map((ch) => {
    const t = profile.targets.find((x) => x.channelId === ch.id);
    return t
      ? { ...ch, faderLevel: t.targetFader, pan: t.targetPan, eqLow: t.targetLow, eqHigh: t.targetHigh }
      : ch;
  });
  return { channels, master: makeDefaultMaster() };
}

interface MatchTheMixProps {
  channels: ChannelSettings[];
  activeProfileId: string | null;
  listening: 'A' | 'B';
  isPlaying: boolean;
  matchScores: Record<string, number>;
  onStartProfile: (profile: ReferenceProfile) => void;
  onListen: (which: 'A' | 'B') => void;
  onPlay: () => void;
  onPause: () => void;
  onSaveMatchScore: (profileId: string, percentage: number) => void;
  onTryAgain: () => void;
}

/**
 * Score one setting from 0 to 1. Being within `tolerance` of the target is perfect.
 * Beyond that, credit drops in proportion to how far the target is from a fresh,
 * zeroed console, so leaving the console untouched earns little credit.
 */
function paramScore(diff: number, target: number, tolerance: number, minSpan: number): number {
  const span = Math.max(Math.abs(target), minSpan); // fresh console sits at 0 for all four settings
  const err = Math.max(0, diff - tolerance);
  return Math.max(0, Math.min(1, 1 - err / span));
}

const describePan = (p: number) => (Math.abs(p) < 0.05 ? 'center' : p < 0 ? 'left' : 'right');

export const MatchTheMix: React.FC<MatchTheMixProps> = ({
  channels,
  activeProfileId,
  listening,
  isPlaying,
  matchScores,
  onStartProfile,
  onListen,
  onPlay,
  onPause,
  onSaveMatchScore,
  onTryAgain
}) => {
  const [evaluationResult, setEvaluationResult] = useState<{
    overallScore: number;
    breakdown: { name: string; score: number; notes: string[] }[];
  } | null>(null);

  const currentProfile = REFERENCE_PROFILES.find((p) => p.id === activeProfileId) || REFERENCE_PROFILES[0];
  const song = BUILTIN_SONGS.find((s) => s.id === currentProfile.songId);

  const [needsMoves, setNeedsMoves] = useState(false);

  const handleEvaluateMix = () => {
    // "Trying" means moving something: an untouched console doesn't earn the 50% for trying
    const touched = channels.some((c) => c.faderLevel !== 0 || c.pan !== 0 || c.eqLow !== 0 || c.eqHigh !== 0 || c.mute);
    if (!touched) {
      setEvaluationResult(null);
      setNeedsMoves(true);
      return;
    }
    setNeedsMoves(false);
    let totalScoreSum = 0;
    const breakdown = currentProfile.targets.map((target) => {
      const ch = channels.find((c) => c.id === target.channelId);
      if (!ch) return { name: `Ch ${target.channelId}`, score: 0, notes: ['Channel missing'] };

      // A muted channel is effectively -∞
      const fader = ch.mute ? -60 : ch.faderLevel;
      const faderDiff = Math.abs(fader - target.targetFader);
      const panDiff = Math.abs(ch.pan - target.targetPan);
      const lowDiff = Math.abs(ch.eqLow - target.targetLow);
      const highDiff = Math.abs(ch.eqHigh - target.targetHigh);

      const chScore = Math.round(
        100 *
          (paramScore(faderDiff, target.targetFader, 1, 4) * 0.45 +
            paramScore(panDiff, target.targetPan, 0.1, 0.4) * 0.25 +
            paramScore(lowDiff, target.targetLow, 1.5, 4) * 0.15 +
            paramScore(highDiff, target.targetHigh, 1.5, 4) * 0.15)
      );
      totalScoreSum += chScore;

      // Hints point a direction without revealing the exact setting
      const notes: string[] = [];
      if (faderDiff > 2.5) notes.push(fader > target.targetFader ? 'Too loud' : 'Too quiet');
      if (panDiff > 0.25) {
        if (Math.abs(target.targetPan) < 0.05) notes.push('Should be closer to center');
        else notes.push(`Should sit more to the ${describePan(target.targetPan)}`);
      }
      if (lowDiff > 3) notes.push(ch.eqLow > target.targetLow ? 'Too much low end' : 'Needs more low end');
      if (highDiff > 3) notes.push(ch.eqHigh > target.targetHigh ? 'Too bright' : 'Needs more brightness');
      if (notes.length === 0) notes.push('Close match!');

      return { name: ch.name, score: chScore, notes };
    });

    const overall = Math.round(totalScoreSum / currentProfile.targets.length);
    setEvaluationResult({ overallScore: overall, breakdown });
    onSaveMatchScore(currentProfile.id, overall);
  };

  const bestForProfile = matchScores[currentProfile.id];

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 pb-2">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6 shadow-xl flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
          <div className="flex flex-col">
            <span className="text-xs font-mono font-bold text-sky-400 uppercase">
              CRITICAL LISTENING LAB
            </span>
            <h2 className="text-xl font-bold text-zinc-100 mt-0.5">
              MATCH THE MIX (BLIND A/B)
            </h2>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            BEST SCORE ON THIS MIX:{' '}
            <strong className="text-emerald-400">{bestForProfile !== undefined ? `${bestForProfile}%` : '—'}</strong>
          </span>
        </div>

        {/* Reference picker */}
        <div className="flex flex-wrap items-center gap-2">
          {REFERENCE_PROFILES.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                if (p.id === activeProfileId) return;
                setEvaluationResult(null);
                setNeedsMoves(false);
                onStartProfile(p);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors ${
                p.id === activeProfileId
                  ? 'bg-sky-600 text-white border-sky-400'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-750'
              }`}
            >
              {p.name}
              {matchScores[p.id] !== undefined && (
                <span className="ml-1.5 text-emerald-300">{matchScores[p.id]}%</span>
              )}
            </button>
          ))}
        </div>

        <div className="text-xs text-zinc-300 leading-relaxed bg-zinc-950 p-3 rounded border border-zinc-850 flex flex-col gap-1.5">
          <span>
            <strong className="text-sky-300">Song:</strong> {song?.title}
          </span>
          <span>{currentProfile.description}</span>
          <span className="text-zinc-400">
            <strong className="text-zinc-300">How it works:</strong> A is a hidden reference mix. B is your mix. The console
            below only ever shows <em>your</em> settings, so you have to match A by ear. Only the{' '}
            <strong className="text-zinc-200">faders, pan, LOW EQ and HIGH EQ</strong> count toward your score.
          </span>
        </div>

        {/* A/B switcher */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-zinc-950 p-3 sm:p-4 rounded-lg border border-zinc-800">
          <button
            onClick={isPlaying ? onPause : onPlay}
            className={`px-4 py-3 rounded-lg font-mono font-bold text-sm transition-colors ${
              isPlaying ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isPlaying ? '❚❚ PAUSE' : '▶ PLAY'}
          </button>

          <div className="flex flex-1 rounded-lg overflow-hidden border border-zinc-700">
            <button
              onClick={() => onListen('A')}
              className={`flex-1 px-4 py-3 font-mono font-bold text-sm transition-all ${
                listening === 'A'
                  ? 'bg-sky-500 text-zinc-950 shadow-[inset_0_0_12px_rgba(0,0,0,0.25)]'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-750'
              }`}
            >
              A · REFERENCE
            </button>
            <button
              onClick={() => onListen('B')}
              className={`flex-1 px-4 py-3 font-mono font-bold text-sm transition-all ${
                listening === 'B'
                  ? 'bg-emerald-500 text-zinc-950 shadow-[inset_0_0_12px_rgba(0,0,0,0.25)]'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-750'
              }`}
            >
              B · YOUR MIX
            </button>
          </div>

          <button
            onClick={handleEvaluateMix}
            className="px-5 py-3 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-mono font-bold text-xs rounded-lg shadow-lg border border-sky-400/50 transition-all"
          >
            CHECK MY MATCH
          </button>
        </div>

        <p className="text-[11px] font-mono text-zinc-500 -mt-2">
          {listening === 'A'
            ? 'Now hearing A (reference). Touching any console control switches you back to B.'
            : 'Now hearing B (your mix). Adjust the console below, then flip back to A to compare.'}
        </p>

        {needsMoves && (
          <div className="text-xs font-mono text-amber-300 bg-amber-950/30 border border-amber-800/50 rounded-lg px-3 py-2">
            Your console is still at zero. Listen to A, then move the faders, pan, LOW and HIGH EQ before checking.
          </div>
        )}

        {/* Evaluation Breakdown */}
        {evaluationResult && (
          <div className="bg-zinc-950 p-4 sm:p-5 rounded-lg border border-sky-500/60 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm sm:text-base font-bold text-sky-400 font-mono">HOW CLOSE ARE YOU?</span>
              <span className="text-2xl font-mono font-extrabold text-sky-400">{evaluationResult.overallScore}%</span>
            </div>

            <div className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
              {evaluationResult.breakdown.map((item, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono p-2 bg-zinc-900 rounded border border-zinc-850"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-bold text-zinc-200 w-32 truncate">{item.name}</span>
                    <span className="text-zinc-400">{item.notes.join(' · ')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.score > 80 ? 'bg-emerald-400' : item.score > 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                        style={{ width: `${item.score}%` }}
                      />
                    </div>
                    <span className="font-bold text-zinc-100 w-10 text-right">{item.score}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-zinc-500 font-mono flex-1 min-w-[200px]">
                Your best score for each reference is what goes on your grade report: 50% for trying it, plus up to
                50% more for how close you get. Keep adjusting and check again, or start over from a fresh console.
              </p>
              <button
                onClick={() => {
                  setEvaluationResult(null);
                  setNeedsMoves(false);
                  onTryAgain();
                }}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono font-bold text-xs border border-zinc-600"
                title="Reset the console to zero and try this reference again (your best score is kept)"
              >
                ↺ TRY AGAIN
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
