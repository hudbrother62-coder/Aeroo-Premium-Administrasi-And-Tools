import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

export async function GET(req:NextRequest){
  const versionId=req.nextUrl.searchParams.get('version_id')||'';
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(versionId))return NextResponse.json({error:'Versi tidak valid.'},{status:400});
  const s=await db();
  const {data,error}=await s.rpc('target_review_catalog',{p_version_id:versionId});
  if(error)return NextResponse.json({error:'Katalog target tidak dapat dimuat.'},{status:500,headers:{'Cache-Control':'no-store'}});
  if(!data?.version)return NextResponse.json({error:'Versi tidak ditemukan.'},{status:404});
  const source={verified_detail_month_masks:data.month_masks,context_verified_repeated_titles:data.contextual_months};
  const groups=data.group_rows||{};
  const monthSchedule:Record<string,Record<string,number[]>>={};
  const setMonth=(rawLevel:string,sourceRow:string,month:number)=>{
    const level=rawLevel==='Remaja'?'Muda-Mudi':rawLevel;
    if(!Number.isInteger(month)||month<7||month>11||!/^[0-9]+$/.test(sourceRow))return;
    if(!monthSchedule[level])monthSchedule[level]={};
    const row=monthSchedule[level][sourceRow]||(monthSchedule[level][sourceRow]=[]);
    if(!row.includes(month))row.push(month);
  };
  const masks=source.verified_detail_month_masks||{};
  for(const [level,encoded] of Object.entries(masks)){
    if(typeof encoded!=='string')continue;
    for(const pair of encoded.split(';')){
      const [sourceRow,rawMask]=pair.split(':');
      const mask=Number(rawMask);
      if(!Number.isInteger(mask))continue;
      for(let month=7;month<=11;month++)if((mask&(1<<(month-7)))!==0)setMonth(level,sourceRow,month);
    }
  }
  const contextual=source.context_verified_repeated_titles;
  if(Array.isArray(contextual))for(const rec of contextual)
    setMonth(String(rec.level||''),String(rec.source_row||''),Number(rec.month_number));
  return NextResponse.json({version_id:data.version.id,version:data.version,targets:data.targets||[],group_rows:groups,month_schedule:monthSchedule},{headers:{'Cache-Control':'private, no-store'}});
}
