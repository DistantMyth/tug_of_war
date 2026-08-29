import { describe, expect, it } from "vitest";
import {
  applyAutoBalance,
  applyVolunteerMove,
  calculateBalanceTarget,
  chooseWildcardCandidate,
  cloneRoster,
  countRoster,
  createBalancePlan,
  derivePlanFromRoster,
  findPlayer,
  isBalanceComplete,
  previewAutoBalance,
  selectWildcard,
  snapshotPlan,
  type BalancerPlayer,
  type BalancePlan,
  type Roster,
} from "./index.js";

function makePlayer(playerId: string, team: BalancerPlayer["team"]): BalancerPlayer {
  return { playerId, team };
}

function makeRoster(leftCount: number, rightCount: number, chaosCount = 0): Roster {
  const players: BalancerPlayer[] = [];
  for (let i = 1; i <= leftCount; i += 1) {
    players.push(makePlayer(`p-left-${String(i).padStart(4, "0")}`, "left"));
  }
  for (let i = 1; i <= rightCount; i += 1) {
    players.push(makePlayer(`p-right-${String(i).padStart(4, "0")}`, "right"));
  }
  for (let i = 1; i <= chaosCount; i += 1) {
    players.push(makePlayer(`p-chaos-${String(i).padStart(4, "0")}`, "chaos"));
  }
  return { players };
}

