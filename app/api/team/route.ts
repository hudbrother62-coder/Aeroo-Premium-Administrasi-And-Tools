import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase-server';

const allowedRoles = new Set(['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER']);

export async function GET() {
  const supabase = await db();
  const { data, error } = await supabase.rpc('list_app_users');
  if (error) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const username = String(body.username ?? '').trim();
  const password = String(body.password ?? '');
  const displayName = String(body.display_name ?? '').trim();
  const role = String(body.role ?? 'VIEWER');

  if (!allowedRoles.has(role)) {
    return NextResponse.json({ error: 'Role tidak valid.' }, { status: 400 });
  }
  if (username.length < 3 || password.length < 8) {
    return NextResponse.json({ error: 'Username minimal 3 karakter dan password minimal 8 karakter.' }, { status: 400 });
  }

  const supabase = await db();
  const { data, error } = await supabase.rpc('admin_create_app_user', {
    p_username: username,
    p_password: password,
    p_display_name: displayName,
    p_role: role,
  });

  if (error) {
    const msg = error.message.includes('username_exists') ? 'Username sudah digunakan.' : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ id: data }, { status: 201 });
}
