'use client';

import Link from 'next/link';
import Image from 'next/image';
import GlobalTools from '@/components/GlobalTools';
import NavigationReturn from '@/components/NavigationReturn';
import {usePathname} from 'next/navigation';
import {useEffect,useMemo,useState} from 'react';
import {
  LayoutDashboard,Database,ClipboardCheck,BookOpen,Target,
  CalendarDays,Warehouse,ChartNoAxesCombined,FileText,Settings,Moon,Sun,Menu,X,LogOut,LogIn,MoreHorizontal,NotebookPen,Network,Archive,Upload,PanelLeftClose,PanelLeftOpen,Plus,UserPlus,Users,FileSearch,Eye
} from 'lucide-react';

type Role='ADMIN'|'DEWAN_GURU'|'KELOMPOK'|'VIEWER';
type AppUser={id:string;username:string;display_name:string|null;role:Role;active:boolean;read_scopes?:string[];write_scopes?:string[];permissions?:Record<string,boolean>};

const nav=[
  {href:'/',label:'Beranda',icon:LayoutDashboard,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[],publicRead:true},
  {href:'/database',label:'Database',icon:Database,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[],publicRead:true},
  {href:'/rekap',label:'Rekap',icon:ChartNoAxesCombined,roles:['VIEWER'] as Role[],publicRead:true},
  {href:'/presensi',label:'Presensi',icon:ClipboardCheck,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[],publicRead:true},
  {href:'/jurnal',label:'Jurnal Kegiatan',icon:BookOpen,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[],publicRead:true},
  {href:'/notulensi',label:'Notulensi',icon:NotebookPen,roles:['ADMIN','DEWAN_GURU','KELOMPOK'] as Role[]},
  {href:'/target',label:'Target & Progres',icon:Target,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[],publicRead:true},
  {href:'/agenda',label:'Agenda',icon:CalendarDays,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[],publicRead:true},
  {href:'/sarpras',label:'Sarana & Prasarana',icon:Warehouse,roles:['ADMIN','DEWAN_GURU','KELOMPOK'] as Role[]},
  {href:'/kelengkapan',label:'Kelengkapan',icon:ClipboardCheck,roles:['ADMIN','DEWAN_GURU','KELOMPOK'] as Role[]},
  {href:'/laporan',label:'Laporan',icon:FileText,roles:['ADMIN','DEWAN_GURU','VIEWER'] as Role[],publicRead:true},
  {href:'/struktur',label:'Dapukan & Pengurus',icon:Network,roles:['ADMIN','KELOMPOK'] as Role[]},
  {href:'/catatan',label:'Catatan',icon:NotebookPen,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[]},
  {href:'/arsip',label:'Arsip',icon:Archive,roles:['ADMIN'] as Role[]},
  {href:'/impor',label:'Import Center',icon:Upload,roles:['ADMIN','DEWAN_GURU','KELOMPOK'] as Role[]},
  {href:'/tim-akses',label:'Akses',icon:Users,roles:['ADMIN'] as Role[]},
  {href:'/audit',label:'Audit',icon:FileSearch,roles:['ADMIN'] as Role[]},
  {href:'/pengaturan',label:'Pengaturan',icon:Settings,roles:['ADMIN'] as Role[]},
];

