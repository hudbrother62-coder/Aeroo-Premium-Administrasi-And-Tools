import {NextRequest,NextResponse} from 'next/server';
const publicPages=new Set(['/','/login','/database','/presensi','/jurnal','/target','/agenda','/rekap','/laporan']);
const publicReads=new Set(['/api/members','/api/classes','/api/categories','/api/levels','/api/activity-types','/api/attendance','/api/attendance/recap','/api/journals','/api/agenda','/api/targets','/api/targets/import','/api/targets/overview','/api/summary','/api/report-templates','/api/members/spreadsheet']);
export function middleware(req:NextRequest){const p=req.nextUrl.pathname;
 if(!['GET','HEAD','OPTIONS'].includes(req.method)){const origin=req.headers.get('origin');if(origin&&origin!==req.nextUrl.origin)return NextResponse.json({error:'Asal permintaan tidak sesuai.'},{status:403})}
 if(p.startsWith('/_next')||/\.(webp|png|jpg|svg|ico)$/.test(p)||publicPages.has(p)||p.startsWith('/api/public/')||p.startsWith('/api/auth/'))return NextResponse.next();
 if(req.method==='GET'&&publicReads.has(p))return NextResponse.next();
 if(!req.cookies.get('aeroo_session')?.value){if(p.startsWith('/api/'))return NextResponse.json({error:'Login diperlukan untuk perubahan.'},{status:401});const url=req.nextUrl.clone();url.pathname='/login';url.search='';return NextResponse.redirect(url)}return NextResponse.next();
}
export const config={matcher:['/((?!_next/static|_next/image|robots.txt|sitemap.xml).*)']};
