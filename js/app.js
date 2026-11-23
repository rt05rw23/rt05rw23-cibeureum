import { supabase } from './config.js';

export async function checkAuthAndRedirect(requiredRole) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = 'index.html';
    return null;
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) {
    window.location.href = 'index.html';
    return null;
  }

  // Validasi pencocokan role
  if (requiredRole === 'warga' && profile.role !== 'warga' && profile.role !== 'admin' && profile.role !== 'superadmin') {
    window.location.href = 'index.html';
    return null;
  }
  if (requiredRole === 'admin' && profile.role !== 'admin' && profile.role !== 'superadmin') {
    alert('Akses ditolak: Anda bukan pengurus RT.');
    window.location.href = 'warga.html';
    return null;
  }
  if (requiredRole === 'superadmin' && profile.role !== 'superadmin') {
    alert('Akses ditolak: Hanya untuk Super Admin.');
    window.location.href = 'admin.html';
    return null;
  }

  return { user, profile };
}

export async function setupLogout() {
  const btn = document.getElementById('logoutBtn');
  if (btn) {
    btn.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = 'index.html';
    });
  }
}
