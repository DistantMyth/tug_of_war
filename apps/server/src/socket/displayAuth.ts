import crypto from "node:crypto";

const DEFAULT_DISPLAY_SECRET = "tow-default-display-secret-dev-only";

export function getDisplaySecret(): string {
  const secret = process.env.DISPLAY_SECRET ?? process.env.DISPLAY_PIN ?? process.env.DISPLAY_TOKEN;
  if (secret && secret.trim().length > 0) {
    return secret.trim();
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("DISPLAY_SECRET must be configured in production");
  }
  return DEFAULT_DISPLAY_SECRET;
}

export function verifyDisplaySecret(candidate: string | undefined | null, secret = getDisplaySecret()): boolean {
  if (!candidate || typeof candidate !== "string") {
    return false;
  }
  const candidateBuf = Buffer.from(candidate.trim(), "utf8");
  const secretBuf = Buffer.from(secret.trim(), "utf8");

  if (candidateBuf.length !== secretBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(candidateBuf, secretBuf);
}
