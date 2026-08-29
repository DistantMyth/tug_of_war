import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Users, Zap } from "lucide-react";
import { useGameStore } from "../../store/useGameStore.js";

export const WelcomeScene: React.FC = () => {
  const { counts, phase } = useGameStore();
  const [qrUrl, setQrUrl] = useState<string>("");

  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/join` : "https://tow.local/join";

  useEffect(() => {
    QRCode.toDataURL(joinUrl, {
      width: 320,
      margin: 1,
      color: {
        dark: "#00f0ff",
        light: "#07090e",
      },
    })
      .then(setQrUrl)
      .catch(() => {});
  }, [joinUrl]);

  const leftPercent = counts.total > 0 ? Math.round((counts.left / counts.total) * 100) : 50;
  const rightPercent = counts.total > 0 ? 100 - leftPercent : 50;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-8 md:p-12 overflow-hidden bg-cyber-grid">
      {/* Ambient Backlight Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Banner */}
      <div className="text-center z-10 space-y-2">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/40 text-cyan-400 text-xs tracking-widest uppercase font-mono-condensed">
          <Zap className="w-4 h-4 text-cyan-400" />
          Technical Club Orientation Battle
        </div>
        <h1 className="text-5xl md:text-7xl font-display uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-slate-100 to-amber-400 drop-shadow-lg">
          Tug of War
        </h1>
        <p className="text-sm md:text-base text-slate-400 font-mono-condensed">
          {phase === "OPEN" ? "LOBBY OPEN — CHOOSE YOUR SIDE" : "PREPARING FOR BATTLE"}
        </p>
      </div>

      {/* Center: Big QR Code + Live Counts */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-12 z-10 max-w-5xl w-full">
        {/* Left Team Card */}
        <div className="flex-1 w-full bg-slate-900/60 border border-cyan-500/40 rounded-3xl p-8 backdrop-blur-xl flex flex-col items-center text-center box-glow-cyan">
          <div className="text-xs font-mono-condensed tracking-widest text-cyan-400 uppercase">Team Signal</div>
          <div className="text-4xl md:text-5xl font-display text-cyan-400 text-glow-cyan mt-2">CYAN</div>
          <div className="text-6xl md:text-7xl font-mono-condensed font-black text-slate-100 mt-4">
            {counts.left}
          </div>
          <div className="text-xs text-slate-400 mt-2 font-mono-condensed">PLAYERS JOINED</div>
        </div>

        {/* QR Code Center Box */}
        <div className="shrink-0 flex flex-col items-center bg-slate-950/90 border-2 border-slate-700/80 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
          <div className="relative p-3 bg-[#07090e] rounded-2xl border border-slate-800">
            {qrUrl ? (
              <img src={qrUrl} alt="Scan to Join" className="w-48 h-48 md:w-56 md:h-56 rounded-xl" />
            ) : (
              <div className="w-48 h-48 md:w-56 md:h-56 flex items-center justify-center text-slate-500 font-mono-condensed">
                Generating QR...
              </div>
            )}
          </div>
          <div className="mt-4 text-center">
            <div className="text-sm font-bold text-slate-200 tracking-wider">SCAN TO JOIN</div>
            <div className="text-xs text-cyan-400 font-mono-condensed mt-0.5">{joinUrl}</div>
          </div>
        </div>

        {/* Right Team Card */}
        <div className="flex-1 w-full bg-slate-900/60 border border-amber-500/40 rounded-3xl p-8 backdrop-blur-xl flex flex-col items-center text-center box-glow-amber">
          <div className="text-xs font-mono-condensed tracking-widest text-amber-400 uppercase">Team Power</div>
          <div className="text-4xl md:text-5xl font-display text-amber-400 text-glow-amber mt-2">AMBER</div>
          <div className="text-6xl md:text-7xl font-mono-condensed font-black text-slate-100 mt-4">
            {counts.right}
          </div>
          <div className="text-xs text-slate-400 mt-2 font-mono-condensed">PLAYERS JOINED</div>
        </div>
      </div>

      {/* Bottom Bar: Total Connected & Split */}
      <div className="w-full max-w-4xl z-10 space-y-3">
        <div className="flex items-center justify-between text-xs md:text-sm font-mono-condensed text-slate-400">
          <div className="flex items-center gap-2 text-cyan-400">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            LEFT {leftPercent}%
          </div>
          <div className="flex items-center gap-2 text-slate-200 font-bold">
            <Users className="w-4 h-4 text-slate-400" />
            TOTAL {counts.total} PARTICIPANTS ({counts.online} ONLINE)
          </div>
          <div className="flex items-center gap-2 text-amber-400">
            RIGHT {rightPercent}%
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
          </div>
        </div>

        {/* Split Bar */}
        <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800 p-0.5">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-l-full transition-all duration-500"
            style={{ width: `${leftPercent}%` }}
          />
          <div
            className="h-full bg-gradient-to-l from-amber-500 to-amber-400 rounded-r-full transition-all duration-500"
            style={{ width: `${rightPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};
