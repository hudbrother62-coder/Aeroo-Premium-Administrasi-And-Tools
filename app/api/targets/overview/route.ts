import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

export async function GET(req:NextRequest){
  const s=await db();const month=req.nextUrl.searchParams.get('month')||new Date().toISOString().slice(0,7);
  const from=month+'-01';const year=Number(month.slice(0,4)),m=Number(month.slice(5,7));
  const end=new Date(year,m+4,1);const to=`${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-01`;
  const [targetResult,memberResult,progressResult]=await Promise.all([
    s.from('learning_targets').select('id,title,target_month,class_id,level_id,levels(name),classes(name)').eq('active',true).gte('target_month',from).lte('target_month',to).order('target_month'),
    s.from('members').select('id,name,level_id,class_id,classes(name),levels(name),member_categories(categories(slug))').eq('status','ACTIVE'),
    s.from('journal_progress').select('member_id,target_id,progress_value,created_at').not('target_id','is',null).order('created_at',{ascending:false}).limit(5000)
  ]);
  const error=targetResult.error||memberResult.error||progressResult.error;
  if(error)return NextResponse.json({error:error.message},{status:400});
  const targets=targetResult.data??[];
  const people=(memberResult.data??[]).filter((p:any)=>p.member_categories?.some((c:any)=>c.categories?.slug==='caberawit'||c.categories?.slug==='muda-mudi'&&p.levels?.name==='Remaja'));
  const latest=new Map<string,number>();
  for(const p of progressResult.data??[]){const key=`${p.member_id}:${p.target_id}`;if(!latest.has(key)&&p.progress_value!==null)latest.set(key,Math.min(100,Math.max(0,Number(p.progress_value))))}
  const individual=people.map((p:any)=>{
    const assigned=targets.filter(t=>t.level_id===p.level_id&&(!t.class_id||t.class_id===p.class_id));
    const scored=assigned.map(t=>latest.get(`${p.id}:${t.id}`)??0);
    return {id:p.id,name:p.name,class_name:p.classes?.name||'',level_name:p.levels?.name||'',targets:assigned.length,assessed:assigned.filter(t=>latest.has(`${p.id}:${t.id}`)).length,percentage:scored.length?Math.round(scored.reduce((a,b)=>a+b,0)/scored.length):0};
  });
  const group=new Map<string,{name:string;count:number;total:number}>();
  for(const p of individual){const name=p.class_name||p.level_name;const g=group.get(name)||{name,count:0,total:0};g.count++;g.total+=p.percentage;group.set(name,g)}
  return NextResponse.json({from,to,targets,individual,classes:Array.from(group.values()).map(g=>({name:g.name,count:g.count,percentage:Math.round(g.total/g.count)}))});
}
