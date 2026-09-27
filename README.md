# Airo / Aeroo Administrasi

Aplikasi Next.js untuk anggota, presensi, jurnal, target, agenda, rekap, dan laporan Jabirawit. Desktop dan ponsel memakai tata letak responsif. Ringkasan publik tersedia di `/`; data individu memerlukan sesi login.

## Menjalankan

```bash
npm ci
npm run dev
```

Koneksi Supabase menggunakan publishable key dan cookie sesi HttpOnly yang diperiksa oleh fungsi PostgreSQL/RLS. Jangan menambahkan service role key ke kode klien. Migrasi SQL ada di `supabase/migrations` dan diterapkan ke proyek `hzbsdzlhjmfgtexmhccv`.

## Peran

- **Admin Utama:** semua data, akun tim, dan kunjungan viewer.
- **Dewan Guru:** Jabirawit dan Muda-Mudi sesuai lingkup RLS.
- **Kelompok:** Kelompok, Ibu-Ibu, dan Pengurus sesuai lingkup RLS.
- **Viewer publik:** jumlah anggota, pertemuan, presensi, dan jurnal tanpa identitas anggota. Akun Viewer lama tetap baca saja setelah login.

## Impor dan laporan

Template XLSX anggota serta target dapat diunduh langsung dari halaman masing-masing. Target memakai kolom bulan `YYYY-MM` untuk rencana enam bulan. Template laporan DOCX/PPTX menerima placeholder seperti `{{NAMA}}`, `{{KELAS}}`, `{{KEHADIRAN}}`, `{{PROGRES}}`, dan `{{CATATAN}}`. Sistem mengganti data pada template dan menghasilkan dokumen yang tetap dapat diedit.

Gemini bersifat opsional. Atur `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, dan `GEMINI_API_KEY_3` sebagai environment variable server Vercel. AI hanya menyarankan pemetaan teks template, kolom target, atau catatan laporan jika diminta; pengisian dokumen dilakukan oleh kode. Tanpa kunci, placeholder eksplisit dan pemetaan kolom dasar tetap tersedia. `GEMINI_MODEL` dapat mengubah model dari nilai bawaan.
