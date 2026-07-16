-- Migration v6: Support for AI Campaign Manager features
-- 1. Add health_score to campaigns
-- 2. Add notification_preferences to user_settings
-- 3. Create campaign_events table for activity timeline

ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS health_score TEXT DEFAULT 'Healthy';

ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.campaign_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on campaign_events
ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;

-- Create policies for campaign_events
CREATE POLICY "Users can view their own campaign events"
    ON public.campaign_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.campaigns c
            WHERE c.id = campaign_events.campaign_id
            AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own campaign events"
    ON public.campaign_events FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.campaigns c
            WHERE c.id = campaign_events.campaign_id
            AND c.user_id = auth.uid()
        )
    );
