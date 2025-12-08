-- ============================================
-- Complete WaCRM Database Schema
-- ============================================

-- Bots table (already exists)
CREATE TABLE IF NOT EXISTS public.bots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    personality TEXT NOT NULL,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 1000,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bot Knowledge Base (already exists)
CREATE TABLE IF NOT EXISTS public.bot_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID REFERENCES public.bots(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100),
    keywords TEXT[],
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Canned Responses table
CREATE TABLE IF NOT EXISTS public.canned_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    shortcut VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100),
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, shortcut)
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'failed')),
    target_audience VARCHAR(100),
    recipients_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    scheduled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign Recipients tracking
CREATE TABLE IF NOT EXISTS public.campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team Members (using existing auth.users)
-- Add role column to track admin/agent
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS assigned_agent_id UUID;

-- Agent Stats table for performance tracking
CREATE TABLE IF NOT EXISTS public.agent_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_chats INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    avg_response_time INTEGER DEFAULT 0,
    customer_satisfaction DECIMAL(2,1),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Tags for chat categorization
CREATE TABLE IF NOT EXISTS public.chat_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Chat-Tag relationship
CREATE TABLE IF NOT EXISTS public.chat_tag_relations (
    chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES public.chat_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (chat_id, tag_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_canned_responses_user_id ON public.canned_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_canned_responses_shortcut ON public.canned_responses(shortcut);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON public.campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_agent_stats_user_date ON public.agent_stats(user_id, date);
CREATE INDEX IF NOT EXISTS idx_chat_tags_user_id ON public.chat_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_assigned_agent ON public.chats(assigned_agent_id);

-- Disable RLS for now (enable later with proper policies)
ALTER TABLE public.canned_responses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_tag_relations DISABLE ROW LEVEL SECURITY;
