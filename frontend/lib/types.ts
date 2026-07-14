// ─── Campaign Status ─────────────────────────────────────────────────────────
export type CampaignStatus = 'draft' | 'active' | 'content_received' | 'approved' | 'paid' | 'cancelled' | 'rejected';

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
  proof_url: string | null;
  proof_history: { url: string; uploaded_at: string }[] | null;
  magic_link_token: string | null;
  destination_url: string | null;
  short_code: string | null;
  clicks: number;
  created_at: string;             // ISO datetime string
  updated_at: string;             // ISO datetime string
}

export interface PaginatedCampaigns {
  data: Campaign[];
  count: number;
  limit: number;
  offset: number;
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
  destination_url?: string | null;
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
  destination_url?: string | null;
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
  destination_url: string;
  status: CampaignStatus;
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export interface DashboardStats {
  total: number;
  active: number;
  overdue: number;
  completed: number;
  cancelled: number;
  totalSpend: number;
  pendingSpend: number;           // spend on active campaigns
  successRate: number;            // completed / (completed + cancelled) * 100
  avgPayment: number;             // average payment across all paid campaigns
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

// ─── UI helpers ───────────────────────────────────────────────────────────────
export type AccentColor = 'emerald' | 'amber' | 'rose' | 'slate' | 'blue' | 'purple';

// ─── Notifications ────────────────────────────────────────────────────────────
export type NotificationType = 'success' | 'info' | 'warning' | 'error';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  link_url?: string | null;
  is_read: boolean;
  created_at: string;
}
