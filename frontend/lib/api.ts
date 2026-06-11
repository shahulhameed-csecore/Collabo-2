import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { createClient } from './supabase';
import type {
  Campaign,
  CreateCampaignPayload,
  StatusUpdatePayload,
  ExtractedData,
} from './types';

// ─── Axios Instance ──────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 60000, // 60 seconds — generous for AI extraction
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request Interceptor: Auto-inject Supabase JWT ──────────────────────────
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// ─── Response Interceptor: Handle 401 globally ──────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Session expired — sign out and redirect
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Campaign API Calls ──────────────────────────────────────────────────────

/**
 * Fetch all campaigns for the current authenticated user.
 */
export async function getCampaigns(limit = 50, offset = 0): Promise<Campaign[]> {
  const res = await api.get<Campaign[]>('/campaigns/', { params: { limit, offset } });
  return res.data;
}

/**
 * Create a new campaign.
 */
export async function createCampaign(payload: CreateCampaignPayload): Promise<Campaign> {
  const res = await api.post<Campaign>('/campaigns/', payload);
  return res.data;
}

/**
 * Update all fields of an existing campaign.
 */
export async function updateCampaign(id: string, payload: CreateCampaignPayload): Promise<Campaign> {
  const res = await api.put<Campaign>(`/campaigns/${id}`, payload);
  return res.data;
}

/**
 * Update only the status of a campaign.
 */
export async function updateCampaignStatus(id: string, payload: StatusUpdatePayload): Promise<Campaign> {
  const res = await api.patch<Campaign>(`/campaigns/${id}/status`, payload);
  return res.data;
}

/**
 * Delete a campaign.
 */
export async function deleteCampaign(id: string): Promise<void> {
  await api.delete(`/campaigns/${id}`);
}

// ─── AI Extraction API Call ──────────────────────────────────────────────────

/**
 * Upload an image to the AI extraction endpoint.
 * Returns the extracted campaign data. May include requires_human_review=true.
 */
export async function extractFromImage(file: File): Promise<ExtractedData> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await api.post<ExtractedData>('/extract/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export default api;
