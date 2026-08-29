# TeamBalancer (Phase 2)

Pure domain logic for lock-time team equality and CHAOS PLAYER assignment. No Redis, sockets, or HTTP.

## API

```ts
calculateBalanceTarget(n)
createBalancePlan(roster)
selectWildcard(roster, plan, playerId)
applyVolunteerMove(roster, plan, playerId, { phase: "BALANCING" })
previewAutoBalance(roster, plan)
applyAutoBalance(roster, plan)
```

Caller-owned `roster` / `plan` are never mutated. Success returns new objects.

Later Socket.IO/Redis layers must **re-run these checks inside a Lua/MULTI**: current phase, membership sets, remaining need, and player eligibility. This module must not trust client counts — it only reads the roster it is given.

## Target formula

`wildcardNeeded = n % 2`  
`targetPerTeam = (n - wildcardNeeded) / 2`  
`n === 0` → `EMPTY_ROSTER`

## Wildcard policy

1. Score each side by team-switches remaining **if** one player leaves that side for CHAOS.
2. Prefer the side with the **fewest** resulting switches (surplus almost always wins).
3. If sides tie, take the lexicographically smallest `playerId` among those sides.
4. On the chosen side, the candidate is the lexicographically smallest `playerId`.
5. Never `Math.random`. Host override: `selectWildcard`.

## Volunteers

Allowed only in `BALANCING`, surplus → deficit, player is not CHAOS / pending CHAOS, and the move must reduce remaining need (no overshoot).

## Auto fallback

Exclude the CHAOS candidate, sort remaining surplus `playerId`s lexicographically, take exactly `remaining` movers, then assign CHAOS. Same roster ⇒ same movers.
