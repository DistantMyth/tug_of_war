import { ArrowRightLeft, ShieldAlert, Sparkles, Users } from "lucide-react";
import { useGameStore } from "../../store/useGameStore.js";

export const TeamBalanceScene: React.FC = () => {
  const { counts, balancePlan, wildcard } = useGameStore();

  const neededLeftToRight = balancePlan?.remainingLeftToRight ?? 0;
  const neededRightToLeft = balancePlan?.remainingRightToLeft ?? 0;
  const totalNeeded = neededLeftToRight + neededRightToLeft;
  const initialNeeded = (balancePlan?.needLeftToRight ?? 0) + (balancePlan?.needRightToLeft ?? 0);

  const directionText =
    neededLeftToRight > 0
      ? `VOLUNTEERS NEEDED: LEFT → RIGHT`
      : neededRightToLeft > 0
        ? `VOLUNTEERS NEEDED: RIGHT → LEFT`
        : `BALANCING COMPLETE`;

  const progressPercent = initialNeeded > 0 ? Math.round(((initialNeeded - totalNeeded) / initialNeeded) * 100) : 100;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-8 md:p-12 overflow-hidden bg-cyber-grid">
      {/* Ambient Glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <div className="text-center z-10 space-y-2">
        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-amber-500/40 bg-amber-950/50 text-amber-300 text-sm tracking-widest uppercase font-mono-condensed animate-pulse">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          Roster Lock — Team Balance Phase
        </div>
        <h1 className="text-5xl md:text-6xl font-display uppercase tracking-wider text-slate-100 drop-shadow-md">
          Balancing The Battle
        </h1>
        <p className="text-sm md:text-base text-slate-400 font-mono-condensed">
          Equal teams are required for a fair competition.
        </p>
      </div>

      {/* Central Interactive Balance Meter */}
      <div className="w-full max-w-4xl bg-slate-900/80 border border-slate-800 rounded-3xl p-8 md:p-10 backdrop-blur-2xl z-10 space-y-8 shadow-2xl">
        {/* Counts Comparison */}
        <div className="flex items-center justify-between gap-6">
          {/* Left */}
          <div className="flex-1 text-center p-6 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 box-glow-cyan">
            <div className="text-xs text-cyan-400 font-mono-condensed tracking-wider uppercase">Team Left</div>
            <div className="text-5xl md:text-6xl font-mono-condensed font-black text-slate-100 mt-2">
              {counts.left}
            </div>
            <div className="text-xs text-slate-400 font-mono-condensed mt-1">
              TARGET: {balancePlan?.targetLeft ?? counts.left}
            </div>
          </div>

          {/* Center Indicator */}
          <div className="flex flex-col items-center justify-center shrink-0 px-4">
            <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-amber-400 shadow-inner">
              <ArrowRightLeft className="w-7 h-7 animate-pulse" />
            </div>
          </div>

          {/* Right */}
          <div className="flex-1 text-center p-6 rounded-2xl bg-amber-950/30 border border-amber-500/30 box-glow-amber">
            <div className="text-xs text-amber-400 font-mono-condensed tracking-wider uppercase">Team Right</div>
            <div className="text-5xl md:text-6xl font-mono-condensed font-black text-slate-100 mt-2">
              {counts.right}
            </div>
            <div className="text-xs text-slate-400 font-mono-condensed mt-1">
              TARGET: {balancePlan?.targetRight ?? counts.right}
            </div>
          </div>
        </div>

        {/* Hero Call to Action */}
        <div className="text-center space-y-4">
          <div className="text-2xl md:text-3xl font-display text-amber-400 tracking-wider">
            {totalNeeded > 0 ? (
              <span>
                WE NEED <span className="text-slate-100 text-glow-amber text-4xl">{totalNeeded}</span> VOLUNTEERS
              </span>
            ) : (
              <span className="text-emerald-400">TEAMS ARE BALANCED & READY!</span>
            )}
          </div>
          <div className="text-sm font-mono-condensed text-slate-400 uppercase tracking-wide">
            {directionText} — TAP "SWITCH TEAM" ON YOUR PHONE
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-950 rounded-full h-4 p-0.5 border border-slate-800 overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(5, progressPercent)}%` }}
            />
          </div>
        </div>

        {/* Wildcard / Chaos Badge */}
        {balancePlan?.chaosNeeded && (
          <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-200 text-sm font-mono-condensed box-glow-violet">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span>
              CHAOS PLAYER ASSIGNED:{" "}
              <strong className="text-amber-300 font-bold">{wildcard?.label ?? "SELECTING..."}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 text-xs font-mono-condensed text-slate-500 z-10">
        <Users className="w-4 h-4" />
        Total {counts.total} Players — The match will begin automatically when balanced.
      </div>
    </div>
  );
};
