import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await db();
  const { data, error } = await supabase.rpc('get_current_app_user');

  if (error || !data?.length) {
    return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 });
  }

  return NextResponse.json(data[0]);
}
