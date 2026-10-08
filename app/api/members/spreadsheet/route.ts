import {NextRequest,NextResponse} from 'next/server';
import * as XLSX from 'xlsx';
import {db} from '@/lib/supabase-server';
import {publicRows} from '@/lib/public-read';
import {excelDate,spreadsheetCell,readWorkbook} from '@/lib/spreadsheet';

import {effectiveMembership} from '@/lib/domain';

export const runtime='nodejs';

const columns=[
  'ID Anggota','Revision','Nama','Jenis Kelamin','Tempat Lahir','Tanggal Lahir',
  'Nomor HP','Alamat','Jenjang','Kelas','Program (pisahkan koma)','Catatan',
  'Nama Wali','Nomor HP Wali','Keikutsertaan JSON'
];

const norm=(v:unknown)=>String(v??'').trim();

function workbook(rows:unknown[][],name:string){
  const book=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows),'Anggota');
  return new Response(XLSX.write(book,{type:'buffer',bookType:'xlsx'}),{
    headers:{
      'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':`attachment; filename="${name}"`
    }
  });
}

export async function GET(req:NextRequest){
  try{
    if(req.nextUrl.searchParams.get('template')==='1'){
      return workbook([
        columns,
        ['','','Contoh Nama','L','Malang','2010-01-01','08123456789','Alamat lengkap','SD 1','','Caberawit','','','','']
      ],'template-anggota-simpul.xlsx');
    }
    const status=req.nextUrl.searchParams.get('status')||'ACTIVE';
    if(!['ACTIVE','INACTIVE','ALL'].includes(status)){
      return NextResponse.json({error:'Filter status tidak valid.'},{status:400});
    }
    const s=await db();
    const {data:role,error:roleError}=await s.rpc('current_app_role');
    if(roleError)throw Error(roleError.message);
    const viewer=!role||role==='VIEWER';
    if(viewer&&status!=='ACTIVE')return NextResponse.json({error:'Arsip hanya dapat diekspor pengelola.'},{status:403});
    if(!viewer&&status!=='ACTIVE'&&role!=='ADMIN')return NextResponse.json({error:'Ekspor arsip dan seluruh database khusus admin.'},{status:403});
    const items:any[]=[];
    if(viewer)items.push(...await publicRows('members'));
    else {
      for(let offset=0;offset<100000;offset+=500){
        let q=s.from('members')
          .select('*,member_memberships(*,categories(name,slug),classes(name),levels(name))')
          .order('name',{ascending:true}).order('id',{ascending:true})
          .range(offset,offset+499);
        if(status!=='ALL')q=q.eq('status',status);
        const {data,error}=await q;
        if(error)throw Error(error.message);
        items.push(...(data||[]));
        if((data||[]).length<500)break;
        if(offset===99500)throw Error('Database terlalu besar. Gunakan ekspor dengan filter status atau hubungi administrator.');
      }
    }
    const format=req.nextUrl.searchParams.get('format')||'xlsx';
    if(!['xlsx','csv'].includes(format))return NextResponse.json({error:'Format tidak didukung.'},{status:400});
    const extra=['Status','Dibuat','Diperbarui'];
    const detailColumns=['ID Anggota','Nama','Status Anggota','Program','Kelas','Jenjang','Jabatan','Bagian','Tugas','Sejak','Sampai','Berakhir','Keikutsertaan Aktif'];
    const rows:unknown[][]=viewer?[
      ['ID Anggota','Nama','Program','Jenjang','Kelas'],
      ...items.map((p:any)=>[
        p.id,p.name,
        (p.member_categories||[]).map((m:any)=>m.categories?.name).filter(Boolean).join(', '),
        (p.member_memberships||[]).filter((m:any)=>effectiveMembership(m)).map((m:any)=>m.levels?.name).filter(Boolean).join(', '),
        (p.member_memberships||[]).filter((m:any)=>effectiveMembership(m)).map((m:any)=>m.classes?.name).filter(Boolean).join(', ')
      ])
    ]:[
      [...columns,...extra],
      ...items.map((p:any)=>{
        const all=p.member_memberships||[];
        const mm=all.filter((m:any)=>effectiveMembership(m));
        const programs=mm.filter((m:any)=>['caberawit','muda-mudi','ibu-ibu'].includes(m.categories?.slug));
        const learning=programs.find((m:any)=>['caberawit','muda-mudi'].includes(m.categories?.slug));
        return [
          p.id,p.revision,p.name,p.gender,p.birth_place,p.birth_date,p.phone,p.address,
          learning?.levels?.name,learning?.classes?.name,
          programs.map((m:any)=>m.categories?.name).filter(Boolean).join(', '),
          p.notes,p.guardian_name,p.guardian_phone,
          JSON.stringify(programs.map(({categories,classes,levels,created_at,member_id,...m}:any)=>m)),
          p.status,p.created_at,p.updated_at
        ];
      })
    ];
    if(format==='csv'){
      const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+spreadsheetCell(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
      return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8',
        'Content-Disposition':'attachment; filename="anggota-simpul-'+status.toLowerCase()+'.csv"',
        'Cache-Control':'private, no-store'}});
    }
    if(viewer)return workbook(rows,'anggota-simpul-publik.xlsx');
    const history:unknown[][]=[
      detailColumns,
      ...items.flatMap((p:any)=>(p.member_memberships||[]).map((m:any)=>[
        p.id,p.name,p.status,m.categories?.name||'',m.classes?.name||'',m.levels?.name||'',
        m.office||'',m.section||'',m.duties||'',m.valid_from||'',m.valid_to||'',m.ended_on||'',effectiveMembership(m)?'Ya':'Tidak'
      ]))
    ];
    const countBy=(key:string)=>items.filter(p=>p.status===key).length;
    const activeMembership=items.flatMap(p=>(p.member_memberships||[]).filter((m:any)=>effectiveMembership(m)));
    const summary:unknown[][]=[
      ['Indikator','Jumlah'],
      ['Total anggota diekspor',items.length],
      ['Aktif',countBy('ACTIVE')],
      ['Arsip',countBy('INACTIVE')],
      ['Keikutsertaan aktif',activeMembership.length],
      ['Total riwayat keikutsertaan',history.length-1],
      ['Catatan','Sheet Anggota mengikuti format impor. Sheet Riwayat berisi keikutsertaan aktif dan historis.']
    ];
    const book=XLSX.utils.book_new();
    for(const [name,records] of [['Anggota',rows],['Riwayat',history],['Ringkasan',summary]] as Array<[string,unknown[][]]>){
      const safeRows=records.map((row,i)=>i===0?row:row.map(v=>typeof v==='string'?spreadsheetCell(v):v??''));
      const sheet=XLSX.utils.aoa_to_sheet(safeRows);
      const header=records[0]||[];
      sheet['!cols']=header.map(v=>({wch:Math.min(40,Math.max(14,String(v).length+3))}));
      XLSX.utils.book_append_sheet(book,sheet,name);
    }
    return new Response(XLSX.write(book,{type:'buffer',bookType:'xlsx'}),{
      headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':'attachment; filename="anggota-simpul-'+status.toLowerCase()+'.xlsx"',
      'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}
    });
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Export gagal'},{status:400});
  }
}

