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
