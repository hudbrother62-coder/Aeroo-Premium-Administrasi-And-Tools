import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase-server';

const allowedRoles = new Set(['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER']);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const role = String(body.role ?? 'VIEWER');
  const active = Boolean(body.active);
  const displayName = String(body.display_name ?? '').trim();
  const newPassword = body.new_password ? String(body.new_password) : null;

  if (!allowedRoles.has(role)) {
    return NextResponse.json({ error: 'Role tidak valid.' }, { status: 400 });
  }
  if (newPassword && newPassword.length < 8) {
    return NextResponse.json({ error: 'Password baru minimal 8 karakter.' }, { status: 400 });
  }

  const supabase = await db();
  const { error } = await supabase.rpc('admin_update_app_user', {
    p_user_id: id,
    p_display_name: displayName,
    p_role: role,
    p_active: active,
    p_new_password: newPassword,
  });

  if (error) {
    const msg = error.message.includes('last_admin_protected')
      ? 'Akun admin terakhir tidak boleh dinonaktifkan atau diturunkan rolenya.'
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
