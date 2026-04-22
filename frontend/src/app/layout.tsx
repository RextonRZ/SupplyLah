import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SupplyLah — AI-Powered Wholesale Automation",
  description: "Turn WhatsApp orders into automated supply chain workflows. SupplyLah uses AI to parse multilingual messages, check inventory, and book logistics for Malaysian SME wholesalers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white antialiased">{children}</body>
    </html>
  );
}
