import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    // Validate input
    if (!userId) {
      return NextResponse.json(
        { error: 'معرف المستخدم مطلوب' },
        { status: 400 }
      );
    }

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

    // Get current user from cookies
    const cookieStore = await import('next/headers').then(m => m.cookies());
    const authCookie = cookieStore.get('sb-access-token') || cookieStore.get('sb-localhost-auth-token');

    let currentUserId: string | null = null;
    if (authCookie) {
      const { data: { user } } = await supabaseAdmin.auth.getUser(authCookie.value);
      currentUserId = user?.id || null;
    }

    if (!currentUserId) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    // Delete from team_members table first
    const { error: teamMemberError } = await supabaseAdmin
      .from('team_members')
      .delete()
      .eq('user_id', userId)
      .eq('added_by', currentUserId);

    if (teamMemberError) {
      console.error('Error deleting team member:', teamMemberError);
      // Continue with user deletion even if this fails
    }

    // Delete user
    const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      console.error('Error deleting user:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'تم حذف المستخدم بنجاح',
    });
  } catch (error: any) {
    console.error('Error in delete-user API:', error);
    return NextResponse.json(
      { error: error.message || 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}
