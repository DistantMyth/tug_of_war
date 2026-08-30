import React, { useEffect } from "react";
import confetti from "canvas-confetti";
import { Award, RotateCcw, Zap, Flame, Crown } from "lucide-react";
import { useGameStore } from "../../store/useGameStore.js";
import { ParticleBackground } from "../common/ParticleBackground.js";
import {
  CyberTitanCrest,
  SolarPhoenixCrest,
  TrophyChampionGold,
  ChaosWildcardCrest,
} from "../common/TeamBadges.js";

export const ResultsScene: React.FC = () => {
  const { scores, winner, roundNumber, counts } = useGameStore();

  useEffect(() => {
    // Multi-cannon celebratory confetti streams
    try {
      const colors =
        winner === "left"
          ? ["#00f0ff", "#38bdf8", "#ffffff", "#ffd700"]
          : winner === "right"
          ? ["#ff6b00", "#ffd700", "#ffffff", "#ff2a00"]
          : ["#d946ef", "#ffd700", "#00f0ff", "#ffffff"];

      // Left cannon
      confetti({
        particleCount: 80,
        angle: 60,
        spread: 70,
        origin: { x: 0.1, y: 0.7 },
        colors,
      });

      // Right cannon
      confetti({
        particleCount: 80,
        angle: 120,
        spread: 70,
        origin: { x: 0.9, y: 0.7 },
        colors,
      });

      // Center sky shower
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 100,
          origin: { x: 0.5, y: 0.3 },
          colors,
        });
      }, 400);
    } catch {}
  }, [winner]);

  const isLeftWinner = winner === "left";
  const isRightWinner = winner === "right";
  const isDraw = winner === "draw" || !winner;

  const scoreDiff = Math.abs(scores.left - scores.right);
  const totalScore = scores.left + scores.right;
  const leftPercent = totalScore > 0 ? Math.round((scores.left / totalScore) * 100) : 50;
  const rightPercent = totalScore > 0 ? 100 - leftPercent : 50;

  const leftAvgPerPlayer = counts.left > 0 ? (scores.left / counts.left).toFixed(1) : "0";
  const rightAvgPerPlayer = counts.right > 0 ? (scores.right / counts.right).toFixed(1) : "0";

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-6 md:p-10 overflow-hidden bg-arena-broadcast select-none">
      {/* Celebration Particle Stream */}
      <ParticleBackground mode="celebration" intensity="high" />

      {/* Rotating Sunburst Rays Background */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
        <svg
          viewBox="0 0 1000 1000"
          className="w-[1400px] h-[1400px] opacity-15 animate-sunburst origin-center pointer-events-none"
        >
          <defs>
            <radialGradient id="sunburstGrad" cx="50%" cy="50%" r="50%">
              <stop
                offset="0%"
                stopColor={isLeftWinner ? "#00f0ff" : isRightWinner ? "#ff7b00" : "#fbbf24"}
                stopOpacity="0.8"
              />
              <stop
                offset="70%"
                stopColor={isLeftWinner ? "#0284c7" : isRightWinner ? "#ff2a00" : "#d946ef"}
                stopOpacity="0.2"
              />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
          </defs>
          {Array.from({ length: 24 }).map((_, i) => (
            <polygon
              key={i}
              points="500,500 470,0 530,0"
              fill="url(#sunburstGrad)"
              transform={`rotate(${i * 15} 500 500)`}
            />
          ))}
        </svg>
      </div>

      {/* Atmospheric Stage Glows */}
      <div
        className={`absolute inset-0 pointer-events-none transition-colors duration-700 ${
          isLeftWinner
            ? "bg-gradient-to-b from-cyan-950/30 via-transparent to-cyan-950/20"
            : isRightWinner
            ? "bg-gradient-to-b from-amber-950/30 via-transparent to-amber-950/20"
            : "bg-gradient-to-b from-purple-950/30 via-transparent to-purple-950/20"
        }`}
      />

      {/* TOP BROADCAST BANNER */}
      <header className="text-center z-20 space-y-1.5 mt-2">
        <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full border border-[var(--line-bright)] bg-[var(--stage-card)]/90 backdrop-blur-xl text-xs font-mono-condensed uppercase tracking-widest text-slate-200 shadow-lg">
          <Award className="w-4 h-4 text-amber-400" />
          <span>ROUND {roundNumber} CONCLUDED</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-display uppercase tracking-wider text-white drop-shadow-[0_0_35px_rgba(255,255,255,0.4)]">
          {isDraw ? "HONORABLE DRAW!" : "VICTORY ACHIEVED!"}
        </h1>
      </header>

      {/* 3D-STYLED VICTORY PODIUM & EMBLEM REVEAL */}
      <div className="w-full max-w-6xl z-20 my-auto flex flex-col items-center">
        {/* Central Monumental Pedestal Stage */}
        <div className="relative flex flex-col items-center mb-4">
          {/* Glowing Victor Crown and Team Emblem Reveal */}
          <div className="relative flex items-center justify-center">
            {/* Halo Pulse behind Trophy */}
            <div
              className={`absolute w-44 h-44 rounded-full blur-3xl opacity-80 animate-pulse ${
                isLeftWinner
                  ? "bg-cyan-400"
                  : isRightWinner
                  ? "bg-amber-400"
                  : "bg-yellow-400"
              }`}
            />

            {/* Winner Crests Cluster */}
            <div className="relative flex items-center gap-4 z-10 p-4">
              {isLeftWinner && (
                <div className="animate-float-slow">
                  <CyberTitanCrest size={80} className="filter drop-shadow-[0_0_25px_rgba(0,240,255,0.9)]" />
                </div>
              )}
              <div className="animate-celebrate">
                <TrophyChampionGold size={96} className="filter drop-shadow-[0_0_35px_rgba(251,191,36,1)]" />
              </div>
              {isRightWinner && (
                <div className="animate-float-slow">
                  <SolarPhoenixCrest size={80} className="filter drop-shadow-[0_0_25px_rgba(255,107,0,0.9)]" />
                </div>
              )}
              {isDraw && (
                <div className="animate-float-slow">
                  <ChaosWildcardCrest size={80} className="filter drop-shadow-[0_0_25px_rgba(217,70,239,0.9)]" />
                </div>
              )}
            </div>
          </div>

          {/* Winner Title Announcement */}
          <div className="text-center mt-2 space-y-1">
            <h2
              className={`text-5xl md:text-7xl font-display uppercase tracking-widest leading-none drop-shadow-2xl ${
                isLeftWinner
                  ? "text-[var(--cyan)] text-glow-cyan"
                  : isRightWinner
                  ? "text-[var(--amber)] text-glow-amber"
                  : "text-[var(--violet)] text-glow-gold"
              }`}
            >
              {isLeftWinner
                ? "TEAM CYAN WINS!"
                : isRightWinner
                ? "TEAM AMBER WINS!"
                : "IT'S A DEADLOCK DRAW!"}
            </h2>

            {!isDraw ? (
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-sm font-mono-condensed uppercase tracking-widest font-bold shadow-md">
                <Crown className="w-4 h-4 text-yellow-400" />
                <span>VICTORY MARGIN: +{scoreDiff.toLocaleString()} TAPS ({Math.abs(leftPercent - rightPercent)}% DOMINANCE)</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-purple-950/80 border border-purple-500/50 text-purple-300 text-sm font-mono-condensed uppercase tracking-widest font-bold">
                <span>HISTORIC 50/50 DEADLOCK CLASH</span>
              </div>
            )}
          </div>
        </div>

        {/* 3D VICTORY PODIUM WINGS & SCORE BREAKDOWN */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {/* Left Podium (Cyan / Sector West) */}
          <div
            className={`p-6 rounded-3xl backdrop-blur-xl border-2 transition-all flex flex-col justify-between ${
              isLeftWinner
                ? "bg-gradient-to-b from-cyan-950/90 to-[#06182c]/90 border-cyan-400/80 shadow-[0_0_40px_rgba(0,240,255,0.3)] md:scale-105"
                : "bg-slate-900/80 border-slate-800 opacity-85"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--cyan)] font-display text-xl uppercase tracking-wider">
                <Zap className="w-5 h-5" />
                CYAN CREW
              </div>
              {isLeftWinner && (
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-400 text-slate-950 text-[10px] font-mono-condensed font-black uppercase">
                  CHAMPION
                </span>
              )}
            </div>

            <div className="my-4 text-center">
              <div className="text-5xl md:text-6xl font-mono-condensed font-black text-white leading-none">
                {scores.left.toLocaleString()}
              </div>
              <span className="text-xs text-cyan-300 font-mono-condensed tracking-wider mt-1 block">
                {leftPercent}% SCORE SHARE
              </span>
            </div>

            <div className="pt-3 border-t border-cyan-500/20 space-y-1.5 text-xs font-mono-condensed">
              <div className="flex justify-between text-slate-400">
                <span>WARRIORS</span>
                <span className="text-white font-bold">{counts.left} PLAYERS</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>AVG TAP SPEED</span>
                <span className="text-cyan-300 font-bold">{leftAvgPerPlayer} TAPS/WARRIOR</span>
              </div>
            </div>
          </div>

          {/* Center Differential Breakdown Box */}
          <div className="p-6 rounded-3xl bg-[var(--stage-card)]/90 border-2 border-[var(--line-bright)] backdrop-blur-2xl shadow-2xl flex flex-col items-center justify-center text-center space-y-3">
            <div className="text-xs font-mono-condensed text-slate-400 uppercase tracking-widest font-bold">
              MATCH TELEMETRY SUMMARY
            </div>

            <div className="w-full space-y-2">
              <div className="flex justify-between text-xs font-mono-condensed text-slate-300">
                <span className="text-cyan-400 font-bold">CYAN {leftPercent}%</span>
                <span className="text-slate-400">TOTAL TAPS: {totalScore.toLocaleString()}</span>
                <span className="text-amber-400 font-bold">{rightPercent}% AMBER</span>
              </div>

              {/* Progress Dominance Bar */}
              <div className="w-full h-3 bg-[#050811] rounded-full overflow-hidden flex border border-[var(--line)]">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300 transition-all"
                  style={{ width: `${leftPercent}%` }}
                />
                <div
                  className="h-full bg-gradient-to-l from-amber-500 to-amber-300 transition-all"
                  style={{ width: `${rightPercent}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full pt-2 border-t border-[var(--line)] text-center">
              <div className="p-2 rounded-xl bg-[var(--stage-surface)] border border-[var(--line)]">
                <div className="text-[10px] text-slate-400 font-mono-condensed">TOTAL WARRIORS</div>
                <div className="text-lg font-mono-condensed font-black text-white">{counts.total}</div>
              </div>
              <div className="p-2 rounded-xl bg-[var(--stage-surface)] border border-[var(--line)]">
                <div className="text-[10px] text-slate-400 font-mono-condensed">ROUND NUMBER</div>
                <div className="text-lg font-mono-condensed font-black text-amber-400">#{roundNumber}</div>
              </div>
            </div>
          </div>

          {/* Right Podium (Amber / Sector East) */}
          <div
            className={`p-6 rounded-3xl backdrop-blur-xl border-2 transition-all flex flex-col justify-between ${
              isRightWinner
                ? "bg-gradient-to-b from-amber-950/90 to-[#261005]/90 border-amber-400/80 shadow-[0_0_40px_rgba(255,107,0,0.3)] md:scale-105"
                : "bg-slate-900/80 border-slate-800 opacity-85"
            }`}
          >
            <div className="flex items-center justify-between">
              {isRightWinner && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-mono-condensed font-black uppercase">
                  CHAMPION
                </span>
              )}
              <div className="flex items-center gap-2 text-[var(--amber)] font-display text-xl uppercase tracking-wider ml-auto">
                AMBER CREW
                <Flame className="w-5 h-5" />
              </div>
            </div>

            <div className="my-4 text-center">
              <div className="text-5xl md:text-6xl font-mono-condensed font-black text-white leading-none">
                {scores.right.toLocaleString()}
              </div>
              <span className="text-xs text-amber-300 font-mono-condensed tracking-wider mt-1 block">
                {rightPercent}% SCORE SHARE
              </span>
            </div>

            <div className="pt-3 border-t border-amber-500/20 space-y-1.5 text-xs font-mono-condensed">
              <div className="flex justify-between text-slate-400">
                <span className="text-white font-bold">{counts.right} PLAYERS</span>
                <span>WARRIORS</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span className="text-amber-300 font-bold">{rightAvgPerPlayer} TAPS/WARRIOR</span>
                <span>AVG TAP SPEED</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER / NEXT MATCH HINT */}
      <footer className="flex items-center gap-2 text-xs md:text-sm font-mono-condensed text-slate-300 z-20 animate-pulse mt-2">
        <RotateCcw className="w-4 h-4 text-[var(--cyan)]" />
        <span>STAND BY FOR NEXT ROUND OR REMATCH • HOST WILL TRIGGER LAUNCH</span>
      </footer>
    </div>
  );
};
