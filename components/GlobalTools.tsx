'use client';
import Link from 'next/link';
import {Bell,Search,X} from 'lucide-react';
import {useEffect,useRef,useState} from 'react';

type SearchGroup={type:string;items:Array<{id:string;title:string;meta?:string;href:string}>};
type Notice={key:string;kind:string;title:string;detail:string;href:string;read:boolean};
export default function GlobalTools({enabled}:{enabled:boolean}){
  const[searchOpen,setSearchOpen]=useState(false),[query,setQuery]=useState(''),[groups,setGroups]=useState<SearchGroup[]>([]),[searching,setSearching]=useState(false);
  const[noticeOpen,setNoticeOpen]=useState(false),[notices,setNotices]=useState<Notice[]>([]),[unread,setUnread]=useState(0);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(enabled)setSearchOpen(true)}if(e.key==='Escape'){setSearchOpen(false);setNoticeOpen(false)}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)},[enabled]);
  useEffect(()=>{if(enabled)void loadNotices()},[enabled]);
  useEffect(()=>{if(!searchOpen||query.trim().length<2){setGroups([]);return}if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(async()=>{setSearching(true);const r=await fetch('/api/search?q='+encodeURIComponent(query));const j=await r.json();setGroups(r.ok?j.groups||[]:[]);setSearching(false)},220);return()=>{if(timer.current)clearTimeout(timer.current)}},[query,searchOpen]);
  async function loadNotices(){const r=await fetch('/api/notifications',{cache:'no-store'});if(!r.ok)return;const j=await r.json();setNotices(j.items||[]);setUnread(j.unread||0)}
  async function markRead(n:Notice){if(!n.read){await fetch('/api/notifications',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({keys:[n.key]})});setNotices(v=>v.map(x=>x.key===n.key?{...x,read:true}:x));setUnread(v=>Math.max(0,v-1))}}
  if(!enabled)return null;
  return <div className="globalTools">
    <button className="iconOnly globalToolButton" aria-label="Cari" title="Cari (Ctrl/⌘ K)" onClick={()=>setSearchOpen(true)}><Search size={18}/></button>
    <button className="iconOnly globalToolButton notificationButton" aria-label="Notifikasi" onClick={()=>{setNoticeOpen(v=>!v);void loadNotices()}}><Bell size={18}/>{unread>0&&<span className="notificationCount">{unread>9?'9+':unread}</span>}</button>
    {noticeOpen&&<div className="notificationPanel"><div className="panelHead"><strong>Notifikasi</strong><button className="iconOnly" onClick={()=>setNoticeOpen(false)}><X size={17}/></button></div><div className="notificationList">{notices.slice(0,20).map(n=><Link key={n.key} href={n.href} className={n.read?'notificationItem read':'notificationItem'} onClick={()=>void markRead(n)}><strong>{n.title}</strong><span>{n.detail}</span></Link>)}{!notices.length&&<div className="emptyState">Tidak ada notifikasi.</div>}</div></div>}
    {searchOpen&&<div className="dialogBackdrop globalSearchBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSearchOpen(false)}}><div className="globalSearchCard" role="dialog" aria-modal="true"><div className="globalSearchInput"><Search size={18}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari anggota, agenda, jurnal, laporan, catatan…"/><button className="iconOnly" onClick={()=>setSearchOpen(false)}><X size={18}/></button></div><div className="globalSearchResults">{searching&&<div className="emptyState">Mencari…</div>}{!searching&&query.trim().length<2&&<div className="emptyState">Ketik minimal 2 huruf.</div>}{groups.map(g=><section key={g.type}><small className="navGroupLabel">{g.type.toUpperCase()}</small>{g.items.map(x=><Link key={x.id} href={x.href} className="searchResult" onClick={()=>setSearchOpen(false)}><strong>{x.title}</strong><span>{x.meta||''}</span></Link>)}</section>)}</div></div></div>}
  </div>
}
