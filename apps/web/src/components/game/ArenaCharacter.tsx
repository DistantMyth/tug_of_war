import type { CSSProperties } from "react";

type Team = "left" | "right";

export function ArenaCharacter({ team, active = false, winner = false }: { team: Team; active?: boolean; winner?: boolean }) {
  const accent = team === "left" ? "var(--cyan)" : "var(--coral)";
  const skin = team === "left" ? "#7de7ef" : "#ffb08d";
  return (
    <div className={`arena-character ${team} ${active ? "is-pulling" : ""} ${winner ? "is-winner" : ""}`} style={{ "--accent": accent } as CSSProperties} aria-label={`${team} team mascot`}>
      <div className="character-shadow" />
      <div className="character-body" style={{ backgroundColor: skin }}>
        <div className="character-face"><i /><i /></div>
        <div className="character-band" />
      </div>
      <div className="character-arm arm-back" style={{ backgroundColor: skin }} />
      <div className="character-arm arm-front" style={{ backgroundColor: skin }} />
      <div className="character-boot boot-back" />
      <div className="character-boot boot-front" />
    </div>
  );
}

export function RopeRig({ pull = 0 }: { pull?: number }) {
  return <div className="rope-rig" style={{ "--pull": `${pull}%` } as CSSProperties}><span className="rope-line" /><span className="rope-knot" /></div>;
}
