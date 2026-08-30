import React from "react";
import {
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  Sparkles,
  Users,
  CheckCircle2,
  Scale,
} from "lucide-react";
import { useGameStore } from "../../store/useGameStore.js";
import { ParticleBackground } from "../common/ParticleBackground.js";
import {
  CyberTitanCrest,
  SolarPhoenixCrest,
  ChaosWildcardCrest,
} from "../common/TeamBadges.js";

export const TeamBalanceScene: React.FC = () => {
  const { counts, balancePlan, wildcard } = useGameStore();

  const neededLeftToRight = balancePlan?.remainingLeftToRight ?? 0;
  const neededRightToLeft = balancePlan?.remainingRightToLeft ?? 0;
  const totalNeeded = neededLeftToRight + neededRightToLeft;
  const initialNeeded = (balancePlan?.needLeftToRight ?? 0) + (balancePlan?.needRightToLeft ?? 0);

  const directionText =
    neededLeftToRight > 0
      ? "VOLUNTEERS NEEDED: CYAN → AMBER"
      : neededRightToLeft > 0
      ? "VOLUNTEERS NEEDED: AMBER → CYAN"
      : "BALANCING COMPLETE";

  const progressPercent =
    initialNeeded > 0 ? Math.round(((initialNeeded - totalNeeded) / initialNeeded) * 100) : 100;

  // Calculate balance scale tilt angle (-12deg to +12deg)
  const rosterDiff = counts.right - counts.left;
  const scaleTilt = Math.max(-12, Math.min(12, rosterDiff * 1.5));

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-6 md:p-12 overflow-hidden bg-arena-broadcast select-none">
      {/* Floating Ambient Atmosphere Particles */}
      <ParticleBackground mode="ambient" intensity="medium" />

      {/* Ambient Arena Lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[var(--amber)]/10 rounded-full blur-[160px] pointer-events-none animate-pulse" />

      {/* TOP HEADER */}
      <header className="text-center z-20 space-y-2 mt-2">
        <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full border border-[var(--amber)]/40 bg-amber-950/70 text-[var(--amber)] text-xs tracking-widest uppercase font-mono-condensed font-bold animate-pulse backdrop-blur-md shadow-[0_0_20px_rgba(255,107,0,0.2)]">
          <ShieldAlert className="w-4 h-4" />
          <span>ARENA ROSTER LOCKED • FAIR PLAY BALANCING</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-display uppercase tracking-wider text-white drop-shadow-[0_0_30px_rgba(255,153,0,0.35)]">
          Balancing The Battle
        </h1>
        <p className="text-sm md:text-base text-slate-300 font-mono-condensed">
          Equal sides are required for an authoritative tournament match.
        </p>
      </header>

      {/* CENTRAL BALANCE DASHBOARD WITH ANIMATED SCALE */}
      <div className="w-full max-w-5xl bg-[var(--stage-card)]/95 border-2 border-[var(--line-bright)] rounded-3xl p-6 md:p-10 backdrop-blur-2xl z-20 space-y-6 shadow-2xl">
        {/* Animated Balance Scale Visual Beam */}
        <div className="relative w-full flex flex-col items-center pt-2">
          {/* Fulcrum Pivot Base */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-[11px] font-mono-condensed text-slate-300 mb-2">
            <Scale className="w-3.5 h-3.5 text-amber-400" />
            <span>
              ROSTER EQUILIBRIUM:{" "}
              <strong className={totalNeeded === 0 ? "text-emerald-400" : "text-amber-400"}>
                {totalNeeded === 0 ? "BALANCED (0 OFFSET)" : `${Math.abs(counts.left - counts.right)} WARRIOR OFFSET`}
              </strong>
            </span>
          </div>

          {/* Scale Crossbeam with Dynamic Tilt */}
          <div
            className="w-full max-w-2xl h-2 bg-gradient-to-r from-cyan-500 via-slate-400 to-amber-500 rounded-full transition-transform duration-500 ease-out relative"
            style={{ transform: `rotate(${scaleTilt}deg)` }}
          >
            {/* Left Beam Weight Ring */}
            <div className="absolute -left-2 -top-2 w-6 h-6 rounded-full border-2 border-cyan-400 bg-cyan-950 flex items-center justify-center shadow-[0_0_10px_#00f0ff]">
              <div className="w-2 h-2 rounded-full bg-cyan-300" />
            </div>
            {/* Center Fulcrum Pin */}
            <div className="absolute left-1/2 -top-3 -translate-x-1/2 w-8 h-8 rounded-full border-2 border-amber-400 bg-slate-950 flex items-center justify-center shadow-lg">
              <div className="w-3 h-3 rounded-full bg-amber-400" />
            </div>
            {/* Right Beam Weight Ring */}
            <div className="absolute -right-2 -top-2 w-6 h-6 rounded-full border-2 border-amber-400 bg-amber-950 flex items-center justify-center shadow-[0_0_10px_#ff9900]">
              <div className="w-2 h-2 rounded-full bg-amber-300" />
            </div>
          </div>
        </div>

        {/* Team Counts & Volunteer Flow Arrows */}
        <div className="flex items-center justify-between gap-4 md:gap-8 pt-2">
          {/* Left Team (Cyan) */}
          <div className="flex-1 text-center p-6 rounded-3xl bg-cyan-950/50 border-2 border-[var(--cyan)]/60 box-glow-cyan">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CyberTitanCrest size={36} />
              <span className="text-xs text-[var(--cyan)] font-mono-condensed tracking-widest uppercase font-bold">
                TEAM CYAN
              </span>
            </div>
            <div className="text-6xl md:text-7xl font-mono-condensed font-black text-white mt-1 leading-none">
              {counts.left}
            </div>
            <div className="text-xs text-slate-400 font-mono-condensed mt-2">
              TARGET: {balancePlan?.targetLeft ?? counts.left}
            </div>
          </div>

          {/* Center Volunteer Flow Direction Indicator */}
          <div className="flex flex-col items-center justify-center shrink-0 px-2 md:px-6">
            <div className="w-16 h-16 rounded-2xl bg-[var(--stage-surface)] border-2 border-[var(--amber)]/60 flex items-center justify-center text-[var(--amber)] shadow-lg relative overflow-hidden">
              {neededLeftToRight > 0 ? (
                <ArrowRight className="w-8 h-8 text-cyan-400 animate-flow-arrow" />
              ) : neededRightToLeft > 0 ? (
                <ArrowLeft className="w-8 h-8 text-amber-400 animate-flow-arrow" />
              ) : (
                <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-pulse" />
              )}
            </div>

            <span className="text-[10px] font-mono-condensed text-slate-400 mt-2 uppercase font-bold tracking-wider text-center">
              {neededLeftToRight > 0
                ? "CYAN → AMBER"
                : neededRightToLeft > 0
                ? "AMBER → CYAN"
                : "OPTIMIZED"}
            </span>
          </div>

          {/* Right Team (Amber) */}
          <div className="flex-1 text-center p-6 rounded-3xl bg-amber-950/50 border-2 border-[var(--amber)]/60 box-glow-amber">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-xs text-[var(--amber)] font-mono-condensed tracking-widest uppercase font-bold">
                TEAM AMBER
              </span>
              <SolarPhoenixCrest size={36} />
            </div>
            <div className="text-6xl md:text-7xl font-mono-condensed font-black text-white mt-1 leading-none">
              {counts.right}
            </div>
            <div className="text-xs text-slate-400 font-mono-condensed mt-2">
              TARGET: {balancePlan?.targetRight ?? counts.right}
            </div>
          </div>
        </div>

        {/* Hero Call to Action */}
        <div className="text-center space-y-3">
          <div className="text-3xl md:text-4xl font-display text-[var(--amber)] tracking-wider">
            {totalNeeded > 0 ? (
              <span>
                WE NEED <strong className="text-white text-glow-amber text-5xl">{totalNeeded}</strong> VOLUNTEERS
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-7 h-7" />
                TEAMS ARE BALANCED & READY!
              </span>
            )}
          </div>
          <div className="text-sm font-mono-condensed text-slate-300 uppercase tracking-widest font-bold">
            {directionText} • TAP "VOLUNTEER" ON YOUR PHONE
          </div>

          {/* Volunteer Progress Bar */}
          <div className="w-full bg-[#04070d] rounded-full h-4 p-0.5 border border-[var(--line-bright)] overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-[0_0_15px_rgba(52,211,153,0.5)]"
              style={{ width: `${Math.max(5, progressPercent)}%` }}
            />
          </div>
        </div>

        {/* Glowing Wildcard Hero Showcase */}
        {balancePlan?.chaosNeeded && (
          <div className="flex items-center justify-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-purple-950/70 via-fuchsia-950/60 to-purple-950/70 border-2 border-purple-500/50 text-purple-200 text-sm font-mono-condensed box-glow-violet shadow-2xl animate-pulse">
            <ChaosWildcardCrest size={40} className="shrink-0" />
            <div className="text-left">
              <div className="text-[10px] text-fuchsia-400 font-bold uppercase tracking-widest">
                ODD PLAYER DETECTED • CHAOS PROTOCOL ENGAGED
              </div>
              <div className="text-base text-white font-display uppercase tracking-wider">
                CHAOS OPERATIVE:{" "}
                <span className="text-[var(--gold)] text-glow-gold">
                  {wildcard?.label ?? "SELECTING RANDOM HERO..."}
                </span>
              </div>
            </div>
            <Sparkles className="w-6 h-6 text-yellow-400 animate-spin shrink-0" />
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer className="flex items-center gap-2 text-xs font-mono-condensed text-slate-400 z-20 mb-2">
        <Users className="w-4 h-4 text-slate-500" />
        <span>Total {counts.total} Players — The match begins automatically when teams are balanced.</span>
      </footer>
    </div>
  );
};
