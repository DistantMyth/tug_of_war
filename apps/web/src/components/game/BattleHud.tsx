import { Activity, Timer, Zap } from "lucide-react";
import { ArenaCharacter, RopeRig } from "./ArenaCharacter.js";

export function BattleHud({ leftScore, rightScore, time, phase, activeTeam }: { leftScore: number; rightScore: number; time: string; phase: string; activeTeam?: "left" | "right" | null }) {
  const total = Math.max(1, leftScore + rightScore);
  const pull = ((leftScore - rightScore) / total) * 42;
  return (
    <section className="battle-hud" aria-label="Live tug of war match">
      <div className="battle-topline"><span><Activity data-icon="inline-start" /> LIVE ARENA / ROUND 01</span><strong><Timer data-icon="inline-start" /> {time}</strong><span>{phase}</span></div>
      <div className="scoreboard">
        <div className="team-score cyan"><span>CYAN CREW</span><strong>{leftScore.toLocaleString()}</strong><small>LEFT SIDE</small></div>
        <div className="arena-battle"><ArenaCharacter team="left" active={activeTeam === "left"} /><RopeRig pull={pull} /><ArenaCharacter team="right" active={activeTeam === "right"} /></div>
        <div className="team-score coral"><span>EMBER CREW</span><strong>{rightScore.toLocaleString()}</strong><small>RIGHT SIDE</small></div>
      </div>
      <div className="battle-meter"><div style={{ width: `${50 + pull / 2}%` }} /></div>
      <div className="battle-callout"><Zap data-icon="inline-start" /> Every tap moves the knot. Pull together.</div>
    </section>
  );
}
