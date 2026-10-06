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
    case 'DEWAN_GURU': return ['CABERAWIT','MUDA_MUDI'];
    case 'KELOMPOK': return ['KELOMPOK','IBU_IBU','PENGURUS'];
    default: return [];
  }
}

export function readScopesForRole(role:string|null|undefined):Audience[]{
  switch(role){
    case 'DEWAN_GURU': return ['CABERAWIT','MUDA_MUDI'];
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
