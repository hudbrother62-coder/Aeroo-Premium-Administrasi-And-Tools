'use client';

import Link from 'next/link';
import Image from 'next/image';
import GlobalTools from '@/components/GlobalTools';
import {usePathname} from 'next/navigation';
import {useEffect,useMemo,useState} from 'react';
import {
  LayoutDashboard,Database,ClipboardCheck,BookOpen,Target,
  CalendarDays,ChartNoAxesCombined,FileText,Settings,Moon,Sun,Menu,X,LogOut,LogIn,MoreHorizontal,NotebookPen,Network,Archive,Upload,PanelLeftClose,PanelLeftOpen,Plus,UserPlus,Users,FileSearch,Eye
} from 'lucide-react';

type Role='ADMIN'|'DEWAN_GURU'|'KELOMPOK'|'VIEWER';
type AppUser={id:string;username:string;display_name:string|null;role:Role;active:boolean;read_scopes?:string[];write_scopes?:string[];permissions?:Record<string,boolean>};

const nav=[
  {href:'/',label:'Beranda',icon:LayoutDashboard,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[],publicRead:true},
  {href:'/database',label:'Database',icon:Database,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[],publicRead:true},
  {href:'/presensi',label:'Presensi',icon:ClipboardCheck,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[],publicRead:true},
  {href:'/jurnal',label:'Jurnal',icon:BookOpen,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[],publicRead:true},
  {href:'/target',label:'Target & Progres',icon:Target,roles:['ADMIN','DEWAN_GURU','VIEWER'] as Role[],publicRead:true},
  {href:'/agenda',label:'Agenda',icon:CalendarDays,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[],publicRead:true},
  {href:'/rekap',label:'Rekap',icon:ChartNoAxesCombined,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[],publicRead:true},
  {href:'/kelengkapan',label:'Kelengkapan',icon:ClipboardCheck,roles:['ADMIN','DEWAN_GURU','KELOMPOK'] as Role[]},
  {href:'/laporan',label:'Laporan',icon:FileText,roles:['ADMIN','DEWAN_GURU','VIEWER'] as Role[],publicRead:true},
  {href:'/struktur',label:'Dapukan & Pengurus',icon:Network,roles:['ADMIN','KELOMPOK'] as Role[]},
  {href:'/catatan',label:'Catatan',icon:NotebookPen,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[]},
  {href:'/arsip',label:'Arsip',icon:Archive,roles:['ADMIN','DEWAN_GURU','KELOMPOK'] as Role[]},
  {href:'/impor',label:'Import Center',icon:Upload,roles:['ADMIN','DEWAN_GURU','KELOMPOK'] as Role[]},
  {href:'/tim-akses',label:'Akses',icon:Users,roles:['ADMIN'] as Role[]},
  {href:'/audit',label:'Audit',icon:FileSearch,roles:['ADMIN'] as Role[]},
  {href:'/pengaturan',label:'Pengaturan',icon:Settings,roles:['ADMIN'] as Role[]},
];

const sections=[['BERANDA',['/']],['OPERASIONAL',['/agenda','/presensi','/jurnal']],['PEMBINAAN',['/target']],['DATA',['/database','/struktur']],['PRIBADI',['/catatan']],['ANALISIS',['/rekap','/kelengkapan','/laporan']],['SISTEM',['/arsip','/impor','/tim-akses','/audit','/pengaturan']]] as const;
const navPermission:Record<string,string>={'/database':'person.read','/agenda':'agenda.read','/presensi':'attendance.read','/jurnal':'journal.read','/target':'target.read','/struktur':'position.read','/rekap':'report.read','/laporan':'report.read','/arsip':'archive.manage','/impor':'import.manage','/tim-akses':'user.manage','/pengaturan':'settings.manage'};
const roleLabel:Record<Role,string>={ADMIN:'Admin',DEWAN_GURU:'Dewan Guru',KELOMPOK:'Operator',VIEWER:'Viewer'};

function Brand({compact=false}:{compact?:boolean}){
  return <Link href="/" className={compact?'brandLogo compact':'brandLogo'} aria-label="Simpul Administrasi">
    <Image src="/simpul-logo.webp" alt="Simpul" width={72} height={72} priority/>
    <span className="brandWordmark"><strong>Simpul</strong><small>KELOMPOK PENGORGAN</small></span>
  </Link>;
}

