import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { createClient } from './supabase';

import type {
  Campaign,
  CreateCampaignPayload,
  StatusUpdatePayload,
  ExtractedData,
  DashboardStats,
  ApiError,
  PaginatedCampaigns,
  CampaignStatus,
} from './types';

// ─── Base URL Resolution ──────────────────────────────────────────────────────
const PRODUCTION_API_URL = 'https://api.mycollabo.online';

const baseURL =
  (process.env.NEXT_PUBLIC_API_URL ?? '').trim() || PRODUCTION_API_URL;

if (process.env.NODE_ENV === 'development') {
  console.log(
    `[API] baseURL resolved to: ${baseURL}` +
      (process.env.NEXT_PUBLIC_API_URL
        ? ' (from NEXT_PUBLIC_API_URL)'
        : ' (fallback — NEXT_PUBLIC_API_URL is not set)')
  );
}

// ─── Axios Instance ───────────────────────────────────────────────────────────
const api = axios.create({
  baseURL,
  timeout: 15_000, // 15 seconds for standard API calls
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Create a single Supabase client instance for the browser
// createBrowserClient from @supabase/ssr caches itself, but moving it here ensures zero overhead
const supabase = createClient();

// ─── Request Interceptor: Auto-inject Supabase JWT ───────────────────────────
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  }

  return config;
});

// ─── Response Interceptor: Handle 401 globally ───────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await supabase.auth.signOut();
      
      // Graceful fallback for redirection
      if (typeof window !== 'undefined') {
        window.location.assign('/login');
      }
    }

    if (process.env.NODE_ENV === 'development') {
      if (error.response) {
        console.error(`[API] Error ${error.response.status}:`, error.response.data);
      } else if (error.request) {
        console.error(
          '[API] No response received. This is usually a CORS block or network error.',
          '\n  Target URL:', baseURL,
          '\n  Error code:', error.code
        );
      } else {
        console.error('[API] Request setup error:', error.message);
      }
    }

    return Promise.reject(error);
  }
);

// ─── Error Message Helper ─────────────────────────────────────────────────────
export function getApiErrorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiError | undefined;

    if (typeof data?.detail === 'string' && data.detail.trim()) {
      return data.detail;
    }

    if (Array.isArray(data?.detail) && data.detail.length > 0) {
      const first = data.detail[0];
      const fieldPath = first.loc?.slice(1).join(' → ') ?? '';
      return fieldPath ? `${fieldPath}: ${first.msg}` : first.msg;
    }

    if (err.code === 'ECONNABORTED') {
      return 'Request timed out. The server may be starting up — please try again in a moment.';
    }

    if (!err.response) {
      const isNetworkError =
        err.code === 'ERR_NETWORK' ||
        err.code === 'ERR_NAME_NOT_RESOLVED' ||
        err.message?.toLowerCase().includes('network');

      if (isNetworkError) {
        return (
          'Cannot reach the server. This may be a temporary network issue — ' +
          'please check your internet connection and try again.'
        );
      }

      return (
        'Cannot reach the server. The backend may be starting up. ' +
        'Please wait 30 seconds and try again.'
      );
    }

    const status = err.response.status;
    if (status === 429) return 'Too many requests. Please wait a moment and try again.';
    if (status === 503) return 'Service is temporarily unavailable. Please try again shortly.';
    if (status === 404) return 'Resource not found.';
    if (status === 403) return 'You do not have permission to perform this action.';
    if (status >= 500) return 'Server error. Our team has been notified — please try again later.';
  }

  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

// ─── Campaign API Calls ───────────────────────────────────────────────────────

/** Fetch all campaigns for the current authenticated user. */
// Limit bumped to 200 per user request to avoid truncation without pagination
export async function getCampaigns(limit = 200, offset = 0): Promise<PaginatedCampaigns> {
  const res = await api.get<PaginatedCampaigns>('/campaigns/', { params: { limit, offset } });
  return res.data;
}

/** Create a new campaign. */
export async function createCampaign(payload: CreateCampaignPayload): Promise<Campaign> {
  const res = await api.post<Campaign>('/campaigns/', payload);
  return res.data;
}

