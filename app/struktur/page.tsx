'use client';

import Link from 'next/link';
import {FormEvent, useEffect, useMemo, useState} from 'react';
import {jakartaDate} from '@/lib/domain';
import './structure.css';

type Position = {
  id?: string;
  revision: number;
  member_id: string;
  title: string;
  section: string;
  duties: string;
  hierarchy_level: number;
  display_order: number;
  valid_from: string;
  valid_to?: string | null;
  active: boolean;
  members?: {id: string; name: string} | null;
};

const LAYERS = [
  {id: 1, name: 'Pimpinan Kelompok', subtitle: 'Penanggung jawab utama kelompok'},
  {id: 2, name: 'Wakil Kyai', subtitle: 'Mendampingi pimpinan kelompok'},
  {id: 3, name: 'Penerobos', subtitle: 'Bidang penerobos'},
  {id: 4, name: 'Agnia', subtitle: 'Bidang agnia'},
  {id: 5, name: 'Mubaligh', subtitle: 'Bidang mubaligh'},
  {id: 6, name: 'KU & Penulis KU', subtitle: 'Satu bidang, dua dapukan terpisah'},
  {id: 7, name: 'Tim Kematian', subtitle: 'Bidang kematian'},
  {id: 8, name: 'Pembangunan & Dhuafa', subtitle: 'Bidang pembangunan dan dhuafa'},
] as const;

const today = () => jakartaDate();
const makeEmpty = (order: number): Position => ({
  revision: 0, member_id: '', title: '', section: '', duties: '',
  hierarchy_level: 99, display_order: order, valid_from: today(),
  valid_to: null, active: true,
});
const current = (p: Position, date: string) =>
  p.active && p.valid_from <= date && (!p.valid_to || p.valid_to >= date);
const rank = (a: Position, b: Position) =>
  a.hierarchy_level - b.hierarchy_level ||
  a.display_order - b.display_order ||
  (a.members?.name || '').localeCompare(b.members?.name || '', 'id');

