-- Drop existing policies if any
DROP POLICY IF EXISTS "bots_policy" ON public.bots;
DROP POLICY IF EXISTS "bot_knowledge_policy" ON public.bot_knowledge;

-- Disable RLS temporarily to test
ALTER TABLE public.bots DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_knowledge DISABLE ROW LEVEL SECURITY;
