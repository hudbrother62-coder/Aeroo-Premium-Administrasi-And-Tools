import './globals.css';import AppShell from '@/components/AppShell';
export const metadata={title:'AIRO — Kelompok Pengorgan',description:'Administrasi Kelompok Pengorgan'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="id"><body><AppShell>{children}</AppShell></body></html>}
