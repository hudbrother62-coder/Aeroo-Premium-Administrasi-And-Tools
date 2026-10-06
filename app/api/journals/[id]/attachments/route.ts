import {randomUUID} from 'crypto';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

export const runtime='nodejs';

const bucket='airo-evidence';
const allowed=new Set(['image/jpeg','image/png','image/webp','application/pdf']);
const maxBytes=10*1024*1024;

function safeName(name:string){
  const clean=name.normalize('NFKC').replace(/[\\/\0-\x1f\x7f]+/g,'-').replace(/[^a-zA-Z0-9._() -]+/g,'-').trim();
  return (clean||'dokumen').slice(0,120);
}

async function can(s:any,id:string,mode:'read'|'write'){
  const fn=mode==='write'?'can_write_journal_id':'can_read_journal_id';
  const {data,error}=await s.rpc(fn,{p_journal_id:id});
  if(error)throw Error(error.message);
  return data===true;
}

export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;
    const s=await db();
    if(!await can(s,id,'read'))return NextResponse.json({error:'Akses ditolak.'},{status:403});

    const downloadId=req.nextUrl.searchParams.get('download');
    if(downloadId){
      const {data:attachment,error:attachmentError}=await s.from('journal_attachments').select('id,file_path,file_name,mime_type').eq('id',downloadId).eq('journal_id',id).single();
      if(attachmentError||!attachment)return NextResponse.json({error:'Dokumentasi tidak ditemukan.'},{status:404});
      const {data:file,error:fileError}=await s.storage.from(bucket).download(attachment.file_path);
      if(fileError||!file)throw Error(fileError?.message||'File tidak dapat diunduh.');
      const buffer=await file.arrayBuffer();
      const name=attachment.file_name||'dokumentasi';
      return new Response(buffer,{headers:{
        'Content-Type':attachment.mime_type||file.type||'application/octet-stream',
        'Content-Length':String(buffer.byteLength),
        'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control':'private, no-store'
      }});
    }

    const {data,error}=await s.from('journal_attachments')
      .select('id,journal_id,file_path,file_name,mime_type,created_at')
      .eq('journal_id',id)
      .order('created_at',{ascending:false});
    if(error)throw Error(error.message);

    const items=await Promise.all((data||[]).map(async a=>{
      const {data:signed}=await s.storage.from(bucket).createSignedUrl(a.file_path,900);
      return {...a,url:signed?.signedUrl||null};
    }));
    return NextResponse.json(items,{headers:{'Cache-Control':'no-store'}});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Dokumentasi tidak dapat dimuat.'},{status:400});
  }
}

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;
    const s=await db();
    if(!await can(s,id,'write'))return NextResponse.json({error:'Akses ditolak.'},{status:403});

    const form=await req.formData();
    const file=form.get('file');
    if(!(file instanceof File))return NextResponse.json({error:'Pilih file dokumentasi.'},{status:400});
    if(file.size<=0||file.size>maxBytes)return NextResponse.json({error:'Ukuran file harus 1 byte–10 MB.'},{status:400});
    if(!allowed.has(file.type))return NextResponse.json({error:'Format yang diizinkan: JPG, PNG, WebP, atau PDF.'},{status:400});

    const displayName=safeName(file.name);
    const path=`journals/${id}/${randomUUID()}-${displayName}`;
    const {error:uploadError}=await s.storage.from(bucket).upload(path,file,{
      contentType:file.type,
      cacheControl:'3600',
      upsert:false
    });
    if(uploadError)throw Error(uploadError.message);

    const {data,error}=await s.from('journal_attachments').insert({
      journal_id:id,
      file_path:path,
      file_name:displayName,
      mime_type:file.type
    }).select('id,journal_id,file_path,file_name,mime_type,created_at').single();

    if(error){
      await s.storage.from(bucket).remove([path]);
      throw Error(error.message);
    }

    const {data:signed}=await s.storage.from(bucket).createSignedUrl(path,900);
    return NextResponse.json({...data,url:signed?.signedUrl||null},{status:201});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Dokumentasi gagal diunggah.'},{status:400});
  }
}

export async function DELETE(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;
    const attachmentId=req.nextUrl.searchParams.get('attachment_id');
    if(!attachmentId)return NextResponse.json({error:'Dokumentasi tidak ditemukan.'},{status:400});

    const s=await db();
    if(!await can(s,id,'write'))return NextResponse.json({error:'Akses ditolak.'},{status:403});

    const {data:attachment,error:loadError}=await s.from('journal_attachments')
      .select('id,file_path')
      .eq('id',attachmentId)
      .eq('journal_id',id)
      .single();
    if(loadError||!attachment)return NextResponse.json({error:'Dokumentasi tidak ditemukan.'},{status:404});

    const {error:storageError}=await s.storage.from(bucket).remove([attachment.file_path]);
    if(storageError)throw Error(storageError.message);

    const {error}=await s.from('journal_attachments').delete().eq('id',attachmentId).eq('journal_id',id);
    if(error)throw Error(error.message);

    return NextResponse.json({ok:true});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Dokumentasi gagal dihapus.'},{status:400});
  }
}
