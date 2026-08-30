import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Users, Zap } from "lucide-react";
import { useGameStore } from "../../store/useGameStore.js";

export const WelcomeScene: React.FC = () => {
  const { counts, phase } = useGameStore();
  const [qrUrl, setQrUrl] = useState<string>("");

  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/join` : "https://tow.local/join";

  useEffect(() => {
    QRCode.toDataURL(joinUrl, {
      width: 340,
      margin: 1,
      color: {
        dark: "#00f2fe",
        light: "#04070d",
      },
    })
      .then(setQrUrl)
      .catch(() => {});
  }, [joinUrl]);

  const leftPercent = counts.total > 0 ? Math.round((counts.left / counts.total) * 100) : 50;
  const rightPercent = counts.total > 0 ? 100 - leftPercent : 50;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-8 md:p-14 overflow-hidden bg-arena-broadcast select-none">
      {/* Background Stadium Atmosphere */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[var(--cyan)]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-[var(--amber)]/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Match Title Banner */}
      <header className="text-center z-10 space-y-2">
        <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full border border-[var(--cyan)]/40 bg-cyan-950/60 text-[var(--cyan)] text-xs tracking-widest uppercase font-mono-condensed font-bold">
          <Zap className="w-4 h-4 text-[var(--cyan)]" />
          TECHNICAL CLUB ORIENTATION • ARENA ARENA BATTLE
        </div>
        <h1 className="text-6xl md:text-8xl font-display uppercase tracking-wider text-white drop-shadow-[0_0_35px_rgba(0,242,254,0.4)]">
          Tug of War
        </h1>
        <p className="text-sm md:text-base text-slate-300 font-mono-condensed tracking-wider">
          {phase === "OPEN" ? "LOBBY OPEN • CHOOSE YOUR TEAM ON YOUR MOBILE DEVICE" : "PREPARING FOR ARENA LAUNCH"}
        </p>
      </header>

      {/* Center: QR Code Gate & Dual Team Portals */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-10 z-10 max-w-6xl w-full my-auto">
        {/* Left Team (CYAN) Portal */}
        <div className="flex-1 w-full bg-[var(--stage-card)]/90 border-2 border-[var(--cyan)]/50 rounded-3xl p-8 backdrop-blur-xl flex flex-col items-center text-center box-glow-cyan">
          <span className="text-xs font-mono-condensed tracking-widest text-[var(--cyan)] uppercase font-bold">
            TEAM SECTOR
          </span>
          <h2 className="text-5xl md:text-6xl font-display text-[var(--cyan)] text-glow-cyan mt-2">
            CYAN
          </h2>
          <strong className="text-7xl md:text-8xl font-mono-condensed font-black text-white mt-3 leading-none">
            {counts.left}
          </strong>
          <span className="text-xs text-slate-400 mt-3 font-mono-condensed tracking-wider">
            WARRIORS ENLISTED
          </span>
        </div>

        {/* QR Code Center Gateway */}
        <div className="shrink-0 flex flex-col items-center bg-[var(--stage-card)] border-2 border-[var(--line-bright)] rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
          <div className="relative p-3 bg-[#04070d] rounded-2xl border border-[var(--line)]">
            {qrUrl ? (
              <img src={qrUrl} alt="Scan to Join" className="w-48 h-48 md:w-60 md:h-60 rounded-xl" />
            ) : (
              <div className="w-48 h-48 md:w-60 md:h-60 flex items-center justify-center text-slate-500 font-mono-condensed">
                Generating QR...
              </div>
            )}
          </div>
          <div className="mt-4 text-center">
            <div className="text-base font-display tracking-widest text-white uppercase">SCAN TO ENTER ARENA</div>
            <div className="text-xs text-[var(--cyan)] font-mono-condensed mt-1 font-bold">{joinUrl}</div>
          </div>
        </div>

        {/* Right Team (AMBER) Portal */}
        <div className="flex-1 w-full bg-[var(--stage-card)]/90 border-2 border-[var(--amber)]/50 rounded-3xl p-8 backdrop-blur-xl flex flex-col items-center text-center box-glow-amber">
          <span className="text-xs font-mono-condensed tracking-widest text-[var(--amber)] uppercase font-bold">
            TEAM SECTOR
          </span>
          <h2 className="text-5xl md:text-6xl font-display text-[var(--amber)] text-glow-amber mt-2">
            AMBER
          </h2>
          <strong className="text-7xl md:text-8xl font-mono-condensed font-black text-white mt-3 leading-none">
            {counts.right}
          </strong>
          <span className="text-xs text-slate-400 mt-3 font-mono-condensed tracking-wider">
            WARRIORS ENLISTED
          </span>
        </div>
      </div>

      {/* Bottom Bar: Total Participants & Balance Gauge */}
      <footer className="w-full max-w-5xl z-10 space-y-3">
        <div className="flex items-center justify-between text-xs md:text-sm font-mono-condensed text-slate-300">
          <div className="flex items-center gap-2 text-[var(--cyan)] font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--cyan)] animate-ping" />
            CYAN {leftPercent}%
          </div>
          <div className="flex items-center gap-2 text-white font-bold tracking-wider">
            <Users className="w-4 h-4 text-[var(--muted)]" />
            TOTAL {counts.total} PARTICIPANTS ({counts.online} ONLINE)
          </div>
          <div className="flex items-center gap-2 text-[var(--amber)] font-bold">
            AMBER {rightPercent}%
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--amber)] animate-ping" />
          </div>
        </div>

        {/* Balance Distribution Bar */}
        <div className="h-3.5 w-full bg-[#04070d] rounded-full overflow-hidden flex border border-[var(--line-bright)] p-0.5">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300 rounded-l-full transition-all duration-300"
            style={{ width: `${leftPercent}%` }}
          />
          <div
            className="h-full bg-gradient-to-l from-amber-500 to-amber-300 rounded-r-full transition-all duration-300"
            style={{ width: `${rightPercent}%` }}
          />
        </div>
      </footer>
    </div>
  );
};
