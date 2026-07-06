// ═══════════════════════════════════════════════════════
//  auth-guard-classic.js — Igual que auth-guard.js pero SIN
//  `import`/`export`, para páginas que usan <script> normal
//  (no type="module"), como modulo2-personal y modulo3-control.
//
//  Uso en el HTML del módulo (ANTES de tu <script> existente):
//
//    <script src="../auth-guard-classic.js"></script>
//    <script>
//      const sesion = RRHHAuth.requireSession('modulo2');
//      if (sesion) RRHHAuth.pintarUsuarioEnSidebar(sesion);
//      // ...resto de tu código actual...
//    </script>
// ═══════════════════════════════════════════════════════

(function (global) {
  const STORAGE_KEY = 'rrhh_sesion';

  const PERMISOS = {
    admin:    ['modulo1', 'modulo2', 'modulo3', 'modulo4', 'modulo5', 'modulo6'],
    rrhh:     ['modulo1', 'modulo2', 'modulo3', 'modulo4', 'modulo5', 'modulo6'],
    empleado: ['modulo3'],
  };

  function rutaLogin() {
    const enModulo = location.pathname.includes('/frontend/');
    return enModulo ? '../../login.html' : 'login.html';
  }

  function getSesion() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function guardarSesion(usuario) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usuario));
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    location.href = rutaLogin();
  }

  function tienePermiso(rol, moduloClave) {
    return (PERMISOS[rol] || []).includes(moduloClave);
  }

  function requireSession(moduloClave) {
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

  function pintarUsuarioEnSidebar(sesion) {
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

  global.RRHHAuth = {
    PERMISOS, getSesion, guardarSesion, logout,
    tienePermiso, requireSession, pintarUsuarioEnSidebar,
  };
})(window);
