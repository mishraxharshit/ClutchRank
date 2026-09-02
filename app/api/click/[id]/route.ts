import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { hmac } from "@/lib/crypto";

// All outbound clicks route through here instead of linking directly to the
// advertiser's URL. This lets us:
//  1. Count clicks server-side (atomic DB increment - never trust a client
//     JS "please increment my click count" call, that's trivially spammable).
//  2. Rate-limit per IP so one person refreshing can't fake a viral listing.
//  3. Only ever redirect to a URL we already validated at claim time.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = getClientIp(req.headers);
  const ipHash = hmac(ip);

  // Generous limit (30/min) - this endpoint should feel invisible to real
  // users, it's only here to blunt scripted click fraud.
  const { allowed } = await checkRateLimit(`click:${ipHash}:${params.id}`, 5, 60);

  const listing = await prisma.listing.findUnique({ where: { id: params.id } });
  if (!listing || listing.status !== "ACTIVE") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (allowed) {
    await prisma.listing.update({
      where: { id: listing.id },
      data: { clicks: { increment: 1 } },
    });
  }

  return NextResponse.redirect(listing.url);
}
