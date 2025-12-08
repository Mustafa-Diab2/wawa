-- Bots table: Store AI bot configurations
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

-- Bot Knowledge Base: Store information for the bot to remember
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

-- Chat-Bot assignment
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS bot_id UUID REFERENCES public.bots(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bots_user_id ON public.bots(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_knowledge_bot_id ON public.bot_knowledge(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_knowledge_keywords ON public.bot_knowledge USING GIN(keywords);

-- Enable RLS
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_knowledge ENABLE ROW LEVEL SECURITY;

-- Simple RLS Policies for bots (allow all for authenticated users)
CREATE POLICY "bots_policy" ON public.bots
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Simple RLS Policies for bot_knowledge (allow all for authenticated users)
CREATE POLICY "bot_knowledge_policy" ON public.bot_knowledge
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
