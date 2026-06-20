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
    icon: [
      { url: '/logo-icon.png', type: 'image/png' },
    ],
    shortcut: '/logo-icon.png',
    apple: [
      { url: '/logo-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: "Collabo — AI-powered Influencer Campaign Management",
    description: "AI-powered influencer campaign management for D2C brands. Forward WhatsApp chats, auto-extract campaign data.",
    type: "website",
    images: [
      {
        url: '/logo-full.png',
        width: 1200,
        height: 315,
        alt: 'Collabo Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Collabo — AI-powered Influencer Campaign Management',
    description: 'AI-powered influencer campaign management for D2C brands.',
    images: ['/logo-full.png'],
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
