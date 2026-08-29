import { useEffect } from "react";
import confetti from "canvas-confetti";
import { Award, RotateCcw, Trophy } from "lucide-react";
import { useGameStore } from "../../store/useGameStore.js";

export const ResultsScene: React.FC = () => {
  const { scores, winner, roundNumber, counts } = useGameStore();

  useEffect(() => {
    // Fire celebratory confetti for the orientation crowd
    try {
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.6 },
        colors: winner === "left" ? ["#00f0ff", "#ffffff", "#0ea5e9"] : ["#ffaa00", "#ffffff", "#f59e0b"],
      });
    } catch {}
  }, [winner]);

  const isLeftWinner = winner === "left";
  const isRightWinner = winner === "right";
  const isDraw = winner === "draw" || !winner;

  const scoreDiff = Math.abs(scores.left - scores.right);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-8 md:p-12 overflow-hidden bg-cyber-grid">
      {/* Background Winner Lights */}
      <div
        className={`absolute inset-0 pointer-events-none ${
          isLeftWinner
            ? "bg-cyan-500/10"
            : isRightWinner
              ? "bg-amber-500/10"
              : "bg-purple-500/10"
        }`}
      />

      {/* Top Banner */}
      <div className="text-center z-10 space-y-2">
        <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full border border-slate-700 bg-slate-900 text-xs font-mono-condensed uppercase tracking-widest text-slate-300">
          <Award className="w-4 h-4 text-amber-400" />
          Round {roundNumber} Concluded
        </div>
        <h1 className="text-5xl md:text-7xl font-display uppercase tracking-wider text-slate-100 drop-shadow-lg">
          {isDraw ? "HONORABLE DRAW!" : "VICTORY ACHIEVED!"}
        </h1>
      </div>

      {/* Winner Spotlight Card */}
      <div className="w-full max-w-4xl z-10 my-auto bg-slate-950/90 border border-slate-800 rounded-3xl p-8 md:p-12 backdrop-blur-2xl text-center space-y-8 shadow-2xl">
        {/* Crown & Winner Announcement */}
        <div className="flex flex-col items-center">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
              isLeftWinner
                ? "bg-cyan-500/20 text-cyan-400 box-glow-cyan"
                : isRightWinner
                  ? "bg-amber-500/20 text-amber-400 box-glow-amber"
                  : "bg-purple-500/20 text-purple-400 box-glow-violet"
            }`}
          >
            <Trophy className="w-10 h-10" />
          </div>

          <div
            className={`text-5xl md:text-7xl font-display uppercase tracking-widest ${
              isLeftWinner
                ? "text-cyan-400 text-glow-cyan"
                : isRightWinner
                  ? "text-amber-400 text-glow-amber"
                  : "text-purple-400 text-glow-violet"
            }`}
          >
            {isLeftWinner ? "TEAM CYAN WINS!" : isRightWinner ? "TEAM AMBER WINS!" : "IT'S A DEADLOCK DRAW!"}
          </div>

          {!isDraw && (
            <div className="text-sm font-mono-condensed text-slate-400 mt-2 uppercase tracking-wider">
              VICTORY MARGIN: +{scoreDiff.toLocaleString()} TAPS
            </div>
          )}
        </div>

        {/* Final Score Duel Box */}
        <div className="grid grid-cols-2 gap-8 p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className={`text-center ${isLeftWinner ? "border-r border-slate-800" : ""}`}>
            <div className="text-xs font-mono-condensed text-cyan-400 uppercase tracking-widest">TEAM CYAN</div>
            <div className="text-4xl md:text-6xl font-mono-condensed font-black text-slate-100 mt-2">
              {scores.left.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 font-mono-condensed mt-1">{counts.left} CONTENDERS</div>
          </div>

          <div className="text-center">
            <div className="text-xs font-mono-condensed text-amber-400 uppercase tracking-widest">TEAM AMBER</div>
            <div className="text-4xl md:text-6xl font-mono-condensed font-black text-slate-100 mt-2">
              {scores.right.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 font-mono-condensed mt-1">{counts.right} CONTENDERS</div>
          </div>
        </div>
      </div>

      {/* Footer / Next Match Hint */}
      <div className="flex items-center gap-2 text-sm font-mono-condensed text-slate-400 z-10 animate-pulse">
        <RotateCcw className="w-4 h-4 text-cyan-400" />
        STAND BY FOR NEXT ROUND OR REMATCH • DO NOT LEAVE THE BATTLE
      </div>
    </div>
  );
};
