import React from "react";
import { ArenaCharacter } from "./ArenaCharacter.js";

export interface RopeArenaProps {
  leftScore: number;
  rightScore: number;
  phase: string;
  isLastFiveSec?: boolean;
  userTeam?: "left" | "right" | "chaos" | null;
  winner?: "left" | "right" | "draw" | null;
  className?: string;
  isProjector?: boolean;
}

export const RopeArena: React.FC<RopeArenaProps> = ({
  leftScore,
  rightScore,
  phase,
  isLastFiveSec = false,
  userTeam: _userTeam = null,
  winner = null,
  className = "",
  isProjector = false,
}) => {
  const isRunning = phase === "RUNNING";
  const isPaused = phase === "PAUSED";
  const isFinished = phase === "FINISHED" || phase === "RESULTS";

  // Calculate visual knot offset (-35% to +35%) based on score differential
  const total = leftScore + rightScore;
  let knotOffsetPercent = 0;
  if (total > 0) {
    const diffRatio = (rightScore - leftScore) / Math.max(1, total);
    // Scale to max +/- 35% displacement
    knotOffsetPercent = Math.max(-35, Math.min(35, diffRatio * 70));
  }

  // Derive athlete states
  let leftAthleteState: "idle" | "pulling" | "losing" | "won" | "lost" | "paused" = "idle";
  let rightAthleteState: "idle" | "pulling" | "losing" | "won" | "lost" | "paused" = "idle";

  if (isFinished) {
    if (winner === "left") {
      leftAthleteState = "won";
      rightAthleteState = "lost";
    } else if (winner === "right") {
      leftAthleteState = "lost";
      rightAthleteState = "won";
    } else {
      leftAthleteState = "idle";
      rightAthleteState = "idle";
    }
  } else if (isPaused) {
    leftAthleteState = "paused";
    rightAthleteState = "paused";
  } else if (isRunning) {
    if (leftScore > rightScore + 5) {
      leftAthleteState = "pulling";
      rightAthleteState = "losing";
    } else if (rightScore > leftScore + 5) {
      leftAthleteState = "losing";
      rightAthleteState = "pulling";
    } else {
      leftAthleteState = "pulling";
      rightAthleteState = "pulling";
    }
  }

  const cableAnimationClass = isRunning
    ? isLastFiveSec
      ? "animate-cable-hyper"
      : "animate-cable-vibrate"
    : "";

  return (
    <div className={`relative w-full flex items-center justify-center select-none ${className}`}>
      {/* Stadium Floor Track / Lighting Strip */}
      <div className="absolute bottom-1 left-2 right-2 h-1.5 bg-gradient-to-r from-[var(--cyan)]/20 via-white/15 to-[var(--amber)]/20 rounded-full blur-[1px]" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-3 bg-white/30 rounded-full blur-[2px]" />

      <div className="w-full max-w-2xl flex items-center justify-between px-2 md:px-6 relative">
        {/* Left Team Athlete (CYAN) */}
        <ArenaCharacter
          team="left"
          state={leftAthleteState}
          isLastFiveSec={isLastFiveSec}
          scale={isProjector ? 1.4 : 1}
          className="z-10"
        />

        {/* Heavy Braided Stadium Cable & Tension Marker */}
        <div className="relative flex-1 mx-[-12px] md:mx-[-18px] h-16 flex items-center z-0">
          {/* Cable Outer Tension Glow */}
          <div
            className={`absolute inset-x-0 h-4 rounded-full blur-[6px] transition-colors ${
              leftScore > rightScore
                ? "bg-[var(--cyan)]/25"
                : rightScore > leftScore
                ? "bg-[var(--amber)]/25"
                : "bg-white/10"
            }`}
          />

          {/* Heavy Steel-Braided Cable */}
          <div
            className={`w-full h-3.5 md:h-4.5 rounded-full bg-gradient-to-b from-[#8a6840] via-[#5c3e1e] to-[#2e1d0c] border border-[#d49a53]/60 shadow-[0_2px_10px_rgba(0,0,0,0.8)] relative overflow-hidden ${cableAnimationClass}`}
          >
            {/* Cable Braid Texture Lines */}
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, rgba(255,255,255,0.4) 0px, rgba(255,255,255,0.4) 3px, transparent 3px, transparent 8px)",
              }}
            />
          </div>

          {/* Center Steel Tension Clamp & Knot Marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 transition-all duration-150 ease-out z-20 flex flex-col items-center"
            style={{
              left: `calc(50% + ${knotOffsetPercent}%)`,
              transform: "translate(-50%, -50%)",
            }}
          >
            {/* Laser Tension Indicator Flag */}
            <div
              className={`w-1 h-3 rounded-full mb-0.5 ${
                leftScore > rightScore
                  ? "bg-[var(--cyan)] shadow-[0_0_10px_var(--cyan)]"
                  : rightScore > leftScore
                  ? "bg-[var(--amber)] shadow-[0_0_10px_var(--amber)]"
                  : "bg-white shadow-[0_0_10px_#fff]"
              }`}
            />

            {/* Heavy Center Steel Knot Box */}
            <div
              className={`w-7 h-7 md:w-9 md:h-9 rounded-lg border-2 flex items-center justify-center rotate-45 transition-colors ${
                leftScore > rightScore
                  ? "bg-[#061e24] border-[var(--cyan)] shadow-[0_0_20px_var(--cyan)]"
                  : rightScore > leftScore
                  ? "bg-[#241306] border-[var(--amber)] shadow-[0_0_20px_var(--amber)]"
                  : "bg-[#090e17] border-white/80 shadow-[0_0_15px_rgba(255,255,255,0.4)]"
              }`}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-white/90" />
            </div>

            {/* Tension Indicator Dot */}
            <div className="w-1 h-1.5 bg-white/60 rounded-full mt-0.5" />
          </div>
        </div>

        {/* Right Team Athlete (AMBER) */}
        <ArenaCharacter
          team="right"
          state={rightAthleteState}
          isLastFiveSec={isLastFiveSec}
          scale={isProjector ? 1.4 : 1}
          className="z-10"
        />
      </div>
    </div>
  );
};
