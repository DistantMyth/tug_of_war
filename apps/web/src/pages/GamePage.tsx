import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRightLeft, Flame, Pause, RotateCcw, Sparkles, Trophy, WifiOff, Zap } from "lucide-react";
import { socketClient } from "../socket/socketClient.js";
import { useConnectionStore } from "../store/useConnectionStore.js";
import { useGameStore } from "../store/useGameStore.js";
import { useSessionStore } from "../store/useSessionStore.js";
import { useUiStore } from "../store/useUiStore.js";
import { BattleHud } from "../components/game/BattleHud.js";
import { RopeArena } from "../components/game/RopeArena.js";

export const GamePage: React.FC = () => {
  const navigate = useNavigate();
  const { token, label, team, chaos } = useSessionStore();
  const { status } = useConnectionStore();
  const { phase, counts, scores, timing, balancePlan, winner, roundNumber } = useGameStore();
  const { addToast } = useUiStore();

  const [tapRipple, setTapRipple] = useState<boolean>(false);
  const [tapStreak, setTapStreak] = useState<number>(0);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [remainingTime, setRemainingTime] = useState<string>("00:30.0");
  const [isLastFiveSec, setIsLastFiveSec] = useState<boolean>(false);
  const streakTimerRef = useRef<number | null>(null);

  // Authentication & Socket Connection
  useEffect(() => {
    if (!token) {
      navigate("/join");
    } else {
      socketClient.connect("player", token);
    }
  }, [token, navigate]);

  // High-Precision RAF Timer Loop based on authoritative server clock
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

      const sec = Math.floor(remainingMs / 1000);
      const centis = Math.floor((remainingMs % 1000) / 100);
      const minutes = Math.floor(sec / 60);
      const seconds = sec % 60;

      setRemainingTime(
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${centis}`,
      );
      setIsLastFiveSec(remainingMs <= 5000 && remainingMs > 0 && phase === "RUNNING");

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [timing.endTime, timing.pausedAt, phase]);

  // Handle Tap Action
  const handleTap = async () => {
    if (phase !== "RUNNING" || chaos || !team) return;

    // Haptic pulse
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(15);
    }

    setTapRipple(true);
    window.setTimeout(() => setTapRipple(false), 200);

    // Client-side visual pull streak (does not affect server score)
    setTapStreak((prev) => Math.min(prev + 1, 99));
    if (streakTimerRef.current) window.clearTimeout(streakTimerRef.current);
    streakTimerRef.current = window.setTimeout(() => setTapStreak(0), 1200);

    const res = await socketClient.playerTap();
    if (!res.ok && res.code === "RATE_LIMITED") {
      addToast({
        type: "warning",
        title: "Pace Yourself",
        description: "Tapping speed capped at 10 taps/sec.",
      });
    }
  };

  const handleChooseTeam = async (chosen: "left" | "right") => {
    setActionLoading(true);
    const res = await socketClient.playerChooseTeam(chosen);
    setActionLoading(false);
    if (!res.ok) {
      addToast({ type: "error", title: "Cannot Join Team", description: res.message });
    }
  };

  const handleSwitchTeam = async () => {
    if (!team) return;
    setActionLoading(true);
    const target = team === "left" ? "right" : "left";
    const res = await socketClient.playerSwitchTeam(target);
    setActionLoading(false);
    if (!res.ok) {
      addToast({ type: "error", title: "Cannot Switch Team", description: res.message });
    }
  };

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
  const canVolunteer =
    (isLeft && (balancePlan?.remainingLeftToRight ?? 0) > 0) ||
    (isRight && (balancePlan?.remainingRightToLeft ?? 0) > 0);

  const teamAccentColor = isLeft ? "var(--cyan)" : isRight ? "var(--amber)" : "var(--muted)";

  return (
    <main className="h-[100dvh] max-h-[100dvh] w-full bg-arena-stadium text-[var(--ink)] flex flex-col justify-between overflow-hidden select-none touch-manipulation">
      {/* ================================================== */}
      {/* TOP STADIUM HUD BAR */}
      {/* ================================================== */}
      <header className="flex-none flex items-center justify-between px-4 py-2.5 md:px-8 border-b border-[var(--line)] bg-[var(--stage-card)]/90 backdrop-blur-md z-30">
        {/* Player Identity Pill */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl border flex items-center justify-center font-mono-condensed font-black text-sm"
            style={{ borderColor: teamAccentColor, color: teamAccentColor }}
          >
            {label ?? "P-??"}
          </div>
          <div>
            <div className="font-display text-xs md:text-sm uppercase tracking-wider text-white">
              {chaos ? "Chaos Wildcard" : team ? `Team ${team.toUpperCase()}` : "Unassigned"}
            </div>
            <div className="font-mono-condensed text-[10px] text-[var(--muted)]">
              ROUND {roundNumber} • {phase}
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--stage-surface)] border border-[var(--line)] text-[10px] font-mono-condensed">
          {status === "connected" ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300">ONLINE</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-amber-400 animate-bounce" />
              <span className="text-amber-400">RECONNECTING</span>
            </>
          )}
        </div>
      </header>

      {/* ================================================== */}
      {/* MAIN VIEWPORT BODY (SCROLL-FREE) */}
      {/* ================================================== */}
      <div className="flex-1 flex flex-col items-center justify-between px-4 py-2 md:py-4 w-full max-w-xl mx-auto overflow-hidden">
        {/* 1. CHAOS PLAYER VIEW */}
        {chaos ? (
          <section className="my-auto w-full p-6 rounded-3xl bg-gradient-to-b from-purple-950/50 to-[var(--stage-card)] border border-[var(--violet)]/50 box-glow-violet flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-[var(--gold)] animate-pulse">
              <Sparkles className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="font-mono-condensed text-xs tracking-widest text-[var(--gold)] font-bold">
                SPECIAL ASSIGNMENT
              </p>
              <h1 className="font-display text-3xl uppercase text-[var(--violet)] tracking-wide">
                Chaos Wildcard
              </h1>
              <p className="text-xs font-mono-condensed text-slate-300 max-w-xs mx-auto leading-relaxed">
                You are the wildcard hero of this round! Hype the crowd, cheer both teams, and spectate live on the main display.
              </p>
            </div>
            <div className="px-4 py-2 rounded-xl bg-purple-900/50 border border-purple-400/30 text-xs font-mono-condensed text-[var(--gold)] font-bold">
              SPECTATING LIVE ON MAIN DISPLAY
            </div>
          </section>
        ) : phase === "OPEN" || phase === "WAITING" ? (
          /* 2. TEAM SELECTION VIEW */
          <section className="my-auto w-full flex flex-col items-center gap-5">
            <div className="text-center space-y-1">
              <p className="font-mono-condensed text-xs tracking-widest text-[var(--cyan)] font-bold">
                REGISTRATION DECK
              </p>
              <h1 className="font-display text-3xl md:text-4xl uppercase text-white tracking-wide">
                Choose your side
              </h1>
              <p className="text-xs font-mono-condensed text-[var(--muted)]">
                You can switch teams freely until the host locks the arena.
              </p>
            </div>

            {/* Team Portals */}
            <div className="grid grid-cols-2 gap-3 w-full">
              {/* Cyan Button */}
              <button
                disabled={actionLoading}
                onClick={() => handleChooseTeam("left")}
                className={`p-4 md:p-5 rounded-2xl border flex flex-col items-center text-center transition-all ${
                  isLeft
                    ? "bg-gradient-to-b from-[#003840] to-[var(--stage-card)] border-[var(--cyan)] box-glow-cyan scale-[1.02]"
                    : "bg-[var(--stage-card)] border-[var(--line)] hover:border-[var(--cyan)]/50"
                }`}
              >
                <span className="text-xs font-mono-condensed font-bold uppercase tracking-wider text-[var(--cyan)]">
                  CYAN
                </span>
                <strong className="text-4xl font-mono-condensed font-black text-white my-1">
                  {counts.left}
                </strong>
                <small className="text-[10px] font-mono-condensed text-slate-400">
                  {isLeft ? "YOUR TEAM ✓" : "JOIN TEAM"}
                </small>
              </button>

              {/* Amber Button */}
              <button
                disabled={actionLoading}
                onClick={() => handleChooseTeam("right")}
                className={`p-4 md:p-5 rounded-2xl border flex flex-col items-center text-center transition-all ${
                  isRight
                    ? "bg-gradient-to-b from-[#402600] to-[var(--stage-card)] border-[var(--amber)] box-glow-amber scale-[1.02]"
                    : "bg-[var(--stage-card)] border-[var(--line)] hover:border-[var(--amber)]/50"
                }`}
              >
                <span className="text-xs font-mono-condensed font-bold uppercase tracking-wider text-[var(--amber)]">
                  AMBER
                </span>
                <strong className="text-4xl font-mono-condensed font-black text-white my-1">
                  {counts.right}
                </strong>
                <small className="text-[10px] font-mono-condensed text-slate-400">
                  {isRight ? "YOUR TEAM ✓" : "JOIN TEAM"}
                </small>
              </button>
            </div>

            {/* Switch Team CTA */}
            {team && (
              <button
                disabled={actionLoading}
                onClick={handleSwitchTeam}
                className="w-full py-3.5 px-4 rounded-xl bg-[var(--stage-card)] hover:bg-[var(--stage-surface)] border border-[var(--line)] text-xs font-mono-condensed uppercase tracking-wider flex items-center justify-center gap-2 text-slate-300 transition-all"
              >
                <ArrowRightLeft className="w-4 h-4 text-amber-400" />
                Switch to {isLeft ? "Amber" : "Cyan"}
              </button>
            )}
          </section>
        ) : phase === "BALANCING" || phase === "LOCKING" ? (
          /* 3. BALANCING VIEW */
          <section className="my-auto w-full flex flex-col items-center gap-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-[var(--amber)] flex items-center justify-center animate-pulse">
              <ArrowRightLeft className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h1 className="font-display text-3xl uppercase text-[var(--amber)] tracking-wide">
                Balancing teams
              </h1>
              <p className="text-xs font-mono-condensed text-slate-400 max-w-xs mx-auto">
                {canVolunteer
                  ? "Your side has surplus players. Volunteer now to balance the battle!"
                  : "Waiting for volunteer players to balance both sides..."}
              </p>
            </div>

            {/* Roster Balance Comparison */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
              <div className="p-3 rounded-xl bg-[var(--stage-card)] border border-[var(--line)]">
                <span className="text-[10px] font-mono-condensed text-[var(--cyan)] font-bold">CYAN</span>
                <strong className="block text-2xl font-mono-condensed text-white">{counts.left}</strong>
              </div>
              <div className="p-3 rounded-xl bg-[var(--stage-card)] border border-[var(--line)]">
                <span className="text-[10px] font-mono-condensed text-[var(--amber)] font-bold">AMBER</span>
                <strong className="block text-2xl font-mono-condensed text-white">{counts.right}</strong>
              </div>
            </div>

            {canVolunteer ? (
              <button
                disabled={actionLoading}
                onClick={handleVolunteer}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-display text-lg uppercase tracking-wider shadow-[0_0_30px_rgba(245,158,11,0.5)] transition-all animate-bounce"
              >
                Volunteer and switch ⚡
              </button>
            ) : (
              <div className="p-3.5 rounded-xl bg-[var(--stage-card)] border border-[var(--line)] text-xs font-mono-condensed text-slate-400">
                You are locked to <strong className="text-white uppercase">Team {team}</strong>. The battle starts shortly.
              </div>
            )}
          </section>
        ) : phase === "COUNTDOWN" ? (
          /* 4. COUNTDOWN VIEW */
          <section className="my-auto w-full text-center space-y-3">
            <p className="font-mono-condensed text-xs tracking-widest text-[var(--cyan)] uppercase font-bold">
              TEAM {team?.toUpperCase()} READY
            </p>
            <h1 className="font-display text-7xl md:text-8xl uppercase text-white tracking-tight animate-ping">
              Ready
            </h1>
            <p className="font-mono-condensed text-xs text-[var(--muted)]">
              WATCH THE MAIN DISPLAY FOR LAUNCH
            </p>
          </section>
        ) : phase === "RUNNING" || phase === "PAUSED" ? (
          /* 5. RUNNING ARENA & TAP ZONE */
          <div className="w-full flex-1 flex flex-col items-center justify-between gap-2 overflow-hidden py-1">
            {/* Top Scoreboard HUD */}
            <BattleHud
              leftScore={scores.left}
              rightScore={scores.right}
              time={remainingTime}
              phase={phase}
              activeTeam={team}
              isLastFiveSec={isLastFiveSec}
            />

            {/* Center Dynamic Stadium Cable & Athletes */}
            <div className="w-full flex-1 flex items-center justify-center my-auto min-h-[140px] max-h-[190px]">
              <RopeArena
                leftScore={scores.left}
                rightScore={scores.right}
                phase={phase}
                isLastFiveSec={isLastFiveSec}
                userTeam={team}
                winner={winner}
              />
            </div>

            {/* Personal Pull Cadence / Streak Gauge */}
            <div className="flex items-center gap-2 text-[10px] font-mono-condensed text-[var(--muted)]">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>PULL CADENCE:</span>
              <strong className="text-white">{tapStreak > 0 ? `${tapStreak} TAPS/BURST` : "READY"}</strong>
            </div>

            {/* Bottom Giant Interactive TAP Control */}
            <div className="w-full relative flex items-center justify-center pb-2">
              {tapRipple && (
                <div
                  className={`absolute inset-0 rounded-3xl animate-tap-ripple ${
                    isLeft ? "bg-[var(--cyan)]/40" : "bg-[var(--amber)]/40"
                  }`}
                />
              )}

              <button
                disabled={phase === "PAUSED"}
                onClick={handleTap}
                aria-label={`Tap for team ${team}`}
                className={`relative w-full max-w-sm h-24 md:h-28 rounded-3xl border-4 flex flex-col items-center justify-center font-display text-3xl md:text-4xl uppercase tracking-wider transition-all duration-75 active:scale-95 cursor-pointer ${
                  phase === "PAUSED"
                    ? "bg-[var(--stage-card)] border-[var(--line)] text-slate-500 opacity-60 cursor-not-allowed"
                    : isLeft
                    ? "bg-gradient-to-r from-[var(--cyan)] to-cyan-300 border-cyan-100 text-slate-950 box-glow-cyan"
                    : "bg-gradient-to-r from-[var(--amber)] to-amber-300 border-amber-100 text-slate-950 box-glow-amber"
                }`}
              >
                {phase === "PAUSED" ? (
                  <div className="flex items-center gap-2 text-xl tracking-wider text-amber-300">
                    <Pause className="w-6 h-6 animate-pulse" />
                    <span>PAUSED</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <Flame className="w-8 h-8 animate-bounce" />
                    <span>TAP ⚡</span>
                  </div>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* 6. FINISHED / RESULTS VIEW */
          <section className="my-auto w-full p-6 rounded-3xl bg-[var(--stage-card)] border border-[var(--line)] text-center flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-[var(--amber)] flex items-center justify-center">
              <Trophy className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="font-mono-condensed text-xs tracking-widest text-[var(--muted)]">
                ROUND RESULT
              </p>
              <h1 className="font-display text-3xl uppercase text-white tracking-wide">
                {winner === team ? "Your team won" : winner === "draw" ? "Draw" : "Nice effort"}
              </h1>
            </div>

            {/* Score Comparison */}
            <div className="grid grid-cols-2 gap-3 w-full">
              <div className="p-3 rounded-xl bg-[var(--stage-surface)] border border-[var(--cyan)]/40">
                <span className="text-[10px] font-mono-condensed text-[var(--cyan)] font-bold">CYAN</span>
                <strong className="block text-3xl font-mono-condensed text-white">{scores.left}</strong>
              </div>
              <div className="p-3 rounded-xl bg-[var(--stage-surface)] border border-[var(--amber)]/40">
                <span className="text-[10px] font-mono-condensed text-[var(--amber)] font-bold">AMBER</span>
                <strong className="block text-3xl font-mono-condensed text-white">{scores.right}</strong>
              </div>
            </div>

            <p className="font-mono-condensed text-xs text-[var(--muted)] flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              NEXT ROUND STANDBY
            </p>
          </section>
        )}
      </div>

      {/* ================================================== */}
      {/* FOOTER BAR */}
      {/* ================================================== */}
      <footer className="flex-none py-2 text-center font-mono-condensed text-[10px] text-[var(--muted)] border-t border-[var(--line)] bg-[var(--stage-card)]/80">
        TUG OF WAR • PARTICIPANT {label ?? "P-??"}
      </footer>
    </main>
  );
};
