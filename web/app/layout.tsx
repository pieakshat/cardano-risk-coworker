import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cardano Risk Analyst",
  description: "A cited decision before you interact with a Cardano contract.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
