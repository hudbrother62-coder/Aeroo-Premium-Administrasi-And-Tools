export const EVIDENCE_MAX_BYTES=10*1024*1024;
export const EVIDENCE_MIME_TYPES=['image/jpeg','image/png','image/webp','application/pdf'] as const;

export function safeEvidenceName(name:string){
  const clean=String(name||'').normalize('NFKC')
    .replace(/[\\/\0-\x1f\x7f]+/g,'-')
    .replace(/[^a-zA-Z0-9._() -]+/g,'-')
    .trim();
  return (clean||'dokumen').slice(0,120);
}

export function validateEvidenceMeta(input:{name:string;type:string;size:number}){
  if(!Number.isFinite(input.size)||input.size<=0||input.size>EVIDENCE_MAX_BYTES){
    throw new Error('Ukuran file harus 1 byte–10 MB.');
  }
  if(!(EVIDENCE_MIME_TYPES as readonly string[]).includes(input.type)){
    throw new Error('Format yang diizinkan: JPG, PNG, WebP, atau PDF.');
  }
  return {name:safeEvidenceName(input.name),type:input.type,size:input.size};
}

export function evidenceContentDisposition(name:string){
  return `attachment; filename*=UTF-8''${encodeURIComponent(safeEvidenceName(name))}`;
}
