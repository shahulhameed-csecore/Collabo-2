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

// ─── Axios Instance ───────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 60_000, // 60 seconds — generous for AI extraction
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request Interceptor: Auto-inject Supabase JWT ───────────────────────────
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
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
    return Promise.reject(error);
  }
);

// ─── Error Message Helper ─────────────────────────────────────────────────────
/**
 * Extracts a user-friendly message from an API error.
 * Falls back to a generic message if nothing can be parsed.
 */
export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiError | undefined;
    if (typeof data?.detail === 'string') return data.detail;
    if (Array.isArray(data?.detail) && data.detail.length > 0) {
      return data.detail[0].msg;
    }
    if (err.code === 'ECONNABORTED') return 'Request timed out. Please check your connection.';
    if (err.response?.status === 429) return 'Too many requests. Please wait a moment and try again.';
    if (err.response?.status === 503) return 'Service is temporarily unavailable. Please try again shortly.';
    if (!err.response) return 'Cannot reach the server. Please check your internet connection.';
  }
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
export async function updateCampaign(id: string, payload: CreateCampaignPayload): Promise<Campaign> {
  const res = await api.put<Campaign>(`/campaigns/${id}`, payload);
  return res.data;
}

/** Update only the status of a campaign. */
export async function updateCampaignStatus(id: string, payload: StatusUpdatePayload): Promise<Campaign> {
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

  const active = campaigns.filter(c => c.status === 'active');
  const completed = campaigns.filter(c => c.status === 'completed');
  const cancelled = campaigns.filter(c => c.status === 'cancelled');
  const overdue = active.filter(c => c.deadline && new Date(c.deadline) < now);

  const upcomingDeadlines = active
    .filter(c => {
      if (!c.deadline) return false;
      const d = new Date(c.deadline);
      return d >= now && d <= sevenDaysLater;
    })
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());

  const closedCount = completed.length + cancelled.length;
  const successRate = closedCount > 0 ? Math.round((completed.length / closedCount) * 100) : 0;

  const totalSpend = campaigns.reduce((s, c) => s + (c.payment_amount || 0), 0);
  const pendingSpend = active.reduce((s, c) => s + (c.payment_amount || 0), 0);

  return {
    total: campaigns.length,
    active: active.length,
    overdue: overdue.length,
    completed: completed.length,
    totalSpend,
    pendingSpend,
    successRate,
    upcomingDeadlines,
  };
}

export default api;
