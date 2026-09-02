import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClutchRank - claim your rank on the gaming leaderboard",
  description: "Pay to claim a rank in front of the gaming audience. Live, public, no ads.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="max-w-3xl mx-auto px-4 py-8">{children}</div>
      </body>
    </html>
  );
}
