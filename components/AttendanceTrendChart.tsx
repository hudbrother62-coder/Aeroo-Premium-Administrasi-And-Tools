
'use client';
import type {AttendanceBucket} from '@/lib/attendance-trends';
export default function AttendanceTrendChart({points,title}:{points:AttendanceBucket[];title:string}){
 const w=660,h=230,left=42,right=19,top=19,bottom=32;
 const x=(i:number)=>left+(points.length>1?i/(points.length-1):0.5)*(w-left-right);
 const y=(value:number)=>top+(100-value)/100*(h-top-bottom);
 const chunks:Array<Array<{i:number;value:number}>>=[];
 let current:Array<{i:number;value:number}>=[];
 points.forEach((p,i)=>{
  if(p.percentage===null){if(current.length)chunks.push(current);current=[];return;}
  current.push({i,value:p.percentage});
 });
 if(current.length)chunks.push(current);
 const marked=points.filter(p=>p.percentage!==null);
 const first=marked[0],last=marked[marked.length-1];
 const delta=marked.length>1&&first&&last?(last.percentage! - first.percentage!):null;
 const monthName=(month:string)=>new Date(month+'-01T12:00:00').toLocaleDateString('id-ID',{month:'short'});
 return <section className="attendanceTrendPanel" aria-label={title}>
  <div className="attendanceTrendHeading"><div><h3>{title}</h3><p>Persentase hadir dari H + I + A per bulan. Bulan tanpa data ditandai —.</p></div>
   {delta!==null&&<span className={'attendanceTrendChange '+(delta>0?'up':delta<0?'down':'stable')}>{delta>0?'+':''}{delta.toFixed(1)} poin persentase</span>}
  </div>
  <div className="attendanceTrendScroll">
   <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={title+'. '+points.map(p=>monthName(p.month)+': '+(p.percentage===null?'belum ada data':p.percentage+' persen')).join(', ')} preserveAspectRatio="xMidYMid meet" className="attendanceTrendSvg">
    {[0,50,100].map(v=><g key={v}><line x1={left} x2={w-right} y1={y(v)} y2={y(v)} className="attendanceTrendGridLine"/><text x={left-8} y={y(v)+4} textAnchor="end" className="attendanceTrendAxisLabel">{v}%</text></g>)}
    {chunks.map((chunk,k)=><polyline key={k} fill="none" className="attendanceTrendLine" points={chunk.map(p=>`${x(p.i)},${y(p.value)}`).join(' ')}/>)}
    {points.map((p,i)=><g key={p.month}>
      {p.percentage!==null&&<><circle className="attendanceTrendDot" cx={x(i)} cy={y(p.percentage)} r={5}/><text className="attendanceTrendValue" x={x(i)} y={y(p.percentage)-12} textAnchor="middle">{p.percentage}%</text></>}
      <text className="attendanceTrendAxisLabel" x={x(i)} y={h-9} textAnchor="middle">{monthName(p.month)}</text>
    </g>)}
   </svg>
  </div>
  <p className="attendanceTrendFoot">Grafik menunjukkan arah perubahan kehadiran, bukan jumlah peserta. Periode tanpa status H/I/A tidak dihitung 0%.</p>
 </section>;
}
