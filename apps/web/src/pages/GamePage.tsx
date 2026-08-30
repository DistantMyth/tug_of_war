import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRightLeft,
  Flame,
  Pause,
  RotateCcw,
  Sparkles,
  Trophy,
  WifiOff,
} from "lucide-react";
import { socketClient } from "../socket/socketClient.js";
import { useConnectionStore } from "../store/useConnectionStore.js";
import { useGameStore } from "../store/useGameStore.js";
import { useSessionStore } from "../store/useSessionStore.js";
import { useUiStore } from "../store/useUiStore.js";
import { BattleHud } from "../components/game/BattleHud.js";

export const GamePage: React.FC = () => {
  const navigate = useNavigate();
  const { token, label, team, chaos } = useSessionStore();
  const { status } = useConnectionStore();
  const { phase, counts, scores, timing, balancePlan, winner, roundNumber } = useGameStore();
  const { addToast } = useUiStore();
  const [tapRipple, setTapRipple] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [remainingTime, setRemainingTime] = useState<string>("00:30.0");

  // Connect player socket on mount
  useEffect(() => {
    if (!token) {
      navigate("/join");
      return;
    }
    socketClient.connect("player", token);
  }, [token, navigate]);

  // Dynamic RAF Timer Loop
  useEffect(() => {
    let frameId: number;
    const tick = () => {
      const now = Date.now();
      const endTime = timing.endTime ?? now + 30000;
      let remainingMs = 0;

      if (phase === "PAUSED" && timing.pausedAt) {
        remainingMs = Math.max(0, endTime - timing.pausedAt);
      } else {
        remainingMs = Math.max(0, endTime - now);
      }

      const totalSec = Math.floor(remainingMs / 1000);
      const minutes = Math.floor(totalSec / 60);
      const seconds = totalSec % 60;
      const decis = Math.floor((remainingMs % 1000) / 100);

      setRemainingTime(`${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${decis}`);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [timing.endTime, timing.pausedAt, phase]);

  // Handle Participant Tap
  const handleTap = async () => {
    if (phase !== "RUNNING" || chaos || !team) return;

    // Haptic vibration feedback if supported
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(12);
    }

    setTapRipple(true);
    setTimeout(() => setTapRipple(false), 250);

    const res = await socketClient.playerTap();
    if (!res.ok) {
      if (res.code === "RATE_LIMITED") {
        addToast({
          type: "warning",
          title: "Pace Yourself",
          description: "Tapping speed capped at 10 taps/sec.",
        });
      }
    }
  };

  // Team Selection
  const handleChooseTeam = async (chosenTeam: "left" | "right") => {
    setActionLoading(true);
    const res = await socketClient.playerChooseTeam(chosenTeam);
    setActionLoading(false);
    if (!res.ok) {
      addToast({ type: "error", title: "Cannot Join Team", description: res.message });
    }
  };

  // Team Switch
  const handleSwitchTeam = async () => {
    if (!team) return;
    const nextTeam = team === "left" ? "right" : "left";
    setActionLoading(true);
    const res = await socketClient.playerSwitchTeam(nextTeam);
    setActionLoading(false);
    if (!res.ok) {
      addToast({ type: "error", title: "Cannot Switch Team", description: res.message });
    }
  };

  // Volunteer Move during Balancing
  const handleVolunteer = async () => {
    setActionLoading(true);
    const res = await socketClient.playerVolunteer();
    setActionLoading(false);
    if (!res.ok) {
      addToast({ type: "error", title: "Volunteer Failed", description: res.message });
    } else {
      addToast({ type: "success", title: "Team Balanced!", description: "Thank you for volunteering." });
    }
  };

  const isLeft = team === "left";
  const isRight = team === "right";

  // Surplus volunteer determination
  const neededLeftToRight = balancePlan?.remainingLeftToRight ?? 0;
  const neededRightToLeft = balancePlan?.remainingRightToLeft ?? 0;
  const canVolunteer = (isLeft && neededLeftToRight > 0) || (isRight && neededRightToLeft > 0);

  return (
    <div className="min-h-screen w-full bg-[#07090e] bg-cyber-grid flex flex-col justify-between p-4 md:p-6 text-slate-100 relative overflow-hidden select-none touch-manipulation">
      {/* Top Header Bar */}
      <div className="w-full flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 font-bold text-xs">
            {label ?? "P-???"}
          </div>
          <div>
            <div className="text-xs font-mono-condensed font-bold text-slate-200">
              {chaos ? "CHAOS WILDCARD" : team ? `TEAM ${team.toUpperCase()}` : "UNASSIGNED"}
            </div>
            <div className="text-[10px] font-mono-condensed text-slate-500">
              ROUND {roundNumber} • {phase}
            </div>
          </div>
        </div>

        {/* Connection status pill */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-mono-condensed">
          {status === "connected" ? (
            <>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 uppercase">ONLINE</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-amber-400 animate-bounce" />
              <span className="text-amber-400 uppercase">RECONNECTING</span>
            </>
          )}
        </div>
      </div>

      {/* ================================================== */}
      {/* 1. CHAOS PLAYER VIEW */}
      {/* ================================================== */}
      {chaos ? (
        <div className="my-auto z-10 flex flex-col items-center text-center p-6 rounded-3xl bg-purple-950/40 border border-purple-500/40 box-glow-violet space-y-6">
          <div className="w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center text-amber-400 animate-pulse">
            <Sparkles className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-mono-condensed uppercase tracking-widest text-amber-400 font-bold">
              Special Assignment
            </div>
            <h2 className="text-3xl font-display text-purple-200 uppercase tracking-wide">
              You are the Chaos Player ⚡
            </h2>
            <p className="text-xs font-mono-condensed text-slate-300 leading-relaxed max-w-xs mx-auto">
              You are the wildcard hero of this round! Your mission is to cheer on both sides, hype the crowd, and keep the battle balanced and unforgettable.
            </p>
          </div>
          <div className="px-4 py-2 rounded-xl bg-purple-900/60 border border-purple-400/30 text-xs font-mono-condensed text-amber-300">
            SPECTATING LIVE ON MAIN DISPLAY
          </div>
        </div>
      ) : null}

      {/* ================================================== */}
      {/* 2. OPEN LOBBY / TEAM SELECTION */}
      {/* ================================================== */}
      {!chaos && (phase === "OPEN" || phase === "WAITING") && (
        <div className="my-auto z-10 w-full max-w-sm mx-auto space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-display uppercase tracking-wide text-slate-100">
              {team ? "Team Chosen" : "Select Your Team"}
            </h2>
            <p className="text-xs font-mono-condensed text-slate-400">
              {team ? "You can switch freely until the host locks the lobby." : "Tap a team below to join the battle."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Left Button */}
            <button
              disabled={actionLoading}
              onClick={() => handleChooseTeam("left")}
              className={`p-6 rounded-2xl border flex flex-col items-center text-center transition-all ${
                isLeft
                  ? "bg-cyan-950/80 border-cyan-400 box-glow-cyan scale-[1.02]"
                  : "bg-slate-900/80 border-slate-800 hover:border-cyan-500/50"
              }`}
            >
              <div className="text-xs font-mono-condensed text-cyan-400 font-bold uppercase">TEAM CYAN</div>
              <div className="text-4xl font-mono-condensed font-black text-slate-100 my-2">{counts.left}</div>
              <div className="text-[10px] font-mono-condensed text-slate-400">
                {isLeft ? "YOUR TEAM ✓" : "JOIN CYAN"}
              </div>
            </button>

            {/* Right Button */}
            <button
              disabled={actionLoading}
              onClick={() => handleChooseTeam("right")}
              className={`p-6 rounded-2xl border flex flex-col items-center text-center transition-all ${
                isRight
                  ? "bg-amber-950/80 border-amber-400 box-glow-amber scale-[1.02]"
                  : "bg-slate-900/80 border-slate-800 hover:border-amber-500/50"
              }`}
            >
              <div className="text-xs font-mono-condensed text-amber-400 font-bold uppercase">TEAM AMBER</div>
              <div className="text-4xl font-mono-condensed font-black text-slate-100 my-2">{counts.right}</div>
              <div className="text-[10px] font-mono-condensed text-slate-400">
                {isRight ? "YOUR TEAM ✓" : "JOIN AMBER"}
              </div>
            </button>
          </div>

          {team && (
            <button
              disabled={actionLoading}
              onClick={handleSwitchTeam}
              className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono-condensed uppercase tracking-wider flex items-center justify-center gap-2 text-slate-300 transition-all"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Switch to {team === "left" ? "Amber" : "Cyan"}
            </button>
          )}
        </div>
      )}

      {/* ================================================== */}
      {/* 3. BALANCING / LOCKING */}
      {/* ================================================== */}
      {!chaos && (phase === "BALANCING" || phase === "LOCKING") && (
        <div className="my-auto z-10 w-full max-w-sm mx-auto space-y-6 text-center">
          <div className="p-4 rounded-full w-16 h-16 bg-amber-500/20 border border-amber-500/40 text-amber-400 mx-auto flex items-center justify-center animate-pulse">
            <ArrowRightLeft className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-display uppercase tracking-wide text-amber-300">
              Team Balancing
            </h2>
            <p className="text-xs font-mono-condensed text-slate-400">
              {canVolunteer
                ? "Your team has surplus players! Help balance the battle."
                : "Waiting for volunteer players to balance teams..."}
            </p>
          </div>

          {canVolunteer ? (
            <button
              disabled={actionLoading}
              onClick={handleVolunteer}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-display text-lg uppercase tracking-wider shadow-[0_0_30px_rgba(245,158,11,0.5)] transition-all animate-bounce"
            >
              Volunteer & Switch Team ⚡
            </button>
          ) : (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono-condensed text-slate-400">
              You are locked to <strong className="text-slate-200 uppercase">Team {team}</strong>. The battle will launch shortly.
            </div>
          )}
        </div>
      )}

      {/* ================================================== */}
      {/* 4. COUNTDOWN */}
      {/* ================================================== */}
      {!chaos && phase === "COUNTDOWN" && (
        <div className="my-auto z-10 w-full max-w-sm mx-auto text-center space-y-4">
          <div className="text-xs font-mono-condensed tracking-widest text-cyan-400 uppercase">
            Team {team?.toUpperCase()} Ready
          </div>
          <div className="text-7xl font-display text-slate-100 uppercase tracking-tight animate-ping">
            READY!
          </div>
          <div className="text-xs font-mono-condensed text-slate-400">
            WATCH THE BIG SCREEN FOR 3-2-1 LAUNCH
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* 5. RUNNING (THE TAP ARENA) */}
      {/* ================================================== */}
      {!chaos && (phase === "RUNNING" || phase === "PAUSED") && (
        <div className="my-auto z-10 w-full max-w-sm mx-auto flex flex-col items-center space-y-6">
          {/* Live Match Info */}
          <div className="w-full flex items-center justify-between px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-mono-condensed">
            <span className={isLeft ? "text-cyan-400 font-bold" : "text-slate-400"}>
              CYAN: {scores.left.toLocaleString()}
            </span>
            <span className="font-mono-condensed text-slate-200 font-bold">{remainingTime}</span>
            <span className={isRight ? "text-amber-400 font-bold" : "text-slate-400"}>
              AMBER: {scores.right.toLocaleString()}
            </span>
          </div>

          <BattleHud leftScore={scores.left} rightScore={scores.right} time={remainingTime} phase={phase === "PAUSED" ? "PAUSED" : "LIVE"} activeTeam={team} />

          <div className="relative flex items-center justify-center my-4">
            {tapRipple && <div className={`absolute inset-0 rounded-full animate-tap-ripple ${isLeft ? "bg-cyan-400/40" : "bg-red-400/40"}`} />}
            <button disabled={phase === "PAUSED"} onClick={handleTap} aria-label={`Tap for team ${team}`} className={`relative size-56 md:size-64 rounded-full border-4 flex flex-col items-center justify-center active:scale-95 transition-transform duration-75 cursor-pointer ${phase === "PAUSED" ? "bg-slate-900 border-slate-700 text-slate-500 opacity-60" : isLeft ? "bg-cyan-300 border-cyan-100 text-slate-950 box-glow-cyan" : "bg-red-400 border-red-100 text-slate-950 box-glow-amber"}`}>
              {phase === "PAUSED" ? <><Pause className="w-16 h-16 text-amber-400 mb-2 animate-pulse" /><div className="font-display text-xl tracking-wider uppercase">PAUSED</div></> : <><Flame className="w-16 h-16 mb-2" /><div className="font-display text-5xl tracking-widest font-black">TAP</div><div className="text-[11px] font-mono-condensed tracking-wider font-bold mt-1 uppercase">FOR TEAM {team?.toUpperCase()}</div></>}
            </button>
          </div>

          {/* Your Team Score Status */}
          <div className="text-center space-y-1">
            <div className="text-xs font-mono-condensed text-slate-400 uppercase">YOUR TEAM SCORE</div>
            <div
              className={`text-3xl font-mono-condensed font-black ${
                isLeft ? "text-cyan-400 text-glow-cyan" : "text-amber-400 text-glow-amber"
              }`}
            >
              {(isLeft ? scores.left : scores.right).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* 6. FINISHED / RESULTS */}
      {/* ================================================== */}
      {!chaos && (phase === "FINISHED" || phase === "RESULTS") && (
        <div className="my-auto z-10 w-full max-w-sm mx-auto text-center space-y-6 p-6 rounded-3xl bg-slate-950/80 border border-slate-800">
          <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-amber-400 mx-auto">
            <Trophy className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <div className="text-xs font-mono-condensed uppercase tracking-widest text-slate-400">Round Result</div>
            <h2 className="text-3xl font-display uppercase tracking-wide text-slate-100">
              {winner === team
                ? "🎉 YOUR TEAM WON!"
                : winner === "draw"
                  ? "IT'S A DRAW!"
                  : "NICE EFFORT!"}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-900 text-xs font-mono-condensed">
            <div>
              <div className="text-cyan-400">CYAN</div>
              <div className="text-xl font-bold text-slate-100">{scores.left.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-amber-400">AMBER</div>
              <div className="text-xl font-bold text-slate-100">{scores.right.toLocaleString()}</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs font-mono-condensed text-slate-400 animate-pulse">
            <RotateCcw className="w-3.5 h-3.5" />
            STAND BY FOR NEXT ROUND WITH SAME TEAMS
          </div>
        </div>
      )}

      {/* Footer / User Identity Info */}
      <div className="w-full text-center text-[10px] font-mono-condensed text-slate-500 z-10 py-1">
        TUG OF WAR • PARTICIPANT ID: {label ?? "P-???"}
      </div>
    </div>
  );
};
