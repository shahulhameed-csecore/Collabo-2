/**
 * Local Development UI-Preview Authentication Bypass
 * 
 * CRITICAL SECURITY RULE:
 * This module is strictly active ONLY when process.env.NODE_ENV === 'development'.
 * In production builds (e.g. on Vercel / mycollabo.online), all bypass functions
 * evaluate to false/null and all calls fall back cleanly to production Supabase auth.
 */

import type { User, Session } from '@supabase/supabase-js';

export const isDevEnvironment = process.env.NODE_ENV === 'development';

/**
 * Checks whether the local development UI preview bypass is enabled.
 * Supported triggers:
 * 1. process.env.NODE_ENV === 'development' (MANDATORY REQUIREMENT)
 * AND one of:
 * 2. URL parameter `?dev_preview=true`
 * 3. localStorage.getItem('COLLABO_DEV_BYPASS') === 'true'
 * 4. process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true'
 * 5. Cookie `collabo_dev_bypass=true` or `collabo-test-session`
 */
export function isDevAuthBypassEnabled(): boolean {
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }

  // Server-side environment check
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true';
  }

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const queryBypass = urlParams.get('dev_preview');
    
    // Explicit enable via URL query param: ?dev_preview=true
    if (queryBypass === 'true') {
      window.localStorage.setItem('COLLABO_DEV_BYPASS', 'true');
      document.cookie = 'collabo_dev_bypass=true; path=/; max-age=86400; SameSite=Lax';
      return true;
    }

    // Explicit disable via URL query param: ?dev_preview=false
    if (queryBypass === 'false') {
      window.localStorage.removeItem('COLLABO_DEV_BYPASS');
      document.cookie = 'collabo_dev_bypass=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
      return false;
    }

    // If the user has a real Supabase session stored, NEVER bypass with mock auth
    const hasRealSession = Object.keys(window.localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (hasRealSession && queryBypass !== 'true') {
      return false;
    }

    // Check stored preference or env flag or cookies
    const storedBypass = window.localStorage.getItem('COLLABO_DEV_BYPASS') === 'true';
    const envBypass = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true';
    const cookieBypass = document.cookie.includes('collabo_dev_bypass=true') || document.cookie.includes('collabo-test-session');

    return storedBypass || envBypass || cookieBypass;
  } catch {
    return false;
  }
}

/**
 * Mock Fallback User for Local Dev UI Preview
 */
export const DEV_MOCK_USER: User = {
  id: 'dev-user',
  app_metadata: {
    provider: 'email',
    providers: ['email'],
  },
  user_metadata: {
    full_name: 'Dev Preview User',
    name: 'Dev Preview User',
  },
  aud: 'authenticated',
  confirmation_sent_at: '2026-01-01T00:00:00.000Z',
  confirmed_at: '2026-01-01T00:00:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
  email: 'dev@mycollabo.online',
  email_confirmed_at: '2026-01-01T00:00:00.000Z',
  last_sign_in_at: '2026-01-01T00:00:00.000Z',
  phone: '',
  role: 'authenticated',
  updated_at: '2026-01-01T00:00:00.000Z',
} as unknown as User;

/**
 * Mock Fallback Session for Local Dev UI Preview
 */
export const DEV_MOCK_SESSION: Session = {
  access_token: 'mock-dev-access-token',
  refresh_token: 'mock-dev-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: DEV_MOCK_USER,
} as unknown as Session;

/**
 * Graceful Mock Fallback Responses for API calls when in Dev Bypass Mode
 */
