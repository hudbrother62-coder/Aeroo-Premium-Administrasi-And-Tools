import {NextRequest,NextResponse} from 'next/server';
import {createHash} from 'crypto';
import {publicDb,sessionDb,AEROO_SESSION_COOKIE} from '@/lib/supabase-server';

export async function POST(req:NextRequest){
  try{
    const body=await req.json();
    const username=String(body.username??'').trim();
    const password=String(body.password??'');
    if(!username||!password)return NextResponse.json({error:'Username dan password wajib diisi.'},{status:400});

    const ip=(req.headers.get('x-forwarded-for')||'').split(',')[0].trim();
    const ipHash=ip?createHash('sha256').update('aeroo:'+ip).digest('hex'):null;
    const userAgent=req.headers.get('user-agent')||null;

    const supabase=publicDb();
    const{data,error}=await supabase.rpc('login_app',{p_username:username,p_password:password});
    const success=!error&&Boolean(data?.length);

    if(!success)return NextResponse.json({error:'Username atau password salah.'},{status:401});

    const session=data[0];

    try{
      const scoped=sessionDb(session.token);
      await scoped.rpc('record_login_event',{
        p_username:session.username,
        p_success:true,
        p_ip_hash:ipHash,
        p_user_agent:userAgent
      });
    }catch{}

    const res=NextResponse.json({ok:true,user:{id:session.user_id,username:session.username,display_name:session.display_name,role:session.role}});
    res.cookies.set(AEROO_SESSION_COOKIE,session.token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:60*60*24*7});
    return res;
  }catch{
    return NextResponse.json({error:'Login belum dapat diproses.'},{status:500});
  }
}
