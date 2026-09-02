# ClutchRank

A pay-to-claim gaming leaderboard. Anyone can pay to take the top rank in a category; the
current price to beat is always visible. Built with Next.js 14 (App Router), TypeScript,
PostgreSQL/Prisma, and Stripe Checkout.

## How ranking works (read this first)

There are no fixed "slots" that get manually shifted around. Every listing is a row with an
`amountCents` value. The leaderboard is just `ORDER BY amountCents DESC`. "Claiming #1" means
paying more than whoever is currently on top — the sort order does the ranking automatically.
This avoids almost every race-condition bug a slot-based system would have: two people paying
at the same instant can never corrupt shared state, because they're just two independent inserts.

## Payment flow (and why it's structured this way)

1. User submits the claim form → `POST /api/claim`.
2. Server re-validates the bid against the **live** current top price (never trusts a client-sent
   "current price" value — that would let anyone claim #1 for a penny by lying about it).
3. Server creates a Stripe Checkout Session and inserts a `PENDING` listing row keyed to that
   session ID. No listing is visible on the leaderboard yet.
4. User pays on Stripe's hosted page.
5. Stripe calls `POST /api/webhooks/stripe`. Only after the webhook verifies the signature and
   confirms `payment_status === "paid"` does the listing flip to `ACTIVE` and become visible.

This means: the only way to ever get on the public leaderboard is a Stripe-confirmed payment.
There is no code path where the leaderboard trusts anything the browser sent about money.

## Setup

```bash
cp .env.example .env      # fill in real values
npm install                # requires network access to registry.npmjs.org and binaries.prisma.sh
npx prisma migrate dev     # creates tables
npx prisma db seed         # seeds categories
npm run dev
```

In a second terminal, forward Stripe webhooks to your local server:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET` in `.env`.

> **Sandbox note:** if you're running this inside a network-restricted environment that can't
> reach `binaries.prisma.sh`, `prisma generate`/`migrate` will fail with a 403 on the engine
> binary download. This is a network policy issue, not a bug in the code — it works normally on
> a real machine, in CI, or on Vercel/Railway/Render, all of which have unrestricted egress.

## Security decisions worth knowing about before you deploy

- **Money never comes from the client.** The claim endpoint recomputes the current top price
  server-side on every request; the amount you eventually pay is fixed inside the Stripe
  Checkout Session itself, not passed back and forth as a number the client controls.
- **Webhook signature verification + idempotency.** `constructEvent` proves the webhook really
  came from Stripe. A `ProcessedWebhookEvent` table stops Stripe's routine webhook retries from
  double-activating a listing.
- **No password-based user accounts.** Listing ownership is a random 24-byte token generated at
  claim time, shown once, and stored only as an HMAC hash — mirrors how you'd store a password,
  without needing a full auth system for what is essentially a one-time purchase.
- **Admin auth** uses a signed, httpOnly JWT cookie (not a plaintext session in the DB), checked
  both in `middleware.ts` (fast rejection at the edge) and again inside each admin API route
  (defense in depth — never rely on middleware alone).
- **Rate limiting** on `/api/claim`, `/api/admin/login`, `/api/report`, and `/api/click/:id`.
  The bundled limiter is in-memory and **only correct on a single server instance** — see the
  comment in `lib/rateLimit.ts`. Set `UPSTASH_REDIS_REST_URL`/`TOKEN` before you deploy on
  anything with more than one instance (which most serverless hosts default to).
- **Input validation** (Zod) rejects non-http(s) URLs (blocks `javascript:`/`data:` XSS vectors),
  enforces length limits, and runs a profanity filter on name/description.
- **Security headers** (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`) are set on every response in `middleware.ts`.

## Known gaps to close before real launch

These are deliberately left as follow-ups rather than guessed at, since the right answer depends
on your actual traffic and legal setup:

- **Stale `PENDING` listings.** If someone starts checkout and abandons it, the row stays
  `PENDING` forever. Add a cron job (Vercel Cron, or a simple scheduled script) that deletes
  `PENDING` listings older than ~24 hours.
- **Edit token delivery.** It's currently passed in the success-page URL query string, which can
  leak via browser history or referrer headers. Wire up a transactional email provider (Resend,
  Postmark) to email it instead, and stop putting it in the URL.
- **Terms of service / refund policy page.** You are taking real payments for a service where
  "value delivered" is inherently fuzzy (traffic, not a guaranteed outcome) — get this reviewed
  before launch, not after your first dispute.
- **Chargeback exposure.** `charge.dispute.created` currently just pulls the listing down. Card
  networks also charge you a dispute fee regardless of outcome — budget for that as a cost of
  doing business at low price points.
- **Content moderation queue.** Listings currently go live immediately on payment. If abuse
  becomes a problem, add a `status: "PENDING_REVIEW"` step for new accounts before their first
  listing goes live, at the cost of the instant-gratification hook that makes this format work.

## Project structure

```
app/
  page.tsx                    Public leaderboard (server component, always fresh)
  claim/page.tsx               Claim form
  claim/success/page.tsx       Post-payment confirmation + one-time edit token
  admin/page.tsx                Moderation dashboard (protected)
  admin/login/page.tsx          Admin login
  api/claim/route.ts            Creates Stripe Checkout session
  api/webhooks/stripe/route.ts  Activates listings on confirmed payment
  api/click/[id]/route.ts       Tracked outbound click redirect
  api/report/route.ts           Visitor abuse reports
  api/admin/*                   Moderation actions
lib/
  db.ts            Prisma client singleton
  stripe.ts        Stripe client
  validation.ts    Zod schemas + content checks
  rateLimit.ts     Redis-backed (fallback: in-memory) rate limiter
  crypto.ts        Token/IP hashing helpers
  adminAuth.ts     Signed admin session cookies
  categories.ts    Static category list
prisma/
  schema.prisma    Data model
  seed.ts          Seeds categories
```

<!-- testing branch protection -->
