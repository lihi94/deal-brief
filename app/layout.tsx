import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deal Brief",
  description: "One-page screening memos for public companies and startups. A portfolio project, not investment advice.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
