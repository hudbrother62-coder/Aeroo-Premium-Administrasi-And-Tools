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
  const username = body.username == null ? null : String(body.username).trim().toLowerCase();

  if (!allowedRoles.has(role)) {
    return NextResponse.json({ error: 'Role tidak valid.' }, { status: 400 });
  }
  if (username !== null && !/^[a-z0-9._-]{3,32}$/.test(username)) {
    return NextResponse.json({ error: 'Username harus 3–32 karakter (huruf, angka, titik, garis bawah, atau tanda hubung).' }, { status: 400 });
  }
  if (newPassword && newPassword.length < 8) {
    return NextResponse.json({ error: 'Password baru minimal 8 karakter.' }, { status: 400 });
  }

  const supabase = await db();
  const access=body.access;
  if(access && (!Array.isArray(access.scopes)||!Array.isArray(access.permissions)))return NextResponse.json({error:'Akses tidak valid.'},{status:400});
  const args={p_user_id:id,p_display_name:displayName,p_role:role,p_active:active,p_new_password:newPassword};
  const {error}=await supabase.rpc('admin_update_app_user_profile',{
    ...args,p_username:username,
    p_scopes:access?.scopes??null,p_permissions:access?.permissions??null,p_class_scope:access?.class_scope??null
  });

  if (error) {
    const msg = error.message.includes('last_admin_protected')
      ? 'Akun admin terakhir tidak boleh dinonaktifkan atau diturunkan rolenya.'
      : error.message.includes('username_exists') ? 'Username sudah digunakan akun lain. Pilih username berbeda.'
      : error.message.includes('invalid_username') ? 'Format username tidak valid. Gunakan 3–32 karakter huruf, angka, titik, garis bawah, atau tanda hubung.'
      : error.message.includes('username_reserved') ? 'Username sistem tidak dapat diubah.'
      : error.message.includes('user_not_found') ? 'Akun tidak ditemukan.'
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
