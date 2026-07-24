/**
 * auth-guard.js
 * -----------------------------------------------------------------------
 * Incluir en el <head> de CADA módulo, después de declarar
 * window.CURRENT_MODULE. Ejemplo, en frontend/modulo3-control/index.html:
 *
 *   <script>window.CURRENT_MODULE = 'modulo3-control';</script>
 *   <script src="../shared/auth-guard.js"></script>
 *
 * Si el usuario no tiene sesión, o su rol no incluye este módulo,
 * se le redirige de vuelta al login (index.html en la raíz del proyecto).
 * -----------------------------------------------------------------------
 */

(function protegerModulo() {
  const ACCESO_POR_ROL = {
    Empleado: ['modulo3-control'],
    Gerente:  ['modulo6-reportes'],
    RRHH:     ['modulo1-reclutamiento', 'modulo2-personal', 'modulo3-control', 'modulo4-desarrollo', 'modulo5-salida'],
    Admin:    ['modulo1-reclutamiento', 'modulo2-personal', 'modulo3-control', 'modulo4-desarrollo', 'modulo5-salida', 'modulo6-reportes', 'configuracion']
  };

  // Cada módulo vive en frontend/<modulo>/index.html — el login (index.html)
  // está dos niveles arriba, en la raíz del proyecto.
  const LOGIN_URL = '../../index.html';

  const rol = sessionStorage.getItem('rol');
  const email = sessionStorage.getItem('email');
  const nombre = sessionStorage.getItem('nombre') || email;
  const moduloActual = window.CURRENT_MODULE;

  if (!rol || !email) {
    window.location.href = LOGIN_URL;
    return;
  }

  const permitidos = ACCESO_POR_ROL[rol] || [];
  if (!moduloActual || !permitidos.includes(moduloActual)) {
    window.location.href = LOGIN_URL;
    return;
  }

  // Expone el rol/email/nombre actuales para que cada módulo los use si lo
  // necesita (ej. filtrar datos por empleado_id)
  window.SESSION = { rol, email, nombre };

  document.addEventListener('DOMContentLoaded', () => {
    // Oculta del sidebar los links a módulos que este rol no puede usar.
    // Requiere que cada <a> del menú tenga data-modulo="modulo2-personal" (etc).
    document.querySelectorAll('[data-modulo]').forEach(link => {
      const destino = link.getAttribute('data-modulo');
      if (!permitidos.includes(destino)) {
        link.style.display = 'none';
      }
    });

    // Muestra el nombre/rol de quien inició sesión en el pie del sidebar,
    // en vez del usuario "Ana García" por defecto.
    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    const avEl = document.getElementById('sidebar-user-av');
    if (nameEl) nameEl.textContent = nombre;
    if (roleEl) roleEl.textContent = rol;
    if (avEl) {
      const iniciales = nombre.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
      avEl.textContent = iniciales || '?';
    }
  });
})();