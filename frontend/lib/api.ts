import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { createClient } from './supabase';
import { toast } from 'sonner';
import type {
  Campaign,
  CreateCampaignPayload,
  StatusUpdatePayload,
  ExtractedData,
  DashboardStats,
  ApiError,
} from './types';

// ─── Base URL Resolution ──────────────────────────────────────────────────────
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
        // We use a short timeout to let the toast render before the redirect happens
        setTimeout(() => {
          window.location.assign('/login');
        }, 1500);
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
export async function getCampaigns(limit = 200, offset = 0): Promise<Campaign[]> {
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
 * Upload a file (image, pdf, docx) to the AI extraction endpoint.
 * Returns extracted campaign data. May include requires_human_review=true.
 */
export async function extractFromFile(file: File): Promise<ExtractedData> {
  const { data: { session } } = await supabase.auth.getSession();
  const formData = new FormData();
  formData.append('file', file);

  // Use native fetch to bypass Axios global JSON headers, guaranteeing a perfect multipart boundary
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/extract/`, {
    method: 'POST',
    body: formData,
    headers: {
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
    }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.detail || 'AI extraction failed.');
  }

  return res.json();
}

// ─── Settings API Calls ─────────────────────────────────────────────────────────

export async function saveWhatsAppNumber(whatsapp_number: string): Promise<{ message: string, whatsapp_number: string }> {
  const res = await api.post('/settings/whatsapp', { whatsapp_number });
  return res.data;
}

export async function getWhatsAppNumber(): Promise<{ whatsapp_number: string | null }> {
  const res = await api.get('/settings/whatsapp');
  return res.data;
}

// ─── Client-side Dashboard Stats Computation ─────────────────────────────────

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
