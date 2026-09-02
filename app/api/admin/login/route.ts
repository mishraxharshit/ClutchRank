import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { createAdminSessionToken, ADMIN_COOKIE_NAME, ADMIN_SESSION_MAX_AGE } from "@/lib/adminAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { hmac } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const ipHash = hmac(ip);

  // Strict limit on login attempts - this is the only door into moderation
  // tools, so it's the one endpoint most worth brute-force protecting.
  const { allowed } = await checkRateLimit(`admin-login:${ipHash}`, 5, 900);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const password = body?.password;
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return NextResponse.json({ error: "Admin login not configured" }, { status: 500 });
  }
  if (typeof password !== "string" || !safeEqual(password, expected)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = await createAdminSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: "/",
  });
  return res;
}
