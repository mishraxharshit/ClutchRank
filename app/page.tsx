import Link from "next/link";
import { prisma } from "@/lib/db";
import { CATEGORIES } from "@/lib/categories";
import ReportButton from "./ReportButton";

export const dynamic = "force-dynamic"; // leaderboard must always reflect live data, never cache stale ranks

export default async function HomePage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const categorySlug = searchParams.category;

  const listings = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      ...(categorySlug ? { categorySlug } : {}),
    },
    orderBy: { amountCents: "desc" },
    take: 50,
    include: { category: true },
  });

  const topAmount = listings[0]?.amountCents ?? 0;
  const nextBidCents = topAmount + 100;

  return (
    <main>
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-medium mb-2">ClutchRank</h1>
        <p className="text-sm text-neutral-600">
          Pay to claim a rank on the gaming leaderboard. Live, public, no ads sold behind the
          scenes - just whoever pays the most sits on top.
        </p>
        <div className="mt-4">
          <Link
            href={`/claim${categorySlug ? `?category=${categorySlug}` : ""}`}
            className="inline-block bg-ink text-white text-sm px-4 py-2 rounded-lg"
          >
            Claim #1 for ${(nextBidCents / 100).toFixed(2)}
          </Link>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 mb-6 justify-center text-xs">
        <CategoryPill slug="" name="All" active={!categorySlug} />
        {CATEGORIES.map((c) => (
          <CategoryPill key={c.slug} slug={c.slug} name={c.name} active={categorySlug === c.slug} />
        ))}
      </nav>

      <ol className="space-y-2">
        {listings.length === 0 && (
          <li className="text-center text-sm text-neutral-500 py-12">
            No listings yet in this category. Be the first to claim #1.
          </li>
        )}
        {listings.map((listing, i) => (
          <li
            key={listing.id}
            className="flex items-center gap-3 border border-neutral-200 rounded-lg p-3 bg-white"
          >
            <span className="w-8 text-center text-sm font-medium text-neutral-400">#{i + 1}</span>
            <div className="flex-1 min-w-0">
              <a
                href={`/api/click/${listing.id}`}
                className="font-medium text-sm hover:underline block truncate"
              >
                {listing.name}
              </a>
              <p className="text-xs text-neutral-500 truncate">{listing.blurb}</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                {listing.category.name} · {listing.clicks} clicks
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-medium">${(listing.amountCents / 100).toLocaleString()}</div>
              <ReportButton listingId={listing.id} />
            </div>
          </li>
        ))}
      </ol>

      <footer className="mt-10 text-center text-xs text-neutral-400">
        <Link href="/admin/login">Admin</Link>
      </footer>
    </main>
  );
}

function CategoryPill({ slug, name, active }: { slug: string; name: string; active: boolean }) {
  return (
    <Link
      href={slug ? `/?category=${slug}` : "/"}
      className={`px-3 py-1 rounded-full border ${
        active ? "bg-ink text-white border-ink" : "border-neutral-300 text-neutral-600"
      }`}
    >
      {name}
    </Link>
  );
}
