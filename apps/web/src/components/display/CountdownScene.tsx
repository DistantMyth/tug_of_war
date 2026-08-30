import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGameStore } from "../../store/useGameStore.js";

export const CountdownScene: React.FC = () => {
  const { timing } = useGameStore();
  const [displayCount, setDisplayCount] = useState<string>("3");
  const numberRef = useRef<HTMLDivElement>(null);

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

      setDisplayCount((prev) => {
        if (prev !== text && numberRef.current) {
          gsap.fromTo(
            numberRef.current,
            { scale: 0.3, opacity: 0, rotation: -12 },
            { scale: 1.15, opacity: 1, rotation: 0, duration: 0.35, ease: "back.out(2)" },
          );
        }
        return text;
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 100);
    return () => clearInterval(interval);
  }, [timing.countdownEndsAt]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-8 overflow-hidden bg-arena-broadcast select-none">
      {/* Background Stadium Glows */}
      <div className="absolute w-[800px] h-[800px] bg-gradient-to-r from-[var(--cyan)]/20 via-transparent to-[var(--amber)]/20 rounded-full blur-[180px] pointer-events-none animate-pulse" />

      {/* Top Text */}
      <header className="text-center z-10 space-y-2 mb-6">
        <div className="text-xs font-mono-condensed tracking-widest text-[var(--cyan)] uppercase font-bold">
          TOURNAMENT MATCH LAUNCH
        </div>
        <h2 className="text-3xl md:text-5xl font-display text-white uppercase tracking-widest">
          Get Ready To Tap!
        </h2>
      </header>

      {/* Giant Cinematic Countdown Number */}
      <div
        ref={numberRef}
        className={`z-10 font-display text-9xl md:text-[18rem] font-black uppercase tracking-tight select-none leading-none ${
          displayCount === "GO!"
            ? "text-emerald-400 text-glow-cyan drop-shadow-[0_0_100px_rgba(16,185,129,1)]"
            : "text-white drop-shadow-[0_0_60px_rgba(255,255,255,0.8)]"
        }`}
      >
        {displayCount}
      </div>

      {/* Bottom Subtitle */}
      <footer className="z-10 text-sm md:text-base font-mono-condensed text-slate-300 mt-8 tracking-widest uppercase">
        PREPARE YOUR DEVICE • SERVER CLOCK SYNCHRONIZED
      </footer>
    </div>
  );
};
