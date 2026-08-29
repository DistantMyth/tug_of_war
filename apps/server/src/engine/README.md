# Game state machine (Phase 1)

Pure domain module. It owns the **authoritative phase** and legal transitions. It does not talk to Socket.IO, Redis, MongoDB, or HTTP.

## How to issue a command

```ts
import { createInitialGameState, reduceGame } from "./engine/index.js";

const before = createInitialGameState("game_1");
const result = reduceGame(before, { type: "OPEN_GAME" });
```

`reduceGame` never mutates `before`. Invalid host/player actions return a result; they do not throw.

## Result

- `{ ok: true, state, events }` — `state` is the next snapshot; `events` always include `PHASE_CHANGED` when the phase actually changes.
- `{ ok: false, error: { code: "INVALID_TRANSITION", message } }` — `before` is unchanged.

Later Socket.IO handlers will `reduceGame(load(), command)` then persist `state` (Redis) and fan out `events`. This folder must stay free of those adapters.

## Valid normal transitions

| From | To |
|---|---|
| WAITING | OPEN |
| OPEN | LOCKING |
| LOCKING | BALANCING, COUNTDOWN |
| BALANCING | COUNTDOWN, OPEN |
| COUNTDOWN | RUNNING |
| RUNNING | PAUSED, FINISHED |
| PAUSED | RUNNING, FINISHED |
| FINISHED | RESULTS |
| RESULTS | COUNTDOWN, BALANCING, WAITING |

`EMERGENCY_STOP` is an explicit command: **any phase → WAITING** (not a normal table edge).

`LOCKING` forks via `RESOLVE_LOCK` using the even/odd roster invariant only (`isRosterReadyForCountdown`). Volunteer math and auto-moves are Phase 2 (`TeamBalancer`), not this helper.
