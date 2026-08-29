import type { BalancerErrorCode, BalancerFailure } from "./types.js";

export function balancerError(code: BalancerErrorCode, message: string): BalancerFailure {
  return { ok: false, error: { code, message } };
}
