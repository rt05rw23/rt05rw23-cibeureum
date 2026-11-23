import { supabase } from './config.js';

let currentUser = null;
let currentProfile = null;

async function init() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  currentUser = user;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  currentProfile = profile || { nama_lengkap: user.email, role: 'warga', status_validasi: 'pending' };

  document.getElementById('userName').textContent = currentProfile.nama_lengkap;
  document.getElementById('userRoleBadge').textContent = `Role: ${currentProfile.role.toUpperCase()} • Rumah ${currentProfile.no_rumah || '-'}`;

  if (currentProfile.role === 'warga') {
    document.getElementById('view-warga').classList.remove('hidden');
    if (currentProfile.status_validasi !== 'verified') {
      document.getElementById('bannerVerifikasi').classList.remove('hidden');
      const btnKirim = document.getElementById('btnKirimSurat');
      if (btnKirim) {
        btnKirim.disabled = true;
        btnKirim.classList.add('opacity-50', 'cursor-not-allowed');
      }
    }
    loadWargaData();
  } else if (currentProfile.role === 'admin') {
    document.getElementById('view-warga').classList.remove('hidden');
    document.getElementById('view-admin').classList.remove('hidden');
    loadWargaData();
    loadAdminData();
  } else if (currentProfile.role === 'superadmin') {
    document.getElementById('view-warga').classList.remove('hidden');
    document.getElementById('view-admin').classList.remove('hidden');
    document.getElementById('view-superadmin').classList.remove('hidden');
    loadWargaData();
    loadAdminData();
    loadSuperAdminData();
  }
}

