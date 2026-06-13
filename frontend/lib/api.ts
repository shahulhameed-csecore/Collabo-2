import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { createClient } from './supabase';
import type {
  Campaign,
  CreateCampaignPayload,
  StatusUpdatePayload,
  ExtractedData,
  DashboardStats,
  ApiError,
} from './types';

// ─── Base URL Resolution ──────────────────────────────────────────────────────
// Hard-coded fallback ensures production works even if the Vercel env var is
// not configured. NEXT_PUBLIC_* vars MUST be set at build time; they are NOT
// read from .env.local in CI/Vercel — you must add them in the Vercel dashboard.
const PRODUCTION_API_URL = 'https://collabo-2.onrender.com';

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
  timeout: 60_000, // 60 seconds — generous for AI extraction
  headers: { 'Content-Type': 'application/json' },
  // Tell axios to send cookies & accept cross-origin responses
  withCredentials: false,
});

// ─── Request Interceptor: Auto-inject Supabase JWT ───────────────────────────
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const supabase = createClient();
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
      const supabase = createClient();
      await supabase.auth.signOut();
      if (typeof window !== 'undefined') window.location.href = '/login';
    }

    if (process.env.NODE_ENV === 'development') {
      if (error.response) {
        console.error(`[API] Error ${error.response.status}:`, error.response.data);
      } else if (error.request) {
        // Request was made but no response received — likely CORS or network issue
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
/**
 * Extracts a user-friendly message from an API error.
 * Falls back to a generic message if nothing can be parsed.
 *
 * Handles:
 * - FastAPI validation errors (array of {loc, msg, type})
 * - Plain string detail errors
 * - Network timeouts (ECONNABORTED)
 * - CORS / no-response errors (ERR_NETWORK, ERR_NAME_NOT_RESOLVED)
 * - Rate-limit responses (429)
 * - Service unavailable (503)
 * - No network connection
 */
export function getApiErrorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiError | undefined;

    // Plain string detail
    if (typeof data?.detail === 'string' && data.detail.trim()) {
      return data.detail;
    }

    // Validation error array — pick first meaningful message
    if (Array.isArray(data?.detail) && data.detail.length > 0) {
      const first = data.detail[0];
      const fieldPath = first.loc?.slice(1).join(' → ') ?? '';
      return fieldPath ? `${fieldPath}: ${first.msg}` : first.msg;
    }

    // Network / timeout errors (no response received at all)
    if (err.code === 'ECONNABORTED') {
      return 'Request timed out. The server may be starting up — please try again in a moment.';
    }

    // No response: CORS block, DNS failure, or server unreachable
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
        'Cannot reach the server. The backend may be starting up (Render ' +
        'free-tier services sleep after inactivity). Please wait 30 seconds ' +
        'and try again.'
      );
    }

    // HTTP status codes
    const status = err.response.status;
    if (status === 429) return 'Too many requests. Please wait a moment and try again.';
    if (status === 503)
      return 'Service is temporarily unavailable. Please try again shortly.';
    if (status === 404) return 'Resource not found.';
    if (status === 403) return 'You do not have permission to perform this action.';
    if (status >= 500)
      return 'Server error. Our team has been notified — please try again later.';
  }

  // Unknown error type
  if (err instanceof Error && err.message) return err.message;

  return fallback;
}

// ─── Campaign API Calls ───────────────────────────────────────────────────────

/** Fetch all campaigns for the current authenticated user. */
export async function getCampaigns(limit = 100, offset = 0): Promise<Campaign[]> {
  const res = await api.get<Campaign[]>('/campaigns/', { params: { limit, offset } });
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
 * Upload an image to the AI extraction endpoint.
 * Returns extracted campaign data. May include requires_human_review=true.
 */
export async function extractFromImage(file: File): Promise<ExtractedData> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post<ExtractedData>('/extract/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

// ─── Client-side Dashboard Stats Computation ─────────────────────────────────

/** Compute dashboard stats from a list of campaigns (no extra API call needed). */
export function computeDashboardStats(campaigns: Campaign[]): DashboardStats {
  const now = new Date();
  const sevenDaysLater = new Date(now);
  sevenDaysLater.setDate(now.getDate() + 7);

  const active    = campaigns.filter(c => c.status === 'active');
  const completed = campaigns.filter(c => c.status === 'completed');
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

  const paidCampaigns = campaigns.filter(c => c.payment_amount > 0);
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

export default api;
