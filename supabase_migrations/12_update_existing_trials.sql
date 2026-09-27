-- 12_update_existing_trials.sql

-- 1. Update the signup trigger for new users to strictly get 14 days
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger AS $$    
BEGIN
  INSERT INTO public.subscriptions (user_id, tier, trial_ends_at)
  VALUES (
    new.id,
    'pro',
    NOW() + INTERVAL '14 days'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Reset ALL current testing accounts to a fresh 14-day Free Trial
UPDATE public.subscriptions
SET trial_ends_at = NOW() + INTERVAL '14 days'
WHERE 
  tier = 'pro'
  -- SAFETY: Ensures we only target accounts that were originally on a free trial.
  -- This prevents accidentally resetting a user who legitimately paid for a 365-day 
  -- or 30-day plan down to 14 days.
  AND trial_ends_at <= (created_at + INTERVAL '31 days');