describe("calculateBalanceTarget", () => {
  const cases: {
    total: number;
    playable: number;
    targetLeft: number;
    targetRight: number;
    wildcardNeeded: 0 | 1;
  }[] = [
    { total: 1, playable: 0, targetLeft: 0, targetRight: 0, wildcardNeeded: 1 },
    { total: 2, playable: 2, targetLeft: 1, targetRight: 1, wildcardNeeded: 0 },
    { total: 3, playable: 2, targetLeft: 1, targetRight: 1, wildcardNeeded: 1 },
    { total: 4, playable: 4, targetLeft: 2, targetRight: 2, wildcardNeeded: 0 },
    { total: 5, playable: 4, targetLeft: 2, targetRight: 2, wildcardNeeded: 1 },
    { total: 6, playable: 6, targetLeft: 3, targetRight: 3, wildcardNeeded: 0 },
    { total: 7, playable: 6, targetLeft: 3, targetRight: 3, wildcardNeeded: 1 },
    { total: 10, playable: 10, targetLeft: 5, targetRight: 5, wildcardNeeded: 0 },
    { total: 199, playable: 198, targetLeft: 99, targetRight: 99, wildcardNeeded: 1 },
    { total: 200, playable: 200, targetLeft: 100, targetRight: 100, wildcardNeeded: 0 },
    { total: 201, playable: 200, targetLeft: 100, targetRight: 100, wildcardNeeded: 1 },
    { total: 202, playable: 202, targetLeft: 101, targetRight: 101, wildcardNeeded: 0 },
    { total: 203, playable: 202, targetLeft: 101, targetRight: 101, wildcardNeeded: 1 },
    { total: 204, playable: 204, targetLeft: 102, targetRight: 102, wildcardNeeded: 0 },
    { total: 217, playable: 216, targetLeft: 108, targetRight: 108, wildcardNeeded: 1 },
    { total: 246, playable: 246, targetLeft: 123, targetRight: 123, wildcardNeeded: 0 },
    { total: 299, playable: 298, targetLeft: 149, targetRight: 149, wildcardNeeded: 1 },
    { total: 300, playable: 300, targetLeft: 150, targetRight: 150, wildcardNeeded: 0 },
  ];

  it.each(cases)(
    "computes exact target for n=$total (target=$targetLeft, wildcard=$wildcardNeeded)",
    ({ total, playable, targetLeft, targetRight, wildcardNeeded }) => {
      const result = calculateBalanceTarget(total);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toEqual({
        totalPlayers: total,
        playablePlayers: playable,
        targetLeft,
        targetRight,
        wildcardNeeded,
      });
    },
  );

  it("fails on n=0 with EMPTY_ROSTER", () => {
    const result = calculateBalanceTarget(0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("EMPTY_ROSTER");
  });

  it("fails on negative or non-integer with INVALID_BALANCE_PLAN", () => {
    const neg = calculateBalanceTarget(-5);
    expect(neg.ok).toBe(false);
    if (!neg.ok) {
      expect(neg.error.code).toBe("INVALID_BALANCE_PLAN");
    }

    const nonInt = calculateBalanceTarget(3.5);
    expect(nonInt.ok).toBe(false);
    if (!nonInt.ok) {
      expect(nonInt.error.code).toBe("INVALID_BALANCE_PLAN");
    }
  });
});

describe("createBalancePlan — Imbalance matrix and targets", () => {
  const matrix: {
    left: number;
    right: number;
    targetLeft: number;
    targetRight: number;
    wildcardNeeded: 0 | 1;
    needL2R: number;
    needR2L: number;
    status: BalancePlan["status"];
  }[] = [
    // Extreme imbalances
    { left: 200, right: 0, targetLeft: 100, targetRight: 100, wildcardNeeded: 0, needL2R: 100, needR2L: 0, status: "needs_moves" },
    { left: 0, right: 200, targetLeft: 100, targetRight: 100, wildcardNeeded: 0, needL2R: 0, needR2L: 100, status: "needs_moves" },
    { left: 217, right: 0, targetLeft: 108, targetRight: 108, wildcardNeeded: 1, needL2R: 108, needR2L: 0, status: "needs_moves" },
    { left: 0, right: 217, targetLeft: 108, targetRight: 108, wildcardNeeded: 1, needL2R: 0, needR2L: 108, status: "needs_moves" },
    { left: 140, right: 60, targetLeft: 100, targetRight: 100, wildcardNeeded: 0, needL2R: 40, needR2L: 0, status: "needs_moves" },
    { left: 60, right: 140, targetLeft: 100, targetRight: 100, wildcardNeeded: 0, needL2R: 0, needR2L: 40, status: "needs_moves" },
    { left: 123, right: 94, targetLeft: 108, targetRight: 108, wildcardNeeded: 1, needL2R: 14, needR2L: 0, status: "needs_moves" },
    { left: 94, right: 123, targetLeft: 108, targetRight: 108, wildcardNeeded: 1, needL2R: 0, needR2L: 14, status: "needs_moves" },
    { left: 20, right: 197, targetLeft: 108, targetRight: 108, wildcardNeeded: 1, needL2R: 0, needR2L: 88, status: "needs_moves" },
    { left: 197, right: 20, targetLeft: 108, targetRight: 108, wildcardNeeded: 1, needL2R: 88, needR2L: 0, status: "needs_moves" },

    // Balanced cases
    { left: 100, right: 100, targetLeft: 100, targetRight: 100, wildcardNeeded: 0, needL2R: 0, needR2L: 0, status: "complete" },
    { left: 101, right: 101, targetLeft: 101, targetRight: 101, wildcardNeeded: 0, needL2R: 0, needR2L: 0, status: "complete" },
    { left: 108, right: 109, targetLeft: 108, targetRight: 108, wildcardNeeded: 1, needL2R: 0, needR2L: 0, status: "needs_wildcard" },
    { left: 109, right: 108, targetLeft: 108, targetRight: 108, wildcardNeeded: 1, needL2R: 0, needR2L: 0, status: "needs_wildcard" },
    { left: 123, right: 123, targetLeft: 123, targetRight: 123, wildcardNeeded: 0, needL2R: 0, needR2L: 0, status: "complete" },
    { left: 149, right: 150, targetLeft: 149, targetRight: 149, wildcardNeeded: 1, needL2R: 0, needR2L: 0, status: "needs_wildcard" },
    { left: 150, right: 150, targetLeft: 150, targetRight: 150, wildcardNeeded: 0, needL2R: 0, needR2L: 0, status: "complete" },
  ];

  it.each(matrix)(
    "creates plan for L=$left, R=$right (needL2R=$needL2R, needR2L=$needR2L, status=$status)",
    ({ left, right, targetLeft, targetRight, wildcardNeeded, needL2R, needR2L, status }) => {
      const roster = makeRoster(left, right);
      const result = createBalancePlan(roster);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const plan = result.value;
      expect(plan.target.targetLeft).toBe(targetLeft);
      expect(plan.target.targetRight).toBe(targetRight);
      expect(plan.target.wildcardNeeded).toBe(wildcardNeeded);
      expect(plan.needLeftToRight).toBe(needL2R);
      expect(plan.needRightToLeft).toBe(needR2L);
      expect(plan.remainingLeftToRight).toBe(needL2R);
      expect(plan.remainingRightToLeft).toBe(needR2L);
      expect(plan.status).toBe(status);
    },
  );

  it("fails on empty roster with EMPTY_ROSTER", () => {
    const emptyRoster: Roster = { players: [] };
    const result = createBalancePlan(emptyRoster);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EMPTY_ROSTER");
    }
  });

  it("fails on duplicate player IDs with INVALID_BALANCE_PLAN", () => {
    const duplicateRoster: Roster = {
      players: [
        makePlayer("p1", "left"),
        makePlayer("p1", "right"),
      ],
    };
    const result = createBalancePlan(duplicateRoster);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_BALANCE_PLAN");
    }
  });

  it("fails on invalid player team with INVALID_TEAM", () => {
    const invalidRoster = {
      players: [
        { playerId: "p1", team: "invalid_team" as any },
      ],
    };
    const result = createBalancePlan(invalidRoster);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_TEAM");
    }
  });
});

