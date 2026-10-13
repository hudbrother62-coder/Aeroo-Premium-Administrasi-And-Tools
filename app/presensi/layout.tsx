'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {ClipboardCheck,History,ChartNoAxesCombined} from 'lucide-react';
import type {ReactNode} from 'react';

const tabs=[
  {href:'/presensi',label:'Isi Presensi',icon:ClipboardCheck},
  {href:'/presensi/riwayat',label:'Riwayat',icon:History},
  {href:'/presensi/rekap',label:'Rekap',icon:ChartNoAxesCombined},
] as const;

export default function PresensiLayout({children}:{children:ReactNode}){
  const pathname=usePathname();
  return <section className="attendanceRoute">
    <nav className="attendanceRouteTabs" aria-label="Navigasi Presensi">
      {tabs.map(({href,label,icon:Icon})=>{
        const active=href==='/presensi'?(pathname==='/presensi'||pathname==='/presensi/buat'):pathname===href;
        return <Link key={href} href={href} className={active?'attendanceRouteTab active':'attendanceRouteTab'} aria-current={active?'page':undefined}>
          <Icon size={17} aria-hidden="true"/><span>{label}</span>
        </Link>;
      })}
    </nav>
    {children}
  </section>;
}
