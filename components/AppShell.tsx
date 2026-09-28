'use client';

import Link from 'next/link';
import Image from 'next/image';
import {usePathname} from 'next/navigation';
import {useEffect,useMemo,useState} from 'react';
import {
  LayoutDashboard,Database,ClipboardCheck,BookOpen,Target,Users,
  CalendarDays,ChartNoAxesCombined,FileText,Settings,Moon,Sun,Menu,X,LogOut,LogIn,MoreHorizontal
} from 'lucide-react';

type Role='ADMIN'|'DEWAN_GURU'|'KELOMPOK'|'VIEWER';
type AppUser={id:string;username:string;display_name:string|null;role:Role;active:boolean};

const nav=[
  {href:'/',label:'Dashboard',icon:LayoutDashboard,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[],publicRead:true},
  {href:'/database',label:'Database',icon:Database,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[],publicRead:true},
  {href:'/presensi',label:'Presensi',icon:ClipboardCheck,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[],publicRead:true},
  {href:'/jurnal',label:'Jurnal',icon:BookOpen,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[],publicRead:true},
  {href:'/target',label:'Target & Progres',icon:Target,roles:['ADMIN','DEWAN_GURU','VIEWER'] as Role[],publicRead:true},
  {href:'/agenda',label:'Agenda',icon:CalendarDays,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[],publicRead:true},
  {href:'/rekap',label:'Rekap Data',icon:ChartNoAxesCombined,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[],publicRead:true},
  {href:'/laporan',label:'Laporan Jabirawit',icon:FileText,roles:['ADMIN','DEWAN_GURU','VIEWER'] as Role[],publicRead:true},
  {href:'/tim-akses',label:'Tim & Akses',icon:Users,roles:['ADMIN'] as Role[]},
  {href:'/pengaturan',label:'Pengaturan',icon:Settings,roles:['ADMIN'] as Role[]},
];

const roleLabel:Record<Role,string>={ADMIN:'Owner',DEWAN_GURU:'Dewan Guru',KELOMPOK:'Kelompok',VIEWER:'Viewer'};

function Brand({compact=false}:{compact?:boolean}){
  return <Link href="/" className={compact?'brandLogo compact':'brandLogo'} aria-label="Airo Administrasi">
    <Image src="/aeroo-mark.webp" alt="" width={72} height={56} priority/>
    <span className="brandWordmark"><strong>AIRO</strong><small>ADMINISTRASI</small></span>
  </Link>;
}

export default function AppShell({children}:{children:React.ReactNode}){
  const path=usePathname();
  const isLogin=path==='/login';
  const[dark,setDark]=useState(false);
  const[drawer,setDrawer]=useState(false);
  const[moreOpen,setMoreOpen]=useState(false);
  const[user,setUser]=useState<AppUser|null>(null);
  const[checking,setChecking]=useState(!isLogin);

  useEffect(()=>{
    const saved=localStorage.getItem('aeroo-theme');
    setDark(saved?saved==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches);
  },[]);
  useEffect(()=>{
    document.documentElement.dataset.theme=dark?'dark':'light';
    localStorage.setItem('aeroo-theme',dark?'dark':'light');
  },[dark]);

  useEffect(()=>{
    if(isLogin){setChecking(false);return}
    setChecking(true);
    fetch('/api/auth/me',{cache:'no-store'}).then(async r=>{
      if(!r.ok){if(path!=='/')window.location.href='/login';setUser(null);document.documentElement.dataset.role='PUBLIC';return null}
      return r.json();
    }).then(v=>{
      if(v){setUser(v);document.documentElement.dataset.role=v.role}
    }).finally(()=>setChecking(false));
  },[isLogin,path]);

  useEffect(()=>setDrawer(false),[path]);
  const visible=useMemo(()=>user?nav.filter(x=>x.roles.includes(user.role)):nav.filter(x=>x.href==='/'),[user]);
  const primaryMobile=['/','/database','/presensi','/agenda'];
  const mobilePrimary=visible.filter(x=>primaryMobile.includes(x.href));
  const mobileMore=visible.filter(x=>!primaryMobile.includes(x.href));
  const title=useMemo(()=>nav.find(x=>x.href==='/'?path==='/':path.startsWith(x.href))?.label??'AEROO',[path]);

  async function logout(){
    await fetch('/api/auth/logout',{method:'POST'});
    window.location.href='/login';
  }

  if(isLogin)return <>{children}</>;

  const renderNav=(items=visible,klass='navList')=><nav className={klass}>
    {items.map(item=>{
      const active=item.href==='/'?path==='/':path.startsWith(item.href);
      const Icon=item.icon;
      return <Link href={item.href} className={active?'navItem active':'navItem'} key={item.href}>
        <span className="navIcon"><Icon size={18}/></span><span>{item.label}</span>
      </Link>;
    })}
  </nav>;

  const account=<div className="sideActions">
    <button className="sideButton" onClick={()=>setDark(v=>!v)}>{dark?<Sun size={18}/>:<Moon size={18}/>}<span>{dark?'Mode terang':'Mode gelap'}</span></button>
    {user&&<div className="userBox">
      <div className="userIdentity"><strong>{user?.display_name||user?.username||'AEROO'}</strong><small>{user?roleLabel[user.role]:'Memuat…'}</small></div>
      <button className="iconOnly" onClick={()=>void logout()} aria-label="Keluar"><LogOut size={18}/></button>
    </div>}
  </div>;

  return <div className="appShell">
    <aside className="desktopSidebar"><Brand/>{renderNav(visible,'navList')}{account}</aside>

    <div className={drawer?'mobileOverlay show':'mobileOverlay'} onClick={()=>setDrawer(false)}/>
    <aside className={drawer?'mobileDrawer open':'mobileDrawer'} aria-hidden={!drawer}>
      <div className="drawerHead"><Brand compact/><button className="iconOnly" onClick={()=>setDrawer(false)} aria-label="Tutup menu"><X size={20}/></button></div>
      <div className="drawerRole"><span>{user?roleLabel[user.role]:'Viewer'}</span><small>{user?.display_name||user?.username||'Ringkasan publik'}</small></div>
      {renderNav(mobileMore,'navList drawerNav')}
      {account}
    </aside>

    <main className="contentArea">
      <header className="mobileHeader">
        <Link href="/" className="mobileBrand"><Image src="/aeroo-mark.webp" alt="" width={48} height={38} priority/><span><b>AIRO</b><small>{title}</small></span></Link>
        <div className="headerActions">
          {!user&&<Link href="/login" className="headerLogin"><LogIn size={16}/>Masuk</Link>}
          <button className="iconOnly headerTheme" onClick={()=>setDark(v=>!v)} aria-label="Tema">{dark?<Sun size={19}/>:<Moon size={19}/>}</button>
        </div>
      </header>
      <div className="pageContent">{checking?<div className="card"><div className="skeleton" style={{height:90}}/></div>:children}</div>
      <nav className="mobileBottomNav" aria-label="Navigasi utama">
        {renderNav(mobilePrimary,'bottomNavItems')}
        {user&&mobileMore.length>0&&<button className={moreOpen?'bottomNavMore active':'bottomNavMore'} onClick={()=>{setMoreOpen(v=>!v);setDrawer(false)}} aria-expanded={moreOpen}><span><MoreHorizontal size={20}/></span><small>Lainnya</small></button>}
      </nav>
      {user&&moreOpen&&<div className="mobileMorePanel">{renderNav(mobileMore,'moreNavItems')}</div>}
    </main>
  </div>;
}
