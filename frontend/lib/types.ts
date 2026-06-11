// ─── Campaign Status Enum ───────────────────────────────────────────────────
export type CampaignStatus = 'draft' | 'active' | 'completed' | 'cancelled';

// ─── Core Campaign Model (matches backend CampaignResponse) ─────────────────
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

// ─── Payload for creating a new campaign (POST /campaigns/) ─────────────────
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

// ─── Payload for updating a campaign status (PATCH /campaigns/{id}/status) ──
export interface StatusUpdatePayload {
  status: CampaignStatus;
}

// ─── AI Extraction result (POST /extract/) ──────────────────────────────────
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

// ─── Generic API Error ───────────────────────────────────────────────────────
export interface ApiError {
  detail: string | ValidationError[];
}

export interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

// ─── Paginated Campaign List ─────────────────────────────────────────────────
export interface CampaignListResponse {
  items: Campaign[];
  total: number;
}

// ─── Form state for the Create Campaign Modal ────────────────────────────────
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
