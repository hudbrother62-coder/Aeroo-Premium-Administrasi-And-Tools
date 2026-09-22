import { NextRequest, NextResponse } from 'next/server';
import { publicDb, AEROO_SESSION_COOKIE } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body.username ?? '').trim();
    const password = String(body.password ?? '');

    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi.' }, { status: 400 });
    }

    const supabase = publicDb();
    const { data, error } = await supabase.rpc('login_app', {
      p_username: username,
      p_password: password,
    });

    if (error || !data?.length) {
      const message = error?.message?.includes('account_temporarily_locked')
        ? 'Terlalu banyak percobaan. Coba lagi beberapa menit.'
        : 'Username atau password salah.';
      return NextResponse.json({ error: message }, { status: 401 });
    }

    const session = data[0];
    const res = NextResponse.json({
      ok: true,
      user: {
        id: session.user_id,
        username: session.username,
        display_name: session.display_name,
        role: session.role,
      },
    });

    res.cookies.set(AEROO_SESSION_COOKIE, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch {
    return NextResponse.json({ error: 'Login belum dapat diproses.' }, { status: 500 });
  }
}
