import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SupplyLah — Operations Dashboard",
  description: "AI-powered supply chain command centre for Malaysian SME wholesalers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
