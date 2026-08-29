import { useEffect, useState } from "react";
import { Pause, Plus, Sparkles, Zap } from "lucide-react";
import { useGameStore } from "../../store/useGameStore.js";

export const BattleScene: React.FC = () => {
  const { scores, counts, timing, phase, extensionBanner, roundNumber } = useGameStore();
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

  // Normalized score calculation for dominant visual tug-of-war meter
  const totalScore = scores.left + scores.right;
  let leftRatio = 50;
  let rightRatio = 50;
  if (totalScore > 0) {
    leftRatio = Math.round((scores.left / totalScore) * 100);
    rightRatio = 100 - leftRatio;
  }

  // Clamped marker position between 5% and 95%
  const ropeMarkerPercent = Math.max(5, Math.min(95, leftRatio));

  return (
    <div
      className={`relative w-full h-full flex flex-col items-center justify-between p-6 md:p-10 overflow-hidden transition-colors duration-500 ${
        isLastFiveSec ? "bg-red-950/30" : "bg-cyber-grid"
      }`}
    >
      {/* Background Energy Lights */}
      <div
        className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-cyan-500/15 rounded-full blur-[140px] pointer-events-none transition-all duration-300"
        style={{ opacity: leftRatio / 50 }}
      />
      <div
        className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 bg-amber-500/15 rounded-full blur-[140px] pointer-events-none transition-all duration-300"
        style={{ opacity: rightRatio / 50 }}
      />

      {/* Top Bar: Round & Timer */}
      <div className="w-full max-w-6xl flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono-condensed uppercase tracking-wider text-slate-300">
            ROUND {roundNumber}
          </div>
          <div className="px-3.5 py-1.5 rounded-lg bg-cyan-950/50 border border-cyan-500/40 text-xs font-mono-condensed uppercase tracking-wider text-cyan-400">
            {counts.left} PLAYERS
          </div>
        </div>

        {/* Central Authoritative Clock */}
        <div
          className={`flex items-center gap-2 px-6 py-2 rounded-2xl border backdrop-blur-xl transition-all duration-300 ${
            isLastFiveSec
              ? "bg-red-950/90 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.6)] animate-pulse"
              : "bg-slate-950/80 border-slate-800"
          }`}
        >
          <div
            className={`font-mono-condensed text-3xl md:text-5xl font-black tracking-widest ${
              isLastFiveSec ? "text-red-400" : "text-slate-100"
            }`}
          >
            {remainingTime}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-lg bg-amber-950/50 border border-amber-500/40 text-xs font-mono-condensed uppercase tracking-wider text-amber-400">
            {counts.right} PLAYERS
          </div>
        </div>
      </div>

      {/* Extension Banner Popup */}
      {extensionBanner && Date.now() - extensionBanner.at < 3500 && (
        <div className="absolute top-24 z-30 animate-bounce flex items-center gap-2 px-6 py-2 rounded-full bg-emerald-500 text-slate-950 font-display text-xl uppercase tracking-widest shadow-[0_0_40px_rgba(16,185,129,0.8)]">
          <Plus className="w-6 h-6 stroke-[3]" />
          {extensionBanner.seconds} SECONDS ADDED!
        </div>
      )}

      {/* Main Duel Stage: Big Scores */}
      <div className="w-full max-w-6xl grid grid-cols-2 gap-8 md:gap-16 z-10 my-auto items-center">
        {/* Left Team Score */}
        <div className="flex flex-col items-start space-y-2">
          <div className="flex items-center gap-2 text-cyan-400 font-display text-2xl md:text-4xl uppercase tracking-widest text-glow-cyan">
            <Zap className="w-6 h-6" />
            TEAM CYAN
          </div>
          <div className="text-6xl md:text-8xl lg:text-9xl font-mono-condensed font-black text-slate-100 text-glow-cyan tracking-tight">
            {scores.left.toLocaleString()}
          </div>
          <div className="text-xs md:text-sm font-mono-condensed text-cyan-400/80 tracking-widest uppercase">
            POWER SIGNAL: {leftRatio}%
          </div>
        </div>

        {/* Right Team Score */}
        <div className="flex flex-col items-end space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-display text-2xl md:text-4xl uppercase tracking-widest text-glow-amber">
            TEAM AMBER
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="text-6xl md:text-8xl lg:text-9xl font-mono-condensed font-black text-slate-100 text-glow-amber tracking-tight">
            {scores.right.toLocaleString()}
          </div>
          <div className="text-xs md:text-sm font-mono-condensed text-amber-400/80 tracking-widest uppercase">
            POWER SIGNAL: {rightRatio}%
          </div>
        </div>
      </div>

      {/* Center Dominant Tug-of-War Tug Line */}
      <div className="w-full max-w-6xl z-10 space-y-4">
        <div className="relative w-full h-8 md:h-12 bg-slate-950 rounded-2xl border-2 border-slate-800 p-1 overflow-hidden shadow-2xl flex items-center">
          {/* Cyan Segment */}
          <div
            className="h-full bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-300 rounded-l-xl transition-all duration-150 shadow-[0_0_20px_rgba(0,240,255,0.6)]"
            style={{ width: `${ropeMarkerPercent}%` }}
          />
          {/* Amber Segment */}
          <div
            className="h-full bg-gradient-to-l from-amber-600 via-amber-500 to-amber-300 rounded-r-xl transition-all duration-150 shadow-[0_0_20px_rgba(255,170,0,0.6)] flex-1"
          />

          {/* Central Knot / Marker Line */}
          <div
            className="absolute top-0 bottom-0 w-3 md:w-4 bg-slate-100 border border-slate-950 rounded-full shadow-[0_0_15px_#ffffff] -translate-x-1/2 transition-all duration-150 z-10"
            style={{ left: `${ropeMarkerPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs font-mono-condensed text-slate-500 tracking-wider">
          <span>LEFT FORTRESS</span>
          <span>AUTHORITATIVE ATOMIC INGESTION</span>
          <span>RIGHT FORTRESS</span>
        </div>
      </div>

      {/* Pause Overlay Mode */}
      {phase === "PAUSED" && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl z-40 flex flex-col items-center justify-center p-8 animate-fadeIn">
          <div className="p-6 rounded-full bg-amber-500/20 border-2 border-amber-500/50 text-amber-400 mb-6 shadow-[0_0_50px_rgba(245,158,11,0.5)]">
            <Pause className="w-16 h-16 animate-pulse" />
          </div>
          <h2 className="text-4xl md:text-6xl font-display text-slate-100 tracking-widest uppercase mb-2">
            Match Paused
          </h2>
          <p className="text-sm md:text-lg font-mono-condensed text-amber-400 tracking-wider">
            HOLD YOUR TAPS • WAITING FOR HOST TO RESUME
          </p>
        </div>
      )}
    </div>
  );
};
