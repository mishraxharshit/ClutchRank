import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import Stripe from "stripe";

// Stripe requires the RAW request body (unparsed) to verify the webhook
// signature. Next.js's default body parsing would corrupt this, so we
// disable it for this route.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  // Signature verification is what proves this request actually came from
  // Stripe and not from someone POSTing a fake "payment succeeded" event
  // directly at this URL to get a free listing.
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: Stripe redelivers webhooks on retry, network blips, or if
  // your endpoint is briefly down. Without this guard a retried
  // "checkout.session.completed" would re-run our activation logic twice.
  const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
    where: { stripeEventId: event.id },
  });
  if (alreadyProcessed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status === "paid") {
      // Wrap the activation + idempotency record in one transaction so we
      // never end up with "listing activated" but "event not marked
      // processed" (or vice versa) if the process crashes mid-way.
      await prisma.$transaction(async (tx) => {
        const listing = await tx.listing.findUnique({
          where: { stripeSessionId: session.id },
        });

        // Defensive check: if we somehow don't have a matching pending
        // listing (shouldn't happen in normal flow), don't silently no-op -
        // log it so it surfaces in monitoring, since it means a customer
        // paid and got nothing.
        if (!listing) {
          console.error(`No listing found for Stripe session ${session.id} - investigate.`);
          return;
        }

        if (listing.status === "PENDING") {
          await tx.listing.update({
            where: { id: listing.id },
            data: {
              status: "ACTIVE",
              activatedAt: new Date(),
              stripePaymentIntentId:
                typeof session.payment_intent === "string" ? session.payment_intent : undefined,
            },
          });
        }

        await tx.processedWebhookEvent.create({
          data: { stripeEventId: event.id },
        });
      });
    }
  }

  if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
    // If a payment is refunded or disputed after the listing went live,
    // pull it down automatically rather than leaving a listing up that
    // nobody actually paid for.
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId =
      typeof charge.payment_intent === "string" ? charge.payment_intent : undefined;
    if (paymentIntentId) {
      await prisma.listing.updateMany({
        where: { stripePaymentIntentId: paymentIntentId, status: "ACTIVE" },
        data: { status: "REFUNDED" },
      });
    }
    await prisma.processedWebhookEvent.upsert({
      where: { stripeEventId: event.id },
      update: {},
      create: { stripeEventId: event.id },
    });
  }

  return NextResponse.json({ received: true });
}
