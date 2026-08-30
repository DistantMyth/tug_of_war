import React, { useEffect, useState, useRef } from "react";

export type ComboTier = "normal" | "combo" | "turbo" | "overdrive";

export interface TapEvent {
  id: number | string;
  x: number;
  y: number;
  streak: number;
  team?: "left" | "right" | "chaos" | null;
  timestamp?: number;
}

export interface FloatingChip {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  rotation: number;
  text: string;
  tier: ComboTier;
  team?: "left" | "right" | "chaos" | null;
}

export interface ActiveShockwave {
  id: string;
  x: number;
  y: number;
  tier: ComboTier;
  team?: "left" | "right" | "chaos" | null;
}

export interface TapComboOverlayProps {
  lastTap?: TapEvent | null;
  className?: string;
}

export function getComboTier(streak: number): ComboTier {
  if (streak >= 20) return "overdrive";
  if (streak >= 10) return "turbo";
  if (streak >= 5) return "combo";
  return "normal";
}

function getChipText(streak: number, tier: ComboTier): string {
  if (tier === "overdrive") {
    const overdriveTexts = [
      "💥 OVERDRIVE x5!",
      "💥 MAXIMUM PULL!",
      "⚡ UNSTOPPABLE!",
      `💥 ${streak}x HYPER!`,
    ];
    return overdriveTexts[Math.floor(Math.random() * overdriveTexts.length)]!;
  }
  if (tier === "turbo") {
    const turboTexts = [
      "🔥 TURBO x3!",
      "🔥 ON FIRE!",
      "🔥 10x BURST!",
      `🔥 ${streak}x STREAK!`,
    ];
    return turboTexts[Math.floor(Math.random() * turboTexts.length)]!;
  }
  if (tier === "combo") {
    const comboTexts = [
      "⚡ COMBO x2!",
      "⚡ CRITICAL PULL!",
      `⚡ ${streak}x COMBO!`,
      "+2 POWER!",
    ];
    return comboTexts[Math.floor(Math.random() * comboTexts.length)]!;
  }
  const normalTexts = ["+1", "+1 PULL", "PULL ⚡", "+1!"];
  return normalTexts[Math.floor(Math.random() * normalTexts.length)]!;
}