export default function Structure() {
  const [rows, setRows] = useState<Position[]>([]);
  const [people, setPeople] = useState<Array<{id: string; name: string}>>([]);
  const [form, setForm] = useState<Position | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState(false);
  const [search, setSearch] = useState('');
  const date = today();

  async function load() {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        fetch('/api/positions', {cache: 'no-store'}),
        fetch('/api/members?mode=names', {cache: 'no-store'}),
      ]);
      const positions = await a.json();
      const members = await b.json();
      if (!a.ok || !b.ok) throw Error(positions.error || members.error || 'Data gagal dimuat.');
      setRows(positions);
      setPeople(members);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Data gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    if (new URLSearchParams(window.location.search).get('create') === '1') {
      setForm(makeEmpty(1));
    }
  }, []);

  useEffect(() => {
    if (!form) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) setForm(null);
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [form, saving]);

  const activeRows = useMemo(
    () => rows.filter(p => current(p, date)),
    [rows, date],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('id');
    return rows
      .filter(p => history ? !current(p, date) : current(p, date))
      .filter(p => !q || [p.members?.name, p.title, p.section].some(x => x?.toLocaleLowerCase('id').includes(q)))
      .sort(rank);
  }, [rows, history, search, date]);

  const levels = useMemo(() => {
    const unique = [...new Set(filtered.map(p => p.hierarchy_level))];
    return unique.sort((a, b) => a - b).map(id => ({
      id,
      label: LAYERS.find(layer => layer.id === id)?.name || 'Dapukan lainnya',
      subtitle: LAYERS.find(layer => layer.id === id)?.subtitle || 'Jabatan tambahan kelompok',
      positions: filtered.filter(p => p.hierarchy_level === id),
    }));
  }, [filtered]);

  function openNew() {
    setError('');
    setForm(makeEmpty(Math.max(1, rows.reduce((m, p) => Math.max(m, p.display_order < 999 ? p.display_order : 0), 0) + 1)));
  }

  function editPosition(p: Position) {
    setError('');
    setForm({...p});
  }

  function change<K extends keyof Position>(key: K, value: Position[K]) {
    setForm(p => p ? {...p, [key]: value} : p);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/positions', {
        method: 'POST', headers: {'content-type': 'application/json'},
        body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || 'Tidak dapat menyimpan dapukan.');
      setForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tidak dapat menyimpan dapukan.');
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(p: Position) {
    if (!p.id || !window.confirm('Nonaktifkan dapukan ini? Riwayatnya tetap tersimpan.')) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/positions?id=' + encodeURIComponent(p.id), {method: 'DELETE'});
      const body = await response.json();
      if (!response.ok) throw Error(body.error || 'Tidak dapat menonaktifkan dapukan.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tidak dapat menonaktifkan dapukan.');
    } finally {
      setSaving(false);
    }
  }

  function positionCard(p: Position) {
    return (
      <article className="positionCard" key={p.id}>
        <div className="positionCardTop">
          <span className="positionNumber">#{String(p.display_order).padStart(2, '0')}</span>
          <span className="positionSection">{p.section || 'Pengurus'}</span>
        </div>
        <h3>{p.title}</h3>
        <Link className="positionPerson" href={'/database/' + encodeURIComponent(p.member_id)}>
          {p.members?.name || 'Nama anggota tidak ditemukan'}
          <span aria-hidden="true">↗</span>
        </Link>
        {p.duties && <p className="positionDuties">{p.duties}</p>}
        <div className="positionCardBottom">
          <small>{current(p, date) ? 'Aktif' : 'Riwayat'} · Tercatat {p.valid_from}</small>
          <div className="positionActions">
            <button type="button" onClick={() => editPosition(p)} disabled={saving}>Edit</button>
            {current(p, date) && (
              <button type="button" className="danger" onClick={() => void deactivate(p)} disabled={saving}>
                Nonaktifkan
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <main className="positionsPage">
      <header className="positionsHeader">
        <div>
          <span className="positionsEyebrow">ORGANISASI KELOMPOK</span>
          <h1>Dapukan & Pengurus</h1>
          <p>Struktur pengurus berjenjang dengan nama yang terhubung langsung ke Database Anggota.</p>
        </div>
        <button type="button" className="btn" onClick={openNew}>+ Tambah Dapukan</button>
      </header>

      <div className="positionsOverview">
        <div><strong>{activeRows.length}</strong><span>Dapukan aktif</span></div>
        <div><strong>{new Set(activeRows.map(p => p.member_id)).size}</strong><span>Pengurus tercatat</span></div>
        <div><strong>{new Set(activeRows.map(p => p.hierarchy_level)).size}</strong><span>Lapisan struktur</span></div>
      </div>

      <div className="positionsToolbar">
        <div className="positionsTabs" role="group" aria-label="Tampilan dapukan">
          <button className={!history ? 'selected' : ''} type="button" onClick={() => setHistory(false)}>Struktur aktif</button>
          <button className={history ? 'selected' : ''} type="button" onClick={() => setHistory(true)}>Riwayat jabatan</button>
        </div>
        <label className="positionsSearch">
          <span className="sr-only">Cari dapukan atau nama anggota</span>
          <input type="search" value={search} placeholder="Cari nama atau dapukan…" onChange={e => setSearch(e.target.value)}/>
        </label>
      </div>

      {error && <div className="notice error positionsError" role="alert">{error}</div>}
      {loading ? <div className="positionEmpty" role="status">Memuat struktur pengurus…</div> : (
        filtered.length === 0 ? <div className="positionEmpty">
          {search ? 'Tidak ada dapukan yang cocok.' : history ? 'Belum ada riwayat jabatan.' : 'Belum ada dapukan aktif.'}
        </div> : (
          <div className="positionLayers">
            {levels.map((level, index) => (
              <section className="positionLayer" key={level.id}>
                <div className="positionLayerMarker" aria-hidden="true">
                  <span>{String(level.id).padStart(2, '0')}</span>
                  {index < levels.length - 1 && <i/>}
                </div>
                <div className="positionLayerContent">
                  <div className="positionLayerHeader">
                    <div>
                      <h2>{level.label}</h2>
                      <p>{level.subtitle}</p>
                    </div>
                    <span className="positionCount">{level.positions.length} pengurus</span>
                  </div>
                  <div className="positionCards">{level.positions.map(positionCard)}</div>
                </div>
              </section>
            ))}
          </div>
        )
      )}

      {form && (
        <div className="dialogBackdrop positionsBackdrop" onMouseDown={e => {
          if (e.target === e.currentTarget && !saving) setForm(null);
        }}>
          <form role="dialog" aria-modal="true" aria-labelledby="position-dialog-title" className="dialogCard positionDialog" onSubmit={save}>
            <div className="cardHead">
              <div>
                <h2 id="position-dialog-title">{form.id ? 'Edit dapukan' : 'Tambah dapukan'}</h2>
                <p>Setiap jabatan dikaitkan dengan satu anggota yang sudah tercatat.</p>
              </div>
              <button type="button" className="smallAction" onClick={() => setForm(null)} disabled={saving}>Kembali</button>
            </div>
            {error && <div className="notice error" role="alert">{error}</div>}
            <div className="positionFormGrid">
              <label className="full">Pilih dari database anggota
                <select className="select" value={form.member_id} required disabled={!!form.id} onChange={e => change('member_id', e.target.value)}>
                  <option value="">Pilih nama anggota</option>
                  {people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
                </select>
              </label>
              <label>Nama dapukan
                <input className="input" required value={form.title} onChange={e => change('title', e.target.value)} placeholder="Contoh: Wakil Kyai"/>
              </label>
              <label>Bidang
                <input className="input" value={form.section} onChange={e => change('section', e.target.value)} placeholder="Contoh: KU"/>
              </label>
              <label>Lapisan struktur
                <select className="select" value={form.hierarchy_level} onChange={e => change('hierarchy_level', Number(e.target.value))}>
                  {LAYERS.map(layer => <option value={layer.id} key={layer.id}>{layer.id}. {layer.name}</option>)}
                  <option value={99}>Lainnya / belum dikelompokkan</option>
                </select>
              </label>
              <label>Nomor urut
                <input className="input" type="number" min={1} max={99999} required value={form.display_order} onChange={e => change('display_order', Number(e.target.value))}/>
              </label>
              <label>Mulai tercatat
                <input className="input" type="date" required readOnly={!!form.id} value={form.valid_from} onChange={e => change('valid_from', e.target.value)}/>
              </label>
              <label>Berlaku sampai (opsional)
                <input className="input" type="date" min={form.valid_from} value={form.valid_to || ''} onChange={e => change('valid_to', e.target.value || null)}/>
              </label>
              <label className="full">Keterangan tugas (opsional)
                <textarea className="textarea" rows={3} value={form.duties} onChange={e => change('duties', e.target.value)}/>
              </label>
              {form.id && <label className="positionActiveCheck full">
                <input type="checkbox" checked={form.active} onChange={e => change('active', e.target.checked)}/>
                Dapukan aktif
              </label>}
            </div>
            <div className="formActions">
              <button type="button" className="btn ghost" onClick={() => setForm(null)} disabled={saving}>Batal</button>
              <button type="submit" className="btn" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan dapukan'}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
