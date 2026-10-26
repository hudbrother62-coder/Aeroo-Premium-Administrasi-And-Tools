import * as XLSX from 'xlsx';
import JSZip from 'jszip';

type Value = string | number;
export type StyledReportSheet = {
  kind:'Ringkasan'|'Presensi'|'Jurnal';
  rows:Value[][];
  minWidths:number[];
  maxWidths:number[];
  merges?:XLSX.Range[];
  freezeRows?:number;
};

const MAIN='123F52', GREEN='0E7C66', HEADER='145A64', BORDER='CAD8DB';
const font=(color:string,bold=false,size=10)=>
  '<font><sz val="'+size+'"/><color rgb="FF'+color+'"/><name val="Aptos"/>'+(bold?'<b/>':'')+'</font>';
const fill=(color:string)=>'<fill><patternFill patternType="solid"><fgColor rgb="FF'+color+'"/><bgColor indexed="64"/></patternFill></fill>';
const border=(weight:'thin'|'medium')=>
  '<border><left style="'+weight+'"><color rgb="FF'+BORDER+'"/></left><right style="'+weight+'"><color rgb="FF'+BORDER+'"/></right><top style="'+weight+'"><color rgb="FF'+BORDER+'"/></top><bottom style="'+weight+'"><color rgb="FF'+BORDER+'"/></bottom><diagonal/></border>';

