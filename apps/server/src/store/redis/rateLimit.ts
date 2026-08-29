import type { Redis } from "ioredis";
import { DEFAULT_TAP_BURST } from "@tow/shared";
import { RedisKeys } from "./keys.js";
import { LuaScripts } from "./scripts.js";
import type { RateLimitResult } from "./types.js";

export type TapRateLimitConfig = {
  windowMs?: number;
  maxBurst?: number;
};

export async function checkTapRateLimit(
  redis: Redis,
  playerId: string,
  config?: TapRateLimitConfig,
): Promise<RateLimitResult> {
  const key = RedisKeys.rateLimitTap(playerId);
  const windowMs = config?.windowMs ?? 1000;
  const maxBurst = config?.maxBurst ?? DEFAULT_TAP_BURST;

  try {
    const rawResult = (await redis.eval(
      LuaScripts.rateLimitTap,
      1,
      key,
      String(windowMs),
      String(maxBurst),
    )) as string;

    const parsed = JSON.parse(rawResult);
    if (parsed.ok) {
      return {
        allowed: true,
        current: parsed.current,
        maxAllowed: parsed.maxAllowed,
      };
    }
    return {
      allowed: false,
      current: maxBurst + 1,
      maxAllowed: maxBurst,
      retryAfterMs: parsed.retryAfterMs ?? windowMs,
    };
  } catch {
    // If Redis fails, fail open or fail closed depending on requirements.
    // In production tap path, default to allowed: true to avoid blocking valid players during transient errors.
    return {
      allowed: true,
      current: 1,
      maxAllowed: maxBurst,
    };
  }
}
