import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase-server';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from 'docx';
import { jsPDF } from 'jspdf';

export const runtime = 'nodejs';

type AttendanceRecord = { status: 'H' | 'I' | 'A' | string };
type AttendanceEvent = {
  title: string;
  event_date: string;
  audience: string;
  attendance_records: AttendanceRecord[] | null;
};

async function dataset(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');
  const aud = req.nextUrl.searchParams.get('audience');

  if (!from || !to) throw new Error('from dan to wajib diisi');

  let q = db()
    .from('attendance_events')
    .select('title,event_date,audience,attendance_records(status)')
    .gte('event_date', from)
    .lte('event_date', to)
    .order('event_date');

  if (aud) q = q.eq('audience', aud);

  const { data, error } = await q;
  if (error) throw error;

  return {
    from,
    to,
    aud: aud || 'Semua',
    events: (data || []) as AttendanceEvent[],
  };
}

function binaryResponse(body: Uint8Array | ArrayBuffer, contentType: string, filename: string) {
  // Node's fetch runtime accepts ArrayBuffer/Uint8Array bodies, while the
  // DOM typings used by Next can be narrower depending on the TypeScript lib.
  const responseBody = body as unknown as BodyInit;
  return new Response(responseBody, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const d = await dataset(req);
    const format = req.nextUrl.searchParams.get('format') || 'xlsx';

    const rows = d.events.map((e) => {
      const records = e.attendance_records ?? [];
      return {
        Tanggal: e.event_date,
        Kegiatan: e.title,
        Kategori: e.audience,
        Hadir: records.filter((r) => r.status === 'H').length,
        Izin: records.filter((r) => r.status === 'I').length,
        Alfa: records.filter((r) => r.status === 'A').length,
      };
    });

    const name = `aeroo-presensi-${d.from}-${d.to}`;

    if (format === 'xlsx') {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Rekap Presensi');
      const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
      return binaryResponse(
        out,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        `${name}.xlsx`,
      );
    }

    if (format === 'docx') {
      const table = new Table({
        rows: [
          new TableRow({
            children: ['Tanggal', 'Kegiatan', 'Kategori', 'Hadir', 'Izin', 'Alfa'].map(
              (x) => new TableCell({ children: [new Paragraph(x)] }),
            ),
          }),
          ...rows.map(
            (r) =>
              new TableRow({
                children: Object.values(r).map(
                  (x) => new TableCell({ children: [new Paragraph(String(x))] }),
                ),
              }),
          ),
        ],
      });

      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'AEROO PREMIUM ADMINISTRASI', bold: true })],
              }),
              new Paragraph(`Laporan Rekap Presensi ${d.from} — ${d.to}`),
              table,
            ],
          },
        ],
      });

      const out = await Packer.toBuffer(doc);
      return binaryResponse(
        new Uint8Array(out),
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        `${name}.docx`,
      );
    }

    if (format !== 'pdf') {
      return NextResponse.json({ error: 'Format laporan tidak didukung' }, { status: 400 });
    }

    const pdf = new jsPDF();
    pdf.setFontSize(15);
    pdf.text('AEROO PREMIUM ADMINISTRASI', 14, 18);
    pdf.setFontSize(11);
    pdf.text(`Laporan Rekap Presensi ${d.from} - ${d.to}`, 14, 26);

    let y = 36;
    for (const r of rows) {
      if (y > 280) {
        pdf.addPage();
        y = 18;
      }
      pdf.text(
        `${r.Tanggal} | ${r.Kegiatan} | H:${r.Hadir} I:${r.Izin} A:${r.Alfa}`,
        14,
        y,
      );
      y += 7;
    }

    return binaryResponse(pdf.output('arraybuffer'), 'application/pdf', `${name}.pdf`);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal membuat laporan';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
