export type Role='ADMIN'|'DEWAN_GURU'|'KELOMPOK'|'VIEWER';
export type Audience='KELOMPOK'|'MUDA_MUDI'|'CABERAWIT'|'IBU_IBU'|'PENGURUS';

export const audienceLabels:Record<Audience,string>={
  KELOMPOK:'Kelompok',
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
    default: return allAudiences;
  }
}

export function canWriteAudience(role:string|null|undefined,audience:string){
  return writeScopesForRole(role).includes(audience as Audience);
}
