-- Add B-Tree index for speeding up dashboard queries filtering by user_id
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns (user_id);

-- Add index for deadline, often queried for sorting or reminders
CREATE INDEX IF NOT EXISTS idx_campaigns_deadline ON campaigns (deadline);

-- Add a partial index specifically for the reminder background jobs
-- These jobs heavily query campaigns WHERE status = 'active'
CREATE INDEX IF NOT EXISTS idx_campaigns_active_status ON campaigns (user_id, status) WHERE status = 'active';
