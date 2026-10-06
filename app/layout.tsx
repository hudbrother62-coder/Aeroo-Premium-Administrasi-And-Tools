import './globals.css';
import type {Metadata} from 'next';
import AppShell from '@/components/AppShell';

export const metadata:Metadata={
  title:{default:'Simpul — Kelompok Pengorgan',template:'%s · Simpul'},
  description:'Administrasi Kelompok Pengorgan yang terhubung dan tertata.',
  applicationName:'Simpul',
  icons:{icon:'/simpul-logo.webp',apple:'/simpul-logo.webp'},
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="id"><body><AppShell>{children}</AppShell></body></html>;
}
