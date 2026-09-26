import React, { useState } from 'react';
import { ChannelSettings, MasterSettings } from '../types/audio';

interface MatchTheMixProps {
  channels: ChannelSettings[];
  master: MasterSettings;
  onAuditionReferenceMix: (isRef: boolean, refState?: { channels: Partial<ChannelSettings>[]; master: Partial<MasterSettings> }) => void;
  onSaveMatchScore: (percentage: number) => void;
  currentMatchScore: number;
}

interface ReferenceProfile {
  id: string;
  name: string;
  description: string;
  targets: {
    channelId: number;
    targetFader: number; // dB
    targetPan: number;   // -1 to 1
    targetLow: number;   // dB
    targetHigh: number;  // dB
  }[];
}

export const REFERENCE_PROFILES: ReferenceProfile[] = [
  {
    id: "ref_funk",
    name: "Commercial Radio Funk Balance",
    description: "Punchy kick/snare foundation, centered bass, vocal right upfront in the pocket, rhythm guitar and synth panned wide for stereo separation.",
    targets: [
      { channelId: 1, targetFader: -2, targetPan: 0, targetLow: 0, targetHigh: 1 },
      { channelId: 2, targetFader: -1, targetPan: 0, targetLow: 2, targetHigh: -1 },
      { channelId: 3, targetFader: 2, targetPan: 0, targetLow: -2, targetHigh: 2 },
      { channelId: 4, targetFader: -4, targetPan: -0.4, targetLow: -3, targetHigh: 1 },
      { channelId: 5, targetFader: -3, targetPan: 0.45, targetLow: -1, targetHigh: 0 },
      { channelId: 6, targetFader: -6, targetPan: 0.2, targetLow: -4, targetHigh: 2 }
    ]
  },
  {
    id: "ref_rock",
    name: "Driving Modern Rock Staging",
    description: "Aggressive drum kit with boosted high snap, solid heavy bass, twin guitars panned hard left and right, cut-through lead vocal.",
    targets: [
      { channelId: 1, targetFader: 0, targetPan: 0, targetLow: 1, targetHigh: 2 },
      { channelId: 2, targetFader: -2, targetPan: 0, targetLow: 3, targetHigh: 0 },
      { channelId: 3, targetFader: 2.5, targetPan: 0, targetLow: -1, targetHigh: 3 },
      { channelId: 4, targetFader: -2, targetPan: -0.65, targetLow: -2, targetHigh: 1 },
      { channelId: 5, targetFader: -2.5, targetPan: 0.65, targetLow: -2, targetHigh: 2 },
      { channelId: 6, targetFader: -7, targetPan: -0.2, targetLow: -5, targetHigh: 1 }
    ]
  }
];