describe("Wildcard policy and deterministic selection", () => {
  it("selects candidate from surplus team in 217-player case (123 L / 94 R)", () => {
    const roster = makeRoster(123, 94);
    const planResult = createBalancePlan(roster);
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) return;

    const plan = planResult.value;
    expect(plan.wildcardNeeded).toBe(1);
    expect(plan.wildcardPlayerId).toBe("p-left-0001"); // Smallest lexicographical on surplus team (LEFT)
    expect(plan.needLeftToRight).toBe(14); // 122 left - 108 target = 14
    expect(plan.needRightToLeft).toBe(0);
  });

  it("selects candidate from surplus team in 203-player case (150 L / 53 R)", () => {
    const roster = makeRoster(150, 53);
    const planResult = createBalancePlan(roster);
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) return;

    const plan = planResult.value;
    expect(plan.wildcardNeeded).toBe(1);
    expect(plan.wildcardPlayerId).toBe("p-left-0001");
    expect(plan.needLeftToRight).toBe(48); // 149 - 101 = 48
  });

  it("selects candidate in 3-player case (2 L / 1 R)", () => {
    const roster = makeRoster(2, 1);
    const planResult = createBalancePlan(roster);
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) return;

    const plan = planResult.value;
    expect(plan.wildcardPlayerId).toBe("p-left-0001");
    expect(plan.needLeftToRight).toBe(0);
    expect(plan.status).toBe("needs_wildcard");
  });

  it("selects candidate in 1-player case (1 L / 0 R)", () => {
    const roster = makeRoster(1, 0);
    const planResult = createBalancePlan(roster);
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) return;

    const plan = planResult.value;
    expect(plan.wildcardPlayerId).toBe("p-left-0001");
    expect(plan.needLeftToRight).toBe(0);
    expect(plan.status).toBe("needs_wildcard");
  });

  it("breaks tie with lexicographically smallest playerId across sides when switches are equal", () => {
    const roster: Roster = {
      players: [
        makePlayer("zeta", "left"),
        makePlayer("alpha", "right"),
        makePlayer("beta", "right"),
      ],
    };
    // total 3, target 1/1/1.
    // side right: right becomes 1, left 1 -> switches = 0
    // candidate on right: "alpha" < "beta" -> "alpha"
    const targetResult = calculateBalanceTarget(3);
    expect(targetResult.ok).toBe(true);
    if (!targetResult.ok) return;

    const candidate = chooseWildcardCandidate(roster, targetResult.value);
    expect(candidate).toBe("alpha");
  });

  it("rejects wildcard selection on even rosters", () => {
    const roster = makeRoster(100, 100);
    const plan = createBalancePlan(roster);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    const selectResult = selectWildcard(roster, plan.value, "p-left-0001");
    expect(selectResult.ok).toBe(false);
    if (!selectResult.ok) {
      expect(selectResult.error.code).toBe("INVALID_WILDCARD");
    }
  });

  it("rejects host-selected wildcard if player does not exist", () => {
    const roster = makeRoster(123, 94);
    const plan = createBalancePlan(roster);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    const result = selectWildcard(roster, plan.value, "nonexistent-player");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PLAYER_NOT_FOUND");
    }
  });

  it("rejects host-selected wildcard after moves have started", () => {
    const roster = makeRoster(123, 94);
    const plan = createBalancePlan(roster);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    const volunteered = applyVolunteerMove(roster, plan.value, "p-left-0002", { phase: "BALANCING" });
    expect(volunteered.ok).toBe(true);
    if (!volunteered.ok) return;

    const result = selectWildcard(volunteered.value.roster, volunteered.value.plan, "p-left-0003");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_BALANCE_PLAN");
    }
  });

  it("allows host to override wildcard candidate cleanly before moves start", () => {
    const roster = makeRoster(123, 94);
    const plan = createBalancePlan(roster);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    // Pick a different left player
    const customWildcard = selectWildcard(roster, plan.value, "p-left-0050");
    expect(customWildcard.ok).toBe(true);
    if (!customWildcard.ok) return;

    expect(customWildcard.value.wildcardPlayerId).toBe("p-left-0050");
    expect(customWildcard.value.needLeftToRight).toBe(14);
  });

  it("fails if roster already contains multiple chaos players", () => {
    const invalidRoster = makeRoster(10, 10, 2);
    const result = createBalancePlan(invalidRoster);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_WILDCARD");
    }
  });
});

