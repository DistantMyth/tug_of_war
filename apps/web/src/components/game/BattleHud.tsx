import React from "react";
import { Timer, Pause, Crown } from "lucide-react";
import { CyberTitanCrest, SolarPhoenixCrest } from "../common/TeamBadges.js";

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
  const leftPercent = total > 0 ? Math.round((leftScore / total) * 100) : 50;
  const isLeftLeading = leftScore > rightScore;
  const isRightLeading = rightScore > leftScore;

  return (
    <section aria-label="Battle Scoreboard" className={`w-full max-w-lg mx-auto flex flex-col gap-2.5 select-none ${className}`}>
      {/* Top Status & Match Clock Strip */}
      <div className="flex items-center justify-between px-3.5 py-1.5 rounded-2xl bg-[var(--stage-card)]/90 border border-[var(--line-bright)] text-xs font-mono-condensed backdrop-blur-md">
        {/* Left Team Mini Indicator */}
        <div className={`flex items-center gap-1.5 font-bold ${isLeft ? "text-[var(--cyan)]" : "text-slate-300"}`}>
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--cyan)] shadow-[0_0_8px_var(--cyan)]" />
          <span>CYAN {isLeft && "(YOU)"}</span>
          {isLeftLeading && <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
        </div>

        {/* Central Authoritative Timer Pill */}
        <div
          className={`flex items-center gap-1.5 px-3.5 py-1 rounded-xl border font-mono-condensed font-black text-sm tracking-wider transition-all duration-200 ${
            isLastFiveSec
              ? "bg-red-950/90 border-red-500 text-red-400 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.7)]"
              : isPaused
              ? "bg-amber-950/70 border-amber-500/60 text-amber-300"
              : "bg-[var(--stage-surface)] border-[var(--line-bright)] text-[var(--ink)] shadow-md"
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
        <div className={`flex items-center gap-1.5 font-bold ${isRight ? "text-[var(--amber)]" : "text-slate-300"}`}>
          {isRightLeading && <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
          <span>AMBER {isRight && "(YOU)"}</span>
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--amber)] shadow-[0_0_8px_var(--amber)]" />
        </div>
      </div>

      {/* Main Digital Scoreboard */}
      <div className="grid grid-cols-2 gap-3">
        {/* Cyan Team Score Box */}
        <div
          className={`p-3 md:p-3.5 rounded-2xl border-2 flex items-center gap-3 transition-all relative overflow-hidden ${
            isLeft
              ? "bg-gradient-to-br from-[#003840]/70 via-[var(--stage-card)] to-[#00222a] border-[var(--cyan)] box-glow-cyan"
              : "bg-[var(--stage-card)]/90 border-[var(--line)] opacity-90"
          }`}
        >
          <div className="shrink-0 w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center">
            <CyberTitanCrest size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono-condensed uppercase tracking-widest text-[var(--cyan)] font-bold truncate">
                CYAN CREW {isLeft && "• YOU"}
              </span>
              <span className="text-[10px] font-mono-condensed text-cyan-400/80 font-bold">{leftPercent}%</span>
            </div>
            <strong className="block text-2xl md:text-3xl font-mono-condensed font-black text-white tracking-tight leading-none mt-1">
              {leftScore.toLocaleString()}
            </strong>
          </div>
        </div>

        {/* Amber Team Score Box */}
        <div
          className={`p-3 md:p-3.5 rounded-2xl border-2 flex items-center gap-3 transition-all relative overflow-hidden ${
            isRight
              ? "bg-gradient-to-br from-[#402600]/70 via-[var(--stage-card)] to-[#281300] border-[var(--amber)] box-glow-amber"
              : "bg-[var(--stage-card)]/90 border-[var(--line)] opacity-90"
          }`}
        >
          <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-500/30 flex items-center justify-center">
            <SolarPhoenixCrest size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono-condensed uppercase tracking-widest text-[var(--amber)] font-bold truncate">
                AMBER CREW {isRight && "• YOU"}
              </span>
              <span className="text-[10px] font-mono-condensed text-amber-400/80 font-bold">{100 - leftPercent}%</span>
            </div>
            <strong className="block text-2xl md:text-3xl font-mono-condensed font-black text-white tracking-tight leading-none mt-1">
              {rightScore.toLocaleString()}
            </strong>
          </div>
        </div>
      </div>

      {/* Arena Dominance Progress Meter */}
      <div className="w-full h-2.5 rounded-full bg-[#050811] border border-[var(--line-bright)] overflow-hidden flex relative p-0.5 shadow-inner">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 to-sky-300 rounded-l-full transition-all duration-150"
          style={{ width: `${leftPercent}%` }}
        />
        <div
          className="h-full bg-gradient-to-r from-amber-300 to-orange-500 rounded-r-full transition-all duration-150"
          style={{ width: `${100 - leftPercent}%` }}
        />
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 bg-white shadow-[0_0_8px_#ffffff] z-10" />
      </div>
    </section>
  );
};

