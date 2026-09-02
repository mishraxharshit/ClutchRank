import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { verifyAdminSessionToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const isAdmin = token ? await verifyAdminSessionToken(token) : false;
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const listingId = body?.listingId;
  const issueRefund = Boolean(body?.refund);
  if (typeof listingId !== "string") {
    return NextResponse.json({ error: "listingId required" }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (issueRefund && listing.stripePaymentIntentId) {
    // Issuing the refund through Stripe (not just deleting our row) matters:
    // it's the honest outcome for the person who paid, and it also means
    // our charge.refunded webhook handler flips status consistently instead
    // of us hand-editing status in two places.
    await stripe.refunds.create({ payment_intent: listing.stripePaymentIntentId });
  } else {
    await prisma.listing.update({ where: { id: listingId }, data: { status: "REMOVED" } });
  }

  return NextResponse.json({ ok: true });
}
