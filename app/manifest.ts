import type {MetadataRoute} from 'next';

export default function manifest():MetadataRoute.Manifest{
  return {
    name:'Simpul',
    short_name:'Simpul',
    description:'Administrasi Kelompok Pengorgan',
    start_url:'/',
    display:'standalone',
    background_color:'#0a1022',
    theme_color:'#6757f5',
    icons:[{src:'/simpul-logo.webp',sizes:'160x160',type:'image/webp'}],
  };
}
