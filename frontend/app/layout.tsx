import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: {
    template: 'Collabo — %s',
    default: 'Collabo',
  },
  description: "Manage your micro-influencer campaigns with AI-powered extraction and real-time tracking.",
  keywords: ["influencer marketing", "campaign management", "D2C brands", "India"],
  icons: {
    icon: '/logo-icon.png',
    shortcut: '/logo-icon.png',
    apple: '/logo-icon.png',
    other: {
      rel: 'apple-touch-icon-precomposed',
      url: '/logo-icon.png',
    },
  },
  openGraph: {
    title: "Collabo",
    description: "AI-powered influencer campaign management for D2C brands.",
    type: "website",
  },
  verification: {
    other: {
      "facebook-domain-verification": "8xf7nmugvhpww8kfivu8gpnzur6fpx",
    },
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
