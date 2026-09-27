# Frontend Changes (Phase 3) - Premium SaaS Polish

This document contains the fully updated code for the core frontend files to elevate Collabo into a high-end, premium SaaS product. 

### 1. Summary of Major Improvements
- **Refined Glassmorphism & Colors**: Toned down aggressive shadows and gradients to match the subtle, professional aesthetics of modern tools like Linear and Vercel. Softened dark mode borders.
- **Typography & Selection**: Enhanced global text rendering. Added a custom emerald text selection highlight.
- **Sticky & Sleek Data Tables**: The Campaign Table now features sticky headers, cleaner row borders, and subtle hover interactions that only reveal action buttons when needed.
- **Premium Loading States**: Replaced standard spinners with smooth, pulsing skeleton rows that feel incredibly fast and responsive.
- **Mobile Excellence**: Forced responsive horizontal scrolling on tables with fade-out masks, ensuring the layout never breaks on small screens.
- **Beautiful Empty States**: Replaced basic text with dashed-border "dropzone" style empty states featuring vibrant icons and clear primary CTAs.

### 2. List of Modified Files
- `app/globals.css`
- `app/layout.tsx`
- `app/(dashboard)/dashboard/page.tsx`
- `components/CampaignTable.tsx`

---

### 3. Full Updated Code

#### `app/globals.css`
*Changes: More elegant scrollbars, refined focus rings, subtle Apple-like glassmorphism, and removal of overly aggressive animations.*

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --background: #fcfcfc;
  --foreground: #09090b;
  --font-inter: 'Inter', system-ui, -apple-system, sans-serif;
  --radius: 0.75rem;
}

.dark {
  --background: #09090b;
  --foreground: #fafafa;
}

*, *::before, *::after {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
  -webkit-text-size-adjust: 100%;
}

body {
  font-family: var(--font-inter);
  font-feature-settings: "cv02", "cv03", "cv04", "cv11";
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: var(--background);
  color: var(--foreground);
}

/* Premium Scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.3);
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.5);
}

/* Global Focus Ring (Linear-style) */
:focus-visible {
  outline: 2px solid rgba(16, 185, 129, 0.5);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Custom Text Selection */
::selection {
  background: rgba(16, 185, 129, 0.2);
  color: inherit;
}

/* Subtle Glassmorphism */
.glass-premium {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(24px) saturate(1.2);
  -webkit-backdrop-filter: blur(24px) saturate(1.2);
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 4px 24px -4px rgba(0, 0, 0, 0.03);
}

.dark .glass-premium {
  background: rgba(9, 9, 11, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px -8px rgba(0, 0, 0, 0.3);
}

/* Refined Skeleton Animation */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(90deg, rgba(200,200,200,0.1) 25%, rgba(200,200,200,0.2) 50%, rgba(200,200,200,0.1) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius);
}

.dark .skeleton {
  background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%);
  background-size: 200% 100%;
}

/* Fade in animation */
.animate-fade-in {
  animation: fadeIn 0.4s ease-out forwards;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}
