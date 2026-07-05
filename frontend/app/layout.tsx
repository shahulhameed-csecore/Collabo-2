import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { GoogleOAuthProvider } from "@react-oauth/google";
import Script from 'next/script';
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
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
};

export const metadata: Metadata = {
  // metadataBase is REQUIRED on Vercel: it converts relative paths like
  // '/logo-full.png' into absolute URLs ('https://mycollabo.online/logo-full.png')
  // for Open Graph and Twitter card previews. Without it, social scrapers
  // get a relative URL and show no image.
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://mycollabo.online'),

  title: {
    template: 'Collabo — %s',
    default: 'Collabo — AI-powered Influencer Campaign Management',
  },
  description:
    'Manage your micro-influencer campaigns with AI-powered extraction and real-time tracking. Built for Indian D2C brands.',
  keywords: [
    'influencer marketing', 'campaign management', 'D2C brands',
    'India', 'micro-influencer', 'WhatsApp bot', 'AI extraction',
  ],
  authors: [{ name: 'Collabo', url: process.env.NEXT_PUBLIC_BASE_URL || 'https://mycollabo.online' }],

  icons: {
    icon: [{ url: '/logo-icon.png', type: 'image/png' }],
    shortcut: '/logo-icon.png',
    apple: [{ url: '/logo-icon.png', sizes: '180x180', type: 'image/png' }],
  },

  openGraph: {
    title: 'Collabo — AI-powered Influencer Campaign Management',
    description:
      'Forward WhatsApp negotiations to our AI bot. Instantly extract campaign data and track deadlines in your dashboard.',
    url: process.env.NEXT_PUBLIC_BASE_URL || 'https://mycollabo.online',
    siteName: 'Collabo',
    type: 'website',
    locale: 'en_IN',
    images: [
      {
        url: '/logo-full.png',   // resolved to absolute by metadataBase
        width: 1200,
        height: 630,
        alt: 'Collabo — AI-powered Influencer Campaign Management',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    site: '@collabo_app',
    title: 'Collabo — AI-powered Influencer Campaign Management',
    description: 'AI-powered influencer campaign management for Indian D2C brands.',
    images: ['/logo-full.png'],
  },

  verification: {
    other: {
      'facebook-domain-verification': 'tegazrw12gvnjbmeyoi1qedcny9gs2',
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors duration-200">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}>
            {children}
          </GoogleOAuthProvider>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#f1f5f9',
                borderRadius: '12px',
                fontSize: '13px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              },
            }}
            richColors
            closeButton
          />
          <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
        </ThemeProvider>
      </body>
    </html>
  );
}