export function getDevMockApiResponse(url: string, _method: string = 'get'): any {
  const cleanUrl = url.toLowerCase();

  // 1. Billing Usage & Plans
  if (cleanUrl.includes('/billing/usage')) {
    return {
      current_plan: 'pro',
      trial_ends_at: '2026-10-29T00:00:00.000Z',
      campaigns_this_month: 7,
      total_campaigns: 7,
      ai_extractions_used: 91,
      is_trial: false,
      is_paid: true,
    };
  }

  // 2. Razorpay Order Creation
  if (cleanUrl.includes('/billing/create-razorpay-order')) {
    return {
      order_id: 'order_dev_preview_mock_999',
      amount: 30000,
      currency: 'INR',
    };
  }

  // 3. Razorpay Payment Verification
  if (cleanUrl.includes('/billing/verify-payment')) {
    return {
      status: 'success',
      message: 'Payment verified successfully (Dev Preview)',
    };
  }

  // 4. WhatsApp Settings & Integrations
  if (cleanUrl.includes('/settings/whatsapp')) {
    if (cleanUrl.includes('/verify')) {
      return { message: 'WhatsApp test ping successful (Dev Preview)', status: 'connected' };
    }
    if (cleanUrl.includes('/generate-code')) {
      return { code: 'COLLABO-7788' };
    }
    if (cleanUrl.includes('/unlink')) {
      return { message: 'WhatsApp unlinked successfully (Dev Preview)' };
    }
    return {
      whatsapp_number: '+919807610000',
      email_reminders_enabled: true,
      whatsapp_reminders_enabled: true,
      username: 'devuser',
      telegram_username: null,
      whatsapp_verified: true,
      whatsapp_verified_at: '2026-10-19T10:00:00.000Z',
      verification_status: 'connected',
      message: 'Settings loaded (Dev Preview)',
    };
  }

  // 5. Telegram Settings
  if (cleanUrl.includes('/settings/telegram')) {
    if (cleanUrl.includes('/generate-code')) {
      return { code: 'TG-1234' };
    }
    if (cleanUrl.includes('/unlink')) {
      return { message: 'Telegram account unlinked (Dev Preview)' };
    }
    return { code: 'TG-1234' };
  }

  // 6. Campaigns List & Stats
  if (cleanUrl.includes('/campaigns')) {
    if (cleanUrl.includes('/bulk')) {
      return { message: 'Bulk action simulated successfully (Dev Preview)' };
    }
    const mockCampaigns = [
      {
        id: 'dev-camp-1',
        brand_name: 'Acme Studio',
        influencer_name: 'Priya Sharma',
        influencer_handle: '@priyasharma',
        platform: 'instagram',
        deliverables: '1 Reel + 2 Stories',
        payment_amount: 35000,
        deadline: '2026-10-25T18:00:00.000Z',
        status: 'active',
        created_at: '2026-10-01T10:00:00.000Z',
      },
      {
        id: 'dev-camp-2',
        brand_name: 'HyperDrive Tech',
        influencer_name: 'Rohan Mehta',
        influencer_handle: '@rohanmehta',
        platform: 'youtube',
        deliverables: '1 Dedicated Video',
        payment_amount: 80000,
        deadline: '2026-11-05T18:00:00.000Z',
        status: 'content_received',
        created_at: '2026-10-05T10:00:00.000Z',
      },
      {
        id: 'dev-camp-3',
        brand_name: 'Glow Skincare',
        influencer_name: 'Ananya Roy',
        influencer_handle: '@ananyaskincare',
        platform: 'instagram',
        deliverables: '2 Static Posts',
        payment_amount: 25000,
        deadline: '2026-10-30T18:00:00.000Z',
        status: 'approved',
        created_at: '2026-10-10T10:00:00.000Z',
      },
    ];
    return {
      data: mockCampaigns,
      campaigns: mockCampaigns,
      count: mockCampaigns.length,
      total: mockCampaigns.length,
      limit: 200,
      offset: 0,
    };
  }

  // 7. Influencer CRM Profiles
  if (cleanUrl.includes('/influencers')) {
    return [
      {
        handle: '@priyasharma',
        name: 'Priya Sharma',
        platform: 'instagram',
        notes: 'Top performing lifestyle creator, rapid response',
        total_campaigns: 3,
        total_spend: 105000,
        success_rate: 100,
        last_collaboration: '2026-10-15T00:00:00.000Z',
      },
      {
        handle: '@rohanmehta',
        name: 'Rohan Mehta',
        platform: 'youtube',
        notes: 'Tech reviewer, high CTR & conversion',
        total_campaigns: 2,
        total_spend: 160000,
        success_rate: 100,
        last_collaboration: '2026-10-12T00:00:00.000Z',
      },
    ];
  }

  return { message: 'Mock response (Dev Preview Mode)' };
}