const sections=[['BERANDA',['/']],['OPERASIONAL',['/agenda','/presensi','/jurnal','/notulensi']],['PEMBINAAN',['/target']],['DATA',['/database','/struktur','/sarpras']],['PRIBADI',['/catatan']],['ANALISIS',['/rekap','/kelengkapan','/laporan']],['SISTEM',['/arsip','/impor','/tim-akses','/audit','/pengaturan']]] as const;
const navPermission:Record<string,string>={'/database':'person.read','/agenda':'agenda.read','/presensi':'attendance.read','/jurnal':'journal.read','/notulensi':'journal.read','/target':'target.read','/struktur':'position.read','/rekap':'report.read','/laporan':'report.read','/arsip':'archive.manage','/impor':'import.manage','/tim-akses':'user.manage','/pengaturan':'settings.manage'};
const viewerRoutes=new Set(['/','/agenda','/database','/presensi','/jurnal','/target','/rekap']);
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
    const syncTheme=(event:StorageEvent)=>{if(event.key==='aeroo-theme'&&event.newValue)setDark(event.newValue==='dark')};
    window.addEventListener('storage',syncTheme);
    return()=>window.removeEventListener('storage',syncTheme);
  },[]);
  useEffect(()=>{
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setDrawer(false);setMoreOpen(false);setQuickOpen(false)}};
    window.addEventListener('keydown',closeOnEscape);
    return()=>window.removeEventListener('keydown',closeOnEscape);
  },[]);

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
  useEffect(()=>{const close=()=>{setDrawer(false);setMoreOpen(false);setQuickOpen(false)};window.addEventListener('simpul:close-overlays',close);return()=>window.removeEventListener('simpul:close-overlays',close)},[]);
  const visible=useMemo(()=>(!user||user.role==='VIEWER')?nav.filter(x=>viewerRoutes.has(x.href)):nav.filter(x=>{
    // The curriculum catalogue is read-only for everyone, independent of editing privileges.
    if(x.href==='/target')return true;
    if(['/arsip','/tim-akses','/audit','/pengaturan'].includes(x.href))return user.role==='ADMIN';
    const permission=navPermission[x.href];
    if(permission&&user.permissions&&permission in user.permissions)return user.permissions[permission]===true;
    return x.roles.includes(user.role);
  }),[user]);
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
    if(user&&user.role!=='VIEWER')items.push({href:'/catatan?create=1',label:'Catatan',icon:NotebookPen});
    return items;
  },[canWriteFormal,user]);

  async function logout(){
    sessionStorage.removeItem('simpul-navigation-history');
    await fetch('/api/auth/logout',{method:'POST'});
    window.location.href='/login';
  }

  if(isLogin)return <>{children}</>;

  const renderNav=(items=visible,klass='navList')=>{
    const link=(item:typeof nav[number])=>{const active=item.href==='/'?path==='/':path.startsWith(item.href);const Icon=item.icon;const primary=<Link key={item.href} href={item.href==='/presensi'&&(!user||user.role==='VIEWER')?'/presensi/riwayat':item.href} aria-current={active?'page':undefined} title={item.label} className={active?'navItem active':'navItem'}><span className="navIcon"><Icon size={18}/></span><span>{item.label}</span></Link>;return item.href==='/agenda'&&klass==='navList'?<div className="agendaSidebarGroup" key={item.href}>{primary}<div className="agendaSidebarLinks"><Link href="/agenda/kalender" className={path==='/agenda/kalender'?'active':''}>Kalender</Link><Link href="/agenda" className={path==='/agenda'?'active':''}>{!user||user.role==='VIEWER'?'Daftar Kegiatan':'Daftar & Kelola'}</Link></div></div>:item.href==='/presensi'&&klass.includes('navList')?<div className="agendaSidebarGroup" key={item.href}>{primary}<div className="agendaSidebarLinks">{user?.role!=='VIEWER'&&!!user&&<Link href="/presensi" className={path==='/presensi'||path==='/presensi/buat'?'active':''}>Isi Presensi</Link>}<Link href="/presensi/riwayat" className={path==='/presensi/riwayat'?'active':''}>Riwayat</Link><Link href="/presensi/rekap" className={path==='/presensi/rekap'?'active':''}>Rekap</Link><Link href="/presensi/individu" className={path==='/presensi/individu'?'active':''}>Rekap Individu</Link></div></div>:item.href==='/catatan'&&klass==='navList'?<div className="agendaSidebarGroup" key={item.href}>{primary}<div className="agendaSidebarLinks"><Link href="/catatan?scope=PERSONAL">Pribadi</Link><Link href="/catatan?scope=ROLE">Per Role</Link><Link href="/catatan?scope=MAIN">Utama</Link></div></div>:primary};
    return <nav className={klass}>{klass.includes('navList')?sections.map(([label,paths])=>{const group=paths.flatMap(href=>items.filter(i=>i.href===href));return group.length?<div className="navGroup" key={label}><small className="navGroupLabel">{label}</small>{group.map(link)}</div>:null}):items.map(link)}</nav>
  };

  const account=<div className="sideActions">{user?.role==='ADMIN'&&<Link className="sideButton mobileAccountAccess" href="/tim-akses"><Users size={18}/><span>Akses login & pengguna</span></Link>}{user&&quickItems.length>0&&<div className="desktopQuickAdd"><button className="sideButton quickAddButton" onClick={()=>setQuickOpen(v=>!v)} aria-expanded={quickOpen}><Plus size={18}/><span>Tambah Data</span></button>{quickOpen&&<div className="quickAddPanel">{quickItems.map(item=>{const Icon=item.icon;return <Link key={item.href} href={item.href} className="quickAddItem"><Icon size={17}/><span>{item.label}</span></Link>})}</div>}</div>}{!user&&<div className="viewerAccess"><div className="viewerAccessInfo"><Eye size={16}/><span><strong>Mode Viewer</strong><small>Akses baca saja</small></span></div><Link className="sideButton viewerLoginButton" href="/login"><LogIn size={18}/>Masuk Admin</Link></div>}
    {user&&<div className="userBox">
      <div className="userIdentity"><strong>{user?.display_name||user?.username||'Simpul'}</strong><small>{user?roleLabel[user.role]:'Memuat…'}</small></div>
      <button className="iconOnly accountLogoutButton" onClick={()=>void logout()} aria-label="Keluar dari akun"><LogOut size={18}/><span className="mobileAccountLogoutText">Keluar</span></button>
    </div>}
  </div>;

  return <div className={`${collapsed?'appShell sidebarCollapsed':'appShell'}${drawer?' mobileNavOpen':''}`}>
    <aside className="desktopSidebar"><Brand/><button className="iconOnly sidebarToggle" onClick={()=>setCollapsed(v=>!v)} aria-label={collapsed?'Buka navigasi':'Ciutkan navigasi'} aria-expanded={!collapsed}>{collapsed?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}</button>{renderNav(visible,'navList')}{account}</aside>

    <div className={drawer?'mobileOverlay show':'mobileOverlay'} onClick={()=>setDrawer(false)}/>
    <aside id="simpul-mobile-menu" className={drawer?'mobileDrawer open':'mobileDrawer'} aria-label="Semua menu Simpul" aria-hidden={!drawer} inert={!drawer}>
      <div className="drawerHead"><Brand compact/><button className="iconOnly" onClick={()=>setDrawer(false)} aria-label="Tutup menu"><X size={20}/></button></div>
      <div className="drawerRole"><span>{user?roleLabel[user.role]:'Viewer'}</span><small>{user?.display_name||user?.username||'Ringkasan publik'}</small></div>
      {renderNav(visible,'navList drawerNav')}
      {account}
    </aside>

    <main className="contentArea">
      <div className="globalToolsDock"><GlobalTools enabled={!!user&&user.role!=='VIEWER'} dark={dark===true} drawerOpen={drawer} onToggleTheme={()=>setDark(v=>!(v??false))}/></div>
      <header className="mobileHeader">
        <div className="mobileHeaderStart">
          <button type="button" className="iconOnly mobileMenuButton" onClick={()=>{setDrawer(true);setMoreOpen(false);setQuickOpen(false)}} aria-label="Buka semua menu" aria-controls="simpul-mobile-menu" aria-expanded={drawer}><Menu size={20}/></button>
          <Link href="/" className="mobileBrand"><Image src="/simpul-logo.webp" alt="" width={48} height={48} priority/><span><b>Simpul</b><small>{title}</small></span></Link>
        </div>
        <div className="headerActions">
          {!user&&<Link href="/login" className="headerLogin"><LogIn size={16}/>Masuk</Link>}
          <button className="iconOnly headerTheme" onClick={()=>setDark(v=>!(v??false))} aria-label={dark?'Aktifkan mode terang':'Aktifkan mode gelap'} title={dark?'Mode terang':'Mode gelap'} aria-pressed={dark===true}>{dark?<Sun size={19}/>:<Moon size={19}/>}</button>
        </div>
      </header>
      <NavigationReturn/>
      <div className="pageContent" key={path}>{children}</div>
      {(moreOpen||quickOpen)&&<button type="button" className="mobilePanelDismiss" aria-label="Tutup menu terbuka" onClick={()=>{setMoreOpen(false);setQuickOpen(false)}}/>}
      {user&&quickItems.length>0&&!path.startsWith('/presensi')&&<><button className="mobileQuickFab" onClick={()=>{setQuickOpen(v=>!v);setMoreOpen(false);setDrawer(false)}} aria-label={quickOpen?'Tutup tambah data':'Tambah data'} aria-expanded={quickOpen}>{quickOpen?<X size={22}/>:<Plus size={22}/>}</button>{quickOpen&&<div className="mobileQuickPanel"><div className="quickAddGrid">{quickItems.map(item=>{const Icon=item.icon;return <Link key={item.href} href={item.href} className="quickAddItem"><Icon size={18}/><span>{item.label}</span></Link>})}</div></div>}</>}
      <nav className="mobileBottomNav" aria-label="Navigasi utama">
        {renderNav(mobilePrimary,'bottomNavItems')}
        {mobileMore.length>0&&<button className={moreOpen?'bottomNavMore active':'bottomNavMore'} onClick={()=>{setMoreOpen(v=>!v);setDrawer(false);setQuickOpen(false)}} aria-expanded={moreOpen}><span><MoreHorizontal size={20}/></span><small>Lainnya</small></button>}
      </nav>
      {moreOpen&&<div className="mobileMorePanel" role="region" aria-label="Menu lainnya"><div className="mobileMoreHead"><strong>Menu lainnya</strong><button type="button" onClick={()=>{setMoreOpen(false);setDrawer(true)}}>Lihat semua menu</button></div>{renderNav(mobileMore,'moreNavItems')}</div>}
    </main>
  </div>;
}
