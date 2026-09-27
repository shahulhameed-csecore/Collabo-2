-- Migration: Add telegram_username to user_settings

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(100);
