import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lighting Control System",
  description:
    "Professional lighting control and visualization system for live performances",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-black text-zinc-400">
      <body>{children}</body>
    </html>
  );
}
