import { prisma } from "@/lib/db";
import AdminActions from "./AdminActions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const listings = await prisma.listing.findMany({
    where: { status: { in: ["ACTIVE", "PENDING"] } },
    orderBy: [{ flaggedCount: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: { category: true, reports: true },
  });

  return (
    <main>
      <h1 className="text-lg font-medium mb-4">Moderation</h1>
      <p className="text-xs text-neutral-500 mb-6">
        Sorted by flag count. Refunding pulls the listing down and reverses the Stripe charge -
        use it for scams or fraud. Remove-without-refund is for policy violations where the payment
        is still valid.
      </p>
      <div className="space-y-3">
        {listings.map((listing) => (
          <div key={listing.id} className="border border-neutral-200 rounded-lg p-3 bg-white">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{listing.name}</p>
                <p className="text-xs text-neutral-500 truncate">{listing.url}</p>
                <p className="text-xs text-neutral-500">
                  {listing.category.name} · ${(listing.amountCents / 100).toFixed(2)} ·{" "}
                  {listing.status} · {listing.flaggedCount} flags
                </p>
                {listing.reports.length > 0 && (
                  <ul className="mt-1 text-[11px] text-red-600 list-disc list-inside">
                    {listing.reports.slice(0, 3).map((r) => (
                      <li key={r.id}>{r.reason}</li>
                    ))}
                  </ul>
                )}
              </div>
              <AdminActions listingId={listing.id} />
            </div>
          </div>
        ))}
        {listings.length === 0 && (
          <p className="text-sm text-neutral-500">Nothing to review.</p>
        )}
      </div>
    </main>
  );
}
