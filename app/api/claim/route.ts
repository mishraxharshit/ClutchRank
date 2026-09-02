import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { claimIntentSchema, validateBidBeatsCurrent } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { generateSecureToken, hmac } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const ipHash = hmac(ip);

  // Rate limit: 5 claim attempts per IP per 10 minutes. This is the endpoint
  // that talks to Stripe and writes to the DB, so it's the one worth
  // protecting most tightly against scripted abuse.
  const { allowed } = await checkRateLimit(`claim:${ipHash}`, 5, 600);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = claimIntentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const category = await prisma.category.findUnique({ where: { slug: input.categorySlug } });
  if (!category) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }

  // Re-check the bid against live server-side data. The client's displayed
  // "current top price" is just a UI hint - it is NEVER trusted as the
  // basis for validation. An attacker could submit any bidCents value
  // directly to this endpoint, so we always recompute the real current top.
  const currentTop = await prisma.listing.findFirst({
    where: { categorySlug: input.categorySlug, status: "ACTIVE" },
    orderBy: { amountCents: "desc" },
  });
  const currentTopCents = currentTop?.amountCents ?? 0;

  const bidError = validateBidBeatsCurrent(input.bidCents, currentTopCents);
  if (bidError) {
    return NextResponse.json({ error: bidError }, { status: 400 });
  }

  // The edit token is generated now, shown to the user once in the Stripe
  // success redirect, and only its HASH is stored. If our database ever
  // leaks, an attacker cannot use the leaked hashes to edit anyone's listing.
  const editToken = generateSecureToken();
  const editTokenHash = hmac(editToken);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  // Create the Stripe Checkout Session first so we have a session ID to key
  // the pending listing row on. No money moves and no listing is visible
  // until Stripe calls our webhook with a confirmed payment.
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: input.bidCents,
          product_data: {
            name: `Claim rank in ${category.name}`,
            description: input.name,
          },
        },
        quantity: 1,
      },
    ],
    customer_email: input.ownerEmail,
    success_url: `${baseUrl}/claim/success?session_id={CHECKOUT_SESSION_ID}&edit_token=${editToken}`,
    cancel_url: `${baseUrl}/claim?canceled=1`,
    metadata: {
      categorySlug: input.categorySlug,
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Could not start checkout" }, { status: 502 });
  }

  await prisma.listing.create({
    data: {
      name: input.name,
      url: input.url,
      blurb: input.blurb,
      categorySlug: input.categorySlug,
      amountCents: input.bidCents,
      status: "PENDING",
      stripeSessionId: session.id,
      editTokenHash,
      ownerEmail: input.ownerEmail,
      ipHash,
    },
  });

  return NextResponse.json({ checkoutUrl: session.url });
}
