import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
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
  title: "InfluencerTrack — Campaign Manager",
  description: "Manage your micro-influencer campaigns with AI-powered extraction and real-time tracking.",
  keywords: ["influencer marketing", "campaign management", "D2C brands", "India"],
  openGraph: {
    title: "InfluencerTrack",
    description: "AI-powered influencer campaign management for D2C brands.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-950 text-white">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#f1f5f9',
            },
          }}
          richColors
        />
      </body>
    </html>
  );
}
