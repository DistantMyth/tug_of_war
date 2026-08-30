import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Users, Zap, Smartphone } from "lucide-react";
import { useGameStore } from "../../store/useGameStore.js";
import { ParticleBackground } from "../common/ParticleBackground.js";
import { CyberTitanCrest, SolarPhoenixCrest } from "../common/TeamBadges.js";

export const WelcomeScene: React.FC = () => {
  const { counts, phase } = useGameStore();
  const [qrUrl, setQrUrl] = useState<string>("");
  const [activeJoinUrl, setActiveJoinUrl] = useState<string>(() => {
    if (typeof window === "undefined") return "https://tow.local/join";
    // Check URL query parameter override e.g. ?joinUrl=https://xyz.loca.lt/join
    const params = new URLSearchParams(window.location.search);
    const override = params.get("joinUrl");
    if (override) return override;
    return `${window.location.origin}/join`;
  });

  useEffect(() => {
    // If running on localhost / 127.0.0.1 without override, fetch the server's real LAN IP or Tunnel URL
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (!params.get("joinUrl") && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
        fetch("/api/network")
          .then((res) => res.json())
          .then((data) => {
            if (data.ok && data.joinUrl) {
              setActiveJoinUrl(data.joinUrl);
            }
          })
          .catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    if (!activeJoinUrl) return;
    QRCode.toDataURL(activeJoinUrl, {
      width: 340,
      margin: 1,
      color: {
        dark: "#00f2fe",
        light: "#04070d",
      },
    })
      .then(setQrUrl)
      .catch(() => {});
  }, [activeJoinUrl]);

  const leftPercent = counts.total > 0 ? Math.round((counts.left / counts.total) * 100) : 50;
  const rightPercent = counts.total > 0 ? 100 - leftPercent : 50;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-6 md:p-12 overflow-hidden bg-arena-broadcast select-none">
      {/* Floating Ambient Atmosphere Particles */}
      <ParticleBackground mode="stadium" intensity="medium" />

      {/* Stadium Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-[540px] h-[540px] bg-[var(--cyan)]/12 rounded-full blur-[160px] pointer-events-none animate-pulse" />
      <div className="absolute top-1/4 right-1/4 w-[540px] h-[540px] bg-[var(--amber)]/12 rounded-full blur-[160px] pointer-events-none animate-pulse" />

      {/* TOP MATCH BANNER */}
      <header className="text-center z-20 space-y-2 mt-2">
        <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full border border-[var(--cyan)]/40 bg-cyan-950/70 text-[var(--cyan)] text-xs tracking-widest uppercase font-mono-condensed font-bold backdrop-blur-md shadow-[0_0_20px_rgba(0,240,255,0.2)]">
          <Zap className="w-4 h-4 text-[var(--cyan)] animate-pulse" />
          <span>TECHNICAL CLUB ORIENTATION • ARENA BATTLE</span>
        </div>
        <h1 className="text-6xl md:text-8xl font-display uppercase tracking-wider text-white drop-shadow-[0_0_35px_rgba(0,242,254,0.4)]">
          Tug of War
        </h1>
        <p className="text-sm md:text-base text-slate-300 font-mono-condensed tracking-wider">
          {phase === "OPEN" ? "LOBBY OPEN • CHOOSE YOUR TEAM ON YOUR MOBILE DEVICE" : "PREPARING FOR ARENA LAUNCH"}
        </p>
      </header>

      {/* CENTER: TEAM SECTORS & GLOWING QR GATEWAY */}
      <div className="flex flex-col lg:flex-row items-center justify-center gap-6 md:gap-10 z-20 max-w-6xl w-full my-auto">
        {/* Left Team (CYAN) Sector Card */}
        <div className="flex-1 w-full bg-gradient-to-b from-cyan-950/70 to-[#041220]/90 border-2 border-[var(--cyan)]/50 rounded-3xl p-6 md:p-8 backdrop-blur-xl flex flex-col items-center text-center box-glow-cyan shadow-2xl">
          <CyberTitanCrest size={64} className="mb-2" />
          <span className="text-xs font-mono-condensed tracking-widest text-[var(--cyan)] uppercase font-bold">
            WEST SECTOR • TEAM CYAN
          </span>
          <h2 className="text-4xl md:text-5xl font-display text-[var(--cyan)] text-glow-cyan mt-1">
            CYAN
          </h2>
          <strong className="text-7xl md:text-8xl font-mono-condensed font-black text-white mt-2 leading-none">
            {counts.left}
          </strong>
          <span className="text-xs text-slate-400 mt-2 font-mono-condensed tracking-wider">
            WARRIORS ENLISTED
          </span>
          <div className="mt-4 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-[11px] font-mono-condensed text-cyan-300">
            ⚡ CYBER TITANS SQUAD
          </div>
        </div>

        {/* QR Code Center Gateway with Scanning Laser Frame */}
        <div className="shrink-0 flex flex-col items-center bg-[var(--stage-card)]/95 border-2 border-[var(--line-bright)] rounded-3xl p-6 shadow-2xl backdrop-blur-2xl relative">
          {/* Cyber HUD Corner Reticles */}
          <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
          <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-amber-400" />
          <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
          <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-amber-400" />

          {/* QR Frame with Laser Scanner */}
          <div className="relative p-3.5 bg-[#04070d] rounded-2xl border border-[var(--line)] overflow-hidden">
            {/* Animated Laser Scanning Line */}
            <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#00f0ff] animate-laser-scan z-10 pointer-events-none" />

            {qrUrl ? (
              <img
                src={qrUrl}
                alt="Scan to Join"
                className="w-44 h-44 md:w-56 md:h-56 rounded-xl relative z-0"
              />
            ) : (
              <div className="w-44 h-44 md:w-56 md:h-56 flex items-center justify-center text-slate-500 font-mono-condensed">
                Generating QR...
              </div>
            )}
          </div>

          <div className="mt-4 text-center space-y-1">
            <div className="text-base font-display tracking-widest text-white uppercase flex items-center justify-center gap-1.5">
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <span>SCAN TO ENTER ARENA</span>
            </div>
            <div className="text-xs text-[var(--cyan)] font-mono-condensed font-bold tracking-wider">
              {activeJoinUrl}
            </div>
          </div>
        </div>

        {/* Right Team (AMBER) Sector Card */}
        <div className="flex-1 w-full bg-gradient-to-b from-amber-950/70 to-[#200e04]/90 border-2 border-[var(--amber)]/50 rounded-3xl p-6 md:p-8 backdrop-blur-xl flex flex-col items-center text-center box-glow-amber shadow-2xl">
          <SolarPhoenixCrest size={64} className="mb-2" />
          <span className="text-xs font-mono-condensed tracking-widest text-[var(--amber)] uppercase font-bold">
            EAST SECTOR • TEAM AMBER
          </span>
          <h2 className="text-4xl md:text-5xl font-display text-[var(--amber)] text-glow-amber mt-1">
            AMBER
          </h2>
          <strong className="text-7xl md:text-8xl font-mono-condensed font-black text-white mt-2 leading-none">
            {counts.right}
          </strong>
          <span className="text-xs text-slate-400 mt-2 font-mono-condensed tracking-wider">
            WARRIORS ENLISTED
          </span>
          <div className="mt-4 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-500/30 text-[11px] font-mono-condensed text-amber-300">
            🔥 SOLAR PHOENIX SQUAD
          </div>
        </div>
      </div>

      {/* BOTTOM BAR: LIVE BALANCE METER & ROSTER METRICS */}
      <footer className="w-full max-w-5xl z-20 space-y-3 mb-2">
        <div className="flex items-center justify-between text-xs md:text-sm font-mono-condensed text-slate-300">
          <div className="flex items-center gap-2 text-[var(--cyan)] font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--cyan)] animate-ping" />
            <span>CYAN {leftPercent}%</span>
          </div>
          <div className="flex items-center gap-2 text-white font-bold tracking-wider">
            <Users className="w-4 h-4 text-slate-400" />
            <span>TOTAL {counts.total} PARTICIPANTS ({counts.online} ONLINE)</span>
          </div>
          <div className="flex items-center gap-2 text-[var(--amber)] font-bold">
            <span>AMBER {rightPercent}%</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--amber)] animate-ping" />
          </div>
        </div>

        {/* Live Balance Distribution Bar */}
        <div className="relative h-4 w-full bg-[#04070d] rounded-full overflow-hidden flex border border-[var(--line-bright)] p-0.5 shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-cyan-600 via-cyan-400 to-cyan-300 rounded-l-full transition-all duration-300"
            style={{ width: `${leftPercent}%` }}
          />
          <div
            className="h-full bg-gradient-to-l from-amber-600 via-amber-400 to-amber-300 rounded-r-full transition-all duration-300"
            style={{ width: `${rightPercent}%` }}
          />
          {/* Centered Target Equilibrium Marker */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 bg-white shadow-[0_0_8px_#fff]" />
        </div>
      </footer>
    </div>
  );
};
