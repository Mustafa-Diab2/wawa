import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName, role } = await request.json();

    // Validate input
    if (!email || !password || !fullName || !role) {
      return NextResponse.json(
        { error: 'جميع الحقول مطلوبة' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' },
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

    // Create new user
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
      },
    });

    if (error) {
      console.error('Error creating user:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Add record to team_members table
    const { error: teamMemberError } = await supabaseAdmin
      .from('team_members')
      .insert({
        user_id: data.user.id,
        added_by: currentUserId,
        role,
      });

    if (teamMemberError) {
      console.error('Error adding to team_members:', teamMemberError);
      // Don't fail the request, just log the error
      // User was created successfully
    }

    return NextResponse.json({
      success: true,
      user: data.user,
      message: `تم إنشاء حساب لـ ${fullName}`,
    });
  } catch (error: any) {
    console.error('Error in create-user API:', error);
    return NextResponse.json(
      { error: error.message || 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}
