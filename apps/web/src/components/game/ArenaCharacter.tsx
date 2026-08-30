import React, { useId } from "react";

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
  const uid = useId().replace(/:/g, "_");
  const isLeft = team === "left";
  const athleteTitle = isLeft ? "Cyber Titan athlete" : "Solar Phoenix athlete";

  // Team Accent Colors
  const accentColor = isLeft ? "var(--cyan, #00f0ff)" : "var(--amber, #ff6b00)";
  const secondaryAccent = isLeft ? "#38bdf8" : "#ffd700";
  const coreColor = isLeft ? "#00f0ff" : "#ff7700";
  const glowClass = isLeft
    ? "drop-shadow-[0_0_16px_rgba(0,240,255,0.6)]"
    : "drop-shadow-[0_0_16px_rgba(255,107,0,0.6)]";

  // Posture transformations for state handling
  let postureTransform = "";
  let animationClass = "";

  if (state === "pulling") {
    animationClass = isLeft ? "animate-char-heave-left" : "animate-char-heave-right";
  } else if (state === "losing") {
    postureTransform = isLeft ? "rotate(9deg) translateX(7px)" : "rotate(-9deg) translateX(-7px)";
    animationClass = "animate-char-tremor";
  } else if (state === "won") {
    animationClass = "animate-char-celebrate";
  } else if (state === "lost") {
    postureTransform = "translateY(14px) scaleY(0.88)";
  } else if (state === "paused") {
    postureTransform = isLeft ? "rotate(-7deg)" : "rotate(7deg)";
  } else {
    // Idle ready stance with subtle rhythmic breath
    postureTransform = isLeft ? "rotate(-6deg)" : "rotate(6deg)";
    animationClass = "animate-char-breathe";
  }

  return (
    <div
      role="img"
      aria-label={athleteTitle}
      className={`relative inline-flex flex-col items-center justify-end select-none pointer-events-none transition-transform duration-300 ${animationClass} ${className}`}
      style={{
        transform: `${postureTransform} scale(${scale})`,
        transformOrigin: "bottom center",
      }}
    >
      {/* Dynamic Ground Contact Shadow & Laser Grip Track */}
      <div
        className={`absolute -bottom-2 w-28 h-4 rounded-full blur-[7px] transition-all duration-300 ${
          state === "won"
            ? isLeft
              ? "bg-[var(--cyan)]/30 w-32"
              : "bg-[var(--amber)]/30 w-32"
            : state === "lost"
            ? "bg-black/80 w-24 h-5"
            : isLastFiveSec
            ? isLeft
              ? "bg-[var(--cyan)]/40 w-32 animate-pulse"
              : "bg-[var(--amber)]/40 w-32 animate-pulse"
            : "bg-black/60"
        }`}
      />

      {/* SVG Vector Athlete Rig */}
      <svg
        viewBox="0 0 130 150"
        className={`w-28 h-36 md:w-36 md:h-44 ${glowClass} overflow-visible`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Embedded Styles for Self-Contained Keyframes & High-Performance GPU Transitions */}
          <style>{`
            @keyframes charHeaveLeft {
              0%, 100% { transform: translate(0px, 0px) rotate(-14deg); }
              50% { transform: translate(-8px, 1px) rotate(-22deg); }
            }
            @keyframes charHeaveRight {
              0%, 100% { transform: translate(0px, 0px) rotate(14deg); }
              50% { transform: translate(8px, 1px) rotate(22deg); }
            }
            @keyframes charTremor {
              0%, 100% { transform: translate(0, 0); }
              20% { transform: translate(-1.5px, 0.8px); }
              40% { transform: translate(1.5px, -0.8px); }
              60% { transform: translate(-1px, -0.5px); }
              80% { transform: translate(1px, 0.5px); }
            }
            @keyframes charBreathe {
              0%, 100% { transform: translateY(0px) scale(1); }
              50% { transform: translateY(-2.5px) scale(1.015); }
            }
            @keyframes charCelebrate {
              0%, 100% { transform: translateY(0) scale(1); }
              50% { transform: translateY(-16px) scale(1.08); }
            }
            @keyframes coreSurge {
              0%, 100% { r: 5.5px; opacity: 0.85; }
              50% { r: 7.5px; opacity: 1; filter: drop-shadow(0 0 8px ${accentColor}); }
            }
            @keyframes coreOverdrive {
              0%, 100% { r: 6px; opacity: 0.9; }
              50% { r: 9px; opacity: 1; filter: drop-shadow(0 0 14px ${accentColor}); }
            }
            @keyframes coreFlicker {
              0%, 100% { opacity: 0.9; }
              25% { opacity: 0.2; }
              50% { opacity: 0.8; }
              75% { opacity: 0.1; }
            }
            @keyframes laserStreak {
              0%, 100% { transform: translateX(0); opacity: 0.85; }
              50% { transform: translateX(${isLeft ? "2.5px" : "-2.5px"}); opacity: 1; }
            }
            @keyframes flamePlume {
              0%, 100% { transform: rotate(0deg) skewX(0deg); }
              50% { transform: rotate(${isLeft ? "-3deg" : "3deg"}) skewX(${isLeft ? "-2deg" : "2deg"}); }
            }
            @keyframes sparkFlyA {
              0% { transform: translate(0, 0) scale(0.2); opacity: 0; }
              30% { opacity: 1; }
              100% { transform: translate(${isLeft ? "-26px, -18px" : "26px, -18px"}) scale(1.2); opacity: 0; }
            }
            @keyframes sparkFlyB {
              0% { transform: translate(0, 0) scale(0.2); opacity: 0; }
              30% { opacity: 1; }
              100% { transform: translate(${isLeft ? "-34px, -10px" : "34px, -10px"}) scale(1); opacity: 0; }
            }
            @keyframes sparkFlyC {
              0% { transform: translate(0, 0) scale(0.2); opacity: 0; }
              30% { opacity: 1; }
              100% { transform: translate(${isLeft ? "-20px, -26px" : "20px, -26px"}) scale(0.8); opacity: 0; }
            }
            @keyframes sweatDropFlow {
              0% { transform: translate(0, 0) scale(0.5); opacity: 0; }
              30% { opacity: 0.9; }
              100% { transform: translate(${isLeft ? "-12px, 24px" : "12px, 24px"}) scale(1); opacity: 0; }
            }
            @keyframes frictionPuff {
              0% { transform: scale(0.4); opacity: 0.8; }
              100% { transform: scale(1.6); opacity: 0; }
            }
            @keyframes victoryRays {
              0% { transform: rotate(0deg); opacity: 0.4; }
              50% { opacity: 0.9; }
              100% { transform: rotate(360deg); opacity: 0.4; }
            }

            .animate-char-heave-left { animation: charHeaveLeft 0.38s ease-in-out infinite; }
            .animate-char-heave-right { animation: charHeaveRight 0.38s ease-in-out infinite; }
            .animate-char-tremor { animation: charTremor 0.08s linear infinite; }
            .animate-char-breathe { animation: charBreathe 2.8s ease-in-out infinite; }
            .animate-char-celebrate { animation: charCelebrate 0.52s ease-in-out infinite; }

            .anim-core-pulse { animation: coreSurge 1.4s ease-in-out infinite; }
            .anim-core-overdrive { animation: coreOverdrive 0.3s ease-in-out infinite; }
            .anim-core-flicker { animation: coreFlicker 0.18s steps(2, start) infinite; }
            .anim-laser-streak { animation: laserStreak 1.2s ease-in-out infinite; }
            .anim-flame-plume { animation: flamePlume 0.8s ease-in-out infinite; transform-origin: 50% 80%; }
            .anim-spark-a { animation: sparkFlyA 0.45s cubic-bezier(0.1, 0.8, 0.3, 1) infinite; }
            .anim-spark-b { animation: sparkFlyB 0.55s cubic-bezier(0.1, 0.8, 0.3, 1) infinite 0.15s; }
            .anim-spark-c { animation: sparkFlyC 0.6s cubic-bezier(0.1, 0.8, 0.3, 1) infinite 0.3s; }
            .anim-sweat-1 { animation: sweatDropFlow 0.8s ease-out infinite; }
            .anim-sweat-2 { animation: sweatDropFlow 0.9s ease-out infinite 0.4s; }
            .anim-dust-puff { animation: frictionPuff 0.7s ease-out infinite; }
            .anim-victory-rays { animation: victoryRays 12s linear infinite; transform-origin: center; }
          `}</style>

          {/* Gradients for Cyber Titan (Left Team) */}
          <linearGradient id={`${uid}_cyberArmor`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
          <linearGradient id={`${uid}_cyberChassis`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#0c4a6e" />
            <stop offset="100%" stopColor="#031f33" />
          </linearGradient>
          <linearGradient id={`${uid}_cyberPlate`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <linearGradient id={`${uid}_cyberVisor`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#00f0ff" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <radialGradient id={`${uid}_cyberArcGlow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor="#00f0ff" />
            <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
          </radialGradient>

          {/* Gradients for Solar Phoenix (Right Team) */}
          <linearGradient id={`${uid}_solarArmor`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#451a03" />
            <stop offset="50%" stopColor="#290f02" />
            <stop offset="100%" stopColor="#0c0401" />
          </linearGradient>
          <linearGradient id={`${uid}_solarChassis`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ea580c" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#9a3412" />
            <stop offset="100%" stopColor="#431407" />
          </linearGradient>
          <linearGradient id={`${uid}_solarPlate`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          <linearGradient id={`${uid}_solarVisor`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#ffd700" />
            <stop offset="100%" stopColor="#ff5500" />
          </linearGradient>
          <linearGradient id={`${uid}_solarFlame`} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#ff3b00" />
            <stop offset="50%" stopColor="#ff9900" />
            <stop offset="100%" stopColor="#ffd700" />
          </linearGradient>
          <radialGradient id={`${uid}_solarCoreGlow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor="#fbbf24" />
            <stop offset="75%" stopColor="#ff6b00" />
            <stop offset="100%" stopColor="#ff6b00" stopOpacity="0" />
          </radialGradient>

          {/* Glow Filters */}
          <filter id={`${uid}_glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ============================================================ */}
        {/* BACKGROUND GROUND SPARKS & FRICTION PARTICLES               */}
        {/* ============================================================ */}
        {(state === "pulling" || state === "losing") && (
          <g className="ground-friction-vfx pointer-events-none">
            {/* Ground Dust Puffs */}
            <circle
              cx={isLeft ? 26 : 104}
              cy="138"
              r="6"
              fill={isLeft ? "#38bdf8" : "#fbbf24"}
              opacity="0.3"
              className="anim-dust-puff"
            />
            <circle
              cx={isLeft ? 68 : 62}
              cy="138"
              r="4.5"
              fill={isLeft ? "#0284c7" : "#ea580c"}
              opacity="0.25"
              className="anim-dust-puff"
              style={{ animationDelay: "0.35s" }}
            />

            {/* High-Velocity Ground Sparks (Spraying from planted rear cleat) */}
            <g transform={`translate(${isLeft ? "22, 137" : "108, 137"})`}>
              <circle cx="0" cy="0" r="2.2" fill="#ffffff" filter={`url(#${uid}_glow)`} className="anim-spark-a" />
              <circle cx="0" cy="0" r="1.8" fill={secondaryAccent} className="anim-spark-b" />
              <path
                d="M0,0 L-4,-2 L0,-4 L-2,-1 Z"
                fill={coreColor}
                filter={`url(#${uid}_glow)`}
                className="anim-spark-c"
              />
              {isLastFiveSec && (
                <>
                  <circle
                    cx="0"
                    cy="0"
                    r="2.5"
                    fill="#ffffff"
                    filter={`url(#${uid}_glow)`}
                    className="anim-spark-a"
                    style={{ animationDelay: "0.2s" }}
                  />
                  <circle
                    cx="0"
                    cy="0"
                    r="1.6"
                    fill={accentColor}
                    className="anim-spark-c"
                    style={{ animationDelay: "0.1s" }}
                  />
                </>
              )}
            </g>
          </g>
        )}

        {/* Overdrive Sweat / Energy Drop Particles during Intense Pulling */}
        {(state === "pulling" || isLastFiveSec) && state !== "won" && state !== "lost" && (
          <g className="energy-sweat-particles pointer-events-none">
            <ellipse
              cx={isLeft ? 48 : 82}
              cy="34"
              rx="1.5"
              ry="2.5"
              fill={coreColor}
              filter={`url(#${uid}_glow)`}
              className="anim-sweat-1"
            />
            <ellipse
              cx={isLeft ? 60 : 70}
              cy="52"
              rx="1.2"
              ry="2"
              fill="#ffffff"
              filter={`url(#${uid}_glow)`}
              className="anim-sweat-2"
            />
            {isLastFiveSec && (
              <ellipse
                cx={isLeft ? 42 : 88}
                cy="44"
                rx="1.8"
                ry="2.8"
                fill={secondaryAccent}
                filter={`url(#${uid}_glow)`}
                className="anim-sweat-1"
                style={{ animationDelay: "0.5s" }}
              />
            )}
          </g>
        )}

        {/* Triumphant Golden/Cyan Victory Radiance Halo */}
        {state === "won" && (
          <g className="victory-radiance pointer-events-none" transform="translate(65, 50)">
            <circle cx="0" cy="0" r="38" fill={`url(#${isLeft ? `${uid}_cyberArcGlow` : `${uid}_solarCoreGlow`})`} opacity="0.35" />
            <g className="anim-victory-rays">
              {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                <line
                  key={angle}
                  x1="0"
                  y1="0"
                  x2={32 * Math.cos((angle * Math.PI) / 180)}
                  y2={32 * Math.sin((angle * Math.PI) / 180)}
                  stroke={secondaryAccent}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeDasharray="4 6"
                />
              ))}
            </g>
          </g>
        )}

        {/* ============================================================ */}
        {/* ATHLETE VECTOR RIG RENDERING                                 */}
        {/* ============================================================ */}
        {isLeft ? (
          /* ========================================================== */
          /* TEAM LEFT: CYBER TITAN (CYBER AZURE)                       */
          /* ========================================================== */
          <CyberTitanRig
            uid={uid}
            state={state}
            isLastFiveSec={isLastFiveSec}
            accentColor={accentColor}
            secondaryAccent={secondaryAccent}
          />
        ) : (
          /* ========================================================== */
          /* TEAM RIGHT: SOLAR PHOENIX (SOLAR FLARE)                    */
          /* ========================================================== */
          <SolarPhoenixRig
            uid={uid}
            state={state}
            isLastFiveSec={isLastFiveSec}
            accentColor={accentColor}
            secondaryAccent={secondaryAccent}
          />
        )}
      </svg>
    </div>
  );
};

/* ==================================================================== */
/* SUB-COMPONENT: CYBER TITAN RIG (TEAM LEFT)                           */
/* ==================================================================== */
interface CharacterRigProps {
  uid: string;
  state: "idle" | "pulling" | "losing" | "won" | "lost" | "paused";
  isLastFiveSec: boolean;
  accentColor: string;
  secondaryAccent: string;
}

const CyberTitanRig: React.FC<CharacterRigProps> = ({
  uid,
  state,
  isLastFiveSec,
  accentColor,
  secondaryAccent,
}) => {
  const isWon = state === "won";
  const isLost = state === "lost";
  const isLosing = state === "losing";
  const isPulling = state === "pulling";

  // Dynamic Core Reactor CSS Class
  const coreAnimClass = isLost
    ? ""
    : isLosing
    ? "anim-core-flicker"
    : isLastFiveSec
    ? "anim-core-overdrive"
    : "anim-core-pulse";

  // Render pose specific limbs & torso
  if (isWon) {
    /* WON CELEBRATION POSE: Upright champion, double fist pump aloft */
    return (
      <g id={`${uid}_cyber_won`}>
        {/* Left Arm Raised High */}
        <path d="M46 54 L30 30 L22 14" stroke="#0f172a" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M46 54 L30 30 L22 14" stroke={`url(#${uid}_cyberPlate)`} strokeWidth="6" strokeLinecap="round" />
        {/* Left Victory Gauntlet Fist */}
        <circle cx="22" cy="14" r="7" fill="#0284c7" stroke="#ffffff" strokeWidth="2.5" />
        <circle cx="22" cy="14" r="3.5" fill="#ffffff" filter={`url(#${uid}_glow)`} />

        {/* Right Arm Raised High */}
        <path d="M78 54 L94 30 L102 14" stroke="#0f172a" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M78 54 L94 30 L102 14" stroke={`url(#${uid}_cyberPlate)`} strokeWidth="6" strokeLinecap="round" />
        {/* Right Victory Gauntlet Fist */}
        <circle cx="102" cy="14" r="7" fill="#0284c7" stroke="#ffffff" strokeWidth="2.5" />
        <circle cx="102" cy="14" r="3.5" fill="#ffffff" filter={`url(#${uid}_glow)`} />

        {/* Braced Champion Legs */}
        <path d="M48 94 L34 122 L24 138" stroke="#090e17" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M48 94 L34 122 L24 138" stroke={`url(#${uid}_cyberPlate)`} strokeWidth="4" strokeLinecap="round" strokeDasharray="5 5" />
        <path d="M76 94 L90 122 L100 138" stroke="#090e17" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M76 94 L90 122 L100 138" stroke={`url(#${uid}_cyberPlate)`} strokeWidth="4" strokeLinecap="round" strokeDasharray="5 5" />

        {/* Armored Magnetic Cleats */}
        <rect x="14" y="132" width="22" height="8" rx="3" fill="#0f172a" stroke={accentColor} strokeWidth="2" />
        <rect x="88" y="132" width="22" height="8" rx="3" fill="#0f172a" stroke={accentColor} strokeWidth="2" />

        {/* Torso & Exoskeleton Armor */}
        <path d="M42 46 L82 46 L74 94 L50 94 Z" fill={`url(#${uid}_cyberArmor)`} stroke={accentColor} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M52 46 L50 94 M72 46 L74 94" stroke="#0284c7" strokeWidth="1.5" strokeOpacity="0.6" />

        {/* Arc Reactor */}
        <polygon points="62,54 70,68 54,68" fill="#031f33" stroke={accentColor} strokeWidth="2" />
        <circle cx="62" cy="63" r="6" fill={`url(#${uid}_cyberArcGlow)`} className={coreAnimClass} filter={`url(#${uid}_glow)`} />

        {/* Cyber Helmet & Visor */}
        <ellipse cx="62" cy="28" rx="14" ry="16" fill="#090e17" stroke={accentColor} strokeWidth="2.5" />
        <path d="M50 28 Q62 26 74 28" stroke={`url(#${uid}_cyberVisor)`} strokeWidth="5.5" strokeLinecap="round" filter={`url(#${uid}_glow)`} />
        {/* Antennas */}
        <line x1="48" y1="20" x2="44" y2="12" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="76" y1="20" x2="80" y2="12" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" />
      </g>
    );
  }

  if (isLost) {
    /* LOST SLUMP POSE: Collapsed onto knees, extinguished dark core */
    return (
      <g id={`${uid}_cyber_lost`}>
        {/* Slumped Bent Legs */}
        <path d="M46 96 L30 118 L48 136 L24 138" stroke="#060b13" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M68 96 L82 118 L64 136 L88 138" stroke="#060b13" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />

        {/* Slumped Torso */}
        <path d="M38 60 L78 60 L70 102 L46 102 Z" fill="#090e17" stroke="#334155" strokeWidth="2" strokeLinejoin="round" />

        {/* Extinguished Arc Reactor */}
        <circle cx="58" cy="74" r="5" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />

        {/* Limp Hanging Arms */}
        <path d="M40 68 L32 94 L30 116" stroke="#060b13" strokeWidth="9" strokeLinecap="round" />
        <path d="M76 68 L84 94 L86 116" stroke="#060b13" strokeWidth="9" strokeLinecap="round" />

        {/* Drooped Cyber Helmet */}
        <ellipse cx="58" cy="46" rx="13" ry="15" fill="#090e17" stroke="#334155" strokeWidth="2" />
        {/* Dark Inactive Visor Slit */}
        <path d="M48 48 L68 48" stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round" />
      </g>
    );
  }

  /* DEFAULT / PULLING / LOSING / IDLE / PAUSED POSES */
  // Left character leans back to the left, pulling arms to the right
  const leanOffset = isLosing ? 12 : isPulling ? -6 : 0;

  return (
    <g id={`${uid}_cyber_pulling`}>
      {/* 1. REAR ARM (Background Arm Clamping Cable) */}
      <g id={`${uid}_cyber_rear_arm`}>
        <path
          d={`M${38 + leanOffset} 58 L${68 + leanOffset} 76 L${90 + leanOffset} 72`}
          stroke="#060b13"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M${38 + leanOffset} 58 L${68 + leanOffset} 76 L${90 + leanOffset} 72`}
          stroke={`url(#${uid}_cyberPlate)`}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Secondary Gauntlet Clamp */}
        <circle cx={88 + leanOffset} cy={72} r="5.5" fill="#0f172a" stroke={secondaryAccent} strokeWidth="2" />
      </g>

      {/* 2. BRACED REAR LEG (Locked anchor against the turf) */}
      <g id={`${uid}_cyber_rear_leg`}>
        <path
          d={`M${40 + leanOffset} 92 L22 122 L12 138`}
          stroke="#060b13"
          strokeWidth="13"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M${40 + leanOffset} 92 L22 122 L12 138`}
          stroke={`url(#${uid}_cyberChassis)`}
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* Hydraulic Piston Strut on Thigh */}
        <line x1={36 + leanOffset} y1="96" x2="22" y2="120" stroke={secondaryAccent} strokeWidth="2" strokeDasharray="3 4" />
        
        {/* Heavy Armored Magnetic Cleat (Digging into floor) */}
        <path
          d="M2 134 L20 134 L22 140 L0 140 Z"
          fill="#0c1524"
          stroke={accentColor}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Cleat Grip Spikes */}
        <line x1="4" y1="140" x2="4" y2="142" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="12" y1="140" x2="12" y2="142" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="20" y1="140" x2="20" y2="142" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* 3. FRONT TENSION LEG */}
      <g id={`${uid}_cyber_front_leg`}>
        <path
          d={`M${56 + leanOffset} 90 L${68 + leanOffset * 0.5} 118 L${78 + leanOffset * 0.5} 138`}
          stroke="#090e17"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M${56 + leanOffset} 90 L${68 + leanOffset * 0.5} 118 L${78 + leanOffset * 0.5} 138`}
          stroke={`url(#${uid}_cyberPlate)`}
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Knee Armor Guard */}
        <circle cx={68 + leanOffset * 0.5} cy="118" r="6" fill="#0f172a" stroke={accentColor} strokeWidth="2" />

        {/* Front Foot Grip Cleat */}
        <path
          d={`M${68 + leanOffset * 0.5} 134 L${86 + leanOffset * 0.5} 134 L${88 + leanOffset * 0.5} 140 L${66 + leanOffset * 0.5} 140 Z`}
          fill="#0c1524"
          stroke={accentColor}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </g>

      {/* 4. ATHLETIC TORSO & EXOSKELETON CHASSIS */}
      <g id={`${uid}_cyber_torso`}>
        {/* Outer Heavy Armor Shell */}
        <path
          d={`M${32 + leanOffset} 46 L${68 + leanOffset} 46 L${60 + leanOffset} 94 L${40 + leanOffset} 94 Z`}
          fill={`url(#${uid}_cyberArmor)`}
          stroke={accentColor}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Segmented Power Conduits */}
        <path
          d={`M${42 + leanOffset} 48 L${46 + leanOffset} 92 M${58 + leanOffset} 48 L${54 + leanOffset} 92`}
          stroke="#0284c7"
          strokeWidth="1.5"
          strokeOpacity="0.7"
        />

        {/* Cyber Arc Reactor (Triangular Energy Core) */}
        <polygon
          points={`${50 + leanOffset},54 ${58 + leanOffset},68 ${42 + leanOffset},68`}
          fill="#031f33"
          stroke={accentColor}
          strokeWidth="2"
        />
        <circle
          cx={50 + leanOffset}
          cy="63"
          r="5.5"
          fill={`url(#${uid}_cyberArcGlow)`}
          className={coreAnimClass}
          filter={`url(#${uid}_glow)`}
        />

        {/* Hydraulic Abdominal Plates */}
        <line x1={42 + leanOffset} y1="76" x2={58 + leanOffset} y2="76" stroke={accentColor} strokeWidth="2" strokeLinecap="round" />
        <line x1={44 + leanOffset} y1="82" x2={56 + leanOffset} y2="82" stroke={secondaryAccent} strokeWidth="1.8" strokeLinecap="round" />

        {/* Shoulder Pauldron */}
        <path
          d={`M${30 + leanOffset} 44 L${46 + leanOffset} 40 L${44 + leanOffset} 58 L${26 + leanOffset} 56 Z`}
          fill="#0f172a"
          stroke={accentColor}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </g>

      {/* 5. HELMET & GLOWING BLUE LASER VISOR */}
      <g id={`${uid}_cyber_helmet`}>
        {/* Neck Cyber Guard */}
        <rect x={44 + leanOffset} y="38" width="12" height="8" rx="2" fill="#060b13" stroke={accentColor} strokeWidth="1.5" />

        {/* Mecha Exoskeleton Helmet */}
        <ellipse
          cx={50 + leanOffset}
          cy="26"
          rx="14"
          ry="16"
          fill="#090e17"
          stroke={accentColor}
          strokeWidth="2.5"
        />
        {/* Side Mecha Antennas */}
        <path
          d={`M${38 + leanOffset} 18 L${34 + leanOffset} 8 L${38 + leanOffset} 12`}
          stroke={accentColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M${62 + leanOffset} 18 L${66 + leanOffset} 8 L${62 + leanOffset} 12`}
          stroke={accentColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Glowing Blue Laser Visor with Laser Eye Streak */}
        <g className="anim-laser-streak">
          <path
            d={`M${44 + leanOffset} 24 Q${56 + leanOffset} 24 ${64 + leanOffset} 28`}
            stroke={`url(#${uid}_cyberVisor)`}
            strokeWidth="5.5"
            strokeLinecap="round"
            filter={`url(#${uid}_glow)`}
          />
          {/* Laser Core Streak */}
          <line
            x1={42 + leanOffset}
            y1="24"
            x2={68 + leanOffset}
            y2="28"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      </g>

      {/* 6. LEAD ARM & REINFORCED DUAL GAUNTLET CLAMPS */}
      <g id={`${uid}_cyber_lead_arm`}>
        <path
          d={`M${48 + leanOffset} 52 L${78 + leanOffset} 66 L${98 + leanOffset} 62`}
          stroke="#060b13"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M${48 + leanOffset} 52 L${78 + leanOffset} 66 L${98 + leanOffset} 62`}
          stroke={`url(#${uid}_cyberPlate)`}
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Forearm Conduit */}
        <line
          x1={54 + leanOffset}
          y1="56"
          x2={78 + leanOffset}
          y2="66"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Reinforced Gauntlet Clamps (Locking onto tow cable) */}
        <circle cx={94 + leanOffset} cy="64" r="6.5" fill="#f0f6fc" stroke="#0284c7" strokeWidth="2.5" filter={`url(#${uid}_glow)`} />
        <circle cx={84 + leanOffset} cy="70" r="5.5" fill="#0f172a" stroke={accentColor} strokeWidth="2" />
      </g>
    </g>
  );
};

/* ==================================================================== */
/* SUB-COMPONENT: SOLAR PHOENIX RIG (TEAM RIGHT)                        */
/* ==================================================================== */
const SolarPhoenixRig: React.FC<CharacterRigProps> = ({
  uid,
  state,
  isLastFiveSec,
  accentColor,
  secondaryAccent,
}) => {
  const isWon = state === "won";
  const isLost = state === "lost";
  const isLosing = state === "losing";
  const isPulling = state === "pulling";

  // Dynamic Solar Core Reactor CSS Class
  const coreAnimClass = isLost
    ? ""
    : isLosing
    ? "anim-core-flicker"
    : isLastFiveSec
    ? "anim-core-overdrive"
    : "anim-core-pulse";

  if (isWon) {
    /* WON CELEBRATION POSE: Upright solar phoenix champion, golden wings of triumph */
    return (
      <g id={`${uid}_solar_won`}>
        {/* Left Arm Raised High */}
        <path d="M46 54 L30 30 L22 14" stroke="#1c0a02" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M46 54 L30 30 L22 14" stroke={`url(#${uid}_solarPlate)`} strokeWidth="6" strokeLinecap="round" />
        {/* Left Solar Gauntlet Fist */}
        <circle cx="22" cy="14" r="7" fill="#ea580c" stroke="#ffd700" strokeWidth="2.5" />
        <circle cx="22" cy="14" r="3.5" fill="#ffd700" filter={`url(#${uid}_glow)`} />

        {/* Right Arm Raised High */}
        <path d="M78 54 L94 30 L102 14" stroke="#1c0a02" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M78 54 L94 30 L102 14" stroke={`url(#${uid}_solarPlate)`} strokeWidth="6" strokeLinecap="round" />
        {/* Right Solar Gauntlet Fist */}
        <circle cx="102" cy="14" r="7" fill="#ea580c" stroke="#ffd700" strokeWidth="2.5" />
        <circle cx="102" cy="14" r="3.5" fill="#ffd700" filter={`url(#${uid}_glow)`} />

        {/* Braced Champion Legs */}
        <path d="M48 94 L34 122 L24 138" stroke="#140803" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M48 94 L34 122 L24 138" stroke={`url(#${uid}_solarPlate)`} strokeWidth="4" strokeLinecap="round" strokeDasharray="5 5" />
        <path d="M76 94 L90 122 L100 138" stroke="#140803" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M76 94 L90 122 L100 138" stroke={`url(#${uid}_solarPlate)`} strokeWidth="4" strokeLinecap="round" strokeDasharray="5 5" />

        {/* High-Traction Thermal Cleats */}
        <rect x="14" y="132" width="22" height="8" rx="3" fill="#290f02" stroke={secondaryAccent} strokeWidth="2" />
        <rect x="88" y="132" width="22" height="8" rx="3" fill="#290f02" stroke={secondaryAccent} strokeWidth="2" />

        {/* Torso & Solar Breastplate Armor */}
        <path d="M42 46 L82 46 L74 94 L50 94 Z" fill={`url(#${uid}_solarArmor)`} stroke={secondaryAccent} strokeWidth="2.5" strokeLinejoin="round" />
        
        {/* Solar Core Sunburst Reactor */}
        <circle cx="62" cy="63" r="8" fill="#431407" stroke={secondaryAccent} strokeWidth="2" />
        <circle cx="62" cy="63" r="6" fill={`url(#${uid}_solarCoreGlow)`} className={coreAnimClass} filter={`url(#${uid}_glow)`} />

        {/* Flame Crest Helmet */}
        {/* Phoenix Flame Plumage */}
        <path
          d="M62 14 Q52 4 48 0 Q58 6 62 12 Q66 6 76 0 Q72 4 62 14 Z"
          fill={`url(#${uid}_solarFlame)`}
          className="anim-flame-plume"
          filter={`url(#${uid}_glow)`}
        />
        <ellipse cx="62" cy="28" rx="14" ry="16" fill="#180903" stroke={secondaryAccent} strokeWidth="2.5" />
        {/* Golden Visor */}
        <path d="M50 28 Q62 26 74 28" stroke={`url(#${uid}_solarVisor)`} strokeWidth="5.5" strokeLinecap="round" filter={`url(#${uid}_glow)`} />
      </g>
    );
  }

  if (isLost) {
    /* LOST SLUMP POSE: Collapsed onto knees, extinguished amber embers */
    return (
      <g id={`${uid}_solar_lost`}>
        {/* Slumped Bent Legs */}
        <path d="M46 96 L30 118 L48 136 L24 138" stroke="#120501" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M68 96 L82 118 L64 136 L88 138" stroke="#120501" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />

        {/* Slumped Torso */}
        <path d="M38 60 L78 60 L70 102 L46 102 Z" fill="#180903" stroke="#451a03" strokeWidth="2" strokeLinejoin="round" />

        {/* Extinguished Solar Reactor */}
        <circle cx="58" cy="74" r="5" fill="#290f02" stroke="#451a03" strokeWidth="1.5" />

        {/* Limp Hanging Arms */}
        <path d="M40 68 L32 94 L30 116" stroke="#120501" strokeWidth="9" strokeLinecap="round" />
        <path d="M76 68 L84 94 L86 116" stroke="#120501" strokeWidth="9" strokeLinecap="round" />

        {/* Drooped Phoenix Helmet */}
        <ellipse cx="58" cy="46" rx="13" ry="15" fill="#180903" stroke="#451a03" strokeWidth="2" />
        {/* Extinguished Visor */}
        <path d="M48 48 L68 48" stroke="#290f02" strokeWidth="3.5" strokeLinecap="round" />
      </g>
    );
  }

  /* DEFAULT / PULLING / LOSING / IDLE / PAUSED POSES */
  // Right character leans back to the right, pulling arms to the left
  const leanOffset = isLosing ? -12 : isPulling ? 6 : 0;

  return (
    <g id={`${uid}_solar_pulling`}>
      {/* 1. REAR ARM (Background Arm Clamping Cable) */}
      <g id={`${uid}_solar_rear_arm`}>
        <path
          d={`M${62 + leanOffset} 58 L${32 + leanOffset} 76 L${10 + leanOffset} 72`}
          stroke="#140803"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M${62 + leanOffset} 58 L${32 + leanOffset} 76 L${10 + leanOffset} 72`}
          stroke={`url(#${uid}_solarPlate)`}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Secondary Solar Gauntlet Clamp */}
        <circle cx={12 + leanOffset} cy={72} r="5.5" fill="#290f02" stroke={secondaryAccent} strokeWidth="2" />
      </g>

      {/* 2. BRACED REAR LEG (Locked anchor against the turf) */}
      <g id={`${uid}_solar_rear_leg`}>
        <path
          d={`M${60 + leanOffset} 92 L78 122 L88 138`}
          stroke="#140803"
          strokeWidth="13"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M${60 + leanOffset} 92 L78 122 L88 138`}
          stroke={`url(#${uid}_solarChassis)`}
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* Flame Conduits along Thigh */}
        <line x1={64 + leanOffset} y1="96" x2="78" y2="120" stroke={secondaryAccent} strokeWidth="2" strokeDasharray="3 4" />
        
        {/* High-Traction Thermal Cleat (Digging into floor with heat vents) */}
        <path
          d="M80 134 L98 134 L100 140 L78 140 Z"
          fill="#290f02"
          stroke={secondaryAccent}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Claw Traction Studs */}
        <line x1="80" y1="140" x2="80" y2="142" stroke={secondaryAccent} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="88" y1="140" x2="88" y2="142" stroke={secondaryAccent} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="96" y1="140" x2="96" y2="142" stroke={secondaryAccent} strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* 3. FRONT TENSION LEG */}
      <g id={`${uid}_solar_front_leg`}>
        <path
          d={`M${44 + leanOffset} 90 L${32 + leanOffset * 0.5} 118 L${22 + leanOffset * 0.5} 138`}
          stroke="#140803"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M${44 + leanOffset} 90 L${32 + leanOffset * 0.5} 118 L${22 + leanOffset * 0.5} 138`}
          stroke={`url(#${uid}_solarPlate)`}
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Knee Armor Guard */}
        <circle cx={32 + leanOffset * 0.5} cy="118" r="6" fill="#290f02" stroke={secondaryAccent} strokeWidth="2" />

        {/* Front Thermal Grip Cleat */}
        <path
          d={`M${14 + leanOffset * 0.5} 134 L${32 + leanOffset * 0.5} 134 L${34 + leanOffset * 0.5} 140 L${12 + leanOffset * 0.5} 140 Z`}
          fill="#290f02"
          stroke={secondaryAccent}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </g>

      {/* 4. ATHLETIC TORSO & SOLAR BREASTPLATE */}
      <g id={`${uid}_solar_torso`}>
        {/* Outer Solar Armor Shell */}
        <path
          d={`M${38 + leanOffset} 46 L${74 + leanOffset} 46 L${66 + leanOffset} 94 L${46 + leanOffset} 94 Z`}
          fill={`url(#${uid}_solarArmor)`}
          stroke={secondaryAccent}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Sunburst Engraved Lines */}
        <path
          d={`M${56 + leanOffset} 48 L${52 + leanOffset} 92 M${44 + leanOffset} 48 L${48 + leanOffset} 92`}
          stroke="#ea580c"
          strokeWidth="1.5"
          strokeOpacity="0.7"
        />

        {/* Solar Core Sunburst Reactor */}
        <circle
          cx={56 + leanOffset}
          cy="63"
          r="8"
          fill="#431407"
          stroke={secondaryAccent}
          strokeWidth="2"
        />
        <circle
          cx={56 + leanOffset}
          cy="63"
          r="5.5"
          fill={`url(#${uid}_solarCoreGlow)`}
          className={coreAnimClass}
          filter={`url(#${uid}_glow)`}
        />

        {/* Heat Dissipation Slits */}
        <line x1={48 + leanOffset} y1="76" x2={64 + leanOffset} y2="76" stroke={accentColor} strokeWidth="2" strokeLinecap="round" />
        <line x1={50 + leanOffset} y1="82" x2={62 + leanOffset} y2="82" stroke={secondaryAccent} strokeWidth="1.8" strokeLinecap="round" />

        {/* Winged Solar Pauldron */}
        <path
          d={`M${76 + leanOffset} 44 L${60 + leanOffset} 40 L${62 + leanOffset} 58 L${80 + leanOffset} 56 Z`}
          fill="#290f02"
          stroke={secondaryAccent}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </g>

      {/* 5. HELMET & PHOENIX FLAME CREST */}
      <g id={`${uid}_solar_helmet`}>
        {/* Phoenix Flame Plumage Crest (Flaring upwards) */}
        <path
          d={`M${56 + leanOffset} 12 Q${66 + leanOffset} 2 ${70 + leanOffset} -4 Q${60 + leanOffset} 4 ${56 + leanOffset} 10 Q${52 + leanOffset} 4 ${42 + leanOffset} -4 Q${46 + leanOffset} 2 ${56 + leanOffset} 12 Z`}
          fill={`url(#${uid}_solarFlame)`}
          className="anim-flame-plume"
          filter={`url(#${uid}_glow)`}
        />

        {/* Aerodynamic Phoenix Helmet Shell */}
        <ellipse
          cx={56 + leanOffset}
          cy="26"
          rx="14"
          ry="16"
          fill="#180903"
          stroke={secondaryAccent}
          strokeWidth="2.5"
        />

        {/* Glowing Gold Phoenix Visor */}
        <g className="anim-laser-streak">
          <path
            d={`M${62 + leanOffset} 24 Q${50 + leanOffset} 24 ${42 + leanOffset} 28`}
            stroke={`url(#${uid}_solarVisor)`}
            strokeWidth="5.5"
            strokeLinecap="round"
            filter={`url(#${uid}_glow)`}
          />
          {/* Molten Core Streak */}
          <line
            x1={64 + leanOffset}
            y1="24"
            x2={38 + leanOffset}
            y2="28"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      </g>

      {/* 6. LEAD ARM & REINFORCED THERMAL GAUNTLETS */}
      <g id={`${uid}_solar_lead_arm`}>
        <path
          d={`M${58 + leanOffset} 52 L${28 + leanOffset} 66 L${8 + leanOffset} 62`}
          stroke="#140803"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M${58 + leanOffset} 52 L${28 + leanOffset} 66 L${8 + leanOffset} 62`}
          stroke={`url(#${uid}_solarPlate)`}
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Thermal Energy Conduit */}
        <line
          x1={52 + leanOffset}
          y1="56"
          x2={28 + leanOffset}
          y2="66"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Reinforced Thermal Gauntlet Clamps (Locking onto tow cable) */}
        <circle cx={12 + leanOffset} cy="64" r="6.5" fill="#ffd700" stroke="#ff5500" strokeWidth="2.5" filter={`url(#${uid}_glow)`} />
        <circle cx={22 + leanOffset} cy="70" r="5.5" fill="#290f02" stroke={secondaryAccent} strokeWidth="2" />
      </g>
    </g>
  );
};

