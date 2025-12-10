import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Get Supabase URL from environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'خطأ في إعدادات الخادم' },
        { status: 500 }
      );
    }

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create team_members table
    const { error: tableError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
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

        -- Create index for better performance
        CREATE INDEX IF NOT EXISTS idx_team_members_added_by ON public.team_members(added_by);
        CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
      `
    });

    if (tableError) {
      console.error('Error creating table:', tableError);
      return NextResponse.json(
        { error: 'فشل إنشاء الجدول', details: tableError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'تم إنشاء جدول team_members بنجاح',
    });
  } catch (error: any) {
    console.error('Error in setup-schema API:', error);
    return NextResponse.json(
      { error: error.message || 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}
