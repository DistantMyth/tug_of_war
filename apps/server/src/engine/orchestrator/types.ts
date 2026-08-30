import type { ErrorCode, GamePhase, PublicState, YouView } from "@tow/shared";
import type { BalanceMove, BalancePlan, Roster } from "../balance/types.js";
import type { StoredCounts } from "../../store/redis/types.js";

export type AutoBalancePreview = {
  moves: BalanceMove[];
  wildcardPlayerId: string | null;
  finalCounts: {
    left: number;
    right: number;
    chaos: number;
    total: number;
  };
  /** FIX #5: roster version at preview time — used to detect volunteer moves between preview and confirm */
  rosterVersion?: number;
};


export type OrchestratorResult<T = void> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: ErrorCode;
      message: string;
    };