export const TapComboOverlay: React.FC<TapComboOverlayProps> = ({
  lastTap = null,
  className = "",
}) => {
  const [chips, setChips] = useState<FloatingChip[]>([]);
  const [shockwaves, setShockwaves] = useState<ActiveShockwave[]>([]);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const processedIdRef = useRef<number | string | null>(null);

  // Clear all pending timeouts on unmount to guarantee zero memory leaks
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  // Process incoming tap events
  useEffect(() => {
    if (!lastTap || lastTap.id === processedIdRef.current) return;
    processedIdRef.current = lastTap.id;

    const tier = getComboTier(lastTap.streak);
    const chipText = getChipText(lastTap.streak, tier);
    const chipId = `chip_${lastTap.id}_${Math.random().toString(36).slice(2, 7)}`;
    const waveId = `wave_${lastTap.id}_${Math.random().toString(36).slice(2, 7)}`;

    // Randomize upward floating trajectory
    const dx = (Math.random() - 0.5) * 50; // -25px to +25px drift
    const dy = -(70 + Math.random() * 45); // -70px to -115px upwards
    const rotation = (Math.random() - 0.5) * 16; // -8deg to +8deg

    const newChip: FloatingChip = {
      id: chipId,
      x: lastTap.x,
      y: lastTap.y,
      dx,
      dy,
      rotation,
      text: chipText,
      tier,
      team: lastTap.team,
    };

    const newWave: ActiveShockwave = {
      id: waveId,
      x: lastTap.x,
      y: lastTap.y,
      tier,
      team: lastTap.team,
    };

    // Cap maximum active particles to 20 for optimal mobile rendering performance
    setChips((prev) => [...prev.slice(-19), newChip]);
    setShockwaves((prev) => [...prev.slice(-14), newWave]);

    // Timers for scheduled removal
    const chipTimer = setTimeout(() => {
      setChips((prev) => prev.filter((c) => c.id !== chipId));
      timersRef.current.delete(chipTimer);
    }, 850);
    timersRef.current.add(chipTimer);

    const waveTimer = setTimeout(() => {
      setShockwaves((prev) => prev.filter((w) => w.id !== waveId));
      timersRef.current.delete(waveTimer);
    }, 550);
    timersRef.current.add(waveTimer);
  }, [lastTap]);

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 pointer-events-none overflow-hidden z-40 select-none ${className}`}
    >
      {/* 1. Multi-Layer Shockwave Rings */}
      {shockwaves.map((wave) => {
        const isLeft = wave.team === "left";
        const isOverdrive = wave.tier === "overdrive";
        const isTurbo = wave.tier === "turbo";
        const isCombo = wave.tier === "combo";

        let outerColor = isLeft ? "border-cyan-400" : "border-amber-400";
        let innerColor = isLeft ? "bg-cyan-400/30 border-cyan-200" : "bg-amber-400/30 border-amber-200";

        if (isOverdrive) {
          outerColor = "border-fuchsia-400 shadow-[0_0_30px_rgba(217,70,239,0.8)]";
          innerColor = "bg-gradient-to-r from-red-500/40 via-amber-400/40 to-fuchsia-500/40 border-yellow-200";
        } else if (isTurbo) {
          outerColor = "border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.8)]";
          innerColor = "bg-orange-500/30 border-amber-300";
        } else if (isCombo) {
          outerColor = isLeft ? "border-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.7)]" : "border-amber-300 shadow-[0_0_15px_rgba(255,107,0,0.7)]";
        }

        return (
          <div
            key={wave.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: wave.x, top: wave.y }}
          >
            {/* Outer Shockwave Ring */}
            <div
              className={`w-28 h-28 rounded-full border-2 animate-shockwave-outer ${outerColor}`}
            />
            {/* Inner High-Density Shockwave Ring */}
            <div
              className={`absolute inset-0 m-auto w-16 h-16 rounded-full border-2 animate-shockwave-inner ${innerColor}`}
            />
            {/* Overdrive Spark Pulse Ring */}
            {isOverdrive && (
              <div
                className="absolute inset-0 m-auto w-24 h-24 rounded-full border border-yellow-300 animate-ping opacity-75"
              />
            )}
          </div>
        );
      })}

      {/* 2. Floating Score Popup Chips */}
      {chips.map((chip) => {
        const isLeft = chip.team === "left";
        const isOverdrive = chip.tier === "overdrive";
        const isTurbo = chip.tier === "turbo";
        const isCombo = chip.tier === "combo";

        let chipStyle = "bg-slate-900/90 text-white border border-slate-700/80 shadow-md";
        let glowStyle = "";

        if (isOverdrive) {
          chipStyle =
            "bg-gradient-to-r from-red-600 via-amber-500 to-fuchsia-600 text-slate-950 font-black border-2 border-yellow-300 animate-overdrive-aura";
          glowStyle = "shadow-[0_0_25px_rgba(239,68,68,0.9),0_0_10px_rgba(251,191,36,0.8)]";
        } else if (isTurbo) {
          chipStyle =
            "bg-gradient-to-r from-orange-600 via-amber-500 to-red-600 text-slate-950 font-black border-2 border-amber-300";
          glowStyle = "shadow-[0_0_20px_rgba(249,115,22,0.85)]";
        } else if (isCombo) {
          chipStyle = isLeft
            ? "bg-slate-950/90 text-cyan-300 border-2 border-cyan-400 box-glow-cyan"
            : "bg-slate-950/90 text-amber-300 border-2 border-amber-400 box-glow-amber";
          glowStyle = isLeft ? "shadow-[0_0_15px_rgba(0,240,255,0.7)]" : "shadow-[0_0_15px_rgba(255,107,0,0.7)]";
        } else {
          chipStyle = isLeft
            ? "bg-slate-950/80 text-cyan-200 border border-cyan-500/60"
            : "bg-slate-950/80 text-amber-200 border border-amber-500/60";
        }

        return (
          <div
            key={chip.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-out"
            style={{
              left: `calc(${chip.x}px + ${chip.dx}px)`,
              top: `calc(${chip.y}px + ${chip.dy}px)`,
              transform: `translate(-50%, -50%) rotate(${chip.rotation}deg)`,
              animation: "chipPopFade 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            }}
          >
            <div
              className={`px-3 py-1 rounded-full text-xs md:text-sm font-mono-condensed uppercase tracking-wider backdrop-blur-md flex items-center gap-1 ${chipStyle} ${glowStyle}`}
            >
              <span>{chip.text}</span>
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes chipPopFade {
          0% {
            opacity: 0;
            transform: translate(-50%, 10px) scale(0.6);
          }
          15% {
            opacity: 1;
            transform: translate(-50%, -15px) scale(1.18);
          }
          70% {
            opacity: 0.95;
            transform: translate(-50%, -45px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -75px) scale(0.85);
          }
        }
      `}</style>
    </div>
  );
};
