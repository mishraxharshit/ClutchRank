"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminActions({ listingId }: { listingId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function act(refund: boolean) {
    if (!confirm(refund ? "Refund and remove this listing?" : "Remove this listing (no refund)?")) {
      return;
    }
    setBusy(true);
    await fetch("/api/admin/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, refund }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2 shrink-0">
      <button
        disabled={busy}
        onClick={() => act(false)}
        className="text-xs border border-neutral-300 rounded px-2 py-1"
      >
        Remove
      </button>
      <button
        disabled={busy}
        onClick={() => act(true)}
        className="text-xs border border-red-300 text-red-600 rounded px-2 py-1"
      >
        Refund
      </button>
    </div>
  );
}
