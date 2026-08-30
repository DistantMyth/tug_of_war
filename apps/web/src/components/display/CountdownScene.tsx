import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Zap, Shield, Radio } from "lucide-react";
import { useGameStore } from "../../store/useGameStore.js";
import { ParticleBackground } from "../common/ParticleBackground.js";
import { CyberTitanCrest, SolarPhoenixCrest } from "../common/TeamBadges.js";

export const CountdownScene: React.FC = () => {
  const { timing, counts } = useGameStore();
  const [displayCount, setDisplayCount] = useState<string>("3");
  const [shockwaveKey, setShockwaveKey] = useState<number>(0);
  const [isRumbling, setIsRumbling] = useState<boolean>(false);
  const numberRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateCountdown = () => {
      const endsAt = timing.countdownEndsAt ?? Date.now() + 3000;
      const remainingMs = Math.max(0, endsAt - Date.now());
      const remainingSec = Math.ceil(remainingMs / 1000);

      let text = "3";
      if (remainingSec >= 3) text = "3";
      else if (remainingSec === 2) text = "2";
      else if (remainingSec === 1) text = "1";
      else text = "GO!";

      setDisplayCount(text);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 80);
    return () => clearInterval(interval);
  }, [timing.countdownEndsAt]);

  // Handle number animation & screen shake whenever displayCount changes
  useEffect(() => {
    setShockwaveKey(Date.now());
    setIsRumbling(true);
    const timer = setTimeout(() => setIsRumbling(false), 200);

    if (numberRef.current) {
      gsap.killTweensOf(numberRef.current);
      gsap.fromTo(
        numberRef.current,
        {
          scale: 0.15,
          opacity: 0,
          rotation: displayCount === "GO!" ? -18 : -10,
          filter: "brightness(2.5)",
        },
        {
          scale: displayCount === "GO!" ? 1.3 : 1.15,
          opacity: 1,
          rotation: 0,
          filter: "brightness(1)",
          duration: displayCount === "GO!" ? 0.45 : 0.35,
          ease: "back.out(2.2)",
        },
      );
    }

    return () => clearTimeout(timer);
  }, [displayCount]);

  const isGo = displayCount === "GO!";

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex flex-col items-center justify-between p-6 md:p-12 overflow-hidden bg-arena-broadcast select-none transition-transform ${
        isRumbling ? "animate-screen-shake" : ""
      }`}
    >
      {/* Dynamic Floating Particles */}
      <ParticleBackground mode="battle" intensity="high" />

      {/* Atmospheric Stadium Spotlight Glows */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--cyan)]/15 rounded-full blur-[180px] pointer-events-none animate-pulse" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--amber)]/15 rounded-full blur-[180px] pointer-events-none animate-pulse" />

      {/* TOP BROADCAST HEADER */}
      <header className="text-center z-20 space-y-2 mt-2">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/40 bg-cyan-950/60 text-xs font-mono-condensed tracking-widest text-[var(--cyan)] uppercase font-bold backdrop-blur-md">
          <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
          <span>TOURNAMENT MATCH LAUNCH</span>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
        </div>
        <h2 className="text-3xl md:text-5xl font-display text-white uppercase tracking-widest drop-shadow-[0_0_25px_rgba(255,255,255,0.4)]">
          Get Ready To Tap!
        </h2>
      </header>

      {/* CENTER CINEMATIC COUNTDOWN ARENA */}
      <div className="relative w-full max-w-7xl flex items-center justify-between my-auto z-20 px-4 md:px-12">
        {/* LEFT TEAM BANNER SPOTLIGHT (CYBER TITAN / CYAN) */}
        <div className="hidden lg:flex flex-col items-start w-64 p-6 rounded-3xl bg-gradient-to-br from-cyan-950/70 to-[#041220]/80 border-2 border-cyan-500/40 backdrop-blur-xl shadow-[0_0_40px_rgba(0,240,255,0.2)]">
          <div className="flex items-center gap-3">
            <CyberTitanCrest size={56} className="shrink-0" />
            <div>
              <span className="text-[10px] font-mono-condensed font-bold tracking-widest text-cyan-400 uppercase">
                WEST SECTOR
              </span>
              <h3 className="text-2xl font-display text-cyan-300 uppercase tracking-wider text-glow-cyan">
                CYBER TITANS
              </h3>
            </div>
          </div>
          <div className="mt-4 w-full flex items-center justify-between pt-3 border-t border-cyan-500/20 text-xs font-mono-condensed">
            <span className="text-slate-400">ENLISTED SQUAD</span>
            <span className="text-cyan-300 font-bold px-2 py-0.5 bg-cyan-950/80 rounded border border-cyan-500/40">
              {counts.left} WARRIORS
            </span>
          </div>
        </div>

        {/* CENTER CINEMATIC 3-2-1-GO BLAST SYSTEM */}
        <div className="relative flex items-center justify-center flex-1 min-h-[340px]">
          {/* Expanding Shockwave Rings on Number Change */}
          <div key={`shockwave-${shockwaveKey}`} className="absolute pointer-events-none">
            <div
              className={`w-64 h-64 md:w-96 md:h-96 rounded-full border-4 ${
                isGo
                  ? "border-emerald-400 shadow-[0_0_80px_#10b981]"
                  : "border-cyan-400/80 shadow-[0_0_60px_#00f0ff]"
              } animate-shockwave-outer`}
            />
            <div
              className={`w-48 h-48 md:w-72 md:h-72 rounded-full border-2 ${
                isGo ? "border-emerald-300" : "border-amber-400/80"
              } animate-shockwave-inner`}
            />
          </div>

          {/* Spinning Energy HUD Rings */}
          <div className="absolute w-72 h-72 md:w-[460px] md:h-[460px] pointer-events-none flex items-center justify-center">
            {/* Outer HUD Ring */}
            <div
              className="absolute inset-0 rounded-full border border-dashed border-cyan-400/25 animate-spin-slow"
              style={{ animationDuration: "24s" }}
            />
            {/* Inner Reverse HUD Reticle */}
            <div
              className="absolute inset-8 rounded-full border border-amber-400/20 animate-spin-slow"
              style={{ animationDirection: "reverse", animationDuration: "16s" }}
            />
            {/* Tech Crosshair Accents */}
            <div className="absolute top-0 w-3 h-1 bg-cyan-400/80 shadow-[0_0_8px_#00f0ff]" />
            <div className="absolute bottom-0 w-3 h-1 bg-cyan-400/80 shadow-[0_0_8px_#00f0ff]" />
            <div className="absolute left-0 w-1 h-3 bg-amber-400/80 shadow-[0_0_8px_#ff9900]" />
            <div className="absolute right-0 w-1 h-3 bg-amber-400/80 shadow-[0_0_8px_#ff9900]" />
          </div>

          {/* Giant Blast Countdown Number */}
          <div
            ref={numberRef}
            className={`z-20 font-display text-9xl md:text-[18rem] font-black uppercase tracking-tight select-none leading-none will-change-transform ${
              isGo
                ? "text-emerald-300 text-glow-cyan drop-shadow-[0_0_120px_rgba(16,185,129,1)]"
                : "text-white drop-shadow-[0_0_80px_rgba(255,255,255,0.9)]"
            }`}
          >
            {displayCount}
          </div>
        </div>

        {/* RIGHT TEAM BANNER SPOTLIGHT (SOLAR PHOENIX / AMBER) */}
        <div className="hidden lg:flex flex-col items-end w-64 p-6 rounded-3xl bg-gradient-to-bl from-amber-950/70 to-[#200e04]/80 border-2 border-amber-500/40 backdrop-blur-xl shadow-[0_0_40px_rgba(255,107,0,0.2)] text-right">
          <div className="flex items-center gap-3 flex-row-reverse">
            <SolarPhoenixCrest size={56} className="shrink-0" />
            <div>
              <span className="text-[10px] font-mono-condensed font-bold tracking-widest text-amber-400 uppercase">
                EAST SECTOR
              </span>
              <h3 className="text-2xl font-display text-amber-300 uppercase tracking-wider text-glow-amber">
                SOLAR PHOENIX
              </h3>
            </div>
          </div>
          <div className="mt-4 w-full flex items-center justify-between pt-3 border-t border-amber-500/20 text-xs font-mono-condensed">
            <span className="text-amber-300 font-bold px-2 py-0.5 bg-amber-950/80 rounded border border-amber-500/40">
              {counts.right} WARRIORS
            </span>
            <span className="text-slate-400">ENLISTED SQUAD</span>
          </div>
        </div>
      </div>

      {/* BOTTOM BROADCAST FOOTER */}
      <footer className="z-20 flex flex-col items-center gap-2 mb-2 text-center">
        <div className="text-xs md:text-sm font-mono-condensed text-slate-300 tracking-widest uppercase">
          PREPARE YOUR DEVICE • SERVER CLOCK SYNCHRONIZED
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono-condensed text-slate-500">
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-cyan-400" /> RAPID TAP ENGAGEMENT
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-amber-400" /> ANTI-CHEAT VERIFIED
          </span>
        </div>
      </footer>
    </div>
  );
};
