-- Force update the specific account from the screenshot (and any others)
-- This bypasses the created_at check entirely just to force it to 14 days!

UPDATE public.subscriptions
SET 
  trial_ends_at = NOW() + INTERVAL '14 days',
  is_paid = false
WHERE 
  -- We can explicitly target your email account here:
  user_id IN (SELECT id FROM auth.users WHERE email = 'shahulhameededit@gmail.com')
  
  -- Or any account that still has more than 14 days left and isn't paid
  OR (trial_ends_at > NOW() + INTERVAL '14 days' AND is_paid = false);
