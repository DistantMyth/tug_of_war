import React, { useId, useMemo } from "react";
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
  const rawId = useId();
  const id = useMemo(() => rawId.replace(/[^a-zA-Z0-9_-]/g, "_"), [rawId]);

  const isRunning = phase === "RUNNING";
  const isPaused = phase === "PAUSED";
  const isFinished = phase === "FINISHED" || phase === "RESULTS";

  // Score differential and dominance physics calculation
  const total = leftScore + rightScore;
  const scoreDiff = rightScore - leftScore;
  let knotOffsetPercent = 0; // -35% (Left dominant) to +35% (Right dominant)
  let diffRatio = 0; // -1 to +1

  if (total > 0) {
    diffRatio = scoreDiff / Math.max(1, total);
    knotOffsetPercent = Math.max(-35, Math.min(35, diffRatio * 70));
  }

  const absDiffRatio = Math.abs(diffRatio);
  const leadingTeam: "left" | "right" | "tie" =
    scoreDiff < -1 ? "left" : scoreDiff > 1 ? "right" : "tie";

  // Tension physics level: 0 (slack/idle) to 1 (maximum taut stretch)
  const tensionFactor = useMemo(() => {
    if (!isRunning && !isFinished) return 0.25;
    if (isLastFiveSec) return 1.0;
    const baseTension = Math.min(1, 0.4 + absDiffRatio * 0.6 + Math.min(0.3, total / 100));
    return baseTension;
  }, [isRunning, isFinished, isLastFiveSec, absDiffRatio, total]);

  // Dynamic Sag calculation in SVG viewBox units (viewBox height is 200, neutral center is 100)
  // Low tension gives natural catenary droop (+22 units), maximum tension pulls cable taut (+2 units)
  const sag = useMemo(() => {
    if (isPaused) return 18;
    if (!isRunning && !isFinished) return 20;
    return Math.max(2, 22 * (1 - tensionFactor * 0.9));
  }, [isPaused, isRunning, isFinished, tensionFactor]);

  // Clamp Knot coordinates in SVG viewBox (0 to 1000 x, 0 to 200 y)
  // 500 is neutral center. knotOffsetPercent spans -35% to +35% -> x spans 150 to 850
  const knotX = 500 + knotOffsetPercent * 10;
  const knotY = 100 + sag * 0.6;

  // SVG Bezier Curve paths
  // Left Anchor (x: 20, y: 100) -> Knot (knotX, knotY) -> Right Anchor (x: 980, y: 100)
  const leftAnchorX = 20;
  const leftAnchorY = 100;
  const rightAnchorX = 980;
  const rightAnchorY = 100;

  // Control points for Left and Right Bezier curves with reactive tension sag
  const leftControlX = (leftAnchorX + knotX) / 2;
  const leftControlY = (leftAnchorY + knotY) / 2 + sag * 0.8;
  const rightControlX = (knotX + rightAnchorX) / 2;
  const rightControlY = (knotY + rightAnchorY) / 2 + sag * 0.8;

  const fullCablePath = `M ${leftAnchorX} ${leftAnchorY} Q ${leftControlX} ${leftControlY} ${knotX} ${knotY} Q ${rightControlX} ${rightControlY} ${rightAnchorX} ${rightAnchorY}`;

  // Derive athlete battle states
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

  // Dynamic colors based on lead
  const primaryGlowColor =
    leadingTeam === "left"
      ? "var(--cyan)"
      : leadingTeam === "right"
      ? "var(--amber)"
      : "#ffffff";

  const plasmaCoreColor =
    leadingTeam === "left"
      ? "#00f0ff"
      : leadingTeam === "right"
      ? "#ff6b00"
      : "#e2e8f0";

  const plasmaCoreGlow =
    leadingTeam === "left"
      ? "rgba(0, 240, 255, 0.8)"
      : leadingTeam === "right"
      ? "rgba(255, 107, 0, 0.8)"
      : "rgba(255, 255, 255, 0.5)";

  // Animation CSS classes for dynamic physics vibration / sway
  const cableVibrationClass = isRunning
    ? isLastFiveSec || tensionFactor > 0.85
      ? "animate-cable-hyper"
      : "animate-cable-vibrate"
    : "animate-float-slow";

  // Clamp pulse class
  const clampPulseClass = isRunning
    ? isLastFiveSec
      ? "animate-pulse scale-105"
      : "scale-100"
    : "";

  // Dynamic lightning arcs branching from knot to cable during active pulling
  const lightningArcs = useMemo(() => {
    if (!isRunning && !isLastFiveSec) return [];
    const arcs = [];
    const arcLeftOffset = 45;
    const arcRightOffset = 45;

    // Arc 1 - Left branch
    arcs.push({
      d: `M ${knotX - 10} ${knotY - 2} Q ${knotX - arcLeftOffset * 0.5} ${knotY - 14} ${knotX - arcLeftOffset} ${knotY + 2}`,
      color: "#00f0ff",
      key: "arc-l1",
    });

    // Arc 2 - Right branch
    arcs.push({
      d: `M ${knotX + 10} ${knotY + 2} Q ${knotX + arcRightOffset * 0.5} ${knotY + 14} ${knotX + arcRightOffset} ${knotY - 2}`,
      color: "#ff6b00",
      key: "arc-r1",
    });

    // Arc 3 - High tension center spark
    if (isLastFiveSec || tensionFactor > 0.75) {
      arcs.push({
        d: `M ${knotX - 18} ${knotY + 6} L ${knotX} ${knotY - 18} L ${knotX + 18} ${knotY + 6}`,
        color: "#ffffff",
        key: "arc-c1",
      });
    }

    return arcs;
  }, [isRunning, isLastFiveSec, knotX, knotY, tensionFactor]);

  // Spark particle seeds
  const sparkParticles = useMemo(() => {
    if (!isRunning) return [];
    return [
      { cx: knotX - 22, cy: knotY - 12, r: 2.2, color: "#00f0ff", delay: "0s" },
      { cx: knotX + 24, cy: knotY - 10, r: 2.0, color: "#ff6b00", delay: "0.15s" },
      { cx: knotX - 14, cy: knotY + 16, r: 1.8, color: "#ffffff", delay: "0.3s" },
      { cx: knotX + 18, cy: knotY + 14, r: 2.4, color: "#ffd700", delay: "0.45s" },
    ];
  }, [isRunning, knotX, knotY]);

  // Accessible descriptive status for screen readers
  const accessibleStatus = `Tug of war arena. Team Cyan: ${leftScore}, Team Amber: ${rightScore}. ${
    leadingTeam === "tie"
      ? "Teams are dead even."
      : `Team ${leadingTeam === "left" ? "Cyan" : "Amber"} is leading.`
  } Rope tension is ${
    tensionFactor > 0.8 ? "hyper maximum taut" : tensionFactor > 0.5 ? "high" : "moderate"
  }. Center clamp is at ${Math.round(knotOffsetPercent)}% displacement.`;

  return (
    <div
      role="region"
      data-testid="rope-arena"
      aria-label={accessibleStatus}
      className={`relative w-full flex flex-col items-center justify-center select-none overflow-visible ${className}`}
    >
      {/* ===================================================================== */}
      {/* 1. STADIUM GROUND TENSION TRACK & REACTIVE FLOOR LIGHTING */}
      {/* ===================================================================== */}
      <div className="w-full max-w-5xl px-4 md:px-12 relative flex flex-col items-center pointer-events-none mb-1">
        {/* Floor Spotlights */}
        <div className="absolute -bottom-8 inset-x-8 h-16 flex justify-between items-center opacity-60">
          {/* Left Cyan Spotlight */}
          <div
            className="w-44 h-14 rounded-full bg-[var(--cyan)]/25 blur-xl transition-all duration-300"
            style={{
              opacity: leadingTeam === "left" ? 0.9 : 0.35,
              transform: `scale(${leadingTeam === "left" ? 1.25 : 0.9})`,
            }}
          />
          {/* Dynamic Knot Floor Spotlight (Tracks Clamp) */}
          <div
            className="w-32 h-10 rounded-full blur-lg transition-all duration-150"
            style={{
              backgroundColor: plasmaCoreGlow,
              transform: `translateX(${knotOffsetPercent * 3.5}px)`,
              opacity: isRunning ? 0.85 : 0.4,
            }}
          />
          {/* Right Amber Spotlight */}
          <div
            className="w-44 h-14 rounded-full bg-[var(--amber)]/25 blur-xl transition-all duration-300"
            style={{
              opacity: leadingTeam === "right" ? 0.9 : 0.35,
              transform: `scale(${leadingTeam === "right" ? 1.25 : 0.9})`,
            }}
          />
        </div>

        {/* Stadium Floor Tension Runner Strip */}
        <div className="relative w-full h-2 rounded-full bg-[#060a14] border border-[var(--line-bright)] overflow-hidden shadow-[inset_0_1px_4px_rgba(0,0,0,0.9)] flex items-center">
          {/* Left Cyan Sector Energy Fill */}
          <div
            className="h-full bg-gradient-to-r from-[var(--cyan)] via-cyan-400 to-transparent transition-all duration-150"
            style={{ width: `${Math.max(10, 50 - knotOffsetPercent)}%` }}
          />
          {/* Right Amber Sector Energy Fill */}
          <div
            className="h-full ml-auto bg-gradient-to-l from-[var(--amber)] via-amber-400 to-transparent transition-all duration-150"
            style={{ width: `${Math.max(10, 50 + knotOffsetPercent)}%` }}
          />

          {/* Central Ground Zero Point Marker */}
          <div className="absolute left-1/2 -translate-x-1/2 w-2 h-full bg-white shadow-[0_0_8px_#ffffff] z-10" />

          {/* Dynamic Knot Ground Laser Dot */}
          <div
            className="absolute top-0 bottom-0 w-2.5 rounded-full transition-all duration-150 z-20 shadow-[0_0_12px_#fff]"
            style={{
              left: `calc(50% + ${knotOffsetPercent}%)`,
              transform: "translateX(-50%)",
              backgroundColor: primaryGlowColor,
            }}
          />
        </div>

        {/* Tension Measurement Tick Marks */}
        <div className="w-full flex justify-between items-center text-[9px] md:text-[10px] font-mono-condensed text-slate-500 tracking-wider pt-1 px-2">
          <span className={knotOffsetPercent <= -25 ? "text-[var(--cyan)] font-bold drop-shadow-[0_0_4px_var(--cyan)]" : ""}>
            -30%
          </span>
          <span className="hidden sm:inline">-20%</span>
          <span className="hidden sm:inline">-10%</span>
          <span className="text-slate-300 font-bold tracking-widest flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-white animate-ping" />
            CENTER
          </span>
          <span className="hidden sm:inline">+10%</span>
          <span className="hidden sm:inline">+20%</span>
          <span className={knotOffsetPercent >= 25 ? "text-[var(--amber)] font-bold drop-shadow-[0_0_4px_var(--amber)]" : ""}>
            +30%
          </span>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. ATHLETES & SVG DYNAMIC CABLE ARENA */}
      {/* ===================================================================== */}
      <div
        className={`w-full ${
          isProjector ? "max-w-6xl" : "max-w-3xl"
        } flex items-center justify-between px-1 md:px-6 relative min-h-[140px] md:min-h-[160px]`}
      >
        {/* Left Team Athlete (CYAN) */}
        <ArenaCharacter
          team="left"
          state={leftAthleteState}
          isLastFiveSec={isLastFiveSec}
          scale={isProjector ? 1.35 : 1}
          className="z-20 relative flex-none"
        />

        {/* Dynamic Center SVG Arena Canvas (Rope & Titanium Clamp) */}
        <div className="relative flex-1 mx-[-18px] md:mx-[-28px] h-32 md:h-36 flex items-center justify-center z-10 overflow-visible">
          <svg
            viewBox="0 0 1000 200"
            className={`w-full h-full overflow-visible transition-transform duration-100 ${cableVibrationClass}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              {/* Diffuse Atmospheric Tension Glow Filter */}
              <filter id={`tensionGlow-${id}`} x="-20%" y="-40%" width="140%" height="180%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

              {/* Hyper Sharp Core Glow Filter */}
              <filter id={`coreLaserGlow-${id}`} x="-30%" y="-50%" width="160%" height="200%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Steel Braid Pattern Simulation */}
              <pattern
                id={`steelBraid-${id}`}
                width="16"
                height="16"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(35)"
              >
                <line x1="0" y1="0" x2="0" y2="16" stroke="#475569" strokeWidth="3" />
                <line x1="8" y1="0" x2="8" y2="16" stroke="#1e293b" strokeWidth="3" />
                <line x1="4" y1="0" x2="4" y2="16" stroke="#94a3b8" strokeWidth="1.5" strokeOpacity="0.8" />
              </pattern>

              {/* Metallic Titanium Cable Gradient */}
              <linearGradient id={`cableMetallic-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94a3b8" />
                <stop offset="35%" stopColor="#475569" />
                <stop offset="70%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>

              {/* Dynamic Neon Plasma Core Gradient */}
              <linearGradient id={`plasmaGradient-${id}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.95" />
                <stop
                  offset="50%"
                  stopColor={leadingTeam === "left" ? "#00f0ff" : leadingTeam === "right" ? "#ff6b00" : "#ffffff"}
                  stopOpacity="1"
                />
                <stop offset="100%" stopColor="#ff6b00" stopOpacity="0.95" />
              </linearGradient>

              {/* Clamp Titanium Bevel Gradient */}
              <linearGradient id={`clampTitanium-${id}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#64748b" />
                <stop offset="50%" stopColor="#334155" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>

              {/* Reactor Core Glow Gradient */}
              <radialGradient id={`reactorGlow-${id}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                <stop offset="40%" stopColor={plasmaCoreColor} stopOpacity="0.9" />
                <stop offset="80%" stopColor={plasmaCoreColor} stopOpacity="0.3" />
                <stop offset="100%" stopColor={plasmaCoreColor} stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* ------------------------------------------------------------- */}
            {/* CABLE LAYER 1: ATMOSPHERIC AMBIENT TENSION GLOW               */}
            {/* ------------------------------------------------------------- */}
            <path
              d={fullCablePath}
              fill="none"
              stroke={primaryGlowColor}
              strokeWidth="24"
              strokeLinecap="round"
              filter={`url(#tensionGlow-${id})`}
              opacity={isRunning ? (isLastFiveSec ? 0.8 : 0.45) : 0.25}
              className="transition-colors duration-300"
            />

            {/* ------------------------------------------------------------- */}
            {/* CABLE LAYER 2: HEAVY STEEL-BRAIDED SLEEVE                     */}
            {/* ------------------------------------------------------------- */}
            {/* Base Dark Structural Core */}
            <path
              d={fullCablePath}
              fill="none"
              stroke="#070c16"
              strokeWidth="14"
              strokeLinecap="round"
            />
            {/* Metallic Gradient Outer Cable */}
            <path
              d={fullCablePath}
              fill="none"
              stroke={`url(#cableMetallic-${id})`}
              strokeWidth="11"
              strokeLinecap="round"
            />
            {/* Steel Braid Hatch Weave Texture */}
            <path
              d={fullCablePath}
              fill="none"
              stroke={`url(#steelBraid-${id})`}
              strokeWidth="10"
              strokeLinecap="round"
              opacity="0.75"
            />

            {/* ------------------------------------------------------------- */}
            {/* CABLE LAYER 3: DYNAMIC NEON PLASMA ENERGY CORE                */}
            {/* ------------------------------------------------------------- */}
            {/* Traveling Plasma Energy Wave */}
            <path
              d={fullCablePath}
              fill="none"
              stroke={`url(#plasmaGradient-${id})`}
              strokeWidth={isRunning ? 5 : 3.5}
              strokeLinecap="round"
              strokeDasharray={isRunning ? "24 16" : "none"}
              className={isRunning ? "animate-pulse" : ""}
              filter={`url(#coreLaserGlow-${id})`}
              opacity={isRunning ? 0.95 : 0.6}
            />

            {/* Ultra-Intense Hyper-White Laser Centerline */}
            <path
              d={fullCablePath}
              fill="none"
              stroke="#ffffff"
              strokeWidth={isLastFiveSec ? 2.5 : 1.8}
              strokeLinecap="round"
              opacity={isRunning ? 0.9 : 0.5}
            />

            {/* ------------------------------------------------------------- */}
            {/* ELECTRIC LIGHTNING ARCS & SPARK PARTICLES                     */}
            {/* ------------------------------------------------------------- */}
            {lightningArcs.map((arc) => (
              <path
                key={arc.key}
                d={arc.d}
                fill="none"
                stroke={arc.color}
                strokeWidth="1.8"
                strokeLinecap="round"
                filter={`url(#coreLaserGlow-${id})`}
                className="animate-spark-flash"
              />
            ))}

            {sparkParticles.map((spark, idx) => (
              <circle
                key={`spark-${idx}`}
                cx={spark.cx}
                cy={spark.cy}
                r={spark.r}
                fill={spark.color}
                filter={`url(#coreLaserGlow-${id})`}
                className="animate-ping"
                style={{ animationDuration: "0.8s", animationDelay: spark.delay }}
              />
            ))}

            {/* ------------------------------------------------------------- */}
            {/* CENTER TENSION KNOT & TITANIUM CLAMP ASSEMBLY                 */}
            {/* ------------------------------------------------------------- */}
            <g
              transform={`translate(${knotX}, ${knotY})`}
              className={`transition-transform duration-100 ease-out ${clampPulseClass}`}
            >
              {/* --- Laser Alignment Flags & Vertical Tracking Beams --- */}
              {/* Upper Vertical Alignment Laser Beam */}
              <line
                x1="0"
                y1="-8"
                x2="0"
                y2="-46"
                stroke={primaryGlowColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                filter={`url(#coreLaserGlow-${id})`}
                className="animate-pulse"
              />
              <circle cx="0" cy="-46" r="3" fill="#ffffff" stroke={primaryGlowColor} strokeWidth="1.5" />

              {/* Lower Vertical Alignment Laser Beam */}
              <line
                x1="0"
                y1="8"
                x2="0"
                y2="46"
                stroke={primaryGlowColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                filter={`url(#coreLaserGlow-${id})`}
                className="animate-pulse"
              />
              <circle cx="0" cy="46" r="3" fill="#ffffff" stroke={primaryGlowColor} strokeWidth="1.5" />

              {/* --- Heavy Multi-Layer Titanium Clamp Housing --- */}
              {/* Outer Clamp Drop Shadow */}
              <rect
                x="-20"
                y="-20"
                width="40"
                height="40"
                rx="8"
                transform="rotate(45)"
                fill="#020617"
                opacity="0.8"
              />

              {/* Main Titanium Machined Body */}
              <rect
                x="-17"
                y="-17"
                width="34"
                height="34"
                rx="6"
                transform="rotate(45)"
                fill={`url(#clampTitanium-${id})`}
                stroke={primaryGlowColor}
                strokeWidth="2"
                className="transition-colors duration-200"
              />

              {/* Internal Carbon Compression Bracket */}
              <rect
                x="-12"
                y="-12"
                width="24"
                height="24"
                rx="4"
                transform="rotate(45)"
                fill="#090d16"
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="1"
              />

              {/* Four Corner Hex Fastener Bolts */}
              <circle cx="-13" cy="0" r="1.8" fill="#e2e8f0" stroke="#1e293b" strokeWidth="0.6" />
              <circle cx="13" cy="0" r="1.8" fill="#e2e8f0" stroke="#1e293b" strokeWidth="0.6" />
              <circle cx="0" cy="-13" r="1.8" fill="#e2e8f0" stroke="#1e293b" strokeWidth="0.6" />
              <circle cx="0" cy="13" r="1.8" fill="#e2e8f0" stroke="#1e293b" strokeWidth="0.6" />

              {/* --- Central Glowing Plasma Reactor Core --- */}
              <circle
                cx="0"
                cy="0"
                r="11"
                fill={`url(#reactorGlow-${id})`}
                className={isRunning ? "animate-pulse" : ""}
              />
              <circle
                cx="0"
                cy="0"
                r="5.5"
                fill="#ffffff"
                filter={`url(#coreLaserGlow-${id})`}
              />
              <circle
                cx="0"
                cy="0"
                r="2.5"
                fill={plasmaCoreColor}
              />

              {/* Directional Pull Indicator Chevrons */}
              {leadingTeam === "left" && (
                <path
                  d="M -26 0 L -21 -5 L -21 5 Z"
                  fill="var(--cyan)"
                  filter={`url(#coreLaserGlow-${id})`}
                  className="animate-pulse"
                />
              )}
              {leadingTeam === "right" && (
                <path
                  d="M 26 0 L 21 -5 L 21 5 Z"
                  fill="var(--amber)"
                  filter={`url(#coreLaserGlow-${id})`}
                  className="animate-pulse"
                />
              )}
            </g>
          </svg>
        </div>

        {/* Right Team Athlete (AMBER) */}
        <ArenaCharacter
          team="right"
          state={rightAthleteState}
          isLastFiveSec={isLastFiveSec}
          scale={isProjector ? 1.35 : 1}
          className="z-20 relative flex-none"
        />
      </div>
    </div>
  );
};

