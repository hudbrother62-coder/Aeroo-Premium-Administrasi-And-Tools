import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import {validDate} from './domain';
export function excelDate(value:unknown):string|null{
 if(value===null||value===undefined||value==='')return null;
 if(typeof value==='number'){const d=XLSX.SSF.parse_date_code(value);if(!d)throw Error('Tanggal Excel tidak valid');const date=`${String(d.y).padStart(4,'0')}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;if(!validDate(date))throw Error('Tanggal tidak valid');return date}
 const raw=String(value).trim();if(validDate(raw))return raw;const m=raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);if(m){const date=`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;if(validDate(date))return date}throw Error('Tanggal gunakan YYYY-MM-DD atau DD/MM/YYYY');
}
export function spreadsheetCell(value:unknown){const s=String(value??'');return /^[=+\-@\t\r]/.test(s)?"'"+s:s}
export async function readWorkbook(file:File){if(!file.name.toLowerCase().endsWith('.xlsx')||file.size>5_000_000)throw Error('Gunakan XLSX maksimal 5 MB');const bytes=await file.arrayBuffer();const zip=await JSZip.loadAsync(bytes);const entries=Object.values(zip.files);if(entries.length>1000)throw Error('Workbook terlalu kompleks');let size=0;for(const e of entries){const n=(e as any)._data?.uncompressedSize||0;size+=n;if(size>50_000_000||n>15_000_000)throw Error('Isi workbook terlalu besar')}if(!zip.file('xl/workbook.xml'))throw Error('Workbook tidak valid');return XLSX.read(bytes,{type:'array',cellDates:false});}
