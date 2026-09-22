'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type IconName =
  | 'home' | 'users' | 'child' | 'check' | 'book' | 'target'
  | 'calendar' | 'chart' | 'file' | 'sun' | 'moon' | 'menu' | 'close';

const paths: Record<IconName, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  child: <><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/><path d="M8.5 12.5 6 15"/><path d="m15.5 12.5 2.5 2.5"/></>,
  check: <><path d="M9 11l2 2 4-5"/><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 2v4M16 2v4M3 9h18"/></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V5H6.5A2.5 2.5 0 0 0 4 7.5v12Z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20"/><path d="M8 8h8M8 12h6"/></>,
  target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>,
  moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const sections = [
  {
    label: 'Utama',
    items: [
      { href: '/', label: 'Dashboard', icon: 'home' as IconName },
    ],
  },
  {
    label: 'Database',
    items: [
      { href: '/database/kelompok', label: 'Database Kelompok', icon: 'users' as IconName },
      { href: '/database/caberawit', label: 'Database Caberawit', icon: 'child' as IconName },
    ],
  },
  {
    label: 'Operasional',
    items: [
      { href: '/presensi', label: 'Presensi', icon: 'check' as IconName },
      { href: '/jurnal', label: 'Jurnal Kegiatan', icon: 'book' as IconName },
      { href: '/target', label: 'Target & Perkembangan', icon: 'target' as IconName },
      { href: '/agenda', label: 'Agenda', icon: 'calendar' as IconName },
    ],
  },
  {
    label: 'Analisis',
    items: [
      { href: '/rekap', label: 'Rekap', icon: 'chart' as IconName },
      { href: '/laporan', label: 'Laporan', icon: 'file' as IconName },
    ],
  },
];

function Brand() {
  return <div className="brandBlock" aria-label="Aeroo Premium Administrasi">
    <div className="brandMark"><span>A</span></div>
    <div>
      <div className="brandWord">AEROO <span>Premium</span></div>
      <div className="brandSub">Administrasi</div>
    </div>
  </div>;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [dark, setDark] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('aeroo-theme');
    const next = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(next);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('aeroo-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => setDrawer(false), [path]);

  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawer]);

  const title = useMemo(() => {
    const flat = sections.flatMap(s => s.items);
    return flat.find(item => item.href === path)?.label ?? 'Aeroo Premium Administrasi';
  }, [path]);

  const navContent = <div className="navInner">
    <Brand />
    <div className="navSections">
      {sections.map(section => <div className="navSection" key={section.label}>
        <div className="navLabel">{section.label}</div>
        {section.items.map(item => {
          const active = item.href === '/' ? path === '/' : path.startsWith(item.href);
          return <Link className={active ? 'navItem active' : 'navItem'} href={item.href} key={item.href}>
            <span className="navIcon"><Icon name={item.icon} /></span>
            <span>{item.label}</span>
          </Link>;
        })}
      </div>)}
    </div>

    <button className="themeButton" onClick={() => setDark(v => !v)}>
      <span className="navIcon"><Icon name={dark ? 'sun' : 'moon'} /></span>
      <span>{dark ? 'Mode Terang' : 'Mode Gelap'}</span>
    </button>

    <div className="sidebarFoot">
      <span className="statusDot" />
      <div><strong>Aeroo Premium</strong><small>Sistem administrasi aktif</small></div>
    </div>
  </div>;

  return <div className="appShell">
    <aside className="desktopSidebar">{navContent}</aside>

    <div className={drawer ? 'mobileOverlay show' : 'mobileOverlay'} onClick={() => setDrawer(false)} aria-hidden={!drawer} />
    <aside className={drawer ? 'mobileDrawer open' : 'mobileDrawer'} aria-hidden={!drawer}>
      <div className="drawerTop">
        <Brand />
        <button className="iconButton" aria-label="Tutup navigasi" onClick={() => setDrawer(false)}><Icon name="close" /></button>
      </div>
      {navContent}
    </aside>

    <main className="contentArea">
      <header className="mobileHeader">
        <button className="iconButton menuButton" aria-label="Buka navigasi" onClick={() => setDrawer(true)}><Icon name="menu" /></button>
        <div className="mobileHeaderTitle"><span>{title}</span><small>Aeroo Premium Administrasi</small></div>
        <button className="iconButton" aria-label="Ganti tema" onClick={() => setDark(v => !v)}><Icon name={dark ? 'sun' : 'moon'} /></button>
      </header>
      <div className="pageContent">{children}</div>
    </main>
  </div>;
}
