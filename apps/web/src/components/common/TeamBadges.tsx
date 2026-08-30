import React from "react";

interface BadgeProps {
  className?: string;
  size?: number;
}

/**
 * Cyber Titan Emblem (Team Cyan / Left)
 * Futuristic Cybernetic Mech-Horned Titan with neon electric energy
 */
export const CyberTitanCrest: React.FC<BadgeProps> = ({ className = "", size = 48 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`drop-shadow-[0_0_12px_rgba(0,240,255,0.6)] ${className}`}
    >
      <defs>
        <linearGradient id="cyberGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00f0ff" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <linearGradient id="cyberShieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#042f2e" />
          <stop offset="100%" stopColor="#081426" />
        </linearGradient>
      </defs>

      {/* Hex Shield Outer */}
      <polygon
        points="50,4 92,26 92,74 50,96 8,74 8,26"
        fill="url(#cyberShieldGrad)"
        stroke="url(#cyberGrad)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Inner Accent Inset */}
      <polygon
        points="50,12 84,30 84,70 50,88 16,70 16,30"
        stroke="#00f0ff"
        strokeWidth="1"
        strokeOpacity="0.4"
        fill="none"
      />

      {/* Cyber Titan Horns / V-Visor */}
      <path
        d="M26 32 L38 22 L46 36 L50 28 L54 36 L62 22 L74 32 L68 52 L50 78 L32 52 Z"
        fill="#0b172a"
        stroke="url(#cyberGrad)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Laser Eye Visor */}
      <path
        d="M36 44 L50 48 L64 44 L50 54 Z"
        fill="#00f0ff"
        className="animate-pulse"
      />
      {/* Core Energy Line */}
      <line x1="50" y1="56" x2="50" y2="72" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="50" cy="64" r="3" fill="#ffffff" />
    </svg>
  );
};

/**
 * Solar Phoenix Emblem (Team Amber / Right)
 * Blazing Celestial Solar Phoenix with radiant flame crest
 */
export const SolarPhoenixCrest: React.FC<BadgeProps> = ({ className = "", size = 48 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`drop-shadow-[0_0_12px_rgba(255,107,0,0.6)] ${className}`}
    >
      <defs>
        <linearGradient id="solarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffd700" />
          <stop offset="50%" stopColor="#ff7b00" />
          <stop offset="100%" stopColor="#ff2a00" />
        </linearGradient>
        <linearGradient id="solarShieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b1104" />
          <stop offset="100%" stopColor="#1a0702" />
        </linearGradient>
      </defs>

      {/* Hex Shield Outer */}
      <polygon
        points="50,4 92,26 92,74 50,96 8,74 8,26"
        fill="url(#solarShieldGrad)"
        stroke="url(#solarGrad)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Inner Accent Inset */}
      <polygon
        points="50,12 84,30 84,70 50,88 16,70 16,30"
        stroke="#ff9900"
        strokeWidth="1"
        strokeOpacity="0.4"
        fill="none"
      />

      {/* Phoenix Wings & Crown */}
      <path
        d="M50 18 C58 28, 76 26, 80 40 C72 44, 68 50, 68 60 C62 68, 50 78, 50 78 C50 78, 38 68, 32 60 C32 50, 28 44, 20 40 C24 26, 42 28, 50 18 Z"
        fill="#210a04"
        stroke="url(#solarGrad)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Solar Core Heart Flame */}
      <path
        d="M50 32 C54 40, 60 48, 50 64 C40 48, 46 40, 50 32 Z"
        fill="url(#solarGrad)"
        className="animate-pulse"
      />
      <circle cx="50" cy="48" r="3.5" fill="#ffffff" />
    </svg>
  );
};

/**
 * Chaos Wildcard Emblem
 * Arcane Galactic Spiral Nova
 */
export const ChaosWildcardCrest: React.FC<BadgeProps> = ({ className = "", size = 48 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`drop-shadow-[0_0_12px_rgba(217,70,239,0.6)] ${className}`}
    >
      <defs>
        <linearGradient id="chaosGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="50%" stopColor="#d946ef" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      {/* Outer Diamond */}
      <polygon
        points="50,6 94,50 50,94 6,50"
        fill="#1e0c2b"
        stroke="url(#chaosGrad)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <polygon
        points="50,16 84,50 50,84 16,50"
        stroke="#f472b6"
        strokeWidth="1"
        strokeOpacity="0.5"
        fill="none"
      />
      {/* 8-Pointed Mystic Star */}
      <path
        d="M50 20 L57 43 L80 50 L57 57 L50 80 L43 57 L20 50 L43 43 Z"
        fill="url(#chaosGrad)"
        className="animate-spin"
        style={{ transformOrigin: "50px 50px", animationDuration: "8s" }}
      />
      <circle cx="50" cy="50" r="6" fill="#fbbf24" stroke="#ffffff" strokeWidth="2" />
    </svg>
  );
};

/**
 * Trophy Champion Gold
 */
export const TrophyChampionGold: React.FC<BadgeProps> = ({ className = "", size = 64 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`drop-shadow-[0_0_20px_rgba(251,191,36,0.8)] ${className}`}
    >
      <defs>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fffbeb" />
          <stop offset="40%" stopColor="#fde047" />
          <stop offset="80%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>
      </defs>
      {/* Cup Body */}
      <path
        d="M28 20 H72 V46 C72 58 62 68 50 68 C38 68 28 58 28 46 V20 Z"
        fill="url(#goldGrad)"
        stroke="#fef08a"
        strokeWidth="2"
      />
      {/* Handles */}
      <path
        d="M28 26 C16 26 14 42 28 46 M72 26 C84 26 86 42 72 46"
        stroke="url(#goldGrad)"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      {/* Stem & Pedestal */}
      <rect x="46" y="68" width="8" height="12" fill="url(#goldGrad)" />
      <polygon points="32,92 68,92 62,80 38,80" fill="url(#goldGrad)" stroke="#fef08a" strokeWidth="1.5" />
      {/* Star Crown on Cup */}
      <polygon
        points="50,30 53,38 62,39 55,45 57,53 50,48 43,53 45,45 38,39 47,38"
        fill="#ffffff"
        className="animate-pulse"
      />
    </svg>
  );
};
