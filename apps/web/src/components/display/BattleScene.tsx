import React, { useEffect, useState } from "react";
import { Pause, Plus, Zap, Flame } from "lucide-react";
import { useGameStore } from "../../store/useGameStore.js";
import { RopeArena } from "../game/RopeArena.js";

export const BattleScene: React.FC = () => {
  const { scores, counts, timing, phase, extensionBanner, roundNumber, winner } = useGameStore();
  const [remainingTime, setRemainingTime] = useState<string>("00:30.00");
  const [isLastFiveSec, setIsLastFiveSec] = useState<boolean>(false);

  // Dynamic RAF Timer Loop based on authoritative server clock
  useEffect(() => {
    let frameId: number;

    const tick = () => {
      const now = Date.now();
      const endTime = timing.endTime ?? now + 30000;
      let remainingMs = 0;

      if (phase === "PAUSED" && timing.pausedAt) {
        remainingMs = Math.max(0, endTime - timing.pausedAt);
      } else {
        remainingMs = Math.max(0, endTime - now);
      }

      const totalSec = Math.floor(remainingMs / 1000);
      const minutes = Math.floor(totalSec / 60);
      const seconds = totalSec % 60;
      const centis = Math.floor((remainingMs % 1000) / 10);

      const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
      setRemainingTime(formatted);
      setIsLastFiveSec(remainingMs <= 5000 && remainingMs > 0 && phase === "RUNNING");

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [timing.endTime, timing.pausedAt, phase]);

  // Score differential percentage
  const totalScore = scores.left + scores.right;
  let leftRatio = 50;
  let rightRatio = 50;
  if (totalScore > 0) {
    leftRatio = Math.round((scores.left / totalScore) * 100);
    rightRatio = 100 - leftRatio;
  }

  return (
    <div
      className={`relative w-full h-full flex flex-col items-center justify-between p-6 md:p-12 overflow-hidden select-none transition-colors duration-500 ${
        isLastFiveSec ? "bg-red-950/40" : "bg-arena-broadcast"
      }`}
    >
      {/* Background Stadium Spotlights */}
      <div
        className="absolute top-1/3 left-1/5 -translate-y-1/2 w-[480px] h-[480px] bg-[var(--cyan)]/15 rounded-full blur-[160px] pointer-events-none transition-all duration-300"
        style={{ opacity: Math.max(0.3, leftRatio / 50) }}
      />
      <div
        className="absolute top-1/3 right-1/5 -translate-y-1/2 w-[480px] h-[480px] bg-[var(--amber)]/15 rounded-full blur-[160px] pointer-events-none transition-all duration-300"
        style={{ opacity: Math.max(0.3, rightRatio / 50) }}
      />

      {/* TOP BROADCAST HEADER */}
      <header className="w-full max-w-7xl flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-[var(--stage-card)] border border-[var(--line)] text-xs font-mono-condensed uppercase tracking-wider text-slate-200">
            ROUND {roundNumber}
          </div>
          <div className="px-4 py-2 rounded-xl bg-cyan-950/70 border border-[var(--cyan)]/50 text-xs font-mono-condensed uppercase tracking-wider text-[var(--cyan)] font-bold">
            {counts.left} PLAYERS
          </div>
        </div>

        {/* Central Authoritative Clock */}
        <div
          className={`flex items-center gap-3 px-8 py-2.5 rounded-2xl border backdrop-blur-xl transition-all duration-300 ${
            isLastFiveSec
              ? "bg-red-950/90 border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.7)] animate-pulse"
              : phase === "PAUSED"
              ? "bg-amber-950/80 border-amber-500/60"
              : "bg-[var(--stage-card)]/90 border-[var(--line-bright)]"
          }`}
        >
          {phase === "PAUSED" ? (
            <div className="flex items-center gap-2 text-amber-300 font-display text-2xl tracking-widest uppercase">
              <Pause className="w-6 h-6 animate-pulse" />
              <span>GAME PAUSED</span>
            </div>
          ) : (
            <div
              className={`font-mono-condensed text-4xl md:text-6xl font-black tracking-widest ${
                isLastFiveSec ? "text-red-400" : "text-white"
              }`}
            >
              {remainingTime}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-amber-950/70 border border-[var(--amber)]/50 text-xs font-mono-condensed uppercase tracking-wider text-[var(--amber)] font-bold">
            {counts.right} PLAYERS
          </div>
          <div className="px-4 py-2 rounded-xl bg-[var(--stage-card)] border border-[var(--line)] text-xs font-mono-condensed uppercase tracking-wider text-slate-200">
            TOTAL {counts.total}
          </div>
        </div>
      </header>

      {/* Extension Banner Notification */}
      {extensionBanner && Date.now() - extensionBanner.at < 3500 && (
        <div className="absolute top-28 z-40 animate-bounce flex items-center gap-3 px-8 py-3 rounded-full bg-emerald-400 text-slate-950 font-display text-2xl uppercase tracking-widest shadow-[0_0_50px_rgba(52,211,153,0.9)]">
          <Plus className="w-7 h-7 stroke-[3]" />
          <span>{extensionBanner.seconds} SECONDS ADDED!</span>
        </div>
      )}

      {/* DUAL SCOREBOARD DISPLAY */}
      <div className="w-full max-w-7xl grid grid-cols-2 gap-12 z-10 my-2 items-center">
        {/* Left Team (CYAN) */}
        <div className="flex flex-col items-start space-y-1">
          <div className="flex items-center gap-2.5 text-[var(--cyan)] font-display text-3xl md:text-5xl uppercase tracking-wider text-glow-cyan">
            <Zap className="w-8 h-8" />
            CYAN CREW
          </div>
          <div className="text-7xl md:text-9xl lg:text-[10rem] font-mono-condensed font-black text-white text-glow-cyan tracking-tight leading-none">
            {scores.left.toLocaleString()}
          </div>
          <div className="text-sm font-mono-condensed text-[var(--cyan)]/80 tracking-widest uppercase">
            POWER DOMINANCE: {leftRatio}%
          </div>
        </div>

        {/* Right Team (AMBER) */}
        <div className="flex flex-col items-end space-y-1">
          <div className="flex items-center gap-2.5 text-[var(--amber)] font-display text-3xl md:text-5xl uppercase tracking-wider text-glow-amber">
            AMBER CREW
            <Flame className="w-8 h-8" />
          </div>
          <div className="text-7xl md:text-9xl lg:text-[10rem] font-mono-condensed font-black text-white text-glow-amber tracking-tight leading-none">
            {scores.right.toLocaleString()}
          </div>
          <div className="text-sm font-mono-condensed text-[var(--amber)]/80 tracking-widest uppercase">
            POWER DOMINANCE: {rightRatio}%
          </div>
        </div>
      </div>

      {/* GRAND STADIUM ARENA (ATHLETES + BRAIDED CABLE) */}
      <div className="w-full max-w-7xl z-20 my-auto py-2">
        <RopeArena
          leftScore={scores.left}
          rightScore={scores.right}
          phase={phase}
          isLastFiveSec={isLastFiveSec}
          winner={winner}
          isProjector={true}
        />
      </div>

      {/* BROADCAST LOWER THIRD STATUS BAR */}
      <footer className="w-full max-w-7xl z-20 flex flex-col gap-3">
        {/* Arena Tug Balance Meter */}
        <div className="relative w-full h-4 rounded-full bg-[#080d16] border border-[var(--line-bright)] overflow-hidden flex shadow-2xl">
          <div
            className="h-full bg-gradient-to-r from-[var(--cyan)] to-cyan-300 transition-all duration-150"
            style={{ width: `${leftRatio}%` }}
          />
          <div
            className="h-full bg-gradient-to-r from-amber-300 to-[var(--amber)] transition-all duration-150"
            style={{ width: `${rightRatio}%` }}
          />
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 bg-white shadow-[0_0_10px_#fff]" />
        </div>

        <div className="flex items-center justify-between text-xs font-mono-condensed text-[var(--muted)] tracking-wider px-1">
          <span>CYAN SECTOR</span>
          <span className="text-slate-300 font-bold">ESPORTS ARENA BROADCAST • LIVE INGESTION</span>
          <span>AMBER SECTOR</span>
        </div>
      </footer>
    </div>
  );
};
