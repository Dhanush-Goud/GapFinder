import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GapFinder AI", template: "%s · GapFinder AI" },
  description: "Find what you don't know yet. GapFinder AI diagnoses knowledge gaps from your own study material and builds an adaptive revision plan.",
};

export const viewport: Viewport = { themeColor: "#4f46e5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