describe("Volunteer balancing flow", () => {
  it("applies a single valid volunteer move immutably", () => {
    const roster = makeRoster(123, 94);
    const planResult = createBalancePlan(roster);
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) return;

    const plan = planResult.value;
    const volunteerId = "p-left-0010";

    const result = applyVolunteerMove(roster, plan, volunteerId, { phase: "BALANCING" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { roster: nextRoster, plan: nextPlan } = result.value;

    // Original objects must NOT be mutated
    expect(findPlayer(roster, volunteerId)?.team).toBe("left");
    expect(plan.remainingLeftToRight).toBe(14);
    expect(plan.moves.length).toBe(0);

    // New objects updated correctly
    expect(findPlayer(nextRoster, volunteerId)?.team).toBe("right");
    expect(nextPlan.remainingLeftToRight).toBe(13);
    expect(nextPlan.moves.length).toBe(1);
    expect(nextPlan.moves[0]).toEqual({
      kind: "team_switch",
      playerId: volunteerId,
      from: "left",
      to: "right",
      reason: "volunteer",
      sequence: 1,
    });
    expect(result.events).toContainEqual({ type: "VOLUNTEER_MOVE_ACCEPTED" });
  });

  it("applies sequential volunteer moves until target is reached", () => {
    // 5 players total: 4 left, 1 right -> target 2 left, 2 right, 1 chaos (from left). Need 1 move left->right.
    const roster = makeRoster(4, 1);
    const plan = createBalancePlan(roster);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    expect(plan.value.remainingLeftToRight).toBe(1);

    // p-left-0001 is the wildcard candidate, so p-left-0002 volunteers
    const step1 = applyVolunteerMove(roster, plan.value, "p-left-0002", { phase: "BALANCING" });
    expect(step1.ok).toBe(true);
    if (!step1.ok) return;

    expect(step1.value.plan.remainingLeftToRight).toBe(0);
    expect(step1.value.plan.status).toBe("needs_wildcard");
    expect(step1.value.plan.moves.length).toBe(1);

    // Extra volunteer should now be rejected as overshoot
    const extra = applyVolunteerMove(step1.value.roster, step1.value.plan, "p-left-0003", { phase: "BALANCING" });
    expect(extra.ok).toBe(false);
    if (!extra.ok) {
      expect(extra.error.code).toBe("MOVE_NOT_ALLOWED");
    }
  });

  it("rejects volunteer if not in BALANCING phase", () => {
    const roster = makeRoster(123, 94);
    const plan = createBalancePlan(roster);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    const result = applyVolunteerMove(roster, plan.value, "p-left-0010", { phase: "OPEN" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MOVE_NOT_ALLOWED");
    }
  });

  it("rejects volunteer from deficit team", () => {
    const roster = makeRoster(123, 94); // surplus is LEFT, deficit is RIGHT
    const plan = createBalancePlan(roster);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    const result = applyVolunteerMove(roster, plan.value, "p-right-0001", { phase: "BALANCING" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MOVE_NOT_ALLOWED");
    }
  });

  it("rejects wildcard player attempting to volunteer", () => {
    const roster = makeRoster(123, 94);
    const plan = createBalancePlan(roster);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    const wildcardId = plan.value.wildcardPlayerId!;
    const result = applyVolunteerMove(roster, plan.value, wildcardId, { phase: "BALANCING" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MOVE_NOT_ALLOWED");
    }
  });

  it("rejects nonexistent player attempting to volunteer", () => {
    const roster = makeRoster(10, 5);
    const plan = createBalancePlan(roster);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    const result = applyVolunteerMove(roster, plan.value, "ghost-player", { phase: "BALANCING" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PLAYER_NOT_FOUND");
    }
  });

  it("rejects already-moved player attempting duplicate volunteer", () => {
    const roster = makeRoster(123, 94);
    const plan = createBalancePlan(roster);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    const first = applyVolunteerMove(roster, plan.value, "p-left-0010", { phase: "BALANCING" });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    // Try volunteering again with same player (now on RIGHT)
    const second = applyVolunteerMove(first.value.roster, first.value.plan, "p-left-0010", { phase: "BALANCING" });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe("MOVE_NOT_ALLOWED");
    }
  });
});

describe("Auto-balance and preview", () => {
  it("previewAutoBalance matches applyAutoBalance exactly (217 players: 123 L / 94 R)", () => {
    const roster = makeRoster(123, 94);
    const planResult = createBalancePlan(roster);
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) return;

    const plan = planResult.value;

    const preview = previewAutoBalance(roster, plan);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;

    expect(preview.value.moves.length).toBe(15); // 14 team switches + 1 wildcard move
    expect(preview.value.wildcardPlayerId).toBe("p-left-0001");
    expect(preview.value.finalCounts).toEqual({ total: 217, left: 108, right: 108, chaos: 1 });

    // Apply auto balance
    const applied = applyAutoBalance(roster, plan);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(applied.value.plan.moves).toEqual(preview.value.moves);
    expect(countRoster(applied.value.roster)).toEqual(preview.value.finalCounts);
    expect(isBalanceComplete(applied.value.roster, applied.value.plan)).toBe(true);
  });

  it("selects lexicographically smallest eligible surplus players", () => {
    // 5 players on left: p-left-0001 (wildcard), p-left-0002, p-left-0003, p-left-0004, p-left-0005
    // 0 on right. Target = 2/2/1. Needs 2 moves left->right.
    const roster = makeRoster(5, 0);
    const plan = createBalancePlan(roster);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    const autoResult = applyAutoBalance(roster, plan.value);
    expect(autoResult.ok).toBe(true);
    if (!autoResult.ok) return;

    const moves = autoResult.value.plan.moves;
    expect(moves.length).toBe(3); // 2 switches + 1 wildcard
    expect(moves[0]).toEqual({
      kind: "team_switch",
      playerId: "p-left-0002", // Smallest non-wildcard surplus
      from: "left",
      to: "right",
      reason: "auto",
      sequence: 1,
    });
    expect(moves[1]).toEqual({
      kind: "team_switch",
      playerId: "p-left-0003", // Next smallest
      from: "left",
      to: "right",
      reason: "auto",
      sequence: 2,
    });
    expect(moves[2]).toEqual({
      kind: "wildcard",
      playerId: "p-left-0001",
      from: "left",
      to: "chaos",
      reason: "auto",
      sequence: 3,
    });

    expect(isBalanceComplete(autoResult.value.roster, autoResult.value.plan)).toBe(true);
  });

  it("handles mixed volunteer + auto-balance flow cleanly", () => {
    const roster = makeRoster(123, 94);
    const planResult = createBalancePlan(roster);
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) return;

    let currentRoster = roster;
    let currentPlan = planResult.value;

    // 4 volunteers step forward
    for (let i = 10; i <= 13; i += 1) {
      const vId = `p-left-${String(i).padStart(4, "0")}`;
      const vResult = applyVolunteerMove(currentRoster, currentPlan, vId, { phase: "BALANCING" });
      expect(vResult.ok).toBe(true);
      if (!vResult.ok) return;
      currentRoster = vResult.value.roster;
      currentPlan = vResult.value.plan;
    }

    expect(currentPlan.remainingLeftToRight).toBe(10); // 14 - 4 = 10 remaining
    expect(currentPlan.moves.length).toBe(4);

    // Host triggers auto balance fallback
    const finalAuto = applyAutoBalance(currentRoster, currentPlan);
    expect(finalAuto.ok).toBe(true);
    if (!finalAuto.ok) return;

    expect(finalAuto.value.plan.moves.length).toBe(15); // 4 volunteers + 10 auto switches + 1 auto wildcard
    // Verify move sequences are strictly 1..15
    const sequences = finalAuto.value.plan.moves.map((m) => m.sequence);
    expect(sequences).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));

    expect(isBalanceComplete(finalAuto.value.roster, finalAuto.value.plan)).toBe(true);
  });

  it("previewAutoBalance does not mutate original roster or plan", () => {
    const roster = makeRoster(10, 2);
    const planResult = createBalancePlan(roster);
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) return;

    const plan = planResult.value;
    const rosterSnapshot = structuredClone(roster);
    const planSnapshot = snapshotPlan(plan);

    previewAutoBalance(roster, plan);

    expect(roster).toEqual(rosterSnapshot);
    expect(plan).toEqual(planSnapshot);
  });
});