export const MatchTheMix: React.FC<MatchTheMixProps> = ({
  channels,
  onAuditionReferenceMix,
  onSaveMatchScore,
  currentMatchScore
}) => {
  const [activeProfileId, setActiveProfileId] = useState<string>("ref_funk");
  const [isAuditioningRef, setIsAuditioningRef] = useState<boolean>(false);
  const [evaluationResult, setEvaluationResult] = useState<{
    overallScore: number;
    breakdown: { name: string; score: number; note: string }[];
  } | null>(null);

  const currentProfile = REFERENCE_PROFILES.find(p => p.id === activeProfileId) || REFERENCE_PROFILES[0];

  const toggleReferenceAudition = () => {
    if (!isAuditioningRef) {
      // Build partial settings from reference
      const refChannels = currentProfile.targets.map(t => ({
        id: t.channelId,
        faderLevel: t.targetFader,
        pan: t.targetPan,
        eqLow: t.targetLow,
        eqHigh: t.targetHigh,
        mute: false
      }));

      onAuditionReferenceMix(true, { channels: refChannels, master: { mainFader: 0 } });
      setIsAuditioningRef(true);
    } else {
      onAuditionReferenceMix(false);
      setIsAuditioningRef(false);
    }
  };

  const handleEvaluateMix = () => {
    let totalScoreSum = 0;
    const breakdown = currentProfile.targets.map((target) => {
      const ch = channels.find(c => c.id === target.channelId);
      if (!ch) return { name: `Ch ${target.channelId}`, score: 0, note: "Channel missing" };

      // Calculate fader accuracy (within 2.5dB is 100%)
      const faderDiff = Math.abs(ch.faderLevel - target.targetFader);
      const faderScore = Math.max(0, 100 - faderDiff * 14);

      // Pan accuracy (within 0.15 is 100%)
      const panDiff = Math.abs(ch.pan - target.targetPan);
      const panScore = Math.max(0, 100 - panDiff * 70);

      // Low EQ accuracy
      const lowDiff = Math.abs(ch.eqLow - target.targetLow);
      const lowScore = Math.max(0, 100 - lowDiff * 10);

      const chScore = Math.round(faderScore * 0.5 + panScore * 0.3 + lowScore * 0.2);
      totalScoreSum += chScore;

      let note = "Target balance achieved!";
      if (faderDiff > 3) {
        note = ch.faderLevel > target.targetFader ? "Fader too loud" : "Fader too quiet";
      } else if (panDiff > 0.3) {
        note = ch.pan > target.targetPan ? "Pan too far right" : "Pan too far left";
      }

      return {
        name: ch.name,
        score: chScore,
        note
      };
    });

    const overall = Math.round(totalScoreSum / currentProfile.targets.length);
    setEvaluationResult({ overallScore: overall, breakdown });
    onSaveMatchScore(overall);
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 pb-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col gap-5">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex flex-col">
            <span className="text-xs font-mono font-bold text-sky-400 uppercase">
              CRITICAL LISTENING LAB
            </span>
            <h2 className="text-xl font-bold text-zinc-100 mt-0.5">
              MATCH THE MIX (A/B REFERENCE COMPARISON)
            </h2>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            BEST MATCH SCORE: <strong className="text-emerald-400">{currentMatchScore}%</strong>
          </span>
        </div>

        {/* Profile Selector */}
        <div className="flex items-center gap-2">
          {REFERENCE_PROFILES.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setActiveProfileId(p.id);
                setEvaluationResult(null);
                if (isAuditioningRef) toggleReferenceAudition();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors ${
                p.id === activeProfileId
                  ? 'bg-sky-600 text-white border-sky-400'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-750'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950 p-3 rounded border border-zinc-850">
          {currentProfile.description}
        </p>

        {/* Helper Ribbon indicating live console integration */}
        <div className="flex flex-wrap items-center justify-between bg-zinc-950/90 px-3 py-2 rounded-lg border border-sky-900/60 text-xs font-mono gap-2">
          <div className="flex items-center gap-2 text-sky-300">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span className="font-bold text-[11px] uppercase">Mix Console Linked Below:</span>
            <span className="text-zinc-400 text-[11px]">
              Tweak faders, pans, and EQs on the console below to match reference [A], then click &quot;Evaluate Mix Accuracy&quot;.
            </span>
          </div>
          <button
            onClick={() => {
              const el = document.getElementById('audio-console-bay');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="text-[11px] text-sky-400 hover:text-sky-200 underline font-bold"
          >
            ↓ Jump to Console Controls
          </button>
        </div>

        {/* A/B Audition Controls */}
        <div className="flex items-center justify-between bg-zinc-950 p-4 rounded-lg border border-zinc-800">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleReferenceAudition}
              className={`px-5 py-2 rounded-lg font-mono font-bold text-xs border transition-all ${
                isAuditioningRef
                  ? 'bg-sky-500 text-zinc-950 border-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.7)]'
                  : 'bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-750'
              }`}
            >
              {isAuditioningRef ? 'AUDITIONING: [A] REFERENCE MIX' : 'AUDITION: [B] YOUR CONSOLE MIX'}
            </button>
            <span className="text-xs text-zinc-400 font-mono">
              Toggle between the professional reference balance and your active console mix
            </span>
          </div>

          <button
            onClick={handleEvaluateMix}
            className="px-6 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-mono font-bold text-xs rounded-lg shadow-lg border border-sky-400/50 transition-all"
          >
            EVALUATE MIX ACCURACY
          </button>
        </div>

        {/* Evaluation Breakdown */}
        {evaluationResult && (
          <div className="bg-zinc-950 p-5 rounded-lg border border-sky-500/60 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-sky-400 font-mono">
                MIX ACCURACY ANALYSIS
              </span>
              <span className="text-2xl font-mono font-extrabold text-sky-400">
                {evaluationResult.overallScore}% MATCH
              </span>
            </div>

            <div className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
              {evaluationResult.breakdown.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs font-mono p-2 bg-zinc-900 rounded border border-zinc-850">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-200 w-36 truncate">{item.name}</span>
                    <span className="text-zinc-400">{item.note}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-zinc-800 h-2 rounded-full overflow-hidden">
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
          </div>
        )}
      </div>
    </div>
  );
};
