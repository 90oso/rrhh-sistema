/**
 * user-prefs.js
 * -----------------------------------------------------------------------
 * Panel "Personalizar perfil" del header (botón superior derecho).
 * Permite ajustar nombre a mostrar, cargo visible y color del avatar.
 * Se guarda en localStorage y se aplica al header y al sidebar en cada
 * carga de página.
 *
 * Incluir en el <head> de cada módulo, después de auth-guard.js:
 *
 *   <script src="../shared/user-prefs.js"></script>
 *
 * El botón que abre el panel debe llamar a abrirConfig(), y el chip de
 * usuario del header debe tener los ids hdr-user-name / hdr-user-role /
 * hdr-user-av para reflejar los cambios.
 * -----------------------------------------------------------------------
 */

(function () {
  // ═══════════════════════════════════════════════════════════════════
  //  TEMA CLARO / OSCURO (compartido por todos los módulos y el login)
  //  Se ejecuta de inmediato, durante el <head>, para evitar el parpadeo.
  //  Los módulos usan Tailwind con colores fijos, así que el modo oscuro
  //  se logra sobrescribiendo las utilidades de color cuando el <html>
  //  tiene data-theme="dark". La elección se guarda en localStorage con
  //  la MISMA clave que el login (th_theme) → tema único en todo el sistema.
  // ═══════════════════════════════════════════════════════════════════
  const THEME_KEY = 'th_theme';

  (function initTema() {
    let t;
    try { t = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (t !== 'dark' && t !== 'light') {
      t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', t);

    if (!document.getElementById('th-dark-css')) {
      const s = document.createElement('style');
      s.id = 'th-dark-css';
      s.textContent = `
        /* Oculta el botón nativo de limpiar de type=search (usamos el propio) */
        input[type="search"]::-webkit-search-cancel-button{ -webkit-appearance:none; appearance:none; }

        /* — Superficies — */
        html[data-theme="dark"] body,
        html[data-theme="dark"] .bg-surface{ background-color:#0D0D12 !important; }
        html[data-theme="dark"] .bg-white{ background-color:#191921 !important; }
        html[data-theme="dark"] .bg-surface-container-lowest{ background-color:#15151D !important; }
        html[data-theme="dark"] .bg-surface-container-low{ background-color:#15151D !important; }
        html[data-theme="dark"] .bg-surface-container,
        html[data-theme="dark"] .bg-surface-container-high,
        html[data-theme="dark"] .bg-surface-container-highest{ background-color:#24242F !important; }
        html[data-theme="dark"] aside{ background-color:rgba(21,21,28,0.94) !important; }
        html[data-theme="dark"] header{ background-color:rgba(13,13,18,0.85) !important; }
        html[data-theme="dark"] .glass-card{ background:rgba(25,25,33,0.75) !important; border-color:rgba(255,255,255,0.08) !important; }
        /* Bordes: un poco más visibles para separar tarjetas del fondo */
        html[data-theme="dark"] .border-outline-variant\\/20,
        html[data-theme="dark"] .border-outline-variant\\/30,
        html[data-theme="dark"] .border-outline-variant\\/40{ border-color:rgba(255,255,255,0.10) !important; }

        /* — Texto — */
        html[data-theme="dark"] .text-primary{ color:#F1F1F6 !important; }
        html[data-theme="dark"] .text-on-surface{ color:#F1F1F6 !important; }
        html[data-theme="dark"] .text-on-surface-variant{ color:#A7ABB5 !important; }
        html[data-theme="dark"] .text-error{ color:#FF8A8A !important; }

        /* — Primario (negro → violeta de marca para que resalte) — */
        html[data-theme="dark"] .bg-primary{ background-color:#6D5BD0 !important; }
        html[data-theme="dark"] .bg-primary\\/10{ background-color:rgba(109,91,208,0.18) !important; }
        html[data-theme="dark"] .bg-primary\\/5{ background-color:rgba(109,91,208,0.12) !important; }
        html[data-theme="dark"] .hover\\:bg-black:hover{ background-color:#5B4BC4 !important; }
        html[data-theme="dark"] .border-primary{ border-color:#8B7CF6 !important; }

        /* — Campos de formulario — */
        html[data-theme="dark"] input,
        html[data-theme="dark"] select,
        html[data-theme="dark"] textarea{ background-color:#191921 !important; color:#F1F1F6 !important; }
        html[data-theme="dark"] input::placeholder,
        html[data-theme="dark"] textarea::placeholder{ color:#71717A !important; }

        /* — Chips e íconos de acento: pastel claro → tinte oscuro translúcido — */
        html[data-theme="dark"] .bg-purple-50{ background-color:rgba(168,85,247,0.16) !important; }
        html[data-theme="dark"] .bg-red-50{ background-color:rgba(239,68,68,0.15) !important; }
        html[data-theme="dark"] .bg-green-50{ background-color:rgba(34,197,94,0.15) !important; }
        html[data-theme="dark"] .bg-orange-50{ background-color:rgba(249,115,22,0.15) !important; }
        html[data-theme="dark"] .bg-sky-50{ background-color:rgba(14,165,233,0.15) !important; }
        html[data-theme="dark"] .bg-amber-50{ background-color:rgba(245,158,11,0.16) !important; }
        html[data-theme="dark"] .bg-gray-50{ background-color:rgba(148,150,160,0.16) !important; }
        html[data-theme="dark"] .hover\\:bg-green-100:hover{ background-color:rgba(34,197,94,0.24) !important; }
        html[data-theme="dark"] .hover\\:bg-red-100:hover{ background-color:rgba(239,68,68,0.24) !important; }

        /* — Texto/íconos de acento: tonos 600/700 (oscuros) → 300 (claros y legibles) — */
        html[data-theme="dark"] .text-purple-600,
        html[data-theme="dark"] .text-purple-700{ color:#D8B4FE !important; }
        html[data-theme="dark"] .text-red-600,
        html[data-theme="dark"] .text-red-700{ color:#FCA5A5 !important; }
        html[data-theme="dark"] .text-green-600,
        html[data-theme="dark"] .text-green-700,
        html[data-theme="dark"] .text-green-800{ color:#86EFAC !important; }
        html[data-theme="dark"] .text-orange-600,
        html[data-theme="dark"] .text-orange-700{ color:#FDBA74 !important; }
        html[data-theme="dark"] .text-sky-600,
        html[data-theme="dark"] .text-sky-700{ color:#7DD3FC !important; }
        html[data-theme="dark"] .text-amber-600,
        html[data-theme="dark"] .text-amber-700{ color:#FCD34D !important; }
        html[data-theme="dark"] .text-gray-600,
        html[data-theme="dark"] .text-gray-700{ color:#CBD1DB !important; }

        /* — Módulo 6 (reportes): textos de gráficos hechos con HTML/CSS — */
        html[data-theme="dark"] .pending-wrap{ background:rgba(255,255,255,0.03) !important; border-color:rgba(255,255,255,0.14) !important; color:#A7ABB5 !important; }
        html[data-theme="dark"] .pending-wrap .pw-title{ color:#F1F1F6 !important; }
        html[data-theme="dark"] .pending-wrap .pw-sub{ color:#A7ABB5 !important; }
        html[data-theme="dark"] .vac-name,
        html[data-theme="dark"] .vac-days{ color:#E7E7EC !important; }
      `;
      (document.head || document.documentElement).appendChild(s);
    }
  })();

  function crearBotonTema() {
    if (document.getElementById('th-theme-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'th-theme-btn';
    btn.type = 'button';
    btn.className = 'material-symbols-outlined hover:bg-surface-container-low rounded-full p-2 cursor-pointer transition-all text-on-surface-variant';
    btn.title = 'Cambiar entre modo claro y oscuro';
    const pinta = () => {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      btn.textContent = dark ? 'light_mode' : 'dark_mode';
      btn.setAttribute('aria-label', dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    };
    btn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      pinta();
    });
    pinta();

    // Ubicación preferida: en el header, justo antes del chip de usuario.
    const chip = document.getElementById('hdr-user-av') || document.getElementById('hdr-user-name');
    const chipWrap = chip ? chip.closest('div[onclick]') : null;
    if (chipWrap && chipWrap.parentElement) {
      chipWrap.parentElement.insertBefore(btn, chipWrap);
    } else {
      // Respaldo: botón flotante si no se encontró el header esperado.
      btn.classList.add('fixed', 'top-3', 'right-4', 'z-[60]', 'bg-surface', 'shadow-lg');
      document.body.appendChild(btn);
    }
  }

  const PREFS_KEY = 'th_user_prefs';
  const COLORES_AVATAR = ['#131B2E', '#4F46E5', '#7C3AED', '#0284C7', '#0D9488', '#16A34A', '#D97706', '#DC2626', '#DB2777'];
  const COLOR_DEFECTO = '#131B2E';

  let colorSel = null; // color elegido dentro del modal (antes de guardar)

  function leerPrefs() {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; }
  }

  function iniciales(nombre) {
    return (nombre || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  }

  // Valores efectivos: preferencia guardada > datos de la sesión > defecto
  function efectivos() {
    const p = leerPrefs();
    return {
      nombre: p.nombre || sessionStorage.getItem('nombre') || sessionStorage.getItem('email') || 'Admin HR',
      rol:    p.rol    || sessionStorage.getItem('rol')    || 'Superuser',
      color:  p.color  || null
    };
  }

  function aplicarPrefs() {
    const { nombre, rol, color } = efectivos();
    const ini = iniciales(nombre);
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    set('hdr-user-name', nombre);     set('hdr-user-role', rol);     set('hdr-user-av', ini);
    set('sidebar-user-name', nombre); set('sidebar-user-role', rol); set('sidebar-user-av', ini);
    if (color) {
      ['hdr-user-av', 'sidebar-user-av'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('bg-primary', 'bg-indigo-600'); el.style.background = color; }
      });
    }
  }

  // ── MODAL (se inyecta una sola vez, con el mismo estilo de los demás modales) ──
  function crearModal() {
    if (document.getElementById('modal-config')) return;

    // CSS propio: no todos los módulos definen .modal-overlay (ej. Reportes),
    // así que el ocultado/mostrado del modal no depende del CSS de la página.
    const css = document.createElement('style');
    css.textContent = `
      #modal-config { background: rgba(15, 23, 42, 0.3); backdrop-filter: blur(8px); transition: all 0.2s ease-out; }
      #modal-config:not(.open) { opacity: 0; pointer-events: none; }
      #modal-config.open { opacity: 1; pointer-events: auto; }
      #modal-config > div { scale: 0.95; }
      #modal-config.open > div { scale: 1; }`;
    document.head.appendChild(css);
    const swatches = COLORES_AVATAR.map(c =>
      `<button type="button" data-color="${c}" class="cfg-swatch w-8 h-8 rounded-full border-2 border-white shadow transition-all" style="background:${c}" title="${c}"></button>`
    ).join('');

    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <div class="modal-overlay fixed inset-0 z-50 flex items-center justify-center" id="modal-config">
      <div class="bg-white rounded-3xl border border-outline-variant/20 p-6 w-full max-w-sm shadow-2xl transition-all duration-300">
        <div class="flex justify-between items-center mb-2 pb-2 border-b border-outline-variant/10">
          <h3 class="font-bold text-base text-primary">Personalizar perfil</h3>
          <button id="cfg-cerrar" class="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors">
            <span class="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
        <p class="text-xs text-on-surface-variant mb-4">Ajusta cómo se muestra tu usuario en el sistema. Se guarda en este navegador.</p>
        <div class="space-y-4">
          <div class="flex items-center gap-3 bg-surface-container-low rounded-2xl p-3">
            <div class="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" id="cfg-preview-av">?</div>
            <div class="min-w-0">
              <p class="font-bold text-xs truncate" id="cfg-preview-nombre">—</p>
              <p class="text-[10px] text-on-surface-variant truncate" id="cfg-preview-rol">—</p>
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-primary mb-1">Nombre a mostrar</label>
            <input class="w-full rounded-xl border border-outline-variant/40 text-xs focus:border-primary focus:ring-primary/20" id="cfg-nombre" type="text" placeholder="Tu nombre">
          </div>
          <div>
            <label class="block text-xs font-bold text-primary mb-1">Cargo / rol visible</label>
            <input class="w-full rounded-xl border border-outline-variant/40 text-xs focus:border-primary focus:ring-primary/20" id="cfg-rol" type="text" placeholder="Ej. Gerente RRHH">
          </div>
          <div>
            <label class="block text-xs font-bold text-primary mb-2">Color del avatar</label>
            <div class="flex flex-wrap gap-2" id="cfg-colores">${swatches}</div>
          </div>
        </div>
        <div class="flex items-center gap-2 mt-6 pt-4 border-t border-outline-variant/10">
          <button id="cfg-reset" class="text-[11px] font-bold text-on-surface-variant hover:text-red-600 transition-colors mr-auto">Restablecer</button>
          <button id="cfg-cancelar" class="px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors">Cancelar</button>
          <button id="cfg-guardar" class="px-4 py-2 text-xs font-bold text-white bg-primary rounded-xl hover:bg-black transition-all active:scale-95">Guardar</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(wrap.firstElementChild);

    // Eventos del modal (independientes del script de cada módulo)
    const modal = document.getElementById('modal-config');
    modal.addEventListener('click', e => { if (e.target === modal) cerrarConfig(); });
    document.getElementById('cfg-cerrar').addEventListener('click', cerrarConfig);
    document.getElementById('cfg-cancelar').addEventListener('click', cerrarConfig);
    document.getElementById('cfg-guardar').addEventListener('click', guardarConfig);
    document.getElementById('cfg-reset').addEventListener('click', restablecerConfig);
    document.getElementById('cfg-nombre').addEventListener('input', actualizarPreview);
    document.getElementById('cfg-rol').addEventListener('input', actualizarPreview);
    document.querySelectorAll('.cfg-swatch').forEach(b => b.addEventListener('click', () => {
      colorSel = b.getAttribute('data-color');
      pintarSwatches();
      actualizarPreview();
    }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarConfig(); });
  }

  function pintarSwatches() {
    document.querySelectorAll('.cfg-swatch').forEach(b => {
      const activo = b.getAttribute('data-color') === colorSel;
      b.classList.toggle('ring-2', activo);
      b.classList.toggle('ring-offset-1', activo);
      b.classList.toggle('ring-primary', activo);
      b.classList.toggle('scale-110', activo);
    });
  }

  function actualizarPreview() {
    const s = efectivos();
    const nombre = document.getElementById('cfg-nombre').value.trim() || s.nombre;
    const rol = document.getElementById('cfg-rol').value.trim() || s.rol;
    document.getElementById('cfg-preview-nombre').textContent = nombre;
    document.getElementById('cfg-preview-rol').textContent = rol;
    const av = document.getElementById('cfg-preview-av');
    av.textContent = iniciales(nombre);
    av.style.background = colorSel || COLOR_DEFECTO;
  }

  function abrirConfig() {
    crearModal();
    const { nombre, rol, color } = efectivos();
    document.getElementById('cfg-nombre').value = nombre;
    document.getElementById('cfg-rol').value = rol;
    colorSel = color;
    pintarSwatches();
    actualizarPreview();
    document.getElementById('modal-config').classList.add('open');
  }

  function cerrarConfig() {
    document.getElementById('modal-config')?.classList.remove('open');
  }

  function guardarConfig() {
    const prefs = {};
    const nombre = document.getElementById('cfg-nombre').value.trim();
    const rol = document.getElementById('cfg-rol').value.trim();
    if (nombre) prefs.nombre = nombre;
    if (rol) prefs.rol = rol;
    if (colorSel) prefs.color = colorSel;
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    aplicarPrefs();
    cerrarConfig();
    toast('Perfil actualizado');
  }

  function restablecerConfig() {
    localStorage.removeItem(PREFS_KEY);
    location.reload(); // vuelve a los valores de la sesión y colores originales
  }

  // Mini-toast con el mismo estilo de los módulos (toast() de script.js no es global)
  function toast(msg) {
    let wrap = document.getElementById('toast-wrap');
    if (!wrap) { // algunos módulos (ej. Reportes) no traen el contenedor
      wrap = document.createElement('div');
      wrap.id = 'toast-wrap';
      wrap.className = 'fixed bottom-6 right-6 z-[300] flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = 'flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-xl text-xs font-bold pointer-events-auto transform translate-y-4 opacity-0 transition-all duration-300 bg-green-50 border-green-200 text-green-800';
    el.innerHTML = '<span class="material-symbols-outlined text-base">check_circle</span><span>' + msg + '</span>';
    wrap.appendChild(el);
    setTimeout(() => el.classList.remove('translate-y-4', 'opacity-0'), 10);
    setTimeout(() => { el.classList.add('translate-y-4', 'opacity-0'); setTimeout(() => el.remove(), 300); }, 3200);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ACCESIBILIDAD Y BÚSQUEDA (compartidas por todos los módulos)
  // ═══════════════════════════════════════════════════════════════════
  const FOCO_SEL = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const panelDe = m => m.querySelector(':scope > div') || m;
  const focusables = cont => Array.from(cont.querySelectorAll(FOCO_SEL)).filter(el => el.offsetParent !== null);

  // Marca db-status y toasts como regiones vivas para lectores de pantalla.
  function mejorarRegionesVivas() {
    const db = document.getElementById('db-status');
    if (db) { db.setAttribute('role', 'status'); db.setAttribute('aria-live', 'polite'); }
    const toast = document.getElementById('toast-wrap');
    if (toast) { toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite'); }
  }

  // Señala en la navegación el módulo actual.
  function mejorarNav() {
    const actual = window.CURRENT_MODULE;
    if (!actual) return;
    const link = document.querySelector('[data-modulo="' + actual + '"]');
    if (link) link.setAttribute('aria-current', 'page');
  }

  // Convierte cada modal en un diálogo accesible: role/aria-modal, título
  // asociado, foco inicial al abrir y regreso del foco al cerrar.
  function mejorarModales() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      if (overlay.__a11y) return;
      overlay.__a11y = true;
      const panel = panelDe(overlay);
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      const h = panel.querySelector('h1,h2,h3,h4');
      if (h) {
        if (!h.id) h.id = 'mdl-h-' + Math.random().toString(36).slice(2, 8);
        panel.setAttribute('aria-labelledby', h.id);
      }
      let lastFocus = null;
      new MutationObserver(() => {
        const abierto = overlay.classList.contains('open');
        if (abierto && !overlay.__open) {
          overlay.__open = true;
          lastFocus = document.activeElement;
          setTimeout(() => { const f = focusables(panel)[0]; if (f) f.focus(); }, 60);
        } else if (!abierto && overlay.__open) {
          overlay.__open = false;
          if (lastFocus && lastFocus.focus) lastFocus.focus();
        }
      }).observe(overlay, { attributes: true, attributeFilter: ['class'] });
    });
  }

  function modalAbierto() {
    const abiertos = document.querySelectorAll('.modal-overlay.open');
    return abiertos.length ? abiertos[abiertos.length - 1] : null;
  }

  // Escape cierra el modal de encima; Tab queda atrapado dentro del modal;
  // "/" enfoca la búsqueda cuando no se está escribiendo.
  function onKeydownGlobal(e) {
    const modal = modalAbierto();
    if (modal && e.key === 'Escape') { modal.classList.remove('open'); return; }
    if (modal && e.key === 'Tab') {
      const f = focusables(panelDe(modal));
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      return;
    }
    if (!modal && e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) {
      const s = document.getElementById('search-input');
      if (s) { e.preventDefault(); s.focus(); }
    }
  }

  // Búsqueda: etiqueta accesible, botón limpiar (×) y debounce del handler.
  function mejorarBusqueda() {
    const input = document.getElementById('search-input');
    if (!input || input.__mejorado) return;
    input.__mejorado = true;
    input.setAttribute('aria-label', input.getAttribute('placeholder') || 'Buscar');
    input.setAttribute('type', 'search');

    // Las funciones invocadas (renderTabla, filtrarTabla, onBuscar) son globales.
    const code = input.getAttribute('oninput') || input.getAttribute('onkeyup') || '';
    input.removeAttribute('oninput'); input.removeAttribute('onkeyup');
    let run = () => {};
    try { run = new Function(code); } catch (e) {}
    let t;
    input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => run.call(input), 140); });

    const cont = input.parentElement;
    if (cont) {
      if (getComputedStyle(cont).position === 'static') cont.style.position = 'relative';
      input.style.paddingRight = '2.25rem';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'material-symbols-outlined';
      btn.textContent = 'close';
      btn.setAttribute('aria-label', 'Limpiar búsqueda');
      btn.style.cssText = 'position:absolute;right:8px;top:50%;transform:translateY(-50%);border:none;background:transparent;cursor:pointer;font-size:18px;color:inherit;opacity:.55;display:none;';
      const sync = () => { btn.style.display = input.value ? 'block' : 'none'; };
      input.addEventListener('input', sync);
      btn.addEventListener('click', () => { input.value = ''; sync(); run.call(input); input.focus(); });
      cont.appendChild(btn);
      sync();
    }
  }

  function mejorasUX() {
    mejorarRegionesVivas();
    mejorarNav();
    mejorarBusqueda();
    mejorarModales();
    document.addEventListener('keydown', onKeydownGlobal);
  }

  document.addEventListener('DOMContentLoaded', () => {
    crearModal();
    crearBotonTema();
    mejorasUX();
    aplicarPrefs(); // corre después de auth-guard, así las preferencias tienen prioridad
  });

  // Para los onclick del header
  window.abrirConfig = abrirConfig;
})();
