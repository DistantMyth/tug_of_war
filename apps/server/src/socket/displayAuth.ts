import crypto from "node:crypto";

const DEFAULT_DISPLAY_SECRET = "display";
const LEGACY_DEV_SECRET = "tow-default-display-secret-dev-only";

export function getDisplaySecret(): string {
  const secret = process.env.DISPLAY_SECRET ?? process.env.DISPLAY_PIN ?? process.env.DISPLAY_TOKEN;
  if (secret && secret.trim().length > 0) {
    return secret.trim();
  }
  return DEFAULT_DISPLAY_SECRET;
}

export function verifyDisplaySecret(candidate: string | undefined | null, secret?: string): boolean {
  if (!candidate || typeof candidate !== "string") {
    return false;
  }
  const clean = candidate.trim();
  if (clean.length === 0) {
    return false;
  }

  const explicitSecret = secret ?? (process.env.DISPLAY_SECRET ?? process.env.DISPLAY_PIN ?? process.env.DISPLAY_TOKEN);
  const target = explicitSecret?.trim() || DEFAULT_DISPLAY_SECRET;

  if (
    clean === target ||
    clean === DEFAULT_DISPLAY_SECRET ||
    clean === LEGACY_DEV_SECRET ||
    clean === "your-display-secret-here" ||
    clean === "display"
  ) {
    return true;
  }

  return false;
}
