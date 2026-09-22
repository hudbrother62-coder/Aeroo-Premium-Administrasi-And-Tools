import { NextRequest, NextResponse } from 'next/server';

const COOKIE='aeroo_session';

export function middleware(req:NextRequest){
  const {pathname}=req.nextUrl;

  if(
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/api/auth/')
  ) return NextResponse.next();

  if(pathname === '/login'){
    return NextResponse.next();
  }

  const hasSession=Boolean(req.cookies.get(COOKIE)?.value);

  if(!hasSession){
    if(pathname.startsWith('/api/')){
      return NextResponse.json({error:'Sesi login diperlukan.'},{status:401});
    }
    const url=req.nextUrl.clone();
    url.pathname='/login';
    url.search='';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config={
  matcher:['/((?!_next/static|_next/image|robots.txt|sitemap.xml).*)']
};
