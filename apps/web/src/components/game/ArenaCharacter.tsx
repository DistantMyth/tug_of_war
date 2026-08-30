import React from "react";

export interface ArenaCharacterProps {
  team: "left" | "right";
  state?: "idle" | "pulling" | "losing" | "won" | "lost" | "paused";
  isLastFiveSec?: boolean;
  scale?: number;
  className?: string;
}

export const ArenaCharacter: React.FC<ArenaCharacterProps> = ({
  team,
  state = "idle",
  isLastFiveSec = false,
  scale = 1,
  className = "",
}) => {
  const isLeft = team === "left";
  const accentColor = isLeft ? "var(--cyan)" : "var(--amber)";
  const glowClass = isLeft ? "drop-shadow-[0_0_12px_rgba(0,242,254,0.5)]" : "drop-shadow-[0_0_12px_rgba(255,153,0,0.5)]";

  // Compute dynamic transform based on character battle state
  let animationClass = "";
  let postureTransform = "";

  if (state === "pulling") {
    animationClass = isLeft ? "animate-heave-left" : "animate-heave-right";
  } else if (state === "losing") {
    postureTransform = isLeft ? "rotate(8deg) translateX(6px)" : "rotate(-8deg) translateX(-6px)";
  } else if (state === "won") {
    animationClass = "animate-celebrate";
  } else if (state === "lost") {
    postureTransform = "translateY(14px) scaleY(0.85)";
  } else if (state === "paused") {
    postureTransform = isLeft ? "rotate(-8deg)" : "rotate(8deg)";
  } else {
    // Idle stance
    postureTransform = isLeft ? "rotate(-6deg)" : "rotate(6deg)";
  }

  return (
    <div
      aria-label={`${team} team athlete`}
      className={`relative inline-flex flex-col items-center justify-end select-none pointer-events-none transition-transform duration-200 ${animationClass} ${className}`}
      style={{
        transform: `${postureTransform} scale(${scale})`,
        transformOrigin: "bottom center",
      }}
    >
      {/* Ground Contact Shadow */}
      <div className="absolute -bottom-2 w-20 h-4 bg-black/60 rounded-full blur-[6px]" />

      {/* SVG Vector Athlete */}
      <svg
        viewBox="0 0 100 140"
        className={`w-24 h-32 md:w-28 md:h-36 ${glowClass}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Rear Arm / Grip */}
        <path
          d={isLeft ? "M38 58 L68 76 L76 72" : "M62 58 L32 76 L24 72"}
          stroke="#090e17"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d={isLeft ? "M38 58 L68 76 L76 72" : "M62 58 L32 76 L24 72"}
          stroke={accentColor}
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Back Leg (Braced Stance) */}
        <path
          d={isLeft ? "M42 92 L22 124 L12 126" : "M58 92 L78 124 L88 126"}
          stroke="#060a12"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={isLeft ? "M42 92 L22 124 L12 126" : "M58 92 L78 124 L88 126"}
          stroke={accentColor}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="4 6"
        />

        {/* Front Leg (Forward Tension Anchor) */}
        <path
          d={isLeft ? "M56 90 L68 116 L80 128" : "M44 90 L32 116 L20 128"}
          stroke="#090e17"
          strokeWidth="13"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Foot Anchor / High-Traction Cleat */}
        <rect
          x={isLeft ? "72" : "12"}
          y="124"
          width="16"
          height="8"
          rx="3"
          fill={accentColor}
        />

        {/* Athletic Torso / Exoskeleton Suit */}
        <path
          d="M34 46 L66 46 L58 94 L42 94 Z"
          fill="#0c1422"
          stroke={accentColor}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Team Power Core Reactor */}
        <circle cx="50" cy="62" r="6" fill={accentColor} className={isLastFiveSec ? "animate-ping" : ""} />
        <path
          d="M44 74 L56 74 M46 80 L54 80"
          stroke={accentColor}
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Helmet / Visor */}
        <ellipse cx="50" cy="28" rx="14" ry="16" fill="#090e17" stroke={accentColor} strokeWidth="2.5" />
        {/* Team Visor Laser */}
        <path
          d={isLeft ? "M44 26 Q56 26 62 30" : "M56 26 Q44 26 38 30"}
          stroke={accentColor}
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* Lead Arm (Tight Dual-Hand Rope Lock) */}
        <path
          d={isLeft ? "M48 54 L78 68 L86 64" : "M52 54 L22 68 L14 64"}
          stroke="#060a12"
          strokeWidth="11"
          strokeLinecap="round"
        />
        <path
          d={isLeft ? "M48 54 L78 68 L86 64" : "M52 54 L22 68 L14 64"}
          stroke={accentColor}
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* Reinforced Gauntlet Clamps */}
        <circle cx={isLeft ? "82" : "18"} cy="66" r="6" fill="#f0f6fc" stroke="#04070d" strokeWidth="2" />
        <circle cx={isLeft ? "72" : "28"} cy="72" r="5" fill="#f0f6fc" stroke="#04070d" strokeWidth="2" />
      </svg>
    </div>
  );
};
