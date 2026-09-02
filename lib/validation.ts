import { z } from "zod";
// @ts-ignore - bad-words has no types package
import Filter from "bad-words";

const profanityFilter = new Filter();

const MIN_BID_CENTS = 500; // $5.00 floor - keeps entry accessible, deters spam
const MAX_BID_CENTS = 100_000_00; // $100,000 ceiling - sanity cap, raise deliberately if needed
const MIN_INCREMENT_CENTS = 100; // must beat current top spot by at least $1

/** Blocks javascript:, data:, and other non-http(s) URL schemes - the classic
 * stored-XSS-via-link vector for any site that renders user-submitted URLs. */
function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export const claimIntentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Name must be at least 3 characters")
    .max(60, "Name must be under 60 characters")
    .refine((v) => !profanityFilter.isProfane(v), "Name contains disallowed language"),
  url: z
    .string()
    .trim()
    .max(500)
    .refine(isSafeHttpUrl, "URL must be a valid http(s) link"),
  blurb: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters")
    .max(200, "Description must be under 200 characters")
    .refine((v) => !profanityFilter.isProfane(v), "Description contains disallowed language"),
  categorySlug: z.string().trim().min(1).max(50),
  ownerEmail: z.string().trim().email("Enter a valid email - it's needed to send your edit link"),
  bidCents: z
    .number()
    .int()
    .min(MIN_BID_CENTS, `Minimum bid is $${MIN_BID_CENTS / 100}`)
    .max(MAX_BID_CENTS, "Bid exceeds the maximum allowed"),
});

export type ClaimIntentInput = z.infer<typeof claimIntentSchema>;

export function validateBidBeatsCurrent(bidCents: number, currentTopCents: number): string | null {
  if (bidCents < currentTopCents + MIN_INCREMENT_CENTS) {
    return `Bid must be at least $${((currentTopCents + MIN_INCREMENT_CENTS) / 100).toFixed(2)} to take #1`;
  }
  return null;
}

export const reportSchema = z.object({
  listingId: z.string().trim().min(1),
  reason: z.string().trim().min(5).max(300),
});

export const MIN_BID_CENTS_EXPORT = MIN_BID_CENTS;