describe("Property & Invariant validation across player counts", () => {
  const countsToTest = [1, 2, 3, 4, 5, 6, 7, 10, 50, 199, 200, 201, 202, 203, 204, 217, 246, 299, 300];

  it.each(countsToTest)("guarantees full balance invariants for n=%d", (n) => {
    // Test with all players starting on LEFT (extreme skew)
    const roster = makeRoster(n, 0);
    const planResult = createBalancePlan(roster);
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) return;

    const autoResult = applyAutoBalance(roster, planResult.value);
    expect(autoResult.ok).toBe(true);
    if (!autoResult.ok) return;

    const finalRoster = autoResult.value.roster;
    const finalPlan = autoResult.value.plan;
    const counts = countRoster(finalRoster);

    const expectedWildcard = n % 2 === 0 ? 0 : 1;
    const expectedPerTeam = Math.floor(n / 2);

    expect(counts.total).toBe(n);
    expect(counts.left).toBe(expectedPerTeam);
    expect(counts.right).toBe(expectedPerTeam);
    expect(counts.chaos).toBe(expectedWildcard);
    expect(counts.left + counts.right + counts.chaos).toBe(n);

    // Invariant: all players exist once
    const playerIds = finalRoster.players.map((p) => p.playerId);
    expect(new Set(playerIds).size).toBe(n);

    expect(isBalanceComplete(finalRoster, finalPlan)).toBe(true);
  });
});

describe("Determinism", () => {
  it("produces identical output over 100 iterations on same roster", () => {
    const roster = makeRoster(123, 94);

    const initialPlan = createBalancePlan(roster);
    expect(initialPlan.ok).toBe(true);
    if (!initialPlan.ok) return;

    const baseline = applyAutoBalance(roster, initialPlan.value);
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) return;

    for (let i = 0; i < 100; i += 1) {
      const plan = createBalancePlan(roster);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;

      const result = applyAutoBalance(roster, plan.value);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.plan.moves).toEqual(baseline.value.plan.moves);
      expect(result.value.roster).toEqual(baseline.value.roster);
    }
  });
});
