import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
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

    // Get team members added by current user
    const { data: teamMembers, error: teamError } = await supabaseAdmin
      .from('team_members')
      .select('user_id, role')
      .eq('added_by', currentUserId);

    if (teamError) {
      console.error('Error fetching team members:', teamError);
      return NextResponse.json(
        { error: teamError.message },
        { status: 400 }
      );
    }

    if (!teamMembers || teamMembers.length === 0) {
      // No team members added by this user
      return NextResponse.json({
        success: true,
        users: [],
      });
    }

    // Get user IDs
    const userIds = teamMembers.map(tm => tm.user_id);

    // List all users
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      console.error('Error listing users:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Filter users to only include those added by current user
    const filteredUsers = data.users.filter(user => userIds.includes(user.id));

    // Return users with simplified data
    const users = filteredUsers.map(user => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      user_metadata: user.user_metadata,
    }));

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error: any) {
    console.error('Error in list-users API:', error);
    return NextResponse.json(
      { error: error.message || 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}