export default function AppShell({children}:{children:React.ReactNode}){
  const path=usePathname();
  const isLogin=path==='/login';
  const[dark,setDark]=useState<boolean|null>(null);const[collapsed,setCollapsed]=useState(false);
  const[drawer,setDrawer]=useState(false);
  const[moreOpen,setMoreOpen]=useState(false);
  const[quickOpen,setQuickOpen]=useState(false);
  const[user,setUser]=useState<AppUser|null>(null);
  const[checking,setChecking]=useState(!isLogin);

  useEffect(()=>{
    const saved=localStorage.getItem('aeroo-theme');
    setDark(saved?saved==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches);
    setCollapsed(localStorage.getItem('airo-sidebar-collapsed')==='1');
  },[]);
  useEffect(()=>{
    if(dark===null)return;document.documentElement.dataset.theme=dark?'dark':'light';
    localStorage.setItem('aeroo-theme',dark?'dark':'light');
  },[dark]);
  useEffect(()=>{localStorage.setItem('airo-sidebar-collapsed',collapsed?'1':'0')},[collapsed]);

  useEffect(()=>{
    if(isLogin){setChecking(false);return}
    setChecking(true);
    fetch('/api/auth/me').then(async r=>{
      if(!r.ok){setUser(null);document.documentElement.dataset.role='PUBLIC';return null}
      return r.json();
    }).then(v=>{
      if(v){setUser(v.public?null:v);document.documentElement.dataset.role=v.role}
    }).catch(()=>{setUser(null);document.documentElement.dataset.role='PUBLIC'}).finally(()=>setChecking(false));
  },[isLogin]);

  useEffect(()=>{setDrawer(false);setMoreOpen(false);setQuickOpen(false)},[path]);
  const visible=useMemo(()=>user?nav.filter(x=>x.roles.includes(user.role)&&(navPermission[x.href]?user.permissions?.[navPermission[x.href]]!==false:true)):nav.filter(x=>x.publicRead),[user]);
  const primaryMobile=['/','/agenda','/presensi','/jurnal'];
  const mobilePrimary=primaryMobile.flatMap(href=>visible.filter(x=>x.href===href));
  const mobileMore=visible.filter(x=>!primaryMobile.includes(x.href));
  const title=useMemo(()=>nav.find(x=>x.href==='/'?path==='/':path.startsWith(x.href))?.label??'Simpul',[path]);
  const canWriteFormal=!!user&&user.role!=='VIEWER';
  const quickItems=useMemo(()=>{
    const items:{href:string;label:string;icon:any}[]=[];
    if(canWriteFormal){
      if(user?.permissions?.['person.write']!==false)items.push({href:'/database/tambah',label:'Data',icon:UserPlus});
      if(user?.role==='ADMIN'||user?.role==='DEWAN_GURU'){
        items.push({href:'/database?create=level',label:'Jenjang',icon:Target});
        items.push({href:'/database?create=class',label:'Kelas',icon:Database});
      }
      if(user?.permissions?.['agenda.write']!==false)items.push({href:'/agenda?create=1',label:'Agenda',icon:CalendarDays});
      if(user?.permissions?.['attendance.write']!==false)items.push({href:'/presensi/buat',label:'Presensi',icon:ClipboardCheck});
      if(user?.permissions?.['journal.write']!==false){items.push({href:'/jurnal/buat',label:'Jurnal',icon:BookOpen});items.push({href:'/jurnal/buat?kind=PENGKAJIAN',label:'Pengkajian',icon:NotebookPen});}
      if((user?.role==='ADMIN'||user?.role==='DEWAN_GURU')&&user?.permissions?.['target.write']!==false)items.push({href:'/target?create=1',label:'Target',icon:Target});
      if((user?.role==='ADMIN'||user?.role==='KELOMPOK')&&user?.permissions?.['position.write']!==false)items.push({href:'/struktur?create=1',label:'Dapukan',icon:Network});
    }
    if(user)items.push({href:'/catatan?create=1',label:'Catatan',icon:NotebookPen});
    return items;
  },[canWriteFormal,user]);

  async function logout(){
    await fetch('/api/auth/logout',{method:'POST'});
    window.location.href='/login';
  }

  if(isLogin)return <>{children}</>;

  const renderNav=(items=visible,klass='navList')=>{
    const link=(item:typeof nav[number])=>{const active=item.href==='/'?path==='/':path.startsWith(item.href);const Icon=item.icon;return <Link href={item.href} aria-current={active?'page':undefined} title={item.label} className={active?'navItem active':'navItem'} key={item.href}><span className="navIcon"><Icon size={18}/></span><span>{item.label}</span></Link>};
    return <nav className={klass}>{klass==='navList'?sections.map(([label,paths])=>{const group=paths.flatMap(href=>items.filter(i=>i.href===href));return group.length?<div className="navGroup" key={label}><small className="navGroupLabel">{label}</small>{group.map(link)}</div>:null}):items.map(link)}</nav>
  };

  const account=<div className="sideActions">{user&&quickItems.length>0&&<div className="desktopQuickAdd"><button className="sideButton quickAddButton" onClick={()=>setQuickOpen(v=>!v)} aria-expanded={quickOpen}><Plus size={18}/><span>Tambah Data</span></button>{quickOpen&&<div className="quickAddPanel">{quickItems.map(item=>{const Icon=item.icon;return <Link key={item.href} href={item.href} className="quickAddItem"><Icon size={17}/><span>{item.label}</span></Link>})}</div>}</div>}{!user&&<div className="viewerAccess"><div className="viewerAccessInfo"><Eye size={16}/><span><strong>Mode Viewer</strong><small>Akses baca saja</small></span></div><Link className="sideButton viewerLoginButton" href="/login"><LogIn size={18}/>Masuk Admin</Link></div>}
    <button className="sideButton" onClick={()=>setDark(v=>!v)}>{dark?<Sun size={18}/>:<Moon size={18}/>}<span>{dark?'Mode terang':'Mode gelap'}</span></button>
    {user&&<div className="userBox">
      <div className="userIdentity"><strong>{user?.display_name||user?.username||'Simpul'}</strong><small>{user?roleLabel[user.role]:'Memuat…'}</small></div>
      <button className="iconOnly" onClick={()=>void logout()} aria-label="Keluar"><LogOut size={18}/></button>
    </div>}
  </div>;

  return <div className={collapsed?'appShell sidebarCollapsed':'appShell'}>
    <aside className="desktopSidebar"><Brand/><button className="iconOnly sidebarToggle" onClick={()=>setCollapsed(v=>!v)} aria-label={collapsed?'Buka navigasi':'Ciutkan navigasi'} aria-expanded={!collapsed}>{collapsed?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}</button>{renderNav(visible,'navList')}{account}</aside>

    <div className={drawer?'mobileOverlay show':'mobileOverlay'} onClick={()=>setDrawer(false)}/>
    <aside className={drawer?'mobileDrawer open':'mobileDrawer'} aria-hidden={!drawer}>
      <div className="drawerHead"><Brand compact/><button className="iconOnly" onClick={()=>setDrawer(false)} aria-label="Tutup menu"><X size={20}/></button></div>
      <div className="drawerRole"><span>{user?roleLabel[user.role]:'Viewer'}</span><small>{user?.display_name||user?.username||'Ringkasan publik'}</small></div>
      {renderNav(mobileMore,'navList drawerNav')}
      {account}
    </aside>

    <main className="contentArea">
      <div className="globalToolsDock"><GlobalTools enabled={!!user}/></div>
      <header className="mobileHeader">
        <Link href="/" className="mobileBrand"><Image src="/simpul-logo.webp" alt="" width={48} height={48} priority/><span><b>Simpul</b><small>{title}</small></span></Link>
        <div className="headerActions">
          {!user&&<Link href="/login" className="headerLogin"><LogIn size={16}/>Masuk</Link>}
          <button className="iconOnly headerTheme" onClick={()=>setDark(v=>!v)} aria-label="Tema">{dark?<Sun size={19}/>:<Moon size={19}/>}</button>
        </div>
      </header>
      <div className="pageContent" key={path}>{children}</div>
      {user&&quickItems.length>0&&<><button className="mobileQuickFab" onClick={()=>{setQuickOpen(v=>!v);setMoreOpen(false)}} aria-label="Tambah data" aria-expanded={quickOpen}><Plus size={22}/></button>{quickOpen&&<div className="mobileQuickPanel"><div className="quickAddGrid">{quickItems.map(item=>{const Icon=item.icon;return <Link key={item.href} href={item.href} className="quickAddItem"><Icon size={18}/><span>{item.label}</span></Link>})}</div></div>}</>}
      <nav className="mobileBottomNav" aria-label="Navigasi utama">
        {renderNav(mobilePrimary,'bottomNavItems')}
        {mobileMore.length>0&&<button className={moreOpen?'bottomNavMore active':'bottomNavMore'} onClick={()=>{setMoreOpen(v=>!v);setDrawer(false)}} aria-expanded={moreOpen}><span><MoreHorizontal size={20}/></span><small>Lainnya</small></button>}
      </nav>
      {moreOpen&&<div className="mobileMorePanel">{renderNav(mobileMore,'moreNavItems')}</div>}
    </main>
  </div>;
}
