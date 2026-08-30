import React, { useEffect, useState } from "react";
import { Pause, Zap, Flame, Clock, AlertTriangle } from "lucide-react";
import { useGameStore } from "../../store/useGameStore.js";
import { RopeArena } from "../game/RopeArena.js";
import { LiveTicker } from "../game/LiveTicker.js";
import { ParticleBackground } from "../common/ParticleBackground.js";
import { CyberTitanCrest, SolarPhoenixCrest } from "../common/TeamBadges.js";

export const BattleScene: React.FC = () => {
  const { scores, counts, timing, phase, extensionBanner, roundNumber, winner } = useGameStore();
  const [remainingTime, setRemainingTime] = useState<string>("00:30.00");
  const [isLastFiveSec, setIsLastFiveSec] = useState<boolean>(false);

  // Dynamic RAF Timer Loop based on authoritative server clock
  useEffect(() => {
    if (phase !== "RUNNING" && phase !== "PAUSED") return;

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
      setRemainingTime((prev) => (prev === formatted ? prev : formatted));

      const lastFive = remainingMs <= 5000 && remainingMs > 0 && phase === "RUNNING";
      setIsLastFiveSec((prev) => (prev === lastFive ? prev : lastFive));

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

  const isOvertime = Boolean(extensionBanner && Date.now() - extensionBanner.at < 5000);

  return (
    <div
      className={`relative w-full h-full flex flex-col items-center justify-between p-4 md:p-8 overflow-hidden select-none transition-colors duration-500 ${
        isLastFiveSec
          ? "bg-red-950/40"
          : isOvertime
          ? "bg-amber-950/30"
          : "bg-arena-broadcast"
      }`}
    >
      {/* Dynamic Floating Particles */}
      <ParticleBackground mode={isLastFiveSec ? "battle" : "stadium"} intensity="high" />

      {/* Background Dynamic Stadium Spotlights */}
      <div
        className="absolute top-1/3 left-1/5 -translate-y-1/2 w-[520px] h-[520px] bg-[var(--cyan)]/15 rounded-full blur-[170px] pointer-events-none transition-all duration-300"
        style={{ opacity: Math.max(0.3, leftRatio / 50) }}
      />
      <div
        className="absolute top-1/3 right-1/5 -translate-y-1/2 w-[520px] h-[520px] bg-[var(--amber)]/15 rounded-full blur-[170px] pointer-events-none transition-all duration-300"
        style={{ opacity: Math.max(0.3, rightRatio / 50) }}
      />

      {/* TOP BROADCAST HEADER */}
      <header className="w-full max-w-7xl flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-[var(--stage-card)] border border-[var(--line)] text-xs font-mono-condensed uppercase tracking-wider text-slate-200 shadow-md">
            ROUND {roundNumber}
          </div>
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-cyan-950/80 border border-[var(--cyan)]/50 text-xs font-mono-condensed uppercase tracking-wider text-[var(--cyan)] font-bold shadow-[0_0_15px_rgba(0,240,255,0.2)]">
            <CyberTitanCrest size={20} />
            <span>{counts.left} PLAYERS</span>
          </div>
        </div>

        {/* Central Authoritative Clock */}
        <div
          className={`flex items-center gap-3 px-8 py-2 rounded-2xl border backdrop-blur-xl transition-all duration-300 shadow-2xl ${
            isLastFiveSec
              ? "bg-red-950/95 border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.8)] animate-pulse"
              : phase === "PAUSED"
              ? "bg-amber-950/90 border-amber-500/80"
              : "bg-[var(--stage-card)]/90 border-[var(--line-bright)]"
          }`}
        >
          {phase === "PAUSED" ? (
            <div className="flex items-center gap-2 text-amber-300 font-display text-2xl tracking-widest uppercase">
              <Pause className="w-6 h-6 animate-pulse" />
              <span>GAME PAUSED</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Clock
                className={`w-6 h-6 ${
                  isLastFiveSec ? "text-red-400 animate-spin" : "text-cyan-400"
                }`}
              />
              <div
                className={`font-mono-condensed text-4xl md:text-6xl font-black tracking-widest leading-none ${
                  isLastFiveSec ? "text-red-400 text-glow-amber" : "text-white"
                }`}
              >
                {remainingTime}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-950/80 border border-[var(--amber)]/50 text-xs font-mono-condensed uppercase tracking-wider text-[var(--amber)] font-bold shadow-[0_0_15px_rgba(255,107,0,0.2)]">
            <SolarPhoenixCrest size={20} />
            <span>{counts.right} PLAYERS</span>
          </div>
          <div className="px-4 py-2 rounded-xl bg-[var(--stage-card)] border border-[var(--line)] text-xs font-mono-condensed uppercase tracking-wider text-slate-200 shadow-md">
            TOTAL {counts.total}
          </div>
        </div>
      </header>

      {/* OVERTIME / EXTENSION ALERT BANNER */}
      {extensionBanner && Date.now() - extensionBanner.at < 4500 && (
        <div className="absolute top-20 z-40 animate-bounce flex items-center gap-3 px-8 py-2.5 rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 text-slate-950 font-display text-xl md:text-2xl uppercase tracking-widest shadow-[0_0_60px_rgba(52,211,153,0.95)] border-2 border-white">
          <AlertTriangle className="w-6 h-6 text-slate-950 stroke-[2.5]" />
          <span>⚡ OVERTIME EXTENSION ACTIVATED: +{extensionBanner.seconds}s ADDED!</span>
        </div>
      )}

      {/* DUAL SCOREBOARD DISPLAY WITH DOMINANCE ENERGY BARS */}
      <div className="w-full max-w-7xl grid grid-cols-2 gap-8 md:gap-14 z-10 my-1 items-center">
        {/* Left Team (CYAN) */}
        <div className="flex flex-col items-start space-y-2">
          <div className="flex items-center gap-3 text-[var(--cyan)] font-display text-3xl md:text-5xl uppercase tracking-wider text-glow-cyan">
            <CyberTitanCrest size={42} />
            <div className="flex items-center gap-2">
              <Zap className="w-7 h-7" />
              <span>CYAN CREW</span>
            </div>
          </div>

          <div className="text-7xl md:text-9xl lg:text-[9.5rem] font-mono-condensed font-black text-white text-glow-cyan tracking-tight leading-none">
            {scores.left.toLocaleString()}
          </div>

          {/* Cyan Dominance Energy Bar */}
          <div className="w-full max-w-md space-y-1">
            <div className="flex justify-between text-xs font-mono-condensed text-[var(--cyan)] font-bold tracking-widest uppercase">
              <span>POWER DOMINANCE: {leftRatio}%</span>
              <span>{scores.left > scores.right ? `+${(scores.left - scores.right).toLocaleString()} LEAD` : ""}</span>
            </div>
            <div className="h-3 w-full bg-slate-950/80 rounded-full overflow-hidden border border-cyan-500/40 p-0.5 relative">
              <div
                className="h-full bg-gradient-to-r from-cyan-600 via-cyan-400 to-white rounded-full transition-all duration-200 shadow-[0_0_15px_#00f0ff]"
                style={{ width: `${leftRatio}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right Team (AMBER) */}
        <div className="flex flex-col items-end space-y-2">
          <div className="flex items-center gap-3 text-[var(--amber)] font-display text-3xl md:text-5xl uppercase tracking-wider text-glow-amber">
            <div className="flex items-center gap-2">
              <span>AMBER CREW</span>
              <Flame className="w-7 h-7" />
            </div>
            <SolarPhoenixCrest size={42} />
          </div>

          <div className="text-7xl md:text-9xl lg:text-[9.5rem] font-mono-condensed font-black text-white text-glow-amber tracking-tight leading-none">
            {scores.right.toLocaleString()}
          </div>

          {/* Amber Dominance Energy Bar */}
          <div className="w-full max-w-md space-y-1">
            <div className="flex justify-between text-xs font-mono-condensed text-[var(--amber)] font-bold tracking-widest uppercase">
              <span>{scores.right > scores.left ? `+${(scores.right - scores.left).toLocaleString()} LEAD` : ""}</span>
              <span>POWER DOMINANCE: {rightRatio}%</span>
            </div>
            <div className="h-3 w-full bg-slate-950/80 rounded-full overflow-hidden border border-amber-500/40 p-0.5 relative flex justify-end">
              <div
                className="h-full bg-gradient-to-l from-amber-600 via-amber-400 to-white rounded-full transition-all duration-200 shadow-[0_0_15px_#ff9900]"
                style={{ width: `${rightRatio}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* GRAND STADIUM ARENA (ATHLETES + BRAIDED CABLE) */}
      <div className="w-full max-w-7xl z-20 my-auto py-1">
        <RopeArena
          leftScore={scores.left}
          rightScore={scores.right}
          phase={phase}
          isLastFiveSec={isLastFiveSec}
          winner={winner}
          isProjector={true}
        />
      </div>

      {/* BROADCAST LOWER THIRD & LIVE ESPORTS TICKER */}
      <footer className="w-full max-w-7xl z-20 flex flex-col gap-2.5">
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
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1.5 bg-white shadow-[0_0_12px_#fff]" />
        </div>

        {/* Live Broadcast Marquee Ticker */}
        <LiveTicker className="rounded-xl border border-[var(--line-bright)]" />
      </footer>
    </div>
  );
};
