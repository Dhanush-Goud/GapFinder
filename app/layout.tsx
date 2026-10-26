import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GapFinder AI", template: "%s · GapFinder AI" },
  description: "Find what you don't know yet. GapFinder AI diagnoses knowledge gaps from your own study material and builds an adaptive revision plan.",
};

export const viewport: Viewport = { themeColor: "#080908" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark bg-[#080908] text-[#F4F5F0]">
      <body className="min-h-screen bg-[#080908] text-[#F4F5F0] font-sans antialiased">{children}</body>
    </html>
  );
}
