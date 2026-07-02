-- Migration: Add telegram_chat_id to user_settings
-- This allows the bot to proactively send deadline reminders via Telegram.

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;

-- Note: We do not add a UNIQUE constraint yet because we only update this 
-- when the user interacts with the bot, and multiple accounts (rare edge case) 
-- might accidentally share a chat_id. It's safer to just store it.
