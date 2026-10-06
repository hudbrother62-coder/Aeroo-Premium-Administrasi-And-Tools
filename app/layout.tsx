import './globals.css';import AppShell from '@/components/AppShell';
export const metadata={title:'Simpul — Kelompok Pengorgan',description:'Administrasi kelompok yang terhubung, tertata, dan mudah dikelola',icons:{icon:'/simpul-logo.webp',apple:'/simpul-logo.webp'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="id"><body><AppShell>{children}</AppShell></body></html>}