export async function POST(req:NextRequest){
  try{
    const preview=req.nextUrl.searchParams.get('preview')==='1';
    const s=await db();
    const {data:role}=await s.rpc('current_app_role');
    if(!['ADMIN','DEWAN_GURU','KELOMPOK'].includes(role||'')){
      return NextResponse.json({error:'Akses input ditolak.'},{status:403});
    }

    const {data:me}=await s.rpc('get_current_app_user');
    const owner=me?.[0];
    const form=await req.formData();
    const file=form.get('file');
    if(!(file instanceof File))throw Error('Pilih workbook');

    const book=await readWorkbook(file);
    const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(
      book.Sheets[book.SheetNames[0]],
      {defval:''}
    );
    if(!rows.length||rows.length>500)throw Error('Isi 1–500 anggota per impor');

    const {data:job}=owner
      ? await s.from('import_jobs').insert({
          owner_user_id:owner.id,
          resource_type:'ANGGOTA',
          file_name:file.name,
          status:'VALIDATING',
          total_rows:rows.length
        }).select('id').single()
      : {data:null};

    const [catRes,levelRes,classRes,existingRes]=await Promise.all([
      s.from('categories').select('id,name,slug'),
      s.from('levels').select('id,name'),
      s.from('classes').select('id,name,level_id,audience'),
      s.from('members').select('id,name,birth_date,phone,address,gender,member_memberships(category_id,active,valid_from,valid_to,ended_on)')
    ]);
    if(catRes.error||levelRes.error||classRes.error||existingRes.error)throw Error('Referensi impor tidak dapat dimuat');

    const cats=catRes.data||[];
    const levels=levelRes.data||[];
    const classes=classRes.data||[];
    const payload:any[]=[];
    const errors:string[]=[];
    const seen=new Set<string>();

    for(let i=0;i<rows.length;i++){
      try{
        const row=rows[i];
        const name=norm(row.Nama);
        if(!name)throw Error('Nama kosong');

        const birth_date=excelDate(row['Tanggal Lahir']);
        const categoryNames=norm(row['Program (pisahkan koma)']||row['Kategori (pisahkan koma)'])
          .split(',')
          .map(v=>v.trim().toLowerCase())
          .filter(Boolean);
        const selected=categoryNames.map(n=>
          cats.find(c=>
            ['caberawit','muda-mudi','ibu-ibu'].includes(c.slug) &&
            (c.name.toLowerCase()===n||c.slug===n)
          )
        );

        const className=norm(row.Kelas);
        const levelName=norm(row.Jenjang);
        const klass=className?classes.filter(k=>k.name.toLowerCase()===className.toLowerCase()):[];
        if(!norm(row['Keikutsertaan JSON'])&&className&&klass.length!==1){
          throw Error('Kelas tidak ditemukan atau namanya ambigu');
        }

        const level=levelName?levels.find(l=>l.name.toLowerCase()===levelName.toLowerCase()):null;
        if(!norm(row['Keikutsertaan JSON'])&&levelName&&!level)throw Error('Jenjang tidak ditemukan');

        let memberships:any[];
        if(norm(row['Keikutsertaan JSON'])){
          memberships=JSON.parse(norm(row['Keikutsertaan JSON']));
          if(!Array.isArray(memberships))throw Error('JSON keikutsertaan harus berupa daftar');
          if(memberships.some((m:any)=>!cats.some(c=>c.id===m.category_id&&['caberawit','muda-mudi','ibu-ibu'].includes(c.slug)))){
            throw Error('Keikutsertaan hanya boleh Caberawit, Muda-Mudi, atau Ibu-Ibu');
          }
        }else{
          if(!selected.length||selected.some(c=>!c))throw Error('Program tidak valid');

          memberships=selected.map(c=>{
            const cat=c!;
            if(!['caberawit','muda-mudi'].includes(cat.slug)){
              return {category_id:cat.id,active:true};
            }

            const audience=cat.slug==='caberawit'?'CABERAWIT':'MUDA_MUDI';
            const matchedClass=klass[0]?.audience===audience?klass[0]:null;
            if(className&&!matchedClass)throw Error('Kelas tidak sesuai program yang dipilih');

            return {
              category_id:cat.id,
              active:true,
              class_id:matchedClass?.id??null,
              level_id:matchedClass?.level_id??level?.id??null
            };
          });
        }

        const id=norm(row['ID Anggota'])||null;
        const person={
          name,
          gender:norm(row['Jenis Kelamin']),
          birth_place:norm(row['Tempat Lahir']),
          birth_date,
          phone:norm(row['Nomor HP']),
          address:norm(row.Alamat),
          notes:norm(row.Catatan),
          guardian_name:norm(row['Nama Wali']),
          guardian_phone:norm(row['Nomor HP Wali'])
        };

        const categoryIds=memberships.map((m:any)=>m.category_id).sort();
        const fingerprint=JSON.stringify([
          name.toLowerCase(),birth_date,person.phone,person.address,person.gender,categoryIds
        ]);
        if(seen.has(id||fingerprint))throw Error('Baris duplikat di workbook');
        seen.add(id||fingerprint);

        if(!id){
          const duplicate=(existingRes.data||[]).some((p:any)=>{
            const activeCategories=(p.member_memberships||[])
              .filter((m:any)=>effectiveMembership(m))
              .map((m:any)=>m.category_id)
              .sort();
            return JSON.stringify([
              p.name.toLowerCase(),p.birth_date,p.phone||'',p.address||'',p.gender||'',activeCategories
            ])===fingerprint;
          });
          if(duplicate)throw Error('Biodata identik sudah ada. Gunakan ID Anggota untuk memperbarui.');
        }

        if(id&&(!Number.isInteger(Number(row.Revision))||norm(row.Revision)==='')){
          throw Error('Revision wajib untuk memperbarui ID Anggota');
        }

        payload.push({
          id,
          revision:id?Number(row.Revision):0,
          person,
          memberships
        });
      }catch(e){
        errors.push(`Baris ${i+2}: ${e instanceof Error?e.message:'Data tidak valid'}`);
      }
    }

    if(preview){
      if(job?.id){
        await s.from('import_jobs').update({
          status:'PREVIEW',
          error_rows:errors.length,
          errors,
          metadata:{valid_rows:payload.length}
        }).eq('id',job.id);
      }
      return NextResponse.json({
        preview:true,
        valid:errors.length===0,
        total:rows.length,
        valid_rows:payload.length,
        inserted:payload.filter(p=>!p.id).length,
        updated:payload.filter(p=>p.id).length,
        errors,
        rows:payload.slice(0,25).map((p:any)=>({
          id:p.id,
          name:p.person.name,
          programs:p.memberships
            .map((m:any)=>cats.find(c=>c.id===m.category_id)?.name)
            .filter(Boolean)
        }))
      });
    }

    if(errors.length){
      if(job?.id){
        await s.from('import_jobs').update({
          status:'FAILED',
          error_rows:errors.length,
          errors,
          completed_at:new Date().toISOString()
        }).eq('id',job.id);
      }
      return NextResponse.json({
        error:'Impor dibatalkan; perbaiki semua baris terlebih dahulu.',
        errors
      },{status:400});
    }

    if(job?.id)await s.from('import_jobs').update({status:'IMPORTING'}).eq('id',job.id);

    const {data,error}=await s.rpc('save_members_batch',{p_rows:payload});
    if(error){
      if(job?.id){
        await s.from('import_jobs').update({
          status:'FAILED',
          error_rows:1,
          errors:[error.message],
          completed_at:new Date().toISOString()
        }).eq('id',job.id);
      }
      return NextResponse.json(
        {error:error.message},
        {status:error.message.includes('CONFLICT')?409:400}
      );
    }

    const inserted=payload.filter(p=>!p.id).length;
    const updated=payload.filter(p=>p.id).length;
    if(job?.id){
      await s.from('import_jobs').update({
        status:'COMPLETED',
        inserted_rows:inserted,
        updated_rows:updated,
        completed_at:new Date().toISOString()
      }).eq('id',job.id);
    }

    return NextResponse.json({inserted,updated,processed:data,errors:[]});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Workbook tidak dapat dibaca.'},{status:400});
  }
}