/** Update all fields of an existing campaign. */
export async function updateCampaign(
  id: string,
  payload: CreateCampaignPayload
): Promise<Campaign> {
  const res = await api.put<Campaign>(`/campaigns/${id}`, payload);
  return res.data;
}

/** Update only the status of a campaign. */
export async function updateCampaignStatus(
  id: string,
  payload: StatusUpdatePayload
): Promise<Campaign> {
  const res = await api.patch<Campaign>(`/campaigns/${id}/status`, payload);
  return res.data;
}

/** Delete a campaign. */
export async function deleteCampaign(id: string): Promise<void> {
  await api.delete(`/campaigns/${id}`);
}

// ─── AI Extraction API Call ───────────────────────────────────────────────────

/**
 * Upload a file (image, pdf, text) to the AI extraction endpoint.
 * Returns extracted campaign data. May include requires_human_review=true.
 */
export async function extractFromFile(file: File): Promise<ExtractedData> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await api.post<ExtractedData>('/extract/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 150_000, // 150s timeout for AI extraction
    });
    return res.data;
  } catch (err: unknown) {
    // If it's a timeout error
    if (axios.isAxiosError(err) && err.code === 'ECONNABORTED') {
      throw new Error('Request timed out. The file might be too large or the AI is taking too long.');
    }
    // Propagate standard API errors via our helper
    throw new Error(getApiErrorMessage(err, 'AI extraction failed.'));
  }
}

// ─── Settings API Calls ─────────────────────────────────────────────────────────
export interface UserSettings {
  whatsapp_number: string | null;
  email_reminders_enabled: boolean;
  whatsapp_reminders_enabled: boolean;
  username: string | null;
  telegram_username: string | null;
  whatsapp_verified?: boolean;
  whatsapp_verified_at?: string | null;
  verification_status?: 'connected' | 'pending' | 'failed' | 'not_connected';
}

export async function saveWhatsAppNumber(payload: { 
  whatsapp_number?: string, 
  email_reminders_enabled: boolean, 
  whatsapp_reminders_enabled: boolean,
  username?: string,
  telegram_username?: string
}): Promise<{ message: string } & UserSettings> {
  const res = await api.post('/settings/whatsapp', payload);
  return res.data;
}

export async function getUserSettings(): Promise<any> {
  try {
    const res = await api.get('/settings/whatsapp');
    return res.data;
  } catch (err: unknown) {
    throw new Error(getApiErrorMessage(err, 'Failed to fetch user settings.'));
  }
}

export async function verifyWhatsAppConnection(): Promise<any> {
  try {
    const res = await api.post('/settings/whatsapp/verify');
    return res.data;
  } catch (err: unknown) {
    throw new Error(getApiErrorMessage(err, 'Failed to verify WhatsApp connection.'));
  }
}

export async function getWhatsAppNumber(): Promise<UserSettings> {
  const res = await api.get('/settings/whatsapp');
  return res.data;
}

// ─── Reporting API Calls ────────────────────────────────────────────────────────

