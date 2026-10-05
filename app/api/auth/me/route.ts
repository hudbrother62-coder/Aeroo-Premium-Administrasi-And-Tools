import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await db();
  const { data, error } = await supabase.rpc('get_current_app_user');

  if (error || !data?.length) {
    return NextResponse.json({id:null,username:'publik',display_name:'Viewer publik',role:'VIEWER',public:true,active:true});
  }

  return NextResponse.json(data[0]);
}
