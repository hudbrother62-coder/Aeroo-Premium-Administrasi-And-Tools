/**
 * Teacher-facing suggestions only. They do NOT modify the original curriculum,
 * target identities, attendance, or assessed individual progress.
 * A lesson's source title always remains visible alongside these suggestions.
 */
export type TeacherContext={
  title:string;
  subject?:string|null;
  parent?:string|null;
  level?:string|null;
};
export type TeacherGuidance={
  focus:string;
  activity:string;
  evidence:string;
};

export const tidySourceNumber=(title:string)=>title.replace(/^\s*\d+\s*[\.\)]\s*/,'').trim();

export function teacherGuidance({title,subject,parent,level}:TeacherContext):TeacherGuidance{
  const raw=tidySourceNumber(title).replace(/^\s*[a-z]\s*[\.\)]\s*/i,'').trim();
  const titleText=raw.toLocaleLowerCase('id-ID');
  const parentText=(parent||'').toLocaleLowerCase('id-ID');
  const topic=(titleText+' '+(subject||'')+' '+parentText).toLocaleLowerCase('id-ID');
  const early=(level||'').toUpperCase()==='PAUD';
  const practice=early?'contoh sederhana, gambar, cerita singkat, dan permainan peran':'contoh situasi nyata, diskusi singkat, dan latihan langsung';
  if(/(kebersihan|bersih|kerapian|rapi|sampah|lingkungan|alam sekitar)/.test(titleText)){
    return {
      focus:'Membentuk kebiasaan menjaga kebersihan, kerapian, dan tanggung jawab terhadap fasilitas serta lingkungan sekitar.',
      activity:'Ajak peserta didik menata perlengkapan, meletakkan sampah pada tempatnya, dan bersama-sama memeriksa kerapian ruang belajar. Sesuaikan tugas dengan usia.',
      evidence:'Amati apakah peserta didik menjaga area belajar tetap rapi, merapikan barang setelah dipakai, dan melakukannya kembali tanpa selalu diingatkan.'
    };
  }
  if(/(orang tua|ayah|ibu|kedua orang tua|keluarga)/.test(titleText)&&/(tata krama|hormat|ta.dhim|berbuat baik|membantu)/.test(topic)){
    return {
      focus:'Melatih ucapan dan perilaku yang sopan serta kepedulian kepada orang tua dan keluarga.',
      activity:'Peragakan cara menjawab panggilan dengan sopan, meminta izin, menawarkan bantuan, dan mengucapkan terima kasih melalui situasi sehari-hari.',
      evidence:'Peserta didik mampu menyebutkan perilaku yang tepat dan mempraktikkan sikap hormat dalam simulasi atau keseharian.'
    };
  }
  if(/(guru|muballigh|ulil amri)/.test(titleText)&&/(tata krama|hormat|ta.dhim|taat|berbuat baik)/.test(topic)){
    return {
      focus:'Mengenalkan adab menghormati pendidik dan pihak yang bertanggung jawab sesuai konteks pembelajaran.',
      activity:'Gunakan permainan peran tentang menyapa, mendengarkan arahan, mengajukan pertanyaan dengan santun, dan menjaga ketertiban saat pengajian.',
      evidence:'Peserta didik mendengarkan dengan tertib, berbicara sopan, serta dapat memberi contoh sikap menghormati orang lain.'
    };
  }
  if(/(saudara|lebih tua|lebih muda)/.test(titleText)){
    return {
      focus:'Membiasakan sikap menghormati yang lebih tua serta menyayangi dan membantu yang lebih muda.',
      activity:'Bahas contoh berbagi, meminta izin memakai barang, membantu adik, dan menyelesaikan salah paham tanpa saling menyakiti.',
      evidence:'Peserta didik dapat memberi contoh dan menunjukkan perilaku saling menghormati serta membantu.'
    };
  }
  if(/(teman|bergaul|pergaulan|berteman)/.test(titleText)){
    return {
      focus:'Melatih pergaulan yang saling menghormati, tidak mengejek, dan mampu bekerja sama.',
      activity:'Diskusikan contoh menyapa, bergiliran, menghargai perbedaan, menjaga batas pergaulan yang baik, dan menyelesaikan konflik dengan kata-kata santun.',
      evidence:'Amati apakah peserta didik menghargai teman, bekerja sama, dan menyampaikan ketidaksetujuan tanpa mengejek.'
    };
  }
  if(/(masjid|sekolah|tempat pengajian|kelas)/.test(titleText)&&/(tata krama|adab|tertib|menjaga)/.test(topic)){
    return {
      focus:'Mengenalkan perilaku yang tepat ketika belajar, mengikuti pengajian, atau berada di tempat ibadah.',
      activity:'Praktikkan masuk dengan tertib, menjaga suara, merapikan perlengkapan, mendengarkan penjelasan, serta menjaga kebersihan tempat.',
      evidence:'Peserta didik bisa menjelaskan aturan sederhana dan menerapkannya saat kegiatan berlangsung.'
    };
  }
  if(/(tata krama|adab|sopan|santun|akhlak)/.test(topic)){
    return {
      focus:'Memahami makna '+raw+' dan menghubungkannya dengan perilaku sehari-hari.',
      activity:'Gunakan '+practice+' untuk membedakan perilaku yang tepat dan yang perlu diperbaiki. Ajak peserta didik mempraktikkan satu contoh.',
      evidence:'Peserta didik dapat memberi contoh perilaku yang baik dan menunjukkan penerapannya saat berinteraksi.'
    };
  }
  if(/(hafalan|hafal|surat|surah|ayat|asmaul|doa|iftitah|tasyahud|dzikir)/.test(topic)){
    return {
      focus:'Membantu peserta didik mengenal, melafalkan, dan mengingat bacaan sesuai materi serta tingkat kemampuannya.',
      activity:'Guru mencontohkan bacaan dengan jelas, peserta didik menirukan bagian pendek secara bertahap, lalu mengulang dalam kelompok atau secara individu.',
      evidence:'Amati ketepatan dan kelancaran pelafalan pada bagian yang dipelajari; catat bagian yang masih perlu pendampingan, tanpa menganggap belum dinilai sebagai gagal.'
    };
  }
  if(/(tilawati|tilawaty|membaca|bacaan|al.qur.an|qur.an)/.test(topic)){
    return {
      focus:'Mengembangkan keterampilan mengenali dan membaca materi sesuai jenjang tanpa melompati kemampuan awal peserta didik.',
      activity:'Berikan contoh bacaan, latihan bertahap, dan kesempatan membaca satu per satu dengan umpan balik yang jelas.',
      evidence:'Catat ketepatan pengucapan dan kelancaran sesuai bagian yang sedang dipelajari.'
    };
  }
  if(/(wudlu|wudhu|sholat|salat|najis|suci|puasa|ibadah|tayamum)/.test(topic)){
    return {
      focus:'Mengenalkan tujuan, urutan, dan praktik '+raw+' sesuai materi yang ditetapkan.',
      activity:'Jelaskan langkah utama melalui demonstrasi, lalu beri kesempatan peserta didik menirukan secara bertahap dengan pendampingan.',
      evidence:'Amati pemahaman urutan, ketepatan praktik sesuai tingkat pembelajaran, dan bagian yang perlu diulang.'
    };
  }
  if(/(mandiri|kemandirian|menata|peralatan|memakai|menggunakan|menyiapkan)/.test(topic)){
    return {
      focus:'Membangun kemandirian melalui kebiasaan melakukan tugas sehari-hari sesuai usia dan kemampuan.',
      activity:'Contohkan langkah tugas, dampingi latihan pertama, lalu beri kesempatan peserta didik mengerjakannya sendiri.',
      evidence:'Lihat apakah peserta didik menyelesaikan tugas dengan aman dan semakin sedikit membutuhkan bantuan.'
    };
  }
  if(/(menulis|tulisan|menyalin|huruf)/.test(topic)){
    return {
      focus:'Melatih kemampuan mengenali bentuk tulisan dan menulis sesuai materi pembelajaran.',
      activity:'Mulai dengan contoh, latihan menebalkan atau menyalin sesuai kemampuan, lalu minta peserta didik menunjukkan hasilnya.',
      evidence:'Amati keterbacaan, ketepatan bentuk tulisan, serta kemajuan dari latihan sebelumnya.'
    };
  }
  if(/(olahraga|gerak|seni|lagu|menggambar|warna)/.test(topic)){
    return {
      focus:'Melatih partisipasi, koordinasi, kreativitas, dan kebiasaan mengikuti arahan kegiatan.',
      activity:'Berikan demonstrasi singkat, lalu ajak peserta didik mencoba gerakan atau karya sesuai tema dengan memperhatikan keselamatan.',
      evidence:'Lihat partisipasi, kemampuan mengikuti instruksi, dan perkembangan keterampilan sesuai usia.'
    };
  }
  if(/(rukun iman|rukun islam|ihsan|keilmuan|pengetahuan|pengertian|faham|kefahaman)/.test(topic)){
    return {
      focus:'Memahami pokok pembahasan '+raw+' pada tingkat pengetahuan yang sesuai jenjang.',
      activity:'Berikan penjelasan ringkas, ilustrasi yang dekat dengan kehidupan, lalu ajukan pertanyaan dan minta peserta didik mengulang dengan bahasanya sendiri.',
      evidence:'Peserta didik dapat menyebutkan poin utama atau menjelaskan kembali inti materi sesuai tingkat kelas.'
    };
  }
  return {
    focus:'Memberikan gambaran dan pemahaman awal mengenai '+raw+' sesuai konteks '+(subject||'pembelajaran')+'.',
    activity:'Mulai dengan '+practice+', lalu minta peserta didik menyebutkan atau mempraktikkan hal yang dipelajari. Pilih contoh yang sesuai dengan judul sumber.',
    evidence:'Catat kemampuan peserta didik menjelaskan kembali inti materi atau menunjukkan keterampilan yang relevan. Gunakan catatan pengamatan sebagai dasar jurnal.'
  };
}
