-- 15_add_is_paid_to_subscriptions.sql
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;

-- Update all existing paid users (assuming anyone with more than 15 days between created_at and trial_ends_at paid)
UPDATE public.subscriptions
SET is_paid = true
WHERE trial_ends_at > (created_at + INTERVAL '15 days');
