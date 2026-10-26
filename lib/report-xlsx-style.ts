import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

type Value=string|number;
export type StyledReportSheet={
  kind:'Ringkasan'|'Presensi'|'Jurnal';
  rows:Value[][];
  minWidths:number[];
  maxWidths:number[];
  merges?:XLSX.Range[];
  freezeRows?:number;
};

type Color={argb:string};
const argb=(hex:string):Color=>({argb:'FF'+hex});
const colors={
  title:'123F52',section:'0E7C66',header:'145A64',stroke:'CAD8DB',
  text:'1F2937',zebra:'F4FAF8',present:'DCFCE7',permit:'FFF4CC',
  absent:'FFE4E6',pending:'F1F5F9',total:'D7F3EC',meta:'E5F4F0',
  note:'FFF7E6',unknown:'475569',green:'166534',amber:'92400E',
  red:'9F1239',muted:'64748B'
};
type Role='title'|'section'|'header'|'body'|'zebra'|'present'|'permit'|'absent'|
 'pending'|'total'|'meta-label'|'meta-value'|'note'|'unknown'|'muted'|
 'number'|'number-zebra'|'journal-label'|'blank';
const border:Partial<ExcelJS.Borders>={
  left:{style:'thin',color:argb(colors.stroke)},
  right:{style:'thin',color:argb(colors.stroke)},
  top:{style:'thin',color:argb(colors.stroke)},
  bottom:{style:'thin',color:argb(colors.stroke)}
};
function decideRole(sheet:StyledReportSheet,index:number,col:number):Role{
  const row=sheet.rows[index]||[];
  const label=row[0];
  if(sheet.kind==='Ringkasan'){
    if(index===0)return 'title';
    if(index===12)return 'header';
    if(index===11)return 'blank';
    if(index>=13){
      if(col===3)return 'present';
      if(col===4)return 'permit';
      if(col===5)return 'absent';
      if(col===6)return 'pending';
      return index%2===0?'zebra':'body';
    }
    if(index===10)return 'note';
    if(col===0)return 'meta-label';
    if(index===5&&col===1)return 'present';
    if(index===6&&col===1)return 'permit';
    if(index===7&&col===1)return 'absent';
    return 'meta-value';
  }
  if(sheet.kind==='Jurnal'){
    if(index===0)return 'header';
    if(col===3&&row[4]===1)return 'journal-label';
    if(col===4)return index%2===0?'number-zebra':'number';
    return index%2===0?'zebra':'body';
  }
  if(label==='SIMPUL — LAPORAN PRESENSI')return 'title';
  if(label==='LAKI-LAKI')return col===3?'blank':'section';
  if(label==='GENDER BELUM TERCATAT')return 'unknown';
  if(label==='NO')return col===3&&row[3]!=='KETERANGAN'?'blank':'header';
  if(label==='TOTAL')return 'total';
  if(label==='Belum diisi')return col===1?'pending':'muted';
  if(label==='Keterangan')return 'note';
  if(['Kegiatan','Tanggal','Pengajar'].includes(String(label))){
    return col===0||col===3&&row[3]!==''?'meta-label':'meta-value';
  }
  if(row.every(v=>v===''||v===undefined))return 'blank';
  if(col===3&&row[3]==='')return 'blank';
  if(col===2||col===6){
    if(row[col]==='H')return 'present';
    if(row[col]==='I')return 'permit';
    if(row[col]==='A')return 'absent';
    if(row[col]==='-')return 'pending';
  }
  if(col===0||col===4)return index%2===0?'number-zebra':'number';
  return index%2===0?'zebra':'body';
}
function widthFor(sheet:StyledReportSheet,col:number){
  let longest=0;
  for(let i=0;i<sheet.rows.length;i++){
    const row=sheet.rows[i]||[];
    if(sheet.kind==='Presensi'&&['SIMPUL — LAPORAN PRESENSI','Keterangan','LAKI-LAKI','GENDER BELUM TERCATAT'].includes(String(row[0])))continue;
    if(sheet.kind==='Ringkasan'&&(i===0||i===10))continue;
    longest=Math.max(longest,String(row[col]??'').length);
  }
  return Math.min(sheet.maxWidths[col],Math.max(sheet.minWidths[col],Math.ceil(longest*1.06)+3));
}
function rowHeight(sheet:StyledReportSheet,index:number,widths:number[]){
  const row=sheet.rows[index]||[];
  if(row[0]==='SIMPUL — LAPORAN PRESENSI'||sheet.kind==='Ringkasan'&&index===0)return 34;
  if(sheet.kind==='Presensi'&&['LAKI-LAKI','GENDER BELUM TERCATAT'].includes(String(row[0])))return 28;
  if(sheet.kind==='Ringkasan'&&index===12||sheet.kind==='Jurnal'&&index===0||row[0]==='NO')return 29;
  if(!row.length||row.every(x=>x===''||x===undefined))return 12;
  let lines=1;
  for(let col=0;col<row.length;col++){
    const value=String(row[col]??'');
    if(!value)continue;
    const usable=Math.max(7,(widths[col]||12)-2);
    lines=Math.max(lines,value.split('\n').reduce((sum,chunk)=>sum+Math.max(1,Math.ceil(chunk.length/usable)),0));
  }
  return Math.min(sheet.kind==='Jurnal'?112:sheet.kind==='Presensi'?72:60,Math.max(24,lines*16+8));
}
function applyStyle(cell:ExcelJS.Cell,role:Role,wrap:boolean){
  const isTitle=role==='title',isSection=role==='section'||role==='header'||role==='unknown';
  let fg=colors.text, bg:string|undefined, bold=false,center=false;
  if(isTitle){fg='FFFFFF';bg=colors.title;bold=true;}
  else if(isSection){fg='FFFFFF';bg=role==='section'?colors.section:role==='header'?colors.header:colors.unknown;bold=true;center=true;}
  else if(role==='present'){fg=colors.green;bg=colors.present;bold=true;center=true;}
  else if(role==='permit'){fg=colors.amber;bg=colors.permit;bold=true;center=true;}
  else if(role==='absent'){fg=colors.red;bg=colors.absent;bold=true;center=true;}
  else if(role==='pending'){fg=colors.muted;bg=colors.pending;center=true;}
  else if(role==='total'){fg=colors.green;bg=colors.total;bold=true;center=true;}
  else if(role==='meta-label'||role==='journal-label'){fg=colors.title;bg=colors.meta;bold=true;}
  else if(role==='meta-value'){bg=colors.zebra;}
  else if(role==='note'){bg=colors.note;bold=true;}
  else if(role==='muted'){fg=colors.muted;bg=colors.pending;}
  else if(role==='zebra'||role==='number-zebra'){bg=colors.zebra;}
  if(role==='number'||role==='number-zebra')center=true;
  if(role==='blank')return;
  cell.font={name:'Aptos',size:isTitle?15:10,bold,color:argb(fg)};
  if(bg)cell.fill={type:'pattern',pattern:'solid',fgColor:argb(bg)};
  cell.border=border;
  cell.alignment={horizontal:center?'center':'left',vertical:'middle',wrapText:wrap||isTitle||role==='note'};
}
function buildSheet(workbook:ExcelJS.Workbook,sheet:StyledReportSheet){
  const ws=workbook.addWorksheet(sheet.kind,{
    views:sheet.freezeRows&&sheet.freezeRows>0
      ?[{state:'frozen',xSplit:0,ySplit:sheet.freezeRows,showGridLines:false}]
      :[{state:'normal',showGridLines:false}],
    pageSetup:{
      paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,
      margins:{left:0.25,right:0.25,top:0.5,bottom:0.5,header:0.2,footer:0.2}
    }
  });
  const widths=sheet.minWidths.map((_,i)=>widthFor(sheet,i));
  for(let c=0;c<widths.length;c++)ws.getColumn(c+1).width=widths[c];
  for(let i=0;i<sheet.rows.length;i++){
    const values=sheet.rows[i]||[];
    const row=ws.getRow(i+1);
    row.height=rowHeight(sheet,i,widths);
    for(let c=0;c<widths.length;c++){
      const cell=row.getCell(c+1);
      const value=values[c];
      if(value!==undefined&&value!==null&&value!=='')cell.value=value;
      const style=decideRole(sheet,i,c);
      const isText=sheet.kind==='Jurnal'&&c!==4||sheet.kind==='Presensi'&&(c===1||c===5);
      applyStyle(cell,style,isText);
    }
  }
  for(const merge of sheet.merges||[]){
    ws.mergeCells(merge.s.r+1,merge.s.c+1,merge.e.r+1,merge.e.c+1);
  }
  if(sheet.kind==='Ringkasan'&&sheet.rows.length>=14){
    ws.autoFilter={from:{row:13,column:1},to:{row:sheet.rows.length,column:7}};
  }
  if(sheet.kind==='Jurnal'&&sheet.rows.length>=2){
    ws.autoFilter={from:{row:1,column:1},to:{row:sheet.rows.length,column:6}};
  }
  ws.headerFooter.oddFooter='&LSimpul &CLaporan Presensi &RHalaman &P / &N';
}
/**
 * ExcelJS generates all OOXML parts and relationships. Never hand-rewrite
 * xl/worksheets/*.xml or xl/styles.xml; Excel had repaired those documents.
 * Keep the existing SheetJS workbook parameter only as a names consistency check.
 */
export async function styledReportXlsx(book:XLSX.WorkBook,sheets:StyledReportSheet[]):Promise<Uint8Array>{
  if(sheets.length!==book.SheetNames.length||sheets.some((sheet,i)=>sheet.kind!==book.SheetNames[i]))
    throw Error('Lembar laporan tidak sesuai.');
  const workbook=new ExcelJS.Workbook();
  workbook.creator='Simpul';
  workbook.title='Laporan Presensi Simpul';
  workbook.subject='Rekap kehadiran dan jurnal kegiatan';
  for(const sheet of sheets)buildSheet(workbook,sheet);
  const bytes=await workbook.xlsx.writeBuffer();
  return new Uint8Array(bytes);
}
