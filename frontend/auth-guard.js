// ═══════════════════════════════════════════════════════
//  auth-guard.js — Sesión propia basada en la tabla `usuarios`
//  (NO usa Supabase Auth; llama al RPC login_usuario()).
//
//  Colócalo en la raíz del proyecto, junto a supabase-client.js.
//  Cada página protegida lo importa así:
//
//    import { requireSession, logout, tienePermiso } from '../../auth-guard.js';
//    const sesion = requireSession(); // redirige a login si no hay sesión
//
// ═══════════════════════════════════════════════════════

const STORAGE_KEY = 'rrhh_sesion';

// Qué rol puede ver qué módulo. Ajusta libremente estos arreglos.
export const PERMISOS = {
  admin:    ['modulo1', 'modulo2', 'modulo3', 'modulo4', 'modulo5', 'modulo6'],
  rrhh:     ['modulo1', 'modulo2', 'modulo3', 'modulo4', 'modulo5', 'modulo6'],
  empleado: ['modulo3'],
};

// Ruta relativa al login.html desde donde se llame (raíz vs frontend/moduloX/)
function rutaLogin() {
  const enModulo = location.pathname.includes('/frontend/');
  return enModulo ? '../../login.html' : 'login.html';
}

export function getSesion() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function guardarSesion(usuario) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(usuario));
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
  location.href = rutaLogin();
}

// Llamar al inicio de cualquier página protegida.
// Si no hay sesión, redirige al login inmediatamente.
// Si moduloClave se especifica, además verifica que el rol tenga permiso.
export function requireSession(moduloClave) {
  const sesion = getSesion();
  if (!sesion) {
    location.href = rutaLogin();
    return null;
  }
  if (moduloClave && !tienePermiso(sesion.rol, moduloClave)) {
    alert('No tienes permiso para acceder a este módulo.');
    location.href = location.pathname.includes('/frontend/') ? '../../index.html' : 'index.html';
    return null;
  }
  return sesion;
}

export function tienePermiso(rol, moduloClave) {
  return (PERMISOS[rol] || []).includes(moduloClave);
}

// Utilidad para pintar el nombre/rol/iniciales en el sidebar
// de cada módulo (reemplaza los datos fijos de "Ana García").
export function pintarUsuarioEnSidebar(sesion) {
  const nombreEl = document.querySelector('.sb-footer .user-name');
  const rolEl = document.querySelector('.sb-footer .user-role');
  const avatarEl = document.querySelector('.sb-footer .user-av');
  if (nombreEl) nombreEl.textContent = sesion.nombre;
  if (rolEl) rolEl.textContent = sesion.rol.charAt(0).toUpperCase() + sesion.rol.slice(1);
  if (avatarEl) {
    avatarEl.textContent = sesion.nombre.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
    avatarEl.style.cursor = 'pointer';
    avatarEl.title = 'Cerrar sesión';
    avatarEl.addEventListener('click', () => {
      if (confirm('¿Cerrar sesión?')) logout();
    });
  }
}
