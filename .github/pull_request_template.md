## What does this change?

<!-- One or two sentences. What does this PR do and why? -->

## How was this tested?

<!-- e.g. "Ran locally, claimed a listing with a Stripe test card, confirmed
it appeared on the leaderboard" - be specific, "it works" isn't enough info
for a reviewer to trust the change. -->

## Checklist

- [ ] I ran `npm run dev` locally and the change works as expected
- [ ] I did not commit `.env` or any real API keys
- [ ] If this touches `/api/claim`, `/api/webhooks/stripe`, or payment logic, I
      re-read the security notes in the README and this change doesn't
      weaken any of them (trusting client-sent amounts, skipping signature
      verification, etc.)
- [ ] If this changes the database schema, I included the Prisma migration
      files (`npx prisma migrate dev` generates these automatically)
