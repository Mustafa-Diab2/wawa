import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function setupTeamMembersTable() {
  console.log('Setting up team_members table...');

  // Check if table exists by trying to query it
  const { error: checkError } = await supabase
    .from('team_members')
    .select('id')
    .limit(1);

  if (!checkError) {
    console.log('✓ Table team_members already exists');
    return;
  }

  console.log('Table does not exist, creating...');
  console.log('');
  console.log('Please run the following SQL in your Supabase SQL Editor:');
  console.log('Dashboard -> SQL Editor -> New Query');
  console.log('');
  console.log('========================================');
  console.log(`
-- Create team_members table to track which admin added which team member
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, added_by)
);

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own team members
CREATE POLICY "Users can view their team members"
  ON public.team_members
  FOR SELECT
  USING (added_by = auth.uid());

-- Policy: Users can insert their own team members
CREATE POLICY "Users can insert team members"
  ON public.team_members
  FOR INSERT
  WITH CHECK (added_by = auth.uid());

-- Policy: Users can update their own team members
CREATE POLICY "Users can update their team members"
  ON public.team_members
  FOR UPDATE
  USING (added_by = auth.uid());

-- Policy: Users can delete their own team members
CREATE POLICY "Users can delete their team members"
  ON public.team_members
  FOR DELETE
  USING (added_by = auth.uid());

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_team_members_added_by ON public.team_members(added_by);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
  `);
  console.log('========================================');
  console.log('');
  console.log('After running the SQL, the team members filtering will work correctly.');
}

setupTeamMembersTable();
