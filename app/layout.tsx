import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import Link from "next/link";
import AuthStatus from "@/components/AuthStatus";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "Job Application Automator",
  description: "Tailor your resume to any JD and email it to HR in one click.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${outfit.variable}`}>
      <body suppressHydrationWarning>
        <div className="min-h-screen">
          <header className="sticky top-0 z-50 border-b border-white/10 bg-dark-900/60 backdrop-blur-md">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <Link href="/" className="flex items-center gap-3 font-display font-bold text-white transition hover:text-brand-400">
                <span className="text-2xl">🎯</span> Job Application Automator
              </Link>
              <AuthStatus />
            </div>
          </header>
          <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
