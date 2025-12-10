const { createClient } = require('@supabase/supabase-js');

async function createTeamMembersTable() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('Creating team_members table...');

  // Check if table exists
  const { data: existingTable, error: checkError } = await supabase
    .from('team_members')
    .select('*')
    .limit(1);

  if (!checkError) {
    console.log('✓ Table team_members already exists');
    return;
  }

  // Create table using raw SQL
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      -- Create team_members table
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

      -- Create policies
      DROP POLICY IF EXISTS "Users can view their team members" ON public.team_members;
      CREATE POLICY "Users can view their team members"
        ON public.team_members
        FOR SELECT
        USING (added_by = auth.uid());

      DROP POLICY IF EXISTS "Users can insert team members" ON public.team_members;
      CREATE POLICY "Users can insert team members"
        ON public.team_members
        FOR INSERT
        WITH CHECK (added_by = auth.uid());

      DROP POLICY IF EXISTS "Users can update their team members" ON public.team_members;
      CREATE POLICY "Users can update their team members"
        ON public.team_members
        FOR UPDATE
        USING (added_by = auth.uid());

      DROP POLICY IF EXISTS "Users can delete their team members" ON public.team_members;
      CREATE POLICY "Users can delete their team members"
        ON public.team_members
        FOR DELETE
        USING (added_by = auth.uid());

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_team_members_added_by ON public.team_members(added_by);
      CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
    `
  });

  if (error) {
    console.error('Error creating table:', error);
    process.exit(1);
  }

  console.log('✓ Table team_members created successfully');
}

createTeamMembersTable().catch(console.error);
