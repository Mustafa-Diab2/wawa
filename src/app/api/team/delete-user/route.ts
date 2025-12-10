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

    // Get current user from authorization header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    let currentUserId: string | null = null;
    if (token) {
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      currentUserId = user?.id || null;
    }

    // If no token in header, try cookies
    if (!currentUserId) {
      const cookieStore = await import('next/headers').then(m => m.cookies());
      const cookies = cookieStore.getAll();

      // Try to find Supabase auth token in cookies
      for (const cookie of cookies) {
        if (cookie.name.includes('auth-token') || cookie.name.includes('sb-')) {
          try {
            const { data: { user } } = await supabaseAdmin.auth.getUser(cookie.value);
            if (user) {
              currentUserId = user.id;
              break;
            }
          } catch (e) {
            // Continue to next cookie
          }
        }
      }
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
