import './globals.css';import AppShell from '@/components/AppShell';
export const metadata={title:'Aeroo Premium Administrasi',description:'Administrasi Kelompok, Muda Mudi, dan Caberawit'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="id"><body><AppShell>{children}</AppShell></body></html>}
