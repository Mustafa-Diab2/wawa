-- Fix bots table by adding missing columns
-- Execute this in Supabase SQL Editor

-- Add description column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bots' AND column_name = 'description'
    ) THEN
        ALTER TABLE public.bots ADD COLUMN description TEXT;
    END IF;
END $$;

-- Add avatar_url column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bots' AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE public.bots ADD COLUMN avatar_url TEXT;
    END IF;
END $$;

-- Add is_active column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bots' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.bots ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Add temperature column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bots' AND column_name = 'temperature'
    ) THEN
        ALTER TABLE public.bots ADD COLUMN temperature DECIMAL(3,2) DEFAULT 0.7;
    END IF;
END $$;

-- Add max_tokens column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bots' AND column_name = 'max_tokens'
    ) THEN
        ALTER TABLE public.bots ADD COLUMN max_tokens INTEGER DEFAULT 1000;
    END IF;
END $$;

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bots' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.bots ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Verify all columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'bots'
ORDER BY ordinal_position;
