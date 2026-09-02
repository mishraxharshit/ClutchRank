"use client";

import { useState } from "react";

export default function ReportButton({ listingId }: { listingId: string }) {
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");

  async function handleReport() {
    const reason = window.prompt("Why are you reporting this listing? (min 5 characters)");
    if (!reason || reason.trim().length < 5) return;

    const res = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, reason: reason.trim() }),
    });
    setStatus(res.ok ? "sent" : "error");
  }

  if (status === "sent") {
    return <span className="text-[10px] text-neutral-400">Reported</span>;
  }

  return (
    <button
      onClick={handleReport}
      className="text-[10px] text-neutral-400 hover:text-neutral-600 underline"
    >
      Report
    </button>
  );
}
