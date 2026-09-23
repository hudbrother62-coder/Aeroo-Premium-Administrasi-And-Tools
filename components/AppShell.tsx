'use client';

import Link from 'next/link';
import Image from 'next/image';
import {usePathname} from 'next/navigation';
import {useEffect,useMemo,useState} from 'react';
import {
  LayoutDashboard,Database,ClipboardCheck,BarChart3,BookOpen,Target,
  CalendarDays,ChartNoAxesCombined,FileText,Settings,Moon,Sun,Menu,X,LogOut
} from 'lucide-react';

type Role='ADMIN'|'DEWAN_GURU'|'KELOMPOK'|'VIEWER';
type AppUser={id:string;username:string;display_name:string|null;role:Role;active:boolean};

const nav=[
  {href:'/',label:'Dashboard',icon:LayoutDashboard,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[]},
  {href:'/database',label:'Database',icon:Database,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[]},
  {href:'/presensi',label:'Presensi',icon:ClipboardCheck,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[]},
  {href:'/rekap-presensi',label:'Rekap Presensi',icon:BarChart3,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[]},
  {href:'/jurnal',label:'Jurnal',icon:BookOpen,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[]},
  {href:'/target',label:'Target & Progres',icon:Target,roles:['ADMIN','DEWAN_GURU','VIEWER'] as Role[]},
  {href:'/agenda',label:'Agenda',icon:CalendarDays,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[]},
  {href:'/rekap',label:'Rekap Data',icon:ChartNoAxesCombined,roles:['ADMIN','DEWAN_GURU','KELOMPOK','VIEWER'] as Role[]},
  {href:'/laporan',label:'Laporan Caberawit',icon:FileText,roles:['ADMIN','DEWAN_GURU','VIEWER'] as Role[]},
  {href:'/pengaturan',label:'Pengaturan',icon:Settings,roles:['ADMIN'] as Role[]},
];

const roleLabel:Record<Role,string>={ADMIN:'Owner',DEWAN_GURU:'Dewan Guru',KELOMPOK:'Kelompok',VIEWER:'Viewer'};

function Brand({compact=false}:{compact?:boolean}){
  return <Link href="/" className={compact?'brandLogo compact':'brandLogo'} aria-label="AEROO">
    <Image src="/aeroo-logo.svg" alt="AEROO" width={180} height={156} priority/>
  </Link>;
}

export default function AppShell({children}:{children:React.ReactNode}){
  const path=usePathname();
  const isLogin=path==='/login';
  const[dark,setDark]=useState(false);
  const[drawer,setDrawer]=useState(false);
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
      if(!r.ok){window.location.href='/login';return null}
      return r.json();
    }).then(v=>{
      if(v){setUser(v);document.documentElement.dataset.role=v.role}
    }).finally(()=>setChecking(false));
  },[isLogin]);

  useEffect(()=>setDrawer(false),[path]);
  const visible=useMemo(()=>nav.filter(x=>!user||x.roles.includes(user.role)),[user]);
  const title=useMemo(()=>nav.find(x=>x.href==='/'?path==='/':path.startsWith(x.href))?.label??'AEROO',[path]);

  async function logout(){
    await fetch('/api/auth/logout',{method:'POST'});
    window.location.href='/login';
  }

  if(isLogin)return <>{children}</>;

  const navMenu=<nav className="navList">
    {visible.map(item=>{
      const active=item.href==='/'?path==='/':path.startsWith(item.href);
      const Icon=item.icon;
      return <Link href={item.href} className={active?'navItem active':'navItem'} key={item.href}>
        <span className="navIcon"><Icon size={18}/></span><span>{item.label}</span>
      </Link>;
    })}
  </nav>;

  const account=<div className="sideActions">
    <button className="sideButton" onClick={()=>setDark(v=>!v)}>{dark?<Sun size={18}/>:<Moon size={18}/>}<span>{dark?'Mode terang':'Mode gelap'}</span></button>
    <div className="userBox">
      <div className="userIdentity"><strong>{user?.display_name||user?.username||'AEROO'}</strong><small>{user?roleLabel[user.role]:'Memuat…'}</small></div>
      <button className="iconOnly" onClick={()=>void logout()} aria-label="Keluar"><LogOut size={18}/></button>
    </div>
  </div>;

  return <div className="appShell">
    <aside className="desktopSidebar"><Brand/>{navMenu}{account}</aside>

    <div className={drawer?'mobileOverlay show':'mobileOverlay'} onClick={()=>setDrawer(false)}/>
    <aside className={drawer?'mobileDrawer open':'mobileDrawer'} aria-hidden={!drawer}>
      <div className="drawerHead"><Brand compact/><button className="iconOnly" onClick={()=>setDrawer(false)} aria-label="Tutup menu"><X size={20}/></button></div>
      <div className="drawerRole"><span>{user?roleLabel[user.role]:'AEROO'}</span><small>{user?.display_name||user?.username||'Administrasi'}</small></div>
      {navMenu}
      {account}
    </aside>

    <main className="contentArea">
      <header className="mobileHeader">
        <button className="iconOnly headerMenu" onClick={()=>setDrawer(true)} aria-label="Menu"><Menu size={21}/></button>
        <div className="mobileTitle"><span className="mobileA">A</span><div><small>AEROO</small><strong>{title}</strong></div></div>
        <button className="iconOnly headerTheme" onClick={()=>setDark(v=>!v)} aria-label="Tema">{dark?<Sun size={19}/>:<Moon size={19}/>}</button>
      </header>
      <div className="pageContent">{checking?<div className="card"><div className="skeleton" style={{height:90}}/></div>:children}</div>
    </main>
  </div>;
}
