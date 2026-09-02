# Contributing to ClutchRank

## Branching workflow

`main` is always deployable — Vercel deploys it automatically. Never push
directly to `main`; always work in a branch and open a pull request.

```bash
git checkout -b your-name/short-description   # e.g. sam/fix-report-button
# make your changes
git add -A
git commit -m "Fix report button double-submit"
git push -u origin your-name/short-description
```

Then open a PR on GitHub. The PR template will show a checklist — fill it in
honestly, it exists to catch the mistakes that are easy to make under
deadline pressure (accidentally committing a secret, skipping a migration
file).

## Before you open a PR

1. `npm run dev` and manually click through whatever you changed.
2. `npx tsc --noEmit` — same check CI will run; catch it locally first.
3. If you touched the database schema: `npx prisma migrate dev --name describe_the_change`
   and commit the generated migration folder under `prisma/migrations/`.

## Secrets

Never commit `.env`. It's already gitignored — keep it that way. Each
developer keeps their own local `.env` (copy `.env.example` and fill in your
own Stripe **test** keys — never share live keys over Slack/email/etc).

Production secrets live only in Vercel's environment variable settings.
When you add a new required environment variable, update `.env.example`
with a placeholder and a comment explaining what it's for — this is the
single source of truth for "what does this app need to run."

## Payment-related code gets extra scrutiny

Anything touching `/api/claim`, `/api/webhooks/stripe`, or `lib/stripe.ts`
should get a second pair of eyes before merging, even on a small team.
The specific things to check in review:

- Is any dollar amount trusted from the client, anywhere? (It shouldn't be —
  the server always recomputes the current top price itself.)
- Does the webhook handler still verify the Stripe signature before doing
  anything?
- Is the change idempotent — if Stripe redelivers the same webhook event,
  does it double-process anything?

## Database changes

Always use `prisma migrate dev` to generate migrations — never hand-edit
the database schema directly in the Neon/Supabase dashboard. If the schema
in the dashboard drifts from what's in `prisma/migrations/`, the next
person's `migrate deploy` will fail in confusing ways.
