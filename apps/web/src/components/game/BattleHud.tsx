import React from "react";
import { Timer, Pause } from "lucide-react";

export interface BattleHudProps {
  leftScore: number;
  rightScore: number;
  time: string;
  phase: string;
  activeTeam?: "left" | "right" | "chaos" | null;
  isLastFiveSec?: boolean;
  className?: string;
}

export const BattleHud: React.FC<BattleHudProps> = ({
  leftScore,
  rightScore,
  time,
  phase,
  activeTeam = null,
  isLastFiveSec = false,
  className = "",
}) => {
  const isPaused = phase === "PAUSED";
  const isLeft = activeTeam === "left";
  const isRight = activeTeam === "right";

  // Score differential percentage for top tension meter
  const total = leftScore + rightScore;
  const leftPercent = total > 0 ? (leftScore / total) * 100 : 50;

  return (
    <section aria-label="Battle Scoreboard" className={`w-full max-w-lg mx-auto flex flex-col gap-3 select-none ${className}`}>
      {/* Top Status & Match Clock Strip */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[var(--stage-card)] border border-[var(--line)] text-xs font-mono-condensed">
        {/* Left Team Mini Indicator */}
        <div className={`flex items-center gap-1.5 font-bold ${isLeft ? "text-[var(--cyan)]" : "text-[var(--muted)]"}`}>
          <span className="w-2 h-2 rounded-full bg-[var(--cyan)]" />
          <span>CYAN</span>
        </div>

        {/* Central Authoritative Timer Pill */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border font-mono-condensed font-black text-sm tracking-wider transition-colors ${
            isLastFiveSec
              ? "bg-red-950/80 border-red-500 text-red-400 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]"
              : isPaused
              ? "bg-amber-950/60 border-amber-500/50 text-amber-300"
              : "bg-[var(--stage-surface)] border-[var(--line-bright)] text-[var(--ink)]"
          }`}
        >
          {isPaused ? (
            <>
              <Pause className="w-3.5 h-3.5 text-amber-400" />
              <span>PAUSED</span>
            </>
          ) : (
            <>
              <Timer className={`w-3.5 h-3.5 ${isLastFiveSec ? "text-red-400 animate-spin" : "text-[var(--cyan)]"}`} />
              <span>{time}</span>
            </>
          )}
        </div>

        {/* Right Team Mini Indicator */}
        <div className={`flex items-center gap-1.5 font-bold ${isRight ? "text-[var(--amber)]" : "text-[var(--muted)]"}`}>
          <span>AMBER</span>
          <span className="w-2 h-2 rounded-full bg-[var(--amber)]" />
        </div>
      </div>

      {/* Main Digital Scoreboard */}
      <div className="grid grid-cols-2 gap-3">
        {/* Cyan Team Score Box */}
        <div
          className={`p-3 md:p-4 rounded-2xl border flex flex-col items-center justify-center transition-all ${
            isLeft
              ? "bg-gradient-to-b from-[#003840]/60 to-[var(--stage-card)] border-[var(--cyan)] box-glow-cyan"
              : "bg-[var(--stage-card)] border-[var(--line)] opacity-85"
          }`}
        >
          <span className="text-[10px] font-mono-condensed uppercase tracking-widest text-[var(--cyan)] font-bold">
            CYAN CREW {isLeft && "• YOU"}
          </span>
          <strong className="text-3xl md:text-4xl font-mono-condensed font-black text-white tracking-tight mt-0.5">
            {leftScore.toLocaleString()}
          </strong>
        </div>

        {/* Amber Team Score Box */}
        <div
          className={`p-3 md:p-4 rounded-2xl border flex flex-col items-center justify-center transition-all ${
            isRight
              ? "bg-gradient-to-b from-[#402600]/60 to-[var(--stage-card)] border-[var(--amber)] box-glow-amber"
              : "bg-[var(--stage-card)] border-[var(--line)] opacity-85"
          }`}
        >
          <span className="text-[10px] font-mono-condensed uppercase tracking-widest text-[var(--amber)] font-bold">
            AMBER CREW {isRight && "• YOU"}
          </span>
          <strong className="text-3xl md:text-4xl font-mono-condensed font-black text-white tracking-tight mt-0.5">
            {rightScore.toLocaleString()}
          </strong>
        </div>
      </div>

      {/* Arena Dominance Progress Meter */}
      <div className="w-full h-2 rounded-full bg-[#080d16] border border-[var(--line)] overflow-hidden flex relative">
        <div
          className="h-full bg-gradient-to-r from-[var(--cyan)] to-cyan-300 transition-all duration-200"
          style={{ width: `${leftPercent}%` }}
        />
        <div
          className="h-full bg-gradient-to-r from-amber-300 to-[var(--amber)] transition-all duration-200"
          style={{ width: `${100 - leftPercent}%` }}
        />
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-white/60 z-10" />
      </div>
    </section>
  );
};
