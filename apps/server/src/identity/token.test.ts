import { describe, expect, it } from "vitest";
import { getPlayerTokenSecret, signPlayerToken, verifyPlayerToken } from "./token.js";
import type { PlayerTokenClaims } from "./types.js";

describe("Player Token Signing and Verification", () => {
  const secret = "test-secret-key-123456789";
  const now = 1700000000000;

  const validClaims: PlayerTokenClaims = {
    playerId: "player-uuid-1234",
    sessionId: "game-session-5678",
    jti: "token-jti-9999",
    issuedAt: now,
    expiresAt: now + 12 * 60 * 60 * 1000,
  };

  it("signs and verifies a valid token successfully", () => {
    const token = signPlayerToken(validClaims, secret);
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);

    const verifyResult = verifyPlayerToken(token, secret, now);
    expect(verifyResult.ok).toBe(true);
    if (!verifyResult.ok) return;

    expect(verifyResult.claims).toEqual(validClaims);
  });

  it("rejects token signed with a different secret", () => {
    const token = signPlayerToken(validClaims, "secret-one");
    const result = verifyPlayerToken(token, "secret-two", now);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
      expect(result.message).toContain("signature");
    }
  });

  it("rejects expired token", () => {
    const expiredClaims: PlayerTokenClaims = {
      ...validClaims,
      expiresAt: now - 1000,
    };
    const token = signPlayerToken(expiredClaims, secret);
    const result = verifyPlayerToken(token, secret, now);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
      expect(result.message).toContain("expired");
    }
  });

  it("rejects tampered payload", () => {
    const token = signPlayerToken(validClaims, secret);
    const [header, payload, signature] = token.split(".");

    // Alter payload
    const decoded = JSON.parse(Buffer.from(payload!, "base64url").toString("utf8"));
    decoded.playerId = "malicious-player-id";
    const tamperedPayload = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url");

    const tamperedToken = `${header}.${tamperedPayload}.${signature}`;
    const result = verifyPlayerToken(tamperedToken, secret, now);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
  });

  it("rejects malformed token strings gracefully", () => {
    expect(verifyPlayerToken(null).ok).toBe(false);
    expect(verifyPlayerToken("").ok).toBe(false);
    expect(verifyPlayerToken("single-string").ok).toBe(false);
    expect(verifyPlayerToken("two.parts").ok).toBe(false);
    expect(verifyPlayerToken("four.parts.here.extra").ok).toBe(false);
  });
});