export async function downloadReport(month: string, format: 'pdf' | 'excel'): Promise<void> {
  // Use axios to fetch the file as a blob so the JWT token is included
  const res = await api.get('/campaigns/reports/monthly', {
    params: { month, format },
    responseType: 'blob'
  });
  
  // Create a temporary link to trigger the browser download
  const blob = new Blob([res.data], { 
    type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Collabo_Report_${month}.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// ─── Client-side Dashboard Stats Computation ─────────────────────────────────

export function computeDashboardStats(campaigns: Campaign[]): DashboardStats {
  const now = new Date();
  const sevenDaysLater = new Date(now);
  sevenDaysLater.setDate(now.getDate() + 7);

  const active    = campaigns.filter(c => c.status === 'active');
  const completed = campaigns.filter(c => c.status === 'paid');
  const cancelled = campaigns.filter(c => c.status === 'cancelled');
  const overdue   = active.filter(c => c.deadline && new Date(c.deadline) < now);

  const upcomingDeadlines = active
    .filter(c => {
      if (!c.deadline) return false;
      const d = new Date(c.deadline);
      return d >= now && d <= sevenDaysLater;
    })
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());

  const closedCount = completed.length + cancelled.length;
  const successRate = closedCount > 0
    ? Math.round((completed.length / closedCount) * 100)
    : 0;

  const paidCampaigns = campaigns.filter(c => (c.payment_amount || 0) > 0);
  const totalSpend   = campaigns.reduce((s, c) => s + (c.payment_amount || 0), 0);
  const pendingSpend = active.reduce((s, c) => s + (c.payment_amount || 0), 0);
  const avgPayment   = paidCampaigns.length > 0
    ? Math.round(totalSpend / paidCampaigns.length)
    : 0;

  return {
    total: campaigns.length,
    active: active.length,
    overdue: overdue.length,
    completed: completed.length,
    cancelled: cancelled.length,
    totalSpend,
    pendingSpend,
    successRate,
    avgPayment,
    upcomingDeadlines,
  };
}

// ─── AI Insights & Health Engine (Phase 2) ────────────────────────────────────

import type { HealthStatus, CampaignAction, DashboardInsights } from './types';

export function computeHealthAndInsights(campaigns: Campaign[]): DashboardInsights {
  let healthyCount = 0;
  let needsAttentionCount = 0;
  let criticalCount = 0;
  
  const todayPriorities: CampaignAction[] = [];
  const recommendedActions: CampaignAction[] = [];
  
  const now = new Date();
  
  for (const c of campaigns) {
    if (c.status === 'cancelled' || c.status === 'rejected') continue;
    
    let isCritical = false;
    let isNeedsAttention = false;
    
    // 1. Deadline Check
    if (c.status === 'active' && c.deadline) {
      const deadline = new Date(c.deadline);
      const daysUntil = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysUntil < 0) {
        isCritical = true;
        todayPriorities.push({
          id: `crit-dl-${c.id}`,
          campaignId: c.id,
          influencerName: c.influencer_name || c.influencer_handle,
          actionText: 'Follow Up (Overdue)',
          priority: 'Critical',
          reason: 'Deadline has passed'
        });
      } else if (daysUntil <= 1) {
        isCritical = true;
        todayPriorities.push({
          id: `crit-dl-${c.id}`,
          campaignId: c.id,
          influencerName: c.influencer_name || c.influencer_handle,
          actionText: 'Send Reminder',
          priority: 'Critical',
          reason: 'Deadline is today or tomorrow'
        });
      } else if (daysUntil <= 3) {
        isNeedsAttention = true;
        recommendedActions.push({
          id: `med-dl-${c.id}`,
          campaignId: c.id,
          influencerName: c.influencer_name || c.influencer_handle,
          actionText: 'Check Status',
          priority: 'Medium',
          reason: 'Deadline approaching in 3 days'
        });
      }
    }
    
    // 2. Payment Check
    if (c.status === 'paid' && c.updated_at) {
      const completedAt = new Date(c.updated_at);
      const daysSince = (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSince >= 7) {
        isCritical = true;
        todayPriorities.push({
          id: `crit-pay-${c.id}`,
          campaignId: c.id,
          influencerName: c.influencer_name || c.influencer_handle,
          actionText: 'Process Payment',
          priority: 'Critical',
          reason: 'Payment overdue (7+ days)'
        });
      } else if (daysSince >= 3) {
        isNeedsAttention = true;
        recommendedActions.push({
          id: `med-pay-${c.id}`,
          campaignId: c.id,
          influencerName: c.influencer_name || c.influencer_handle,
          actionText: 'Mark Paid',
          priority: 'Medium',
          reason: 'Payment pending for 3 days'
        });
      }
    }
    
    // 3. Creator Inactivity Check
    if (c.status === 'active' && c.updated_at) {
      const updatedAt = new Date(c.updated_at);
      const daysInactive = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysInactive >= 5) {
        isNeedsAttention = true; // Wait, user said "Creator Follow-up Required (Inactive 5+ days or overdue)" in Today's priorities
        todayPriorities.push({
          id: `crit-inac-${c.id}`,
          campaignId: c.id,
          influencerName: c.influencer_name || c.influencer_handle,
          actionText: 'Follow Up',
          priority: 'Medium', // Treated as priority today
          reason: 'Creator inactive for 5+ days'
        });
      } else if (daysInactive >= 3) {
        recommendedActions.push({
          id: `low-inac-${c.id}`,
          campaignId: c.id,
          influencerName: c.influencer_name || c.influencer_handle,
          actionText: 'Send Nudge',
          priority: 'Low',
          reason: 'Creator inactive for 3 days'
        });
      }
    }
    
    // Assign Health
    if (isCritical) criticalCount++;
    else if (isNeedsAttention) needsAttentionCount++;
    else if (c.status === 'paid' || c.status === 'active') healthyCount++;
  }
  
  // Sort priorities (Critical first)
  todayPriorities.sort((a, b) => (a.priority === 'Critical' ? -1 : 1));
  recommendedActions.sort((a, b) => (a.priority === 'Medium' ? -1 : 1));

  // Founder Productivity Metrics
  // Formula: 30 mins saved per campaign managed, 10 mins per extraction, etc.
  const campaignsManaged = campaigns.filter(c => c.status !== 'draft' && c.status !== 'cancelled').length;
  const deadlinesProtected = campaigns.filter(c => c.status === 'paid').length;
  // Estimate extractions (e.g., 80% of campaigns used AI extraction)
  const aiExtractions = Math.round(campaigns.length * 0.8);
  const paymentsTracked = campaigns.filter(c => c.payment_amount > 0 && c.status === 'paid').length;
  const creatorFollowUpsAutomated = Math.round(campaignsManaged * 1.5);
  
  const estimatedTimeSavedHours = Math.round((campaignsManaged * 30 + aiExtractions * 10) / 60);

  return {
    healthyCount,
    needsAttentionCount,
    criticalCount,
    todayPriorities,
    recommendedActions,
    productivity: {
      campaignsManaged,
      aiExtractions,
      deadlinesProtected,
      paymentsTracked,
      creatorFollowUpsAutomated,
      estimatedTimeSavedHours
    }
  };
}

