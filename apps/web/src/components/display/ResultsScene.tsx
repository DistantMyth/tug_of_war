import React, { useEffect } from "react";
import confetti from "canvas-confetti";
import { Award, RotateCcw, Trophy } from "lucide-react";
import { useGameStore } from "../../store/useGameStore.js";

export const ResultsScene: React.FC = () => {
  const { scores, winner, roundNumber, counts } = useGameStore();

  useEffect(() => {
    // Fire celebratory confetti for the orientation crowd
    try {
      confetti({
        particleCount: 140,
        spread: 100,
        origin: { y: 0.55 },
        colors: winner === "left" ? ["#00f2fe", "#ffffff", "#0ea5e9"] : ["#ff9900", "#ffffff", "#f59e0b"],
      });
    } catch {}
  }, [winner]);

  const isLeftWinner = winner === "left";
  const isRightWinner = winner === "right";
  const isDraw = winner === "draw" || !winner;

  const scoreDiff = Math.abs(scores.left - scores.right);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-8 md:p-14 overflow-hidden bg-arena-broadcast select-none">
      {/* Background Winner Lights */}
      <div
        className={`absolute inset-0 pointer-events-none ${
          isLeftWinner
            ? "bg-[var(--cyan)]/10"
            : isRightWinner
            ? "bg-[var(--amber)]/10"
            : "bg-[var(--violet)]/10"
        }`}
      />

      {/* Top Banner */}
      <header className="text-center z-10 space-y-2">
        <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full border border-[var(--line-bright)] bg-[var(--stage-card)] text-xs font-mono-condensed uppercase tracking-widest text-slate-200">
          <Award className="w-4 h-4 text-amber-400" />
          ROUND {roundNumber} CONCLUDED
        </div>
        <h1 className="text-6xl md:text-8xl font-display uppercase tracking-wider text-white drop-shadow-lg">
          {isDraw ? "HONORABLE DRAW!" : "VICTORY ACHIEVED!"}
        </h1>
      </header>

      {/* Winner Spotlight Card */}
      <div className="w-full max-w-5xl z-10 my-auto bg-[var(--stage-card)]/90 border-2 border-[var(--line-bright)] rounded-3xl p-8 md:p-14 backdrop-blur-2xl text-center space-y-8 shadow-2xl">
        {/* Crown & Winner Announcement */}
        <div className="flex flex-col items-center">
          <div
            className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-4 ${
              isLeftWinner
                ? "bg-cyan-500/20 text-[var(--cyan)] border-2 border-[var(--cyan)] box-glow-cyan"
                : isRightWinner
                ? "bg-amber-500/20 text-[var(--amber)] border-2 border-[var(--amber)] box-glow-amber"
                : "bg-purple-500/20 text-[var(--violet)] border-2 border-[var(--violet)] box-glow-violet"
            }`}
          >
            <Trophy className="w-12 h-12" />
          </div>

          <div
            className={`text-6xl md:text-8xl font-display uppercase tracking-widest leading-none ${
              isLeftWinner
                ? "text-[var(--cyan)] text-glow-cyan"
                : isRightWinner
                ? "text-[var(--amber)] text-glow-amber"
                : "text-[var(--violet)] text-glow-gold"
            }`}
          >
            {isLeftWinner ? "TEAM CYAN WINS!" : isRightWinner ? "TEAM AMBER WINS!" : "IT'S A DEADLOCK DRAW!"}
          </div>

          {!isDraw && (
            <div className="text-base font-mono-condensed text-slate-300 mt-3 uppercase tracking-widest font-bold">
              VICTORY MARGIN: +{scoreDiff.toLocaleString()} TAPS
            </div>
          )}
        </div>

        {/* Final Score Duel Box */}
        <div className="grid grid-cols-2 gap-8 p-6 md:p-8 rounded-2xl bg-[var(--stage-surface)] border border-[var(--line)]">
          <div className="text-center border-r border-[var(--line)]">
            <span className="text-xs font-mono-condensed text-[var(--cyan)] uppercase tracking-widest font-bold">
              TEAM CYAN
            </span>
            <div className="text-5xl md:text-7xl font-mono-condensed font-black text-white mt-2 leading-none">
              {scores.left.toLocaleString()}
            </div>
            <span className="text-xs text-slate-400 font-mono-condensed mt-2 block tracking-wider">
              {counts.left} WARRIORS
            </span>
          </div>

          <div className="text-center">
            <span className="text-xs font-mono-condensed text-[var(--amber)] uppercase tracking-widest font-bold">
              TEAM AMBER
            </span>
            <div className="text-5xl md:text-7xl font-mono-condensed font-black text-white mt-2 leading-none">
              {scores.right.toLocaleString()}
            </div>
            <span className="text-xs text-slate-400 font-mono-condensed mt-2 block tracking-wider">
              {counts.right} WARRIORS
            </span>
          </div>
        </div>
      </div>

      {/* Footer / Next Match Hint */}
      <footer className="flex items-center gap-2 text-sm font-mono-condensed text-slate-300 z-10 animate-pulse">
        <RotateCcw className="w-4 h-4 text-[var(--cyan)]" />
        STAND BY FOR NEXT ROUND OR REMATCH • HOST WILL TRIGGER LAUNCH
      </footer>
    </div>
  );
};
