'use client';

import Link from 'next/link';
import {ArrowLeft} from 'lucide-react';
import {usePathname} from 'next/navigation';
import {useEffect,useState,type MouseEvent as ReactMouseEvent} from 'react';

const STORAGE_KEY='simpul-navigation-history';
const PANEL_SELECTOR='.notificationPanel, .mobileMorePanel, .mobileQuickPanel, .quickAddPanel, .mobileDrawer.open';

function routeNow(){return window.location.pathname+window.location.search;}
function fallback(path:string){
  if(path==='/rekap-presensi')return '/rekap?tab=presensi';
  const parts=path.split('/').filter(Boolean);
  return parts.length>1?'/'+parts.slice(0,-1).join('/'):'/';
}
function readTrail():string[]{
  try {
    const data=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'[]');
    return Array.isArray(data)?data.filter((v):v is string=>typeof v==='string'&&v.startsWith('/')&&!v.startsWith('//')).slice(-30):[];
  }catch{return [];}
}
function activeDialog(){
  const dialogs=Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'));
  return dialogs.reverse().find(el=>el.getClientRects().length>0)||null;
}
function hasLayer(){return !!(activeDialog()||document.querySelector(PANEL_SELECTOR));}
function dismissLayer():boolean{
  const dialog=activeDialog();
  if(dialog){
    const buttons=Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'));
    const close=buttons.find(button=>{
      const label=(button.getAttribute('aria-label')||button.getAttribute('title')||button.textContent||'').trim();
      return /^(tutup|batal|kembali|close|cancel)(\s|$|[✕×])/i.test(label);
    })||(buttons.length===1?buttons[0]:undefined);
    // Disabled closing controls indicate an in-progress save; never navigate away.
    if(close&&!close.disabled)close.click();
    return true;
  }
  if(document.querySelector(PANEL_SELECTOR)){
    window.dispatchEvent(new Event('simpul:close-overlays'));
    return true;
  }
  return false;
}

export default function NavigationReturn(){
  const pathname=usePathname();
  const[trail,setTrail]=useState<string[]>([]);
  const[layer,setLayer]=useState(false);
  useEffect(()=>{
    if(pathname==='/login')return;
    const route=routeNow(),stored=readTrail(),index=stored.lastIndexOf(route);
    const next=stored[stored.length-1]===route?stored:index>=0?stored.slice(0,index+1):[...stored,route].slice(-30);
    sessionStorage.setItem(STORAGE_KEY,JSON.stringify(next));
    setTrail(next);
  },[pathname]);
  useEffect(()=>{
    const check=()=>setLayer(hasLayer());
    check();
    const observer=new MutationObserver(check);
    observer.observe(document.body,{childList:true,subtree:true});
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'&&dismissLayer())e.preventDefault();};
    document.addEventListener('keydown',onKey,true);
    return()=>{observer.disconnect();document.removeEventListener('keydown',onKey,true);};
  },[]);
  if(pathname==='/login')return null;
  const current=typeof window==='undefined'?pathname:routeNow();
  const previous=trail[trail.length-1]===current?trail[trail.length-2]:undefined;
  const href=previous&&previous!==current?previous:fallback(pathname);
  const showBar=pathname!=='/'||!!(previous&&previous!==current);
  const onBack=(e:ReactMouseEvent<HTMLAnchorElement>)=>{if(dismissLayer())e.preventDefault();};
  return <>
    {showBar&&<div className="simpulReturnBar">
      <Link href={href} className="simpulReturnLink" onClick={onBack} aria-label="Kembali ke halaman sebelumnya">
        <ArrowLeft size={17}/><span>Kembali</span>
      </Link>
    </div>}
    {layer&&<button type="button" className="simpulDialogReturn" onClick={()=>dismissLayer()} aria-label="Kembali dan tutup pop-up">
      <ArrowLeft size={18}/><span>Kembali</span>
    </button>}
  </>;
}
