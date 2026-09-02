import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { reportSchema } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { hmac } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const ipHash = hmac(ip);

  const { allowed } = await checkRateLimit(`report:${ipHash}`, 10, 3600);
  if (!allowed) {
    return NextResponse.json({ error: "Too many reports from this connection" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({ where: { id: parsed.data.listingId } });
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.report.create({
      data: { listingId: listing.id, reason: parsed.data.reason },
    }),
    prisma.listing.update({
      where: { id: listing.id },
      data: { flaggedCount: { increment: 1 } },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
