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

  // Ambil profil & role dari tabel profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  currentProfile = profile || { nama_lengkap: user.email, role: 'warga', no_rumah: '-' };

  document.getElementById('userName').textContent = currentProfile.nama_lengkap;
  document.getElementById('userRoleBadge').textContent = `Role: ${currentProfile.role} • Rumah ${currentProfile.no_rumah}`;

  // Tampilkan dashboard sesuai hierarki role
  if (currentProfile.role === 'warga') {
    document.getElementById('view-warga').classList.remove('hidden');
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

// --- LOGIKA WARGA ---
async function loadWargaData() {
  // Hitung Saldo Kas
  const { data: kas } = await supabase.from('kas_rt').select('nominal, tipe');
  const total = (kas || []).reduce((acc, item) => 
    item.tipe === 'pemasukan' ? acc + Number(item.nominal) : acc - Number(item.nominal), 0);
  document.getElementById('wargaSaldoKas').textContent = `Rp ${total.toLocaleString('id-ID')}`;

  // Muat Surat Milik Warga
  const { data: surat } = await supabase
    .from('surat_pengantar')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  const container = document.getElementById('listSuratWarga');
  container.innerHTML = (surat?.length ? surat : []).map(s => `
    <div class="p-4 flex items-center justify-between">
      <div>
        <div class="font-medium text-slate-900">${s.jenis_surat}</div>
        <div class="text-xs text-slate-500">${s.keterangan || '-'}</div>
      </div>
      <span class="px-2.5 py-1 rounded-full text-xs font-medium ${
        s.status === 'disetujui' ? 'bg-emerald-50 text-emerald-700' :
        s.status === 'ditolak' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
      }">${s.status.toUpperCase()}</span>
    </div>
  `).join('') || '<div class="p-5 text-xs text-slate-400">Belum ada pengajuan surat.</div>';
}

document.getElementById('formSurat')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  await supabase.from('surat_pengantar').insert({
    user_id: currentUser.id,
    jenis_surat: document.getElementById('jenisSurat').value,
    keterangan: document.getElementById('ketSurat').value
  });
  e.target.reset();
  loadWargaData();
  if (currentProfile.role !== 'warga') loadAdminData();
});

// --- LOGIKA ADMIN RT ---
async function loadAdminData() {
  const { data: surat } = await supabase
    .from('surat_pengantar')
    .select('*, profiles(nama_lengkap, no_rumah)')
    .order('created_at', { ascending: false });

  const container = document.getElementById('listSuratAdmin');
  container.innerHTML = (surat || []).map(s => `
    <div class="p-4 flex items-center justify-between gap-3">
      <div>
        <div class="font-medium text-slate-900">${s.jenis_surat} — <span class="text-slate-500 font-normal">${s.profiles?.nama_lengkap || 'Warga'} (${s.profiles?.no_rumah || '-'})</span></div>
        <div class="text-xs text-slate-500">${s.keterangan}</div>
      </div>
      ${s.status === 'menunggu' ? `
        <div class="flex gap-1.5">
          <button onclick="updateStatusSurat('${s.id}', 'disetujui')" class="px-2.5 py-1 bg-[#1B4332] text-white rounded-lg text-xs">Setujui</button>
          <button onclick="updateStatusSurat('${s.id}', 'ditolak')" class="px-2.5 py-1 bg-rose-50 text-rose-600 rounded-lg text-xs">Tolak</button>
        </div>
      ` : `<span class="text-xs font-medium text-slate-400">${s.status}</span>`}
    </div>
  `).join('');
}

window.updateStatusSurat = async (id, status) => {
  await supabase.from('surat_pengantar').update({ status }).eq('id', id);
  loadAdminData();
  loadWargaData();
};

document.getElementById('formKas')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  await supabase.from('kas_rt').insert({
    judul: document.getElementById('judulKas').value,
    nominal: document.getElementById('nominalKas').value,
    tipe: document.getElementById('tipeKas').value
  });
  e.target.reset();
  loadWargaData();
});

// --- LOGIKA SUPER ADMIN ---
async function loadSuperAdminData() {
  const { data: users } = await supabase.from('profiles').select('*').order('nama_lengkap');
  const tbody = document.getElementById('tableUsersSuperAdmin');
  tbody.innerHTML = (users || []).map(u => `
    <tr>
      <td class="px-5 py-3.5 font-medium text-slate-900">${u.nama_lengkap}</td>
      <td class="px-5 py-3.5 text-slate-500">Rumah ${u.no_rumah} (RT ${u.rt})</td>
      <td class="px-5 py-3.5"><span class="px-2 py-0.5 rounded bg-slate-100 text-xs font-medium">${u.role}</span></td>
      <td class="px-5 py-3.5">
        <select onchange="ubahRoleUser('${u.id}', this.value)" class="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white">
          <option value="warga" ${u.role === 'warga' ? 'selected' : ''}>Warga</option>
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin RT</option>
          <option value="superadmin" ${u.role === 'superadmin' ? 'selected' : ''}>Super Admin</option>
        </select>
      </td>
    </tr>
  `).join('');
}

window.ubahRoleUser = async (userId, newRole) => {
  await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
  loadSuperAdminData();
};

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
});

init();
