import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "CarFinder - Find Your Exact Car",
  description:
    "AI-powered car listing search. We find the exact cars you want — no junk, no digging.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-gray-50 text-gray-900 font-sans">
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
