import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cardano Risk Analyst",
  description: "A deterministic risk memo for Cardano tokens.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
