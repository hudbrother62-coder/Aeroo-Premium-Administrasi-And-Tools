'use client';
import Link from 'next/link';
import {useCallback,useEffect,useMemo,useState,type FormEvent} from 'react';
import {Archive,ArrowLeft,BookOpenCheck,Boxes,CheckCircle2,Download,Edit3,Filter,MapPin,Plus,RefreshCw,Search,Warehouse,X} from 'lucide-react';
import './sarpras.css';

type Kind='MAIN'|'TEACHING';
type Org={id:string;name:string;unit_type:'DAERAH'|'DESA'|'KELOMPOK';parent_id:string|null};
type Level={id:string;name:string};
type Class={id:string;name:string;level_id:string|null;audience:string};
type Item={id:string;kind:Kind;org_unit_id:string;level_id:string|null;class_id:string|null;name:string;asset_code:string|null;quantity:number;unit:string;asset_condition:'BAIK'|'RUSAK_RINGAN'|'RUSAK_BERAT';location:string|null;responsible_name:string|null;notes:string|null;acquired_on:string|null;status:string;revision:number;updated_at:string;simpul_org_units?:{name:string;unit_type:string;parent_id:string|null};levels?:{name:string};classes?:{name:string}};
type Form={name:string;asset_code:string;quantity:string;unit:string;asset_condition:Item['asset_condition'];org_unit_id:string;level_id:string;class_id:string;location:string;responsible_name:string;notes:string;acquired_on:string};
type Payload={items:Item[];units:Org[];levels:Level[];classes:Class[];role:string};
const initial:Form={name:'',asset_code:'',quantity:'1',unit:'unit',asset_condition:'BAIK',org_unit_id:'',level_id:'',class_id:'',location:'',responsible_name:'',notes:'',acquired_on:''};
const fmt=new Intl.NumberFormat('id-ID',{maximumFractionDigits:2});
const conditionText:Record<Item['asset_condition'],string>={BAIK:'Baik',RUSAK_RINGAN:'Rusak ringan',RUSAK_BERAT:'Rusak berat'};
function csvCell(x:unknown){const t=String(x??'');const safe=/^[=+\-@\t\r]/.test(t)?"'"+t:t;return '"'+safe.replaceAll('"','""')+'"';}
export default function SarprasPage(){
  const[kind,setKind]=useState<Kind>('MAIN');
  const[status,setStatus]=useState<'ACTIVE'|'ARCHIVED'>('ACTIVE');
  const[data,setData]=useState<Payload|null>(null);
  const[loading,setLoading]=useState(true);
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState('');
  const[message,setMessage]=useState('');
  const[search,setSearch]=useState('');
  const[unitFilter,setUnitFilter]=useState('');
  const[conditionFilter,setConditionFilter]=useState('');
  const[modal,setModal]=useState(false);
  const[editing,setEditing]=useState<Item|null>(null);
  const[form,setForm]=useState<Form>(initial);
  const[reload,setReload]=useState(0);
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const response=await fetch('/api/inventory?status='+status,{cache:'no-store'});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Gagal memuat data sarpras.');
      setData(result);
    }catch(e){setError(e instanceof Error?e.message:'Gagal memuat data sarpras.');}
    finally{setLoading(false);}
  },[status,reload]);
  useEffect(()=>{void load();},[load]);
  const units=data?.units||[];
  const map=useMemo(()=>new Map(units.map(u=>[u.id,u])),[units]);
  function unitLabel(id:string){
    const v:string[]=[];let n=map.get(id),guard=0;
    while(n&&guard++<4){v.unshift(n.name);n=n.parent_id?map.get(n.parent_id):undefined;}
    return v.join(' / ')||'—';
  }
  const items=useMemo(()=>data?.items.filter(x=>x.kind===kind)||[],[data,kind]);
  const filtered=useMemo(()=>items.filter(x=>
    (!unitFilter||x.org_unit_id===unitFilter||function(){let u=map.get(x.org_unit_id),depth=0;while(u?.parent_id&&depth++<4){if(u.parent_id===unitFilter)return true;u=map.get(u.parent_id);}return false;}())&&
    (!conditionFilter||x.asset_condition===conditionFilter)&&
    (!search||[x.name,x.asset_code,x.location,x.responsible_name,x.levels?.name,x.classes?.name,unitLabel(x.org_unit_id)].join(' ').toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID')))
  ),[items,search,unitFilter,conditionFilter,map]);
  const canWrite=!!data&&(data.role==='ADMIN'||(kind==='MAIN'?data.role==='KELOMPOK':data.role==='DEWAN_GURU'||data.role==='KELOMPOK'));
  const stats={types:items.length,quantity:items.reduce((n,x)=>n+Number(x.quantity),0),good:items.filter(x=>x.asset_condition==='BAIK').length,damaged:items.filter(x=>x.asset_condition!=='BAIK').length};
  function openNew(){setEditing(null);setForm(initial);setError('');setModal(true);}
  function openEdit(x:Item){setEditing(x);setForm({name:x.name,asset_code:x.asset_code||'',quantity:String(x.quantity),unit:x.unit,
    asset_condition:x.asset_condition,org_unit_id:x.org_unit_id,level_id:x.level_id||'',class_id:x.class_id||'',location:x.location||'',
    responsible_name:x.responsible_name||'',notes:x.notes||'',acquired_on:x.acquired_on||''});setError('');setModal(true);}
  const upd=(key:keyof Form,value:string)=>setForm(f=>({...f,[key]:value,...(key==='level_id'?{class_id:''}:{})}));
  async function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError('');
    const payload={...form,kind,quantity:Number(form.quantity),level_id:kind==='TEACHING'?form.level_id:null,
      class_id:kind==='TEACHING'&&form.class_id?form.class_id:null,acquired_on:form.acquired_on||null};
    try{
      const response=await fetch('/api/inventory',{method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(editing?{...payload,id:editing.id,revision:editing.revision}:payload)});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Penyimpanan gagal.');
      setModal(false);setEditing(null);setMessage('Data sarpras berhasil disimpan.');setReload(x=>x+1);
    }catch(e){setError(e instanceof Error?e.message:'Penyimpanan gagal.');}finally{setBusy(false);}
  }
  async function changeStatus(x:Item){
    const action=x.status==='ACTIVE'?'ARCHIVE':'RESTORE';
    if(!window.confirm(action==='ARCHIVE'?'Arsipkan '+x.name+'? Data tetap tersimpan.':'Pulihkan '+x.name+'?'))return;
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/inventory',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:x.id,revision:x.revision,action})});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'Gagal memperbarui status.');
      setMessage(action==='ARCHIVE'?'Inventaris berhasil diarsipkan.':'Inventaris berhasil dipulihkan.');
      setReload(n=>n+1);
    }catch(e){setError(e instanceof Error?e.message:'Gagal memperbarui inventaris.');}finally{setBusy(false);}
  }
  function exportCsv(){
    const rows=[['Nama','Kode','Jenis','Organisasi','Jenjang','Kelas','Jumlah','Satuan','Kondisi','Lokasi','Penanggung jawab','Tanggal pengadaan','Catatan'],
      ...filtered.map(x=>[x.name,x.asset_code||'',x.kind==='MAIN'?'Sarpras Utama':'Alat Bantu Mengajar Caberawit',unitLabel(x.org_unit_id),x.levels?.name||'',x.classes?.name||'',x.quantity,x.unit,conditionText[x.asset_condition],x.location||'',x.responsible_name||'',x.acquired_on||'',x.notes||''])];
    const csv='\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='simpul-sarpras-'+kind.toLowerCase()+'.csv';link.click();URL.revokeObjectURL(url);
  }
  const classes=(data?.classes||[]).filter(c=>c.level_id===form.level_id);
  return <div className="spPage">
    <header className="spHero"><div><span className="spEyebrow"><Warehouse size={16}/> ASET ORGANISASI</span>
      <h1>Sarana &amp; Prasarana</h1><p>Pendataan fasilitas dan alat pembelajaran terhubung ke struktur Daerah, Desa, Kelompok, dan jenjang Caberawit.</p></div>
      {canWrite&&<button className="spPrimary" onClick={openNew}><Plus size={17}/> Tambah Sarpras</button>}
    </header>
    <div className="spTabs" role="tablist" aria-label="Jenis sarana prasarana">
      <button type="button" role="tab" aria-selected={kind==='MAIN'} className={kind==='MAIN'?'selected':''} onClick={()=>{setKind('MAIN');setSearch('');setUnitFilter('');setConditionFilter('');setMessage('');}}><Warehouse size={18}/> Sarpras Utama <b>{data?.items.filter(x=>x.kind==='MAIN').length??'—'}</b></button>
      <button type="button" role="tab" aria-selected={kind==='TEACHING'} className={kind==='TEACHING'?'selected':''} onClick={()=>{setKind('TEACHING');setSearch('');setUnitFilter('');setConditionFilter('');setMessage('');}}><BookOpenCheck size={18}/> Alat Bantu Mengajar Caberawit <b>{data?.items.filter(x=>x.kind==='TEACHING').length??'—'}</b></button>
    </div>
    <div className="spDescription"><Boxes size={19}/><span>{kind==='MAIN'?'Catat fasilitas, gedung, ruang belajar, meja, kursi, peralatan dan seluruh inventaris umum.':'Catat alat peraga, buku pembelajaran, media praktik, kartu pembelajaran dan perlengkapan mengajar per jenjang Caberawit.'}</span></div>
    <div className="spMetrics">
      <div><small>Jenis barang</small><strong>{fmt.format(stats.types)}</strong></div>
      <div><small>Jumlah unit barang</small><strong>{fmt.format(stats.quantity)}</strong></div>
      <div><small>Kondisi baik</small><strong>{fmt.format(stats.good)}</strong></div>
      <div><small>Perlu perbaikan</small><strong>{fmt.format(stats.damaged)}</strong></div>
    </div>
    {message&&<div className="spNotice success"><CheckCircle2 size={17}/>{message}<button onClick={()=>setMessage('')} aria-label="Tutup pemberitahuan"><X size={15}/></button></div>}
    {error&&!modal&&<div className="spNotice error">{error}<button onClick={()=>setReload(n=>n+1)}>Coba lagi</button></div>}
    <section className="spPanel">
      <div className="spPanelHead"><div><h2>Daftar Inventaris</h2><p>{kind==='MAIN'?'Seluruh sarpras utama dalam cakupan akses':'Alat bantu mengajar berdasarkan jenjang dan kelas'} · {fmt.format(filtered.length)} data</p></div>
        <div className="spHeadActions"><button onClick={()=>setReload(n=>n+1)} title="Muat ulang" className="spIconButton" disabled={loading}><RefreshCw size={17}/></button><button onClick={exportCsv} className="spSecondary" disabled={!filtered.length}><Download size={16}/> Export CSV</button></div></div>
      <div className="spFilters">
        <label className="spSearch"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama, kode, lokasi..."/></label>
        <label><Filter size={16}/><select value={unitFilter} onChange={e=>setUnitFilter(e.target.value)} aria-label="Filter organisasi"><option value="">Semua organisasi</option>{units.map(x=><option key={x.id} value={x.id}>{x.unit_type==='DAERAH'?'Daerah':x.unit_type==='DESA'?'Desa':'Kelompok'} · {unitLabel(x.id)}</option>)}</select></label>
        <select value={conditionFilter} onChange={e=>setConditionFilter(e.target.value)} aria-label="Filter kondisi"><option value="">Semua kondisi</option>{Object.entries(conditionText).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select>
        <select value={status} onChange={e=>setStatus(e.target.value as typeof status)} aria-label="Status inventaris"><option value="ACTIVE">Aktif</option><option value="ARCHIVED">Arsip</option></select>
      </div>
      {loading?<div className="spEmpty">Memuat inventaris dari database…</div>:!filtered.length?<div className="spEmpty"><Warehouse size={29}/><strong>Belum ada sarpras yang ditampilkan</strong><span>{items.length?'Coba ubah filter pencarian.':'Tambahkan inventaris pertama menggunakan tombol Tambah Sarpras.'}</span></div>:<div className="spTableScroll"><table className="spTable"><thead><tr><th>Nama &amp; kode</th><th>Unit organisasi</th>{kind==='TEACHING'&&<th>Jenjang / kelas</th>}<th>Jumlah</th><th>Kondisi</th><th>Lokasi</th><th>Aksi</th></tr></thead><tbody>{filtered.map(x=><tr key={x.id}>
        <td><strong>{x.name}</strong><small>{x.asset_code||'Tanpa kode'}{x.responsible_name?' · PJ: '+x.responsible_name:''}</small></td>
        <td><span className="spScope"><MapPin size={14}/>{unitLabel(x.org_unit_id)}</span></td>
        {kind==='TEACHING'&&<td>{x.levels?.name||'—'}<small>{x.classes?.name||'Seluruh kelas'}</small></td>}
        <td><strong>{fmt.format(Number(x.quantity))}</strong> {x.unit}</td>
        <td><span className={'spCondition '+x.asset_condition}>{conditionText[x.asset_condition]}</span></td>
        <td>{x.location||'—'}</td>
        <td><div className="spRowActions">{canWrite&&<button title="Edit sarpras" onClick={()=>openEdit(x)}><Edit3 size={17}/></button>}{canWrite&&<button title={x.status==='ARCHIVED'?'Pulihkan':'Arsipkan'} onClick={()=>void changeStatus(x)} disabled={busy}><Archive size={17}/></button>}{!canWrite&&<span>Hanya baca</span>}</div></td>
      </tr>)}</tbody></table></div>}
    </section>
    {!data&&!loading&&<p className="spAccess">Untuk mengelola inventaris, <Link href="/login">masuk ke akun Simpul</Link>.</p>}
    {modal&&<div className="spOverlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setModal(false);}}><div className="spDialog" role="dialog" aria-modal="true" aria-label={editing?'Edit sarpras':'Tambah sarpras'}>
      <div className="spDialogHead"><div><span>{editing?'PERBARUI DATA':'PENDATAAN BARU'}</span><h2>{editing?'Edit':'Tambah'} {kind==='MAIN'?'Sarpras Utama':'Alat Bantu Mengajar'}</h2></div><button aria-label="Tutup formulir" type="button" disabled={busy} onClick={()=>setModal(false)}><X size={20}/></button></div>
      <form onSubmit={e=>void save(e)} className="spForm">
        <label className="spWide">Nama sarpras <span>*</span><input maxLength={160} value={form.name} onChange={e=>upd('name',e.target.value)} required placeholder={kind==='MAIN'?'Contoh: Meja belajar':'Contoh: Kartu huruf hijaiyah'}/></label>
        <label>Kode inventaris<input maxLength={64} value={form.asset_code} onChange={e=>upd('asset_code',e.target.value)} placeholder="Opsional"/></label>
        <label>Unit organisasi <span>*</span><select value={form.org_unit_id} onChange={e=>upd('org_unit_id',e.target.value)} required><option value="">Pilih lokasi kepemilikan</option>{units.map(u=><option key={u.id} value={u.id}>{unitLabel(u.id)}</option>)}</select></label>
        {kind==='TEACHING'&&<><label>Jenjang Caberawit <span>*</span><select value={form.level_id} onChange={e=>upd('level_id',e.target.value)} required><option value="">Pilih jenjang</option>{(data?.levels||[]).map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <label>Kelas Caberawit<select value={form.class_id} onChange={e=>upd('class_id',e.target.value)} disabled={!form.level_id}><option value="">Semua kelas pada jenjang</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></>}
        <label>Jumlah <span>*</span><input type="number" min="0" max="9999999999" step=".01" required value={form.quantity} onChange={e=>upd('quantity',e.target.value)}/></label>
        <label>Satuan <span>*</span><select value={form.unit} onChange={e=>upd('unit',e.target.value)} required>{['unit','buah','set','paket','ruang','gedung','buku','lembar','pasang','kotak'].map(s=><option key={s}>{s}</option>)}</select></label>
        <label>Kondisi <span>*</span><select value={form.asset_condition} onChange={e=>upd('asset_condition',e.target.value)}>{Object.entries(conditionText).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label>
        <label>Lokasi / ruang<input maxLength={200} value={form.location} onChange={e=>upd('location',e.target.value)} placeholder="Contoh: Ruang kelas 1"/></label>
        <label>Penanggung jawab<input maxLength={160} value={form.responsible_name} onChange={e=>upd('responsible_name',e.target.value)} placeholder="Nama pengelola barang"/></label>
        <label>Tanggal pengadaan<input type="date" value={form.acquired_on} onChange={e=>upd('acquired_on',e.target.value)}/></label>
        <label className="spWide">Catatan<textarea maxLength={3000} rows={3} value={form.notes} onChange={e=>upd('notes',e.target.value)} placeholder="Keterangan, pemeliharaan, kebutuhan perbaikan..."/></label>
        {error&&<p className="spFormError">{error}</p>}
        <div className="spDialogActions"><button className="spSecondary" type="button" disabled={busy} onClick={()=>setModal(false)}><ArrowLeft size={16}/> Kembali</button><button type="submit" className="spPrimary" disabled={busy}>{busy?'Menyimpan…':editing?'Simpan Perubahan':'Simpan Sarpras'}</button></div>
      </form>
    </div></div>}
  </div>;
}
