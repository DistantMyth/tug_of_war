import React from "react";
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
      ? `VOLUNTEERS NEEDED: CYAN → AMBER`
      : neededRightToLeft > 0
      ? `VOLUNTEERS NEEDED: AMBER → CYAN`
      : `BALANCING COMPLETE`;

  const progressPercent = initialNeeded > 0 ? Math.round(((initialNeeded - totalNeeded) / initialNeeded) * 100) : 100;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-8 md:p-14 overflow-hidden bg-arena-broadcast select-none">
      {/* Ambient Arena Lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[var(--amber)]/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Header */}
      <header className="text-center z-10 space-y-2">
        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-[var(--amber)]/40 bg-amber-950/60 text-[var(--amber)] text-xs tracking-widest uppercase font-mono-condensed font-bold animate-pulse">
          <ShieldAlert className="w-4 h-4" />
          ARENA ROSTER LOCKED • FAIR PLAY BALANCING
        </div>
        <h1 className="text-6xl md:text-7xl font-display uppercase tracking-wider text-white drop-shadow-[0_0_30px_rgba(255,153,0,0.35)]">
          Balancing The Battle
        </h1>
        <p className="text-sm md:text-base text-slate-300 font-mono-condensed">
          Equal sides are required for an authoritative tournament match.
        </p>
      </header>

      {/* Central Interactive Balance Dashboard */}
      <div className="w-full max-w-5xl bg-[var(--stage-card)]/90 border-2 border-[var(--line-bright)] rounded-3xl p-8 md:p-12 backdrop-blur-2xl z-10 space-y-8 shadow-2xl">
        {/* Counts Comparison */}
        <div className="flex items-center justify-between gap-8">
          {/* Left Team (Cyan) */}
          <div className="flex-1 text-center p-6 rounded-2xl bg-cyan-950/40 border-2 border-[var(--cyan)]/50 box-glow-cyan">
            <span className="text-xs text-[var(--cyan)] font-mono-condensed tracking-widest uppercase font-bold">
              TEAM CYAN
            </span>
            <div className="text-6xl md:text-7xl font-mono-condensed font-black text-white mt-2 leading-none">
              {counts.left}
            </div>
            <div className="text-xs text-slate-400 font-mono-condensed mt-2">
              TARGET: {balancePlan?.targetLeft ?? counts.left}
            </div>
          </div>

          {/* Center Indicator */}
          <div className="flex flex-col items-center justify-center shrink-0 px-4">
            <div className="w-16 h-16 rounded-2xl bg-[var(--stage-surface)] border-2 border-[var(--amber)]/60 flex items-center justify-center text-[var(--amber)] shadow-lg">
              <ArrowRightLeft className="w-8 h-8 animate-pulse" />
            </div>
          </div>

          {/* Right Team (Amber) */}
          <div className="flex-1 text-center p-6 rounded-2xl bg-amber-950/40 border-2 border-[var(--amber)]/50 box-glow-amber">
            <span className="text-xs text-[var(--amber)] font-mono-condensed tracking-widest uppercase font-bold">
              TEAM AMBER
            </span>
            <div className="text-6xl md:text-7xl font-mono-condensed font-black text-white mt-2 leading-none">
              {counts.right}
            </div>
            <div className="text-xs text-slate-400 font-mono-condensed mt-2">
              TARGET: {balancePlan?.targetRight ?? counts.right}
            </div>
          </div>
        </div>

        {/* Hero Call to Action */}
        <div className="text-center space-y-4">
          <div className="text-3xl md:text-4xl font-display text-[var(--amber)] tracking-wider">
            {totalNeeded > 0 ? (
              <span>
                WE NEED <strong className="text-white text-glow-amber text-5xl">{totalNeeded}</strong> VOLUNTEERS
              </span>
            ) : (
              <span className="text-emerald-400">TEAMS ARE BALANCED & READY!</span>
            )}
          </div>
          <div className="text-sm font-mono-condensed text-slate-300 uppercase tracking-widest font-bold">
            {directionText} • TAP "VOLUNTEER" ON YOUR PHONE
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#04070d] rounded-full h-4 p-0.5 border border-[var(--line-bright)] overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(5, progressPercent)}%` }}
            />
          </div>
        </div>

        {/* Wildcard / Chaos Badge */}
        {balancePlan?.chaosNeeded && (
          <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-purple-950/50 border border-purple-500/40 text-purple-200 text-sm font-mono-condensed box-glow-violet">
            <Sparkles className="w-5 h-5 text-[var(--gold)]" />
            <span>
              CHAOS PLAYER ASSIGNED:{" "}
              <strong className="text-[var(--gold)] font-bold">{wildcard?.label ?? "SELECTING..."}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="flex items-center gap-2 text-xs font-mono-condensed text-slate-400 z-10">
        <Users className="w-4 h-4 text-[var(--muted)]" />
        Total {counts.total} Players — The match begins automatically when teams are balanced.
      </footer>
    </div>
  );
};
