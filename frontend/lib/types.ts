// ─── Campaign Status ─────────────────────────────────────────────────────────
export type CampaignStatus = 'draft' | 'active' | 'completed' | 'cancelled';

// ─── Platform ────────────────────────────────────────────────────────────────
export const PLATFORMS = [
  'Instagram',
  'YouTube',
  'Twitter/X',
  'LinkedIn',
  'TikTok',
  'Pinterest',
  'Snapchat',
  'Other',
] as const;

export type Platform = (typeof PLATFORMS)[number] | string;

// ─── Core Campaign Model (matches backend CampaignResponse) ──────────────────
export interface Campaign {
  id: string;
  user_id: string;
  influencer_name: string | null;
  influencer_handle: string;
  platform: string | null;
  deliverables: string | null;
  deadline: string | null;        // ISO date string: "YYYY-MM-DD"
  payment_amount: number;
  special_notes: string | null;
  status: CampaignStatus;
  created_at: string;             // ISO datetime string
  updated_at: string;             // ISO datetime string
}

// ─── Payload for creating a new campaign (POST /campaigns/) ──────────────────
export interface CreateCampaignPayload {
  influencer_name?: string | null;
  influencer_handle: string;
  platform?: string | null;
  deliverables?: string | null;
  deadline?: string | null;
  payment_amount?: number;
  special_notes?: string | null;
  status?: CampaignStatus;
}

// ─── Payload for updating a campaign status (PATCH /campaigns/{id}/status) ───
export interface StatusUpdatePayload {
  status: CampaignStatus;
}

// ─── AI Extraction result (POST /extract/) ───────────────────────────────────
export interface ExtractedData {
  influencer_name: string | null;
  influencer_handle: string | null;
  platform: string | null;
  deliverables: string | null;
  deadline: string | null;
  payment_amount: number;
  special_notes: string | null;
  status: CampaignStatus;
  requires_human_review: boolean;
}

// ─── Generic API Error ────────────────────────────────────────────────────────
export interface ApiError {
  detail: string | ValidationError[];
}

export interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

// ─── Paginated Campaign List ──────────────────────────────────────────────────
export interface CampaignListResponse {
  items: Campaign[];
  total: number;
}

// ─── Form state for the Create Campaign Modal ─────────────────────────────────
export interface CampaignFormState {
  influencer_name: string;
  influencer_handle: string;
  platform: string;
  deliverables: string;
  deadline: string;
  payment_amount: string;   // string for controlled input, convert to number on submit
  special_notes: string;
  status: CampaignStatus;
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export interface DashboardStats {
  total: number;
  active: number;
  overdue: number;
  completed: number;
  totalSpend: number;
  pendingSpend: number;      // spend on active campaigns
  successRate: number;       // completed / (completed + cancelled) * 100
  upcomingDeadlines: Campaign[];  // active campaigns with deadline in next 7 days
}

// ─── Table filter / sort state ────────────────────────────────────────────────
export interface FilterState {
  search: string;
  status: CampaignStatus | 'all';
  platform: string;
}

export interface SortConfig {
  key: keyof Campaign;
  dir: 'asc' | 'desc';
}
