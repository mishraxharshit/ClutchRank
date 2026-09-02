"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";

export default function ClaimPage() {
  const [form, setForm] = useState<{
    name: string;
    url: string;
    blurb: string;
    categorySlug: string;
    ownerEmail: string;
    bid: string;
  }>({
    name: "",
    url: "",
    blurb: "",
    categorySlug: CATEGORIES[0].slug,
    ownerEmail: "",
    bid: "10.00",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const bidCents = Math.round(parseFloat(form.bid) * 100);
    if (Number.isNaN(bidCents) || bidCents <= 0) {
      setError("Enter a valid bid amount");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, bidCents }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setLoading(false);
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      setError("Network error - please try again");
      setLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto">
      <h1 className="text-xl font-medium mb-1">Claim a rank</h1>
      <p className="text-sm text-neutral-500 mb-6">
        You'll be sent to Stripe to pay. Your listing goes live the instant payment is confirmed.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name">
          <input
            required
            maxLength={60}
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>

        <Field label="Link (https://...)">
          <input
            required
            type="url"
            className="input"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
        </Field>

        <Field label="Short description">
          <textarea
            required
            maxLength={200}
            className="input min-h-20"
            value={form.blurb}
            onChange={(e) => setForm({ ...form, blurb: e.target.value })}
          />
        </Field>

        <Field label="Category">
          <select
            className="input"
            value={form.categorySlug}
            onChange={(e) => setForm({ ...form, categorySlug: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Email (for your edit link - never shown publicly)">
          <input
            required
            type="email"
            className="input"
            value={form.ownerEmail}
            onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
          />
        </Field>

        <Field label="Bid amount (USD)">
          <input
            required
            type="number"
            step="0.01"
            min="5"
            className="input"
            value={form.bid}
            onChange={(e) => setForm({ ...form, bid: e.target.value })}
          />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-ink text-white rounded-lg py-2 text-sm disabled:opacity-50"
        >
          {loading ? "Redirecting to payment..." : "Continue to payment"}
        </button>
      </form>

      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid #d4d4d4;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
      `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-neutral-600 mb-1">{label}</span>
      {children}
    </label>
  );
}
