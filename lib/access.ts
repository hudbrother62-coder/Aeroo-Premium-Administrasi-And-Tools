export type Role='ADMIN'|'DEWAN_GURU'|'KELOMPOK'|'VIEWER';
export type Audience='KELOMPOK'|'MUDA_MUDI'|'CABERAWIT'|'IBU_IBU'|'PENGURUS';

export const audienceLabels:Record<Audience,string>={
  KELOMPOK:'Semua Anggota',
  MUDA_MUDI:'Muda-Mudi',
  CABERAWIT:'Caberawit',
  IBU_IBU:'Ibu-Ibu',
  PENGURUS:'Pengurus',
};

export const allAudiences=Object.keys(audienceLabels) as Audience[];

export function writeScopesForRole(role:string|null|undefined):Audience[]{
  switch(role){
    case 'ADMIN': return allAudiences;
    case 'DEWAN_GURU': return [];
    case 'KELOMPOK': return ['KELOMPOK','IBU_IBU','PENGURUS'];
    default: return [];
  }
}

export function readScopesForRole(role:string|null|undefined):Audience[]{
  switch(role){
    case 'DEWAN_GURU': return [];
    case 'KELOMPOK': return ['KELOMPOK','MUDA_MUDI','IBU_IBU','PENGURUS'];
    case 'ADMIN': return allAudiences;
    default: return allAudiences.filter(a=>a!=='PENGURUS');
  }
}

export function canWriteAudience(role:string|null|undefined,audience:string){
  return writeScopesForRole(role).includes(audience as Audience);
}


export type AccessProfile={role:string;read_scopes?:Audience[];write_scopes?:Audience[];permissions?:Record<string,boolean>};
export function readScopesForUser(user:AccessProfile|null|undefined):Audience[]{
  return user?.read_scopes?.length?user.read_scopes:readScopesForRole(user?.role);
}
export function writeScopesForUser(user:AccessProfile|null|undefined):Audience[]{
  return user?.write_scopes?user.write_scopes:writeScopesForRole(user?.role);
}
export function userCan(user:AccessProfile|null|undefined,permission:string,defaultValue=true){
  return user?.permissions&&permission in user.permissions?user.permissions[permission]!==false:defaultValue;
}


export const roleAccessGuide:Record<Role,{label:string;summary:string;defaultRead:Audience[];defaultWrite:Audience[];pages:string[]}> = {
  ADMIN:{label:'Admin',summary:'Akses penuh seluruh Simpul, akun, audit, pengaturan, semua Caberawit dan seluruh data.',defaultRead:allAudiences,defaultWrite:allAudiences,pages:['Semua menu']},
  DEWAN_GURU:{label:'Dewan Guru',summary:'Default tanpa akses global. Dipasangkan ke tepat satu kelas Caberawit, atau dapat diberi akses seluruh Caberawit oleh Admin.',defaultRead:[],defaultWrite:[],pages:['Database sesuai kelas','Presensi sesuai kelas','Jurnal sesuai kelas','Target & Progres sesuai akses','Rekap/Laporan sesuai akses','Catatan']},
  KELOMPOK:{label:'Operator Kelompok',summary:'Operasional kelompok, Muda-Mudi, Ibu-Ibu dan Pengurus. Caberawit hanya jika Admin memberi scope khusus.',defaultRead:['KELOMPOK','MUDA_MUDI','IBU_IBU','PENGURUS'],defaultWrite:['KELOMPOK','IBU_IBU','PENGURUS'],pages:['Database','Agenda','Presensi','Jurnal','Dapukan & Pengurus','Rekap','Kelengkapan','Catatan']},
  VIEWER:{label:'Viewer',summary:'Baca saja pada data publik/yang diizinkan. Tidak dapat mengubah data atau catatan bersama.',defaultRead:['KELOMPOK','CABERAWIT','MUDA_MUDI','IBU_IBU'],defaultWrite:[],pages:['Beranda','Database','Presensi','Jurnal','Target','Agenda','Rekap','Laporan']}
};