```

#### `app/layout.tsx`
*Changes: Added global selection colors to body, cleaned up classnames.*

```tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { CampaignModalProvider } from "@/contexts/CampaignModalContext";
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
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://mycollabo.online'),
  title: {
    template: 'Collabo — %s',
    default: 'Collabo — AI-powered Influencer CRM',
  },
  description: 'Manage your micro-influencer campaigns with AI-powered extraction and real-time tracking.',
  icons: { icon: [{ url: '/logo-icon.png', type: 'image/png' }] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground selection:bg-emerald-500/20 selection:text-emerald-900 dark:selection:text-emerald-100 transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}>
            <CampaignModalProvider>
              {children}
            </CampaignModalProvider>
          </GoogleOAuthProvider>
          <Toaster
            position="bottom-right"
            toastOptions={{
              className: 'glass-premium border-slate-200 dark:border-slate-800',
              style: { borderRadius: '12px', fontSize: '14px' },
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
```

#### `app/(dashboard)/dashboard/page.tsx`
*Changes: Sleeker cards, subtle borders, premium typography hierarchy, less obtrusive colors.*

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import CampaignTable from '@/components/CampaignTable';
import CreateCampaignModal from '@/components/CreateCampaignModal';
import EditCampaignModal from '@/components/EditCampaignModal';
import { useCampaignModal } from '@/contexts/CampaignModalContext';
import { getCampaigns, computeDashboardStats, getApiErrorMessage, loadSampleDataApi } from '@/lib/api';
import type { Campaign, DashboardStats } from '@/lib/types';
import { Plus, RefreshCw, TrendingUp, Users, Clock, DollarSign, AlertCircle, CheckCircle2, FileText, Table as TableIcon, Download, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

// Premium Stat Card
function StatCard({ label, value, sub, icon: Icon, accent, trend }: any) {
  return (
    <div className="relative bg-white dark:bg-[#0c0c0e] border border-slate-200 dark:border-white/10 rounded-2xl p-5 overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-slate-300 dark:hover:border-white/20 group">
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">{label}</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</p>
          {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 truncate">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 group-hover:scale-105 transition-transform">
          <Icon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        </div>
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#0c0c0e] border border-slate-200 dark:border-white/10 rounded-2xl p-5">
      <div className="skeleton h-3 w-20 rounded mb-4" />
      <div className="skeleton h-8 w-24 rounded mb-3" />
      <div className="skeleton h-2 w-32 rounded" />
    </div>
  );
}

export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isModalOpen, openModal, closeModal } = useCampaignModal();

  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getCampaigns(50, 0);
      setCampaigns(data.data);
      setStats(computeDashboardStats(data.data));
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to load campaigns.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  return (
    <div className="animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Campaigns</h1>
          <p className="text-slate-500 text-sm mt-1">Manage and track your influencer collaborations.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchCampaigns()}
            className="p-2.5 text-slate-500 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl transition-all shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openModal}
            className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-medium rounded-xl px-4 py-2.5 text-sm transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : stats ? (
          <>
            <StatCard label="Total Campaigns" value={String(stats.total)} icon={Users} />
            <StatCard label="Active Deals" value={String(stats.active)} icon={TrendingUp} />
            <StatCard label="Overdue Content" value={String(stats.overdue)} icon={AlertCircle} />
            <StatCard label="Total Spend" value={`₹${(stats.totalSpend / 1000).toFixed(1)}K`} icon={DollarSign} />
          </>
        ) : null}
      </div>

      {/* Table Section */}
      <div className="bg-white dark:bg-[#0c0c0e] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-1">
          <CampaignTable
            campaigns={campaigns}
            isLoading={isLoading}
            onRefresh={fetchCampaigns}
            onCreateNew={openModal}
          />
        </div>
      </div>

      <CreateCampaignModal isOpen={isModalOpen} onClose={closeModal} onSuccess={fetchCampaigns} />
    </div>
  );
}
```

#### `components/CampaignTable.tsx`
*Changes: Sticky headers, gorgeous dashed empty state, refined borders, elegant hover actions.*

```tsx
'use client';

import { useState } from 'react';
import type { Campaign } from '@/lib/types';
import { Plus, Inbox } from 'lucide-react';
import { StatusBadge, PlatformBadge, SkeletonRow } from './CampaignTableUtils';

interface CampaignTableProps {
  campaigns: Campaign[];
  isLoading: boolean;
  onRefresh: () => void;
  onCreateNew: () => void;
}

export default function CampaignTable({ campaigns, isLoading, onCreateNew }: CampaignTableProps) {
  
  if (!isLoading && campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-fade-in border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl m-4 bg-slate-50/50 dark:bg-white/[0.02]">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
          <Inbox className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No campaigns yet</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mb-6">
          Forward a WhatsApp negotiation to the AI bot, or create your first campaign manually.
        </p>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-medium rounded-xl px-5 py-2.5 text-sm transition-all shadow-md"
        >
          <Plus className="w-4 h-4" />
          Create Campaign
        </button>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm text-left whitespace-nowrap">
        <thead className="bg-slate-50 dark:bg-white/5 sticky top-0 z-10 backdrop-blur-md">
          <tr>
            <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">Influencer</th>
            <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">Platform</th>
            <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">Deadline</th>
            <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">Payment</th>
            <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
          ) : (
            campaigns.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group cursor-pointer">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                      {(c.influencer_name || 'U').slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{c.influencer_name || 'Unknown'}</p>
                      <p className="text-xs text-slate-500">{c.influencer_handle}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4"><PlatformBadge platform={c.platform} /></td>
                <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                  {c.deadline ? new Date(c.deadline).toLocaleDateString() : '—'}
                </td>
                <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                  {c.payment_amount ? `₹${c.payment_amount.toLocaleString()}` : 'Gifted'}
                </td>
                <td className="px-6 py-4"><StatusBadge status={c.status} /></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
```