// --- WARGA ---
async function loadWargaData() {
  const { data: kas } = await supabase.from('kas_rt').select('nominal, tipe');
  const total = (kas || []).reduce((acc, i) => i.tipe === 'pemasukan' ? acc + Number(i.nominal) : acc - Number(i.nominal), 0);
  const elSaldo = document.getElementById('wargaSaldoKas');
  if (elSaldo) elSaldo.textContent = `Rp ${total.toLocaleString('id-ID')}`;

  const { data: surat } = await supabase.from('surat_pengantar').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
  const container = document.getElementById('listSuratWarga');
  if (container) {
    container.innerHTML = (surat?.length ? surat : []).map(s => `
      <div class="p-4 flex items-center justify-between">
        <div>
          <div class="font-medium text-slate-900">${s.jenis_surat} — ${s.keperluan}</div>
          <div class="text-xs text-slate-500">Pemohon: ${s.nama_pemohon} (NIK: ${s.nik})</div>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-1 rounded-full text-xs font-medium ${
            s.status === 'disetujui' ? 'bg-emerald-50 text-emerald-700' :
            s.status === 'ditolak' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
          }">${s.status.toUpperCase()}</span>
          ${s.status === 'disetujui' ? `<button onclick="window.printSurat('${s.id}')" class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-lg">Cetak Surat</button>` : ''}
        </div>
      </div>
    `).join('') || '<div class="p-5 text-xs text-slate-400">Belum ada pengajuan surat.</div>';
  }

  // Alur Kas
  const { data: allKas } = await supabase.from('kas_rt').select('*').order('created_at', { ascending: false }).limit(5);
  const elAlurKas = document.getElementById('listAlurKasWarga');
  if (elAlurKas) {
    elAlurKas.innerHTML = (allKas || []).map(k => `
      <div class="flex justify-between items-center py-1.5">
        <div>
          <span class="font-medium text-slate-800 block">${k.judul}</span>
          <span class="text-[10px] text-slate-400">${k.kategori || 'Umum'}</span>
        </div>
        <span class="font-semibold ${k.tipe === 'pemasukan' ? 'text-emerald-600' : 'text-rose-600'}">
          ${k.tipe === 'pemasukan' ? '+' : '-'} Rp ${Number(k.nominal).toLocaleString('id-ID')}
        </span>
      </div>
    `).join('') || '<div class="text-xs text-slate-400">Belum ada transaksi kas.</div>';
  }
}

document.getElementById('formSurat')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (currentProfile.status_validasi !== 'verified') {
    alert('Akun Anda belum divalidasi oleh pengurus RT.');
    return;
  }
  await supabase.from('surat_pengantar').insert({
    user_id: currentUser.id,
    jenis_surat: document.getElementById('sJenis').value,
    nama_pemohon: document.getElementById('sNama').value,
    nik: document.getElementById('sNik').value,
    no_kk: document.getElementById('sNoKk').value,
    jenis_kelamin: document.getElementById('sJk').value,
    pekerjaan: document.getElementById('sPekerjaan').value,
    keperluan: document.getElementById('sKeperluan').value
  });
  e.target.reset();
  loadWargaData();
  alert('Pengajuan surat berhasil dikirim!');
});

// --- ADMIN / PENGURUS ---
async function loadAdminData() {
  const { data: pendings } = await supabase.from('profiles').select('*').eq('status_validasi', 'pending');
  const elVerif = document.getElementById('listVerifikasiWarga');
  if (elVerif) {
    elVerif.innerHTML = (pendings?.length ? pendings : []).map(p => `
      <div class="p-4 flex items-center justify-between">
        <div>
          <div class="font-medium text-slate-900">${p.nama_lengkap}</div>
          <div class="text-xs text-slate-500">Rumah: ${p.no_rumah} • NIK: ${p.nik}</div>
        </div>
        <button onclick="window.bukaModalDokumen('${p.id}', '${p.url_ktp}', '${p.url_kk}', '${p.nama_lengkap}')" class="px-3 py-1.5 bg-[#1B4332] text-white rounded-lg text-xs">
          Cek KTP & KK
        </button>
      </div>
    `).join('') || '<div class="p-5 text-xs text-slate-400">Tidak ada warga menunggu verifikasi.</div>';
  }

  const { data: surat } = await supabase.from('surat_pengantar').select('*, profiles(nama_lengkap)').order('created_at', { ascending: false });
  const elSuratAdmin = document.getElementById('listSuratAdmin');
  if (elSuratAdmin) {
    elSuratAdmin.innerHTML = (surat || []).map(s => `
      <div class="p-4 flex items-center justify-between gap-3">
        <div>
          <div class="font-medium text-slate-900">${s.jenis_surat} — <span class="text-slate-500">${s.nama_pemohon}</span></div>
          <div class="text-xs text-slate-500">${s.keperluan}</div>
        </div>
        ${s.status === 'menunggu' ? `
          <div class="flex gap-1.5">
            <button onclick="window.updateStatusSurat('${s.id}', 'disetujui')" class="px-2.5 py-1 bg-[#1B4332] text-white rounded-lg text-xs">Setujui</button>
            <button onclick="window.updateStatusSurat('${s.id}', 'ditolak')" class="px-2.5 py-1 bg-rose-50 text-rose-600 rounded-lg text-xs">Tolak</button>
          </div>
        ` : `<span class="text-xs font-medium text-slate-400">${s.status}</span>`}
      </div>
    `).join('');
  }
}

window.bukaModalDokumen = async (userId, ktpPath, kkPath, nama) => {
  const { data: urlKtp } = supabase.storage.from('dokumen-warga').getPublicUrl(ktpPath);
  const { data: urlKk } = supabase.storage.from('dokumen-warga').getPublicUrl(kkPath);

  document.getElementById('imgKtp').src = urlKtp.publicUrl;
  document.getElementById('imgKk').src = urlKk.publicUrl;
  document.getElementById('modalAksiVerifikasi').innerHTML = `
    <div class="flex gap-3 pt-2">
      <button onclick="window.verifikasiWarga('${userId}', 'verified')" class="flex-1 bg-[#1B4332] text-white py-2 rounded-xl text-xs font-medium">Verifikasi (Setujui Warga)</button>
      <button onclick="window.verifikasiWarga('${userId}', 'rejected')" class="flex-1 bg-rose-50 text-rose-600 py-2 rounded-xl text-xs font-medium">Tolak</button>
    </div>
  `;
  document.getElementById('modalDokumen').classList.remove('hidden');
};

window.verifikasiWarga = async (userId, status) => {
  await supabase.from('profiles').update({ status_validasi: status }).eq('id', userId);
  document.getElementById('modalDokumen').classList.add('hidden');
  loadAdminData();
  alert(`Status warga berhasil diubah menjadi ${status}`);
};

window.updateStatusSurat = async (id, status) => {
  await supabase.from('surat_pengantar').update({ status }).eq('id', id);
  loadAdminData();
  loadWargaData();
};

document.getElementById('formKas')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  await supabase.from('kas_rt').insert({
    judul: document.getElementById('kJudul').value,
    nominal: document.getElementById('kNominal').value,
    tipe: document.getElementById('kTipe').value,
    kategori: document.getElementById('kKategori').value
  });
  e.target.reset();
  loadWargaData();
  alert('Transaksi kas berhasil dicatat!');
});

// --- SUPER ADMIN ---
async function loadSuperAdminData() {
  const { data: cfg } = await supabase.from('pengaturan_surat').select('*').single();
  if (cfg) {
    document.getElementById('cfgKop1').value = cfg.kop_baris_1 || '';
    document.getElementById('cfgKop2').value = cfg.kop_baris_2 || '';
    document.getElementById('cfgRt').value = cfg.nama_ketua_rt || '';
    document.getElementById('cfgRw').value = cfg.nama_ketua_rw || '';
  }

  const { data: users } = await supabase.from('profiles').select('*').order('nama_lengkap');
  const elUsers = document.getElementById('tableUsersSuperAdmin');
  if (elUsers) {
    elUsers.innerHTML = (users || []).map(u => `
      <tr>
        <td class="px-5 py-3.5 font-medium text-slate-900">${u.nama_lengkap}</td>
        <td class="px-5 py-3.5 text-slate-500">Rumah ${u.no_rumah} (RT ${u.rt})</td>
        <td class="px-5 py-3.5"><span class="px-2 py-0.5 rounded bg-slate-100 text-xs font-medium">${u.role}</span></td>
        <td class="px-5 py-3.5">
          <select onchange="window.ubahRoleUser('${u.id}', this.value)" class="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white">
            <option value="warga" ${u.role === 'warga' ? 'selected' : ''}>Warga</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin RT</option>
            <option value="superadmin" ${u.role === 'superadmin' ? 'selected' : ''}>Super Admin</option>
          </select>
        </td>
      </tr>
    `).join('');
  }
}

document.getElementById('formPengaturanSurat')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  await supabase.from('pengaturan_surat').update({
    kop_baris_1: document.getElementById('cfgKop1').value,
    kop_baris_2: document.getElementById('cfgKop2').value,
    nama_ketua_rt: document.getElementById('cfgRt').value,
    nama_ketua_rw: document.getElementById('cfgRw').value
  }).eq('id', 1);
  alert('Pengaturan surat berhasil diperbarui!');
});

window.ubahRoleUser = async (userId, newRole) => {
  await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
  loadSuperAdminData();
};

window.printSurat = async (id) => {
  const { data: s } = await supabase.from('surat_pengantar').select('*').eq('id', id).single();
  const { data: cfg } = await supabase.from('pengaturan_surat').select('*').single();
  
  const printWindow = window.open('', '_print', 'width=800,height=600');
  printWindow.document.write(`
    <html>
    <head>
      <title>Cetak Surat Pengantar</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="p-10 font-sans text-slate-900 bg-white">
      <div class="text-center border-b-2 border-slate-900 pb-4 mb-6">
        <h3 class="font-bold text-sm tracking-wider">${cfg?.kop_baris_1 || ''}</h3>
        <h4 class="font-bold text-xs uppercase">${cfg?.kop_baris_2 || ''}</h4>
        <h2 class="font-bold text-base mt-1">${cfg?.kop_baris_3 || 'RUKUN TETANGGA 04'}</h2>
        <p class="text-[11px] text-slate-600">${cfg?.alamat_sekretariat || ''}</p>
      </div>
      <div class="text-center my-6">
        <h1 class="font-bold text-lg uppercase underline">${s.jenis_surat}</h1>
        <p class="text-xs text-slate-500 mt-1">Nomor: 04/RT-09/VI/2026</p>
      </div>
      <p class="text-sm leading-relaxed mb-4">Yang bertanda tangan di bawah ini Ketua RT 04 / RW 09 Kelurahan Cibeureum, menerangkan dengan sebenarnya bahwa:</p>
      <table class="text-sm space-y-2 mb-6 ml-4">
        <tr><td class="w-48 font-medium">Nama Lengkap</td><td>: ${s.nama_pemohon}</td></tr>
        <tr><td class="font-medium">NIK / No. KK</td><td>: ${s.nik} / ${s.no_kk}</td></tr>
        <tr><td class="font-medium">Jenis Kelamin</td><td>: ${s.jenis_kelamin}</td></tr>
        <tr><td class="font-medium">Pekerjaan</td><td>: ${s.pekerjaan}</td></tr>
        <tr><td class="font-medium">Keperluan</td><td>: <strong>${s.keperluan}</strong></td></tr>
      </table>
      <p class="text-sm leading-relaxed mb-8">Demikian surat pengantar ini dibuat untuk dipergunakan sebagaimana mestinya.</p>
      <div class="flex justify-end text-center text-sm">
        <div>
          <p>Cimahi, ${new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</p>
          <p class="font-bold mt-1">Ketua RT 04</p>
          <div class="h-16"></div>
          <p class="font-bold underline">${cfg?.nama_ketua_rt || 'Bpk. Ahmad Fauzi'}</p>
        </div>
      </div>
      <script>window.print();</script>
    </body>
    </html>
  `);
  printWindow.document.close();
};

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
});

init();
