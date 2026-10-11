'use client';
import type {ReactNode} from 'react';

export type AccessRole='ADMIN'|'DEWAN_GURU'|'KELOMPOK'|'VIEWER';
export type PermissionValues=Record<string,boolean>;

export const permissionGroups=[
  {title:'Database Anggota',description:'Pendataan dan pemutakhiran anggota.',entries:[['person.read','Lihat database'],['person.write','Tambah, edit & kelola anggota']]},
  {title:'Agenda dan Presensi',description:'Kegiatan, presensi dan koreksi.',entries:[['agenda.read','Lihat agenda'],['agenda.write','Kelola agenda'],['attendance.read','Lihat presensi'],['attendance.write','Isi & koreksi presensi']]},
  {title:'Pembelajaran',description:'Jurnal, target, dan progres sesuai jenjang.',entries:[['journal.read','Lihat jurnal'],['journal.write','Isi & edit jurnal'],['target.read','Lihat target & progres'],['target.write','Kelola target & progres']]},
  {title:'Struktur dan Laporan',description:'Dapukan, keputusan, dan pelaporan.',entries:[['position.read','Lihat dapukan & pengurus'],['position.write','Kelola dapukan & pengurus'],['decision.write','Kelola keputusan'],['report.read','Lihat rekap & laporan'],['report.publish','Publikasikan laporan']]},
  {title:'Catatan dan Administrasi',description:'Catatan bersama, impor, dan arsip.',entries:[['note.read','Lihat catatan bersama'],['note.write','Kelola catatan bersama'],['import.manage','Kelola impor'],['archive.manage','Kelola arsip']]},
  {title:'Administrasi Sistem',description:'Khusus akun Admin.',entries:[['user.manage','Kelola akun & akses'],['settings.manage','Kelola pengaturan']]}
] as const;
export const PERMISSION_KEYS=permissionGroups.flatMap(group=>group.entries.map(([key])=>key));
const baseGrants:Record<AccessRole,readonly string[]>={
  ADMIN:PERMISSION_KEYS,
  DEWAN_GURU:['person.read','person.write','agenda.read','agenda.write','attendance.read','attendance.write','journal.read','journal.write','target.read','target.write','report.read','report.publish','import.manage','archive.manage','note.read','note.write'],
  KELOMPOK:['person.read','person.write','agenda.read','agenda.write','attendance.read','attendance.write','journal.read','journal.write','position.read','position.write','decision.write','report.read','report.publish','import.manage','archive.manage','note.read','note.write'],
  VIEWER:['person.read','agenda.read','attendance.read','journal.read','target.read','report.read','note.read'],
};
export function initialPermissions(role:AccessRole):PermissionValues{
  return Object.fromEntries(PERMISSION_KEYS.map(p=>[p,baseGrants[role].includes(p)]));
}
const readonlyKeys=new Set(['person.read','agenda.read','attendance.read','journal.read','target.read','position.read','report.read','note.read']);
export function permissionDisabled(role:AccessRole,key:string):boolean{
  return role==='ADMIN'||(role==='VIEWER'&&!readonlyKeys.has(key))||
    (key==='user.manage'||key==='settings.manage');
}
export function permissionEntries(values:PermissionValues,role:AccessRole){
  return PERMISSION_KEYS.map(permission=>({permission,allowed:role==='ADMIN'||(!permissionDisabled(role,permission)&&!!values[permission])}));
}
export function togglePermission(prev:PermissionValues,key:string,checked:boolean):PermissionValues{
  const next={...prev,[key]:checked};
  const readKey=key==='report.publish'?'report.read':key.endsWith('.write')?key.replace(/\.write$/,'.read'):null;
  if(checked&&readKey&&readKey in prev)next[readKey]=true;
  if(!checked&&key.endsWith('.read')){
    const writeKey=key.replace(/\.read$/,'.write');
    if(writeKey in prev)next[writeKey]=false;
    if(key==='report.read')next['report.publish']=false;
  }
  return next;
}
export function PermissionChecklist({role,values,onChange,header}:{role:AccessRole;values:PermissionValues;onChange:(key:string,checked:boolean)=>void;header?:ReactNode}){
  const count=PERMISSION_KEYS.filter(p=>values[p]&&!permissionDisabled(role,p)).length;
  return <section className="grantPanel">
    <div className="grantPanelHeader"><div><h3>{header||'Centang Akses Menu & Fitur'}</h3><p>Centang hak yang diizinkan. Hak yang tidak dicentang tidak diberikan kepada akun ini.</p></div><span className="chip">{role==='ADMIN'?'Akses penuh':count+' akses'}</span></div>
    {role==='ADMIN'&&<p className="itemMeta">Role Admin memiliki hak penuh dan tidak dapat dibatasi dengan centang.</p>}
    <div className="grantGrid">{permissionGroups.map(group=><div className="grantCard" key={group.title}>
      <strong>{group.title}</strong><small>{group.description}</small>
      {group.entries.map(([key,label])=><label className="grantOption" key={key}><input type="checkbox" checked={role==='ADMIN'||!!values[key]} disabled={permissionDisabled(role,key)} onChange={e=>onChange(key,e.target.checked)}/><span>{label}</span></label>)}
    </div>)}</div>
  </section>;
}
