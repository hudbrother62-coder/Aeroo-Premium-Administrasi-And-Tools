import { NextResponse } from 'next/server';
import { db, AEROO_SESSION_COOKIE } from '@/lib/supabase-server';

export async function POST() {
  try {
    const supabase = await db();
    await supabase.rpc('logout_app');
  } catch {
    // Cookie tetap dibersihkan agar pengguna bisa keluar dari aplikasi.
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AEROO_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
