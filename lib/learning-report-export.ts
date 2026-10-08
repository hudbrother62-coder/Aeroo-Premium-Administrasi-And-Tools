import 'server-only';
import * as XLSX from 'xlsx';
import {jsPDF} from 'jspdf';
import {spreadsheetCell} from './spreadsheet';

type Row=Record<string,unknown>;
type LearningReport={
  title:string;
  values:Record<string,string>;
  details:Row[];
  individuals?:Row[];
  filename:string;
};
function asText(value:unknown){return value===null||value===undefined?'':String(value);}
function sheet(rows:Row[],headers:string[]){
  const keys=rows.length?Object.keys(rows[0]):headers;
  const grid=[keys,...rows.map(r=>keys.map(k=>typeof r[k]==='string'?spreadsheetCell(r[k]):r[k]??''))];
  const out=XLSX.utils.aoa_to_sheet(grid);
  out['!cols']=keys.map(k=>({wch:Math.min(45,Math.max(14,k.length+5))}));
  out['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:grid.length-1,c:keys.length-1}})};
  return out;
}
export function learningReportExport(report:LearningReport,format:'pdf'|'xlsx'){
  const cleanName=report.filename.replace(/[^a-z0-9-]/gi,'-').slice(0,120);
  const headers={'Content-Disposition':'attachment; filename="'+cleanName+'.'+format+'"',
    'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
  const summary=Object.entries(report.values).map(([Indikator,Nilai])=>({Indikator,Nilai}));
  if(format==='xlsx'){
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,sheet(summary,['Indikator','Nilai']),'Ringkasan');
    if(report.individuals)XLSX.utils.book_append_sheet(wb,sheet(report.individuals,['Nama','Hadir','Izin','Alfa','Kehadiran','Progres']),'Individu');
    XLSX.utils.book_append_sheet(wb,sheet(report.details,['Nama','Target','Nilai','Catatan']),'Detail Target');
    return new Response(XLSX.write(wb,{bookType:'xlsx',type:'array'}) as BodyInit,{
      headers:{...headers,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}});
  }
  if(report.details.length>5000)return new Response(JSON.stringify({error:'PDF melebihi 5.000 rincian. Gunakan Excel atau persempit periode.'}),{
    status:413,headers:{'Content-Type':'application/json'}});
  const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const margin=16,w=pdf.internal.pageSize.getWidth(),h=pdf.internal.pageSize.getHeight();
  let y=20;
  function page(){pdf.addPage();y=20;}
  function line(text:string,size=10){
    pdf.setFontSize(size);
    const normalized=text.replace(/[\u0000-\u001f]/g,' ').replace(/[\u2013\u2014]/g,'-');
    const lines=pdf.splitTextToSize(normalized,w-2*margin);
    for(const part of lines){if(y>h-18)page();pdf.text(part,margin,y);y+=size>=14?8:5.3;}
  }
  function section(title:string){if(y>h-40)page();y+=3;line(title,13);y+=2;}
  line('SIMPUL',16);line(report.title,14);y+=4;
  section('Ringkasan laporan');
  for(const r of summary)line(r.Indikator+': '+asText(r.Nilai));
  if(report.individuals){
    section('Rekap individu');
    if(!report.individuals.length)line('Belum ada individu dalam periode ini.');
    for(const row of report.individuals){
      for(const [key,value] of Object.entries(row))line(key+': '+asText(value),9);
      y+=3;
    }
  }
  section('Detail target dan catatan');
  if(!report.details.length)line('Belum ada rincian target.');
  for(const [i,row] of report.details.entries()){
    line((i+1)+'. '+Object.entries(row).map(([k,v])=>k+': '+asText(v)).join(' | '),9);
    y+=2;
  }
  const count=pdf.getNumberOfPages();
  for(let i=1;i<=count;i++){pdf.setPage(i);pdf.setFontSize(8);
    pdf.text('Simpul | '+report.title,margin,h-8);
    pdf.text('Halaman '+i+' / '+count,w-margin,h-8,{align:'right'});
  }
  return new Response(pdf.output('arraybuffer'),{headers:{...headers,'Content-Type':'application/pdf'}});
}
