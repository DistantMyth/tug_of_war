import crypto from "node:crypto";
import type { PlayerTokenClaims, VerifyTokenResult } from "./types.js";

const DEFAULT_SECRET = "tow-default-player-token-secret-change-in-prod-123456789";

export function getPlayerTokenSecret(): string {
  const secret = process.env.PLAYER_TOKEN_SECRET;
  if (secret && secret.trim().length > 0) {
    return secret.trim();
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("PLAYER_TOKEN_SECRET must be configured in production");
  }
  return DEFAULT_SECRET;
}

function base64urlEncode(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

function base64urlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

export function signPlayerToken(claims: PlayerTokenClaims, secret = getPlayerTokenSecret()): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(signingInput)
    .digest();

  const encodedSignature = base64urlEncode(signature);
  return `${signingInput}.${encodedSignature}`;
}

export function verifyPlayerToken(
  token: string | null | undefined,
  secret = getPlayerTokenSecret(),
  now = Date.now(),
): VerifyTokenResult {
  if (!token || typeof token !== "string") {
    return { ok: false, code: "UNAUTHORIZED", message: "Token missing or malformed" };
  }

  const parts = token.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return { ok: false, code: "UNAUTHORIZED", message: "Invalid token format" };
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(signingInput)
    .digest();

  const actualSignature = Buffer.from(encodedSignature, "base64url");
  if (
    actualSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return { ok: false, code: "UNAUTHORIZED", message: "Invalid token signature" };
  }

  try {
    const rawPayload = base64urlDecode(encodedPayload);
    const claims = JSON.parse(rawPayload);

    if (
      !claims ||
      typeof claims !== "object" ||
      typeof claims.playerId !== "string" ||
      typeof claims.sessionId !== "string" ||
      typeof claims.jti !== "string" ||
      typeof claims.issuedAt !== "number" ||
      typeof claims.expiresAt !== "number"
    ) {
      return { ok: false, code: "VALIDATION", message: "Token claims are invalid" };
    }

    if (claims.expiresAt <= now) {
      return { ok: false, code: "UNAUTHORIZED", message: "Token has expired" };
    }

    return { ok: true, claims: claims as PlayerTokenClaims };
  } catch {
    return { ok: false, code: "UNAUTHORIZED", message: "Failed to parse token claims" };
  }
}
