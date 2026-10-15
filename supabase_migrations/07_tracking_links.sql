-- =============================================================================
-- Collabo — Phase 3 Tracking Links Migration
-- Safe to re-run
-- =============================================================================

ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS destination_url TEXT,
ADD COLUMN IF NOT EXISTS short_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS clicks INT DEFAULT 0;

-- Function to atomically increment clicks
CREATE OR REPLACE FUNCTION increment_campaign_clicks(p_short_code TEXT)
RETURNS void AS $$
BEGIN
  UPDATE public.campaigns
  SET clicks = clicks + 1
  WHERE short_code = p_short_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
