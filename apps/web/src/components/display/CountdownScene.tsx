import { useEffect, useRef, useState } from "react";
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
            { scale: 0.4, opacity: 0, rotation: -10 },
            { scale: 1.1, opacity: 1, rotation: 0, duration: 0.35, ease: "back.out(2)" },
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
    <div className="relative w-full h-full flex flex-col items-center justify-center p-8 overflow-hidden bg-cyber-grid">
      {/* Background Shockwave Glows */}
      <div className="absolute inset-0 bg-radial-vignette pointer-events-none" />
      <div className="absolute w-[800px] h-[800px] bg-gradient-to-r from-cyan-500/20 via-transparent to-amber-500/20 rounded-full blur-[160px] pointer-events-none animate-pulse" />

      {/* Top Text */}
      <div className="text-center z-10 space-y-2 mb-6">
        <div className="text-xs font-mono-condensed tracking-widest text-slate-400 uppercase">
          Match Launching
        </div>
        <h2 className="text-2xl md:text-3xl font-display text-slate-200 uppercase tracking-widest">
          Get Ready To Tap!
        </h2>
      </div>

      {/* Giant Cinematic Number */}
      <div
        ref={numberRef}
        className={`z-10 font-display text-8xl md:text-[14rem] font-black uppercase tracking-tight select-none ${
          displayCount === "GO!"
            ? "text-emerald-400 text-glow-cyan drop-shadow-[0_0_80px_rgba(16,185,129,0.9)]"
            : "text-slate-100 drop-shadow-[0_0_50px_rgba(255,255,255,0.7)]"
        }`}
      >
        {displayCount}
      </div>

      {/* Bottom Subtitle */}
      <div className="z-10 text-sm md:text-base font-mono-condensed text-slate-400 mt-8 tracking-widest">
        WARM UP YOUR FINGERS • SERVER CLOCK SYNCHRONIZED
      </div>
    </div>
  );
};
