-- Correct spelling in the Simpul semester-1 target catalogue.
-- Idempotent data-only migration: target IDs, assignments, and progress stay unchanged.
-- The original imported workbook checksums and row references remain untouched.
DO $simpul$
DECLARE
  edits text[][] := ARRAY[
    ARRAY['Tertanam akhlaq tercela yang harus dihindari :', 'Terbiasa menghindari akhlak tercela:'],
    ARRAY['Tilawaty', 'Tilawati'],
    ARRAY['qolqolah', 'qalqalah'],
    ARRAY['idzhar', 'izhar'],
    ARRAY['idghom', 'idgham'],
    ARRAY['bilagunnah', 'bila ghunnah'],
    ARRAY['muhoffaf', 'mukhaffaf'],
    ARRAY['waqof', 'waqaf'],
    ARRAY['Mengetahu dan', 'Mengetahui dan'],
    ARRAY['rukum islam', 'rukun Islam'],
    ARRAY['kasih saying', 'kasih sayang'],
    ARRAY['saying terhadap', 'sayang terhadap'],
    ARRAY['ditunngui', 'ditunggui'],
    ARRAY['kafirr', 'kafir'],
    ARRAY['terhadapa', 'terhadap'],
    ARRAY['betamu', 'bertamu'],
    ARRAY['juz 3 an 4', 'juz 3 dan 4'],
    ARRAY['Al- Fatihah', 'Al-Fatihah'],
    ARRAY['yang tidak/dibenci', 'yang dibenci'],
    ARRAY['harom', 'haram'],
    ARRAY['rowatib', 'rawatib'],
    ARRAY['akhlaq', 'akhlak'],
    ARRAY['mensucikan', 'menyucikan'],
    ARRAY['dipersilahkan', 'dipersilakan'],
    ARRAY['dinasehati', 'dinasihati'],
    ARRAY['nasehat', 'nasihat'],
    ARRAY['orangtua', 'orang tua'],
    ARRAY['Sepakbola', 'Sepak bola'],
    ARRAY['batas batas', 'batas-batas'],
    ARRAY['laki laki', 'laki-laki'],
    ARRAY['dimasjid', 'di masjid'],
    ARRAY['Tatakrama', 'Tata krama'],
    ARRAY['harokat', 'harakat'],
    ARRAY['Surat Al Qodr', 'Surat Al-Qadr'],
    ARRAY['Surat Al Qori’ah', 'Surat Al-Qari’ah'],
    ARRAY['Surat Al Baqoroh', 'Surat Al-Baqarah'],
    ARRAY['Surat Al Gasyiyah', 'Surat Al-Ghasyiyah'],
    ARRAY['Surat At Tariq', 'Surat At-Tariq'],
    ARRAY['Surat Al Alaq', 'Surat Al-‘Alaq'],
    ARRAY['Surat Al Bayyinah', 'Surat Al-Bayyinah'],
    ARRAY['Surat Al Kautsar', 'Surat Al-Kautsar'],
    ARRAY['Surat Al Ma’un', 'Surat Al-Ma’un'],
    ARRAY['Surat Asy Syarh', 'Surat Asy-Syarh']
  ];
  item text[];
BEGIN
  FOREACH item SLICE 1 IN ARRAY edits LOOP
    UPDATE public.learning_targets
       SET title = replace(title, item[1], item[2]),
           description = replace(description, item[1], item[2]),
           source_metadata = CASE
             WHEN strpos(coalesce(source_metadata->>'parent',''), item[1]) > 0
               THEN jsonb_set(source_metadata, '{parent}', to_jsonb(replace(source_metadata->>'parent', item[1], item[2])), false)
             ELSE source_metadata END
     WHERE version_id = 'ac679dd7-9e9d-4d6b-a1fc-9d2774ab438e'::uuid
       AND (strpos(title, item[1]) > 0
         OR strpos(coalesce(description,''), item[1]) > 0
         OR strpos(coalesce(source_metadata->>'parent',''), item[1]) > 0);

    UPDATE public.target_versions
       SET source_structure = jsonb_set(source_structure, '{source_group_rows}',
           replace((source_structure->'source_group_rows')::text, item[1], item[2])::jsonb, false)
     WHERE id = 'ac679dd7-9e9d-4d6b-a1fc-9d2774ab438e'::uuid
       AND strpos(coalesce((source_structure->'source_group_rows')::text,''), item[1]) > 0;
  END LOOP;
END;
$simpul$;
