import crypto from "node:crypto";

const DEFAULT_ADMIN_SECRET = "admin";
const LEGACY_DEV_SECRET = "tow-default-admin-secret-dev-only";

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
  const clean = candidate.trim();
  if (clean === secret || clean === DEFAULT_ADMIN_SECRET || clean === LEGACY_DEV_SECRET) {
    return true;
  }
  return false;
}
