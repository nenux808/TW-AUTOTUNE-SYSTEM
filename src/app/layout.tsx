import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AuthGuard from "@/components/auth/AuthGuard";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "TW AUTO TUNE Management System",
    template: "%s | TW AUTO TUNE",
  },
  description:
    "TW AUTO TUNE workshop management, invoices, jobs, vehicles and inventory system.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full bg-slate-100">
        <AuthGuard>{children}</AuthGuard>

        <footer className="no-print border-t border-slate-200 bg-white/80 px-4 py-3 text-center text-[11px] text-slate-400">
          System developed by{" "}
          <a
            href="https://nenux.com.au"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-slate-500 transition hover:text-red-600 hover:underline"
          >
            Nenux Web Solutions
          </a>
        </footer>
      </body>
    </html>
  );
}
