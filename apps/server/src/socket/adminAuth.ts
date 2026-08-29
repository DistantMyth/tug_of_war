import crypto from "node:crypto";

const DEFAULT_ADMIN_SECRET = "tow-default-admin-secret-dev-only";

export function getAdminSecret(): string {
  const secret = process.env.ADMIN_PASSWORD ?? process.env.ADMIN_SECRET ?? process.env.ADMIN_TOKEN;
  if (secret && secret.trim().length > 0) {
    return secret.trim();
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_PASSWORD must be configured in production");
  }
  return DEFAULT_ADMIN_SECRET;
}

export function verifyAdminSecret(candidate: string | undefined | null, secret = getAdminSecret()): boolean {
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