// ─── Phase 2: Bulk Actions, Influencers, Billing ──────────────────────────────

export async function bulkUpdateStatus(campaign_ids: string[], status: CampaignStatus): Promise<void> {
  await api.patch('/campaigns/bulk/status', { campaign_ids, status });
}

export async function bulkDeleteCampaigns(campaign_ids: string[]): Promise<void> {
  await api.delete('/campaigns/bulk/delete', { data: { campaign_ids } });
}

export async function bulkRemindCampaigns(campaignIds: string[]): Promise<void> {
  await api.post('/campaigns/bulk/remind', { campaign_ids: campaignIds });
}

export async function loadSampleDataApi(): Promise<Campaign[]> {
  const res = await api.post<Campaign[]>('/campaigns/sample-data');
  return res.data;
}

export interface InfluencerProfile {
  handle: string;
  name: string | null;
  platform: string | null;
  notes: string | null;
  total_campaigns: number;
  success_rate: number;
  last_collaboration: string | null;
}

export async function getInfluencers(): Promise<InfluencerProfile[]> {
  const res = await api.get<InfluencerProfile[]>('/influencers/');
  return res.data;
}

export async function updateInfluencerProfile(handle: string, data: { name?: string, platform?: string, notes?: string }): Promise<InfluencerProfile> {
  const res = await api.patch<InfluencerProfile>(`/influencers/${handle}`, data);
  return res.data;
}

export interface BillingUsage {
  current_plan: string;
  trial_ends_at: string | null;
  campaigns_this_month: number;
  ai_extractions_used: number;
}

export async function getBillingUsage(): Promise<BillingUsage> {
  const res = await api.get<BillingUsage>('/billing/usage');
  return res.data;
}

export interface RazorpayOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
}

export async function createRazorpayOrder(): Promise<RazorpayOrderResponse> {
  const res = await api.post<RazorpayOrderResponse>('/billing/create-razorpay-order', {});
  return res.data;
}

export interface RazorpayVerificationPayload {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export async function verifyRazorpayPayment(payload: RazorpayVerificationPayload): Promise<{ status: string; message: string }> {
  const res = await api.post('/billing/verify-payment', payload);
  return res.data;
}

export default api;
