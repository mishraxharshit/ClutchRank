import { createHmac, randomBytes, timingSafeEqual } from "crypto";

function secret(): string {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "APP_SECRET is missing or too short. Set a long random value in .env - see .env.example."
    );
  }
  return s;
}

/** Deterministic HMAC hash - used so we never store raw edit tokens or raw IPs. */
export function hmac(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

/** A random, unguessable token shown to the user exactly once (e.g. edit link). */
export function generateSecureToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Constant-time comparison - prevents timing attacks on token/password checks. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