function stylesXml(){
  const fonts=[
    font('1F2937'),font('FFFFFF',true,15),font('FFFFFF',true,10),
    font('0F3D39',true),font('166534',true),font('92400E',true),
    font('9F1239',true),font('64748B'),font('475569')
  ];
  const fills=[
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
    ...[MAIN,GREEN,HEADER,'F4FAF8','DCFCE7','FFF4CC','FFE4E6','F1F5F9','D7F3EC','E5F4F0','FFF7E6','475569'].map(fill)
  ];
  // Indices: 0 none, 1 default gray125, 2 title, 3 section, 4 header,
  // 5 zebra, 6 hadir, 7 izin, 8 alfa, 9 pending, 10 total, 11 meta, 12 note, 13 unknown.
  const borders=['<border><left/><right/><top/><bottom/><diagonal/></border>',border('thin'),border('medium')];
  const styles:Array<[number,number,number,'left'|'center',boolean]>=[
    [0,0,0,'left',false],      // 0 default
    [1,2,2,'left',true],       // 1 large title
    [2,3,1,'center',true],     // 2 male/female section
    [2,4,1,'center',true],     // 3 column header
    [0,0,1,'left',true],       // 4 body
    [0,5,1,'left',true],       // 5 alternating body
    [4,6,1,'center',false],    // 6 H
    [5,7,1,'center',false],    // 7 I
    [6,8,1,'center',false],    // 8 A
    [7,9,1,'center',false],    // 9 pending
    [3,10,1,'center',true],   // 10 total
    [3,11,1,'left',true],     // 11 metadata label
    [0,0,1,'left',true],      // 12 metadata value
    [8,12,1,'left',true],     // 13 note row
    [2,13,1,'center',true],   // 14 missing gender
    [7,9,1,'left',true],      // 15 muted row
    [0,0,1,'center',false],   // 16 numeric
    [0,5,1,'center',false],   // 17 alternating numeric
    [3,11,1,'left',true]      // 18 journal field label
  ];
  const xfs=styles.map(([fontId,fillId,borderId,horizontal,wrap])=>
    '<xf numFmtId="0" fontId="'+fontId+'" fillId="'+fillId+'" borderId="'+borderId+'" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="'+horizontal+'" vertical="center" wrapText="'+(wrap?'1':'0')+'"/></xf>'
  );
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    +'<fonts count="'+fonts.length+'">'+fonts.join('')+'</fonts>'
    +'<fills count="'+fills.length+'">'+fills.join('')+'</fills>'
    +'<borders count="'+borders.length+'">'+borders.join('')+'</borders>'
    +'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    +'<cellXfs count="'+xfs.length+'">'+xfs.join('')+'</cellXfs>'
    +'<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    +'</styleSheet>';
}
function xml(value:unknown){
  return String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function statusStyle(value:Value|undefined,defaultStyle:number){
  return value==='H'?6:value==='I'?7:value==='A'?8:value==='-'?9:defaultStyle;
}
function role(sheet:StyledReportSheet,index:number,col:number):number{
  const row=sheet.rows[index]||[];
  const label=row[0];
  if(sheet.kind==='Ringkasan'){
    if(index===0)return 1;
    if(index===12)return 3;
    if(index===11)return 0;
    if(index>=13){
      if(col===3)return 6;
      if(col===4)return 7;
      if(col===5)return 8;
      if(col===6)return 9;
      return index%2===0?5:4;
    }
    if(index===10)return 13;
    if(col===0)return 11;
    if(index===5&&col===1)return 6;
    if(index===6&&col===1)return 7;
    if(index===7&&col===1)return 8;
    return 12;
  }
  if(sheet.kind==='Jurnal'){
    if(index===0)return 3;
    if(col===3&&row[4]===1)return 18;
    if(col===4)return index%2===0?17:16;
    return index%2===0?5:4;
  }
  if(label==='SIMPUL — LAPORAN PRESENSI')return 1;
  if(label==='LAKI-LAKI')return col===3?0:2;
  if(label==='GENDER BELUM TERCATAT')return 14;
  if(label==='NO')return col===3&&row[3]!== 'KETERANGAN'?0:3;
  if(label==='TOTAL')return 10;
  if(label==='Belum diisi')return col===1?9:15;
  if(label==='Keterangan')return 13;
  if(label==='Kegiatan'||label==='Tanggal'||label==='Pengajar'){
    return col===0||col===3&&row[3]!==''?11:12;
  }
  if(row.every(v=>v===''||v===undefined))return 0;
  if(col===3&&row[3]==='')return 0;
  if(col===2||col===6)return statusStyle(row[col],index%2===0?5:4);
  if(col===0||col===4)return index%2===0?17:16;
  return index%2===0?5:4;
}
function widthFor(sheet:StyledReportSheet,col:number){
  let longest=0;
  for(let i=0;i<sheet.rows.length;i++){
    const row=sheet.rows[i]||[];
    // Do not widen individual columns to fit merged titles or explanatory notes.
    if(sheet.kind==='Presensi'&&['SIMPUL — LAPORAN PRESENSI','Keterangan','LAKI-LAKI','GENDER BELUM TERCATAT'].includes(String(row[0])))continue;
    if(sheet.kind==='Ringkasan'&&(i===0||i===10))continue;
    const item=String(row[col]??'');
    if(item.length>longest)longest=item.length;
  }
  const measured=Math.ceil(longest*1.06)+3;
  return Math.min(sheet.maxWidths[col],Math.max(sheet.minWidths[col],measured));
}
function rowHeight(sheet:StyledReportSheet,index:number,widths:number[]){
  const row=sheet.rows[index]||[];
  if(row[0]==='SIMPUL — LAPORAN PRESENSI'||sheet.kind==='Ringkasan'&&index===0)return 34;
  if(sheet.kind==='Presensi'&&['LAKI-LAKI','GENDER BELUM TERCATAT'].includes(String(row[0])))return 27;
  if(sheet.kind==='Ringkasan'&&index===12||sheet.kind==='Jurnal'&&index===0||row[0]==='NO')return 28;
  if(row.every(x=>x===''||x===undefined))return 11;
  let lines=1;
  for(let c=0;c<row.length;c++){
    const s=String(row[c]??'');
    if(!s)continue;
    // Letters are a conservative approximation of the rendered Excel column width.
    const usable=Math.max(7,(widths[c]||12)-2);
    const wrapped=s.split('\n').reduce((acc,part)=>acc+Math.max(1,Math.ceil(part.length/usable)),0);
    lines=Math.max(lines,wrapped);
  }
  return Math.min(sheet.kind==='Jurnal'?110:sheet.kind==='Presensi'?64:50,Math.max(23,lines*15+8));
}
function worksheetXml(sheet:StyledReportSheet){
  const length=sheet.minWidths.length;
  const widths=Array.from({length},(_,i)=>widthFor(sheet,i));
  const cols=widths.map((width,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+width+'" customWidth="1"/>').join('');
  const rows=sheet.rows.map((row,index)=>{
    const rowNumber=index+1;
    if(row.length===0||row.every(v=>v===''||v===undefined)&&sheet.kind==='Presensi'){
      return '<row r="'+rowNumber+'" ht="11" customHeight="1"/>';
    }
    const cells=Array.from({length},(_,col)=>{
      const ref=XLSX.utils.encode_cell({r:index,c:col});
      const value=row[col]??'';
      const style=role(sheet,index,col);
      if(value==='')return '<c r="'+ref+'" s="'+style+'"/>';
      if(typeof value==='number'&&Number.isFinite(value))
        return '<c r="'+ref+'" s="'+style+'"><v>'+value+'</v></c>';
      return '<c r="'+ref+'" s="'+style+'" t="inlineStr"><is><t xml:space="preserve">'+xml(value)+'</t></is></c>';
    }).join('');
    return '<row r="'+rowNumber+'" ht="'+rowHeight(sheet,index,widths)+'" customHeight="1">'+cells+'</row>';
  }).join('');
  const mergeList=(sheet.merges||[]).map(m=>'<mergeCell ref="'+XLSX.utils.encode_range(m)+'"/>').join('');
  const merges=mergeList?'<mergeCells count="'+(sheet.merges||[]).length+'">'+mergeList+'</mergeCells>':'';
  const freeze=(sheet.freezeRows||0)>0?'<pane ySplit="'+sheet.freezeRows+'" topLeftCell="A'+(sheet.freezeRows!+1)+'" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A'+(sheet.freezeRows!+1)+'" sqref="A'+(sheet.freezeRows!+1)+'"/>':'';
  const autofilter=sheet.kind==='Ringkasan'&&sheet.rows.length>13?'<autoFilter ref="A13:G'+sheet.rows.length+'"/>'
    :sheet.kind==='Jurnal'?'<autoFilter ref="A1:F'+sheet.rows.length+'"/>':'';
  const last=XLSX.utils.encode_cell({r:Math.max(0,sheet.rows.length-1),c:length-1});
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    +'<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'
    +'<dimension ref="A1:'+last+'"/>'
    +'<sheetViews><sheetView workbookViewId="0" showGridLines="0">'+freeze+'</sheetView></sheetViews>'
    +'<sheetFormatPr defaultRowHeight="19"/>'
    +'<cols>'+cols+'</cols><sheetData>'+rows+'</sheetData>'+merges+autofilter
    +'<printOptions horizontalCentered="1"/>'
    +'<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>'
    +'<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>'
    +'<headerFooter><oddFooter>&amp;LSimpul &amp;CLaporan Presensi &amp;RHalaman &amp;P / &amp;N</oddFooter></headerFooter>'
    +'</worksheet>';
}

/**
 * SheetJS Community produces the workbook structure; JSZip applies OOXML styles.
 * No runtime dependency or stored attendance/journal data is modified.
 */
export async function styledReportXlsx(book:XLSX.WorkBook,sheets:StyledReportSheet[]){
  if(sheets.length!==book.SheetNames.length)throw Error('Lembar laporan tidak sesuai.');
  const raw=XLSX.write(book,{type:'array',bookType:'xlsx'}) as ArrayBuffer;
  const zip=await JSZip.loadAsync(raw);
  if(!zip.file('xl/styles.xml'))throw Error('Workbook tidak memiliki stylesheet.');
  zip.file('xl/styles.xml',stylesXml());
  for(let i=0;i<sheets.length;i++){
    const file='xl/worksheets/sheet'+(i+1)+'.xml';
    if(!zip.file(file))throw Error('Lembar Excel '+(i+1)+' tidak ditemukan.');
    zip.file(file,worksheetXml(sheets[i]));
  }
  return zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:6}});
}
