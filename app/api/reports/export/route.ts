import {NextRequest,NextResponse} from 'next/server';
import {attendanceReport} from '@/lib/attendance-report';
import {spreadsheetCell} from '@/lib/spreadsheet';
import * as XLSX from 'xlsx';
import {Document,Packer,Paragraph,Table,TableCell,TableRow,HeadingLevel,WidthType,TextRun} from 'docx';
import {jsPDF} from 'jspdf';

export const runtime='nodejs';
function deliver(bytes:Uint8Array|ArrayBuffer,mime:string,name:string){
  return new Response(bytes as BodyInit,{headers:{
    'Content-Type':mime,'Content-Disposition':'attachment; filename="'+name+'"',
    'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
  }});
}
function asText(v:unknown){return v===null||v===undefined?'':String(v);}
function worksheet(records:Record<string,unknown>[],fallback:string[]){
  const headers=records.length?Object.keys(records[0]):fallback;
  const body=[headers,...records.map(r=>headers.map(h=>typeof r[h]==='string'?spreadsheetCell(r[h]):r[h]??''))];
  const ws=XLSX.utils.aoa_to_sheet(body);
  ws['!cols']=headers.map(h=>({wch:Math.min(52,Math.max(14,h.length+4))}));
  ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:Math.max(0,body.length-1),c:headers.length-1}})};
  return ws;
}
function table(records:Record<string,unknown>[],fallback:string[]){
  const keys=records.length?Object.keys(records[0]):fallback;
  return new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[
    new TableRow({tableHeader:true,children:keys.map(h=>new TableCell({children:[new Paragraph({children:[new TextRun({text:h,bold:true})]})]}))}),
    ...(records.length?records.map(row=>new TableRow({children:keys.map(h=>new TableCell({children:[new Paragraph(asText(row[h]))]}))})):
      [new TableRow({children:keys.map((_,i)=>new TableCell({children:[new Paragraph(i===0?'Belum ada data':'')]}))})]),
  ]});
}
export async function GET(req:NextRequest){
  try{
    const format=req.nextUrl.searchParams.get('format')||'xlsx';
    if(!['xlsx','docx','pdf'].includes(format))return NextResponse.json({error:'Format laporan tidak didukung.'},{status:400});
    const d=await attendanceReport(req);
    const name='simpul-presensi-'+d.period.from+'-'+d.period.to;
    const summaryRows:Record<string,unknown>[]=[
      {Indikator:'Periode mulai',Nilai:d.period.from},
      {Indikator:'Periode akhir',Nilai:d.period.to},
      {Indikator:'Kategori',Nilai:d.audience},
      {Indikator:'Jumlah kegiatan',Nilai:d.summary.meetings},
      {Indikator:'Hadir',Nilai:d.summary.H},
      {Indikator:'Izin',Nilai:d.summary.I},
      {Indikator:'Alfa',Nilai:d.summary.A},
      {Indikator:'Belum absen',Nilai:d.summary.pending},
      {Indikator:'Total catatan',Nilai:d.summary.total},
      {Indikator:'Kehadiran dari catatan terisi (%)',Nilai:d.summary.percentage??'Belum diisi'},
    ];
    const info='Kehadiran dihitung H/(H+I+A). Belum absen tidak dianggap Alfa dan tidak masuk penyebut.';
    if(format==='xlsx'){
      const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,worksheet(summaryRows,['Indikator','Nilai']),'Ringkasan');
      XLSX.utils.book_append_sheet(wb,worksheet(d.rows as unknown as Record<string,unknown>[],['Tanggal','Kegiatan','Kategori','Hadir','Izin','Alfa','Belum absen','Total peserta','Kehadiran (%)']),'Per Kegiatan');
      XLSX.utils.book_append_sheet(wb,worksheet(d.details as unknown as Record<string,unknown>[],['Tanggal','Kegiatan','Kategori','Kelas','Peserta','Status']),'Detail Individu');
      XLSX.utils.book_append_sheet(wb,worksheet([{Keterangan:info}],['Keterangan']),'Definisi Indikator');
      return deliver(XLSX.write(wb,{type:'array',bookType:'xlsx'}) as ArrayBuffer,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',name+'.xlsx');
    }
    if(d.details.length>10000)return NextResponse.json({error:'Laporan Word/PDF lebih dari 10.000 catatan. Gunakan Excel atau persempit periode.'},{status:413});
    if(format==='docx'){
      const children=[
        new Paragraph({text:'SIMPUL — LAPORAN PRESENSI',heading:HeadingLevel.TITLE}),
        new Paragraph('Periode: '+d.period.from+' s.d. '+d.period.to+' | Kategori: '+d.audience),
        new Paragraph({text:'Ringkasan',heading:HeadingLevel.HEADING_2}),
        table(summaryRows,['Indikator','Nilai']),
        new Paragraph(info),
        new Paragraph({text:'Rekap per kegiatan',heading:HeadingLevel.HEADING_2}),
        table(d.rows as unknown as Record<string,unknown>[],['Tanggal','Kegiatan','Kategori','Hadir','Izin','Alfa','Belum absen','Total peserta','Kehadiran (%)']),
        new Paragraph({text:'Detail kehadiran individu',heading:HeadingLevel.HEADING_2}),
        table(d.details as unknown as Record<string,unknown>[],['Tanggal','Kegiatan','Kategori','Kelas','Peserta','Status']),
        new Paragraph('Sumber: catatan presensi Simpul sesuai hak akses pengguna.'),
      ];
      const bytes=new Uint8Array(await Packer.toBuffer(new Document({sections:[{children}]})));
      return deliver(bytes,'application/vnd.openxmlformats-officedocument.wordprocessingml.document',name+'.docx');
    }
    const pdf=new jsPDF({orientation:'landscape',format:'a4'});
    const pw=pdf.internal.pageSize.getWidth(),ph=pdf.internal.pageSize.getHeight(),margin=13;
    let y=17;
    function page(){pdf.addPage();y=17;}
    function line(value:string,size=9){
      pdf.setFontSize(size);
      const lines=pdf.splitTextToSize(value,pw-margin*2);
      for(const text of lines){if(y>ph-17)page();pdf.text(text,margin,y);y+=size>=13?9:5.5;}
    }
    function heading(label:string){if(y>ph-35)page();y+=4;line(label,13);y+=1;}
    function reportTable(records:Record<string,unknown>[],keys:string[],widths:number[]){
      const usable=pw-2*margin;const sizes=widths.map(n=>n*usable);
      const renderRow=(cells:string[],header=false)=>{
        pdf.setFontSize(header?8.2:7.5);
        const blocks=cells.map((x,i)=>pdf.splitTextToSize(x||'-',sizes[i]-3));
        const h=Math.max(7,...blocks.map(x=>x.length*4+3));
        if(y+h>ph-14){page();if(!header)renderRow(keys,true);}
        let x=margin;
        pdf.setDrawColor(175);
        cells.forEach((_,i)=>{
          pdf.rect(x,y,sizes[i],h);
          pdf.text(blocks[i],x+1.5,y+4.3);
          x+=sizes[i];
        });y+=h;
      };
      renderRow(keys,true);
      if(!records.length)line('Tidak ada catatan untuk periode ini.');
      for(const row of records)renderRow(keys.map(k=>asText(row[k])));
    }
    pdf.setFontSize(16);line('SIMPUL - LAPORAN PRESENSI',16);
    line('Periode: '+d.period.from+' s.d. '+d.period.to+' | Kategori: '+d.audience);
    heading('Ringkasan');
    reportTable(summaryRows,['Indikator','Nilai'],[0.55,0.45]);
    y+=3;line(info,8);
    heading('Rekap per kegiatan');
    reportTable(d.rows as unknown as Record<string,unknown>[],
      ['Tanggal','Kegiatan','Kategori','Hadir','Izin','Alfa','Belum absen','Total peserta','Kehadiran (%)'],
      [0.11,0.25,0.14,0.06,0.06,0.06,0.10,0.10,0.12]);
    heading('Detail kehadiran individu');
    reportTable(d.details as unknown as Record<string,unknown>[],
      ['Tanggal','Kegiatan','Kategori','Kelas','Peserta','Status'],
      [0.12,0.28,0.14,0.15,0.20,0.11]);
    const total=pdf.getNumberOfPages();
    for(let p=1;p<=total;p++){
      pdf.setPage(p);pdf.setFontSize(8);pdf.text('Simpul | '+d.period.from+' - '+d.period.to,margin,ph-6);
      pdf.text('Halaman '+p+' / '+total,pw-margin,ph-6,{align:'right'});
    }
    return deliver(pdf.output('arraybuffer'),'application/pdf',name+'.pdf');
  }catch(e){
    const error=e as Error & {status?:number};
    return NextResponse.json({error:error.message||'Gagal membuat laporan.'},{status:error.status||400});
  }
}
