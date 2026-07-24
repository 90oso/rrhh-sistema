import { supabase } from '../supabase-client.js';
const db = supabase;

// ── ESTADO GENERAL ──
let empleados = [];
let filtroEstado = 'todos';
let empleadoSeleccionado = null;
let editandoId = null;
let estadoCambioId = null;
let histTab = 'cap';
let histCache = {};
let modoDemoActivo = false;

// ── HELPERS GENERALES ──
const AV_COLORS = ['#7073ff', '#00668a', '#EC4899', '#0EA5E9', '#10B981', '#F59E0B', '#6366F1', '#14B8A6', '#EF4444', '#F97316'];
function avColor(id) { return AV_COLORS[(id || 0) % AV_COLORS.length]; }
function iniciales(nombre) { return (nombre || '??').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase(); }
function fmtFecha(iso) { if (!iso) return '—'; const d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }); }
function fmtMoney(n) { if (!n && n !== 0) return '—'; return '$' + Number(n).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function estadoBadge(e) {
  const m = { Activo: 'bg-green-50 text-green-700 ring-green-600/20', Suspendido: 'bg-amber-50 text-amber-700 ring-amber-600/20', Inactivo: 'bg-gray-50 text-gray-700 ring-gray-600/20' };
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${m[e] || 'bg-gray-50 text-gray-700 ring-gray-600/20'}">${e}</span>`;
}
function contratoBadge(c) {
  const m = { Indefinido: 'bg-sky-50 text-sky-700 ring-sky-600/20', Temporal: 'bg-purple-50 text-purple-700 ring-purple-600/20', Servicios: 'bg-orange-50 text-orange-700 ring-orange-600/20' };
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${m[c] || 'bg-gray-50 text-gray-700 ring-gray-600/20'}">${c}</span>`;
}

// ── FILTROS ESTADO ──
function filtrarPor(estado, el) {
  filtroEstado = estado;
  document.querySelectorAll('#filter-row .chip').forEach(c => {
    c.classList.remove('bg-primary', 'text-white', 'shadow-sm');
    c.classList.add('bg-surface-container-high', 'text-on-surface-variant');
  });
  if (el) {
    el.classList.remove('bg-surface-container-high', 'text-on-surface-variant');
    el.classList.add('bg-primary', 'text-white', 'shadow-sm');
  }
  renderTabla();
}

// ── TABLA ──
function renderTabla() {
  const sInp = document.getElementById('search-input');
  const busqueda = (sInp ? sInp.value : '').toLowerCase();
  const lista = empleados.filter(e => {
    const matchE = filtroEstado === 'todos' || e.estado === filtroEstado;
    const matchB = !busqueda ||
      (e.nombre || '').toLowerCase().includes(busqueda) ||
      (e.cargo || '').toLowerCase().includes(busqueda) ||
      (e.departamento || '').toLowerCase().includes(busqueda) ||
      (e.email || '').toLowerCase().includes(busqueda);
    return matchE && matchB;
  });

  const tbody = document.getElementById('tbody');
  if (!tbody) return;

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-on-surface-variant text-sm"><span class="material-symbols-outlined text-2xl block opacity-40 mb-1">person_off</span>Sin empleados</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(e => {
    const ini = iniciales(e.nombre);
    const col = avColor(e.id);
    return `<tr onclick="mostrarPerfil(${e.id})" class="cursor-pointer border-b border-outline-variant/10 text-xs hover:bg-surface-container-low/40 transition-colors ${empleadoSeleccionado === e.id ? 'bg-primary/5' : ''}">
      <td class="py-3 pl-2">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-[11px] shadow-sm flex-shrink-0" style="background:${col}">${ini}</div>
          <div>
            <div class="font-bold text-primary">${e.nombre}</div>
            <div class="text-[10px] text-on-surface-variant opacity-80">${e.departamento || '—'}</div>
          </div>
        </div>
      </td>
      <td class="py-3">${e.cargo || '—'}</td>
      <td class="py-3">${contratoBadge(e.tipo_contrato || 'Indefinido')}</td>
      <td class="py-3">${estadoBadge(e.estado || 'Activo')}</td>
      <td class="py-3 pr-2 text-right">
        <div class="flex gap-1 justify-end">
          <button class="w-7 h-7 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors" onclick="event.stopPropagation();mostrarPerfil(${e.id})" title="Ver perfil"><span class="material-symbols-outlined text-base">visibility</span></button>
          <button class="w-7 h-7 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors" onclick="event.stopPropagation();editarEmpleado(${e.id})" title="Editar"><span class="material-symbols-outlined text-base">edit</span></button>
          <button class="w-7 h-7 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors" onclick="event.stopPropagation();abrirCambioEstado(${e.id})" title="Cambiar estado"><span class="material-symbols-outlined text-base">toggle_on</span></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── PERFIL ──
function mostrarPerfil(id) {
  empleadoSeleccionado = id;
  const e = empleados.find(x => x.id === id);
  if (!e) return;
  const ini = iniciales(e.nombre);
  const col = avColor(e.id);
  const jefe = e.jefe_directo ? (empleados.find(x => x.id === e.jefe_directo) || {}).nombre || '—' : 'Sin jefe directo';

  const pBox = document.getElementById('perfil-content');
  if (pBox) {
    pBox.innerHTML = `
      <div class="flex items-center gap-4 mb-4 pb-4 border-b border-outline-variant/10">
        <div class="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow" style="background:${col}">${ini}</div>
        <div>
          <div class="text-base font-bold text-primary mb-0.5">${e.nombre}</div>
          <div class="text-xs text-on-surface-variant mb-1.5">${e.cargo || '—'} · Depto. ${e.departamento || '—'}</div>
          <div class="flex gap-1.5 flex-wrap">${estadoBadge(e.estado || 'Activo')} ${contratoBadge(e.tipo_contrato || 'Indefinido')}</div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-y-2 gap-x-2 text-[11px] mb-4">
        <div><span class="text-on-surface-variant">Ingreso: </span><span class="font-semibold text-primary">${fmtFecha(e.fecha_ingreso)}</span></div>
        <div><span class="text-on-surface-variant">Jefe: </span><span class="font-semibold text-primary">${jefe}</span></div>
        <div><span class="text-on-surface-variant">Salario: </span><span class="font-semibold text-primary">${fmtMoney(e.salario_base)}</span></div>
        <div><span class="text-on-surface-variant">Emergencia: </span><span class="font-semibold text-primary">${e.contacto_emergencia || '—'}</span></div>
        <div class="col-span-2"><span class="text-on-surface-variant">Email: </span><span class="font-semibold text-primary">${e.email || '—'}</span></div>
      </div>
      <div class="flex gap-0 border-b border-outline-variant/20 mb-3.5">
        <div class="hist-tab px-3 py-2 text-[11px] cursor-pointer border-b-2 -mb-px font-semibold transition-all ${histTab === 'cap' ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-primary'}" onclick="tabHist('cap',this)">Capacitaciones</div>
        <div class="hist-tab px-3 py-2 text-[11px] cursor-pointer border-b-2 -mb-px font-semibold transition-all ${histTab === 'eval' ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-primary'}" onclick="tabHist('eval',this)">Evaluaciones</div>
        <div class="hist-tab px-3 py-2 text-[11px] cursor-pointer border-b-2 -mb-px font-semibold transition-all ${histTab === 'mov' ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-primary'}" onclick="tabHist('mov',this)">Movimientos</div>
      </div>
      <div id="hist-content" class="min-h-[60px]"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mx-auto my-3"></div></div>
      <div class="flex gap-2 mt-4 flex-wrap">
        <button class="flex items-center gap-1.5 bg-surface-container-high hover:bg-surface-container-highest text-primary text-[11px] font-bold px-3 py-2 rounded-xl transition-all" onclick="editarEmpleado(${id})"><span class="material-symbols-outlined text-sm">edit</span>Editar</button>
        <button class="flex items-center gap-1.5 bg-primary hover:bg-black text-white text-[11px] font-bold px-3 py-2 rounded-xl transition-all active:scale-95" onclick="abrirCambioEstado(${id})"><span class="material-symbols-outlined text-sm">toggle_on</span>Cambiar estado</button>
      </div>`;
  }

  cargarHistorial(id);
  renderTabla();
}

function limpiarPerfil() {
  empleadoSeleccionado = null;
  const pBox = document.getElementById('perfil-content');
  if (pBox) pBox.innerHTML = `<div class="text-center py-6 text-on-surface-variant"><span class="material-symbols-outlined text-3xl block mb-2 opacity-40">badge</span><p class="text-xs">Selecciona un empleado para ver su perfil</p></div>`;
}

// ── HISTORIAL (capacitaciones / evaluaciones / movimientos) ──
const HIST_ICONS = { cap: 'workspace_premium', eval: 'star', mov: 'sync_alt' };
const HIST_TABLAS = { cap: 'capacitaciones', eval: 'evaluaciones', mov: 'movimientos_empleado' };

function renderHistContent(tab, items) {
  if (!items || !items.length) return `<div class="text-center py-5 text-on-surface-variant text-xs">Sin registros en este historial</div>`;
  return items.map(i => {
    if (tab === 'cap') {
      return `<div class="flex items-start gap-2.5 py-2 border-b border-outline-variant/10 text-xs last:border-b-0">
        <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-sky-50 text-sky-700"><span class="material-symbols-outlined text-sm">${HIST_ICONS.cap}</span></div>
        <div class="flex-1">
          <div class="font-semibold text-on-surface-variant">${i.nombre || '—'}</div>
          <div class="text-on-surface-variant opacity-70 mt-0.5">${fmtFecha(i.fecha)} · ${i.horas || 0}h${i.proveedor ? ` · ${i.proveedor}` : ''}${i.estado ? ` · ${i.estado}` : ''}</div>
        </div>
      </div>`;
    }
    if (tab === 'eval') {
      return `<div class="flex items-start gap-2.5 py-2 border-b border-outline-variant/10 text-xs last:border-b-0">
        <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-50 text-amber-700"><span class="material-symbols-outlined text-sm">${HIST_ICONS.eval}</span></div>
        <div class="flex-1">
          <div class="font-semibold text-on-surface-variant">Promedio: ${i.promedio != null ? Number(i.promedio).toFixed(2) : '—'}/5</div>
          <div class="text-on-surface-variant opacity-70 mt-0.5">${fmtFecha(i.fecha)}</div>
          ${i.comentarios ? `<div class="text-on-surface-variant mt-1 italic">"${i.comentarios}"</div>` : ''}
        </div>
      </div>`;
    }
    return `<div class="flex items-start gap-2.5 py-2 border-b border-outline-variant/10 text-xs last:border-b-0">
      <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-purple-50 text-purple-700"><span class="material-symbols-outlined text-sm">${HIST_ICONS.mov}</span></div>
      <div class="flex-1">
        <div class="font-semibold text-on-surface-variant">${i.tipo || '—'}</div>
        <div class="text-on-surface-variant opacity-70 mt-0.5">${i.descripcion || ''}${i.descripcion ? ' · ' : ''}${fmtFecha(i.fecha)}</div>
      </div>
    </div>`;
  }).join('');
}

async function cargarHistorial(id) {
  const box = document.getElementById('hist-content');
  if (!box) return;
  const key = `${id}-${histTab}`;

  if (histCache[key]) { box.innerHTML = renderHistContent(histTab, histCache[key]); return; }
  box.innerHTML = '<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mx-auto my-3"></div>';

  if (esDemo()) {
    histCache[key] = datosHistorialDemo(histTab);
    box.innerHTML = renderHistContent(histTab, histCache[key]);
    return;
  }

  const { data, error } = await db.from(HIST_TABLAS[histTab]).select('*').eq('empleado_id', id).order('fecha', { ascending: false });
  if (error) {
    box.innerHTML = `<div class="text-center py-4 text-on-surface-variant text-xs">Tabla "${HIST_TABLAS[histTab]}" no disponible aún</div>`;
    return;
  }
  histCache[key] = data || [];
  box.innerHTML = renderHistContent(histTab, histCache[key]);
}

function tabHist(tab, el) {
  histTab = tab;
  document.querySelectorAll('.hist-tab').forEach(t => {
    t.classList.remove('text-primary', 'border-primary');
    t.classList.add('text-on-surface-variant', 'border-transparent');
  });
  if (el) {
    el.classList.add('text-primary', 'border-primary');
    el.classList.remove('text-on-surface-variant', 'border-transparent');
  }
  cargarHistorial(empleadoSeleccionado);
}

function datosHistorialDemo(tab) {
  const demos = {
    cap: [{ nombre: 'Seguridad Industrial', fecha: '2026-03-15', horas: 8, proveedor: 'Instituto Nacional', estado: 'Completado' },
          { nombre: 'Excel Avanzado', fecha: '2026-01-10', horas: 16, proveedor: 'Capacita Panamá', estado: 'Completado' }],
    eval: [{ promedio: 4.2, fecha: '2026-04-01', comentarios: 'Buen desempeño técnico' },
           { promedio: 3.9, fecha: '2025-12-01', comentarios: null }],
    mov: [{ tipo: 'Cambio de cargo', descripcion: 'Junior → Semi Senior', fecha: '2026-02-15' },
          { tipo: 'Ingreso', descripcion: 'Ingreso a la empresa', fecha: '2021-08-15' }],
  };
  return demos[tab] || [];
}

// ── ORGANIGRAMA (modal por área) ──
let areaOrgSeleccionada = 'todas';

function abrirOrganigrama() {
  renderFiltrosOrganigrama();
  renderOrganigramaArea(areaOrgSeleccionada);
  abrirModal('modal-organigrama');
}

function renderFiltrosOrganigrama() {
  const row = document.getElementById('org-filter-row');
  if (!row) return;
  const deptos = [...new Set(empleados.filter(e => e.estado !== 'Inactivo').map(e => e.departamento).filter(Boolean))];
  const activeClass = 'bg-primary text-white shadow-sm';
  const idleClass = 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest';
  const chip = (val, label) => `<button class="chip px-3 py-1 text-xs font-semibold rounded-full transition-all ${areaOrgSeleccionada === val ? activeClass : idleClass}" onclick="seleccionarAreaOrg('${val.replace(/'/g, "\\'")}',this)">${label}</button>`;
  row.innerHTML = `<span class="text-xs text-on-surface-variant font-medium mr-1">Área:</span>` +
    chip('todas', 'Todas') +
    deptos.map(d => chip(d, d)).join('');
}

function seleccionarAreaOrg(depto, el) {
  areaOrgSeleccionada = depto;
  document.querySelectorAll('#org-filter-row .chip').forEach(c => {
    c.classList.remove('bg-primary', 'text-white', 'shadow-sm');
    c.classList.add('bg-surface-container-high', 'text-on-surface-variant');
  });
  if (el) {
    el.classList.remove('bg-surface-container-high', 'text-on-surface-variant');
    el.classList.add('bg-primary', 'text-white', 'shadow-sm');
  }
  renderOrganigramaArea(depto);
}

function renderOrganigramaArea(depto) {
  const wrap = document.getElementById('org-modal-wrap');
  if (!wrap) return;
  const activos = empleados.filter(e => e.estado !== 'Inactivo' && (depto === 'todas' || e.departamento === depto));

  if (!activos.length) { wrap.innerHTML = '<div class="text-on-surface-variant text-xs py-4">Sin empleados activos en esta área</div>'; return; }

  const raices = activos.filter(e => !e.jefe_directo || !activos.find(x => x.id === e.jefe_directo));
  if (!raices.length) { wrap.innerHTML = '<div class="text-on-surface-variant text-xs py-4">Sin empleados activos</div>'; return; }

  function nodoHtml(emp, depthN = 0) {
    const hijos = activos.filter(e => e.jefe_directo === emp.id);
    const esRaiz = depthN === 0;
    const boxClasses = esRaiz ? 'border-primary bg-primary/5' : 'border-outline-variant/30 bg-white';
    let html = `<div class="flex flex-col [align-items:safe_center]">
      <div class="inline-block px-3.5 py-2 border rounded-xl shadow-sm cursor-pointer transition-all hover:border-primary hover:shadow-md min-w-[110px] flex-shrink-0 ${boxClasses}" onclick="mostrarPerfil(${emp.id});cerrarModal('modal-organigrama')" title="${emp.nombre}">
        <div class="text-[11px] font-bold text-primary">${emp.nombre.split(' ').slice(0, 2).join(' ')}</div>
        <div class="text-[10px] text-on-surface-variant">${emp.cargo || '—'}</div>
        <div class="text-[10px] text-on-surface-variant opacity-60">${emp.departamento || ''}</div>
      </div>`;
    if (hijos.length) {
      html += `<div class="w-px h-4 bg-outline-variant/40 flex-shrink-0"></div>
      <div class="flex gap-2 relative">
        <div class="absolute top-0 left-5 right-5 h-px bg-outline-variant/40"></div>
        ${hijos.map(h => nodoHtml(h, depthN + 1)).join('')}
      </div>`;
    }
    html += `</div>`;
    return html;
  }

  wrap.innerHTML = raices.length === 1
    ? nodoHtml(raices[0])
    : `<div class="flex gap-3 flex-wrap [justify-content:safe_center]">${raices.map(r => nodoHtml(r)).join('')}</div>`;
}

// ── SELECTS / DATALIST ──
function llenarSelectJefe(excluirId = null) {
  const sel = document.getElementById('f-jefe');
  if (!sel) return;
  const actual = sel.value;
  sel.innerHTML = '<option value="">Sin jefe directo (nivel raíz)</option>';
  empleados.filter(e => e.id !== excluirId && e.estado !== 'Inactivo').forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = `${e.nombre} — ${e.cargo || ''}`;
    sel.appendChild(opt);
  });
  sel.value = actual;
}

function llenarDatalistDeptos() {
  const dl = document.getElementById('deptos-list');
  if (!dl) return;
  const deptos = [...new Set(empleados.map(e => e.departamento).filter(Boolean))];
  dl.innerHTML = deptos.map(d => `<option value="${d}">`).join('');
}

// ── STATS ──
function actualizarStats() {
  const activos = empleados.filter(e => e.estado === 'Activo');
  const total = empleados.length;
  const deptos = [...new Set(activos.map(e => e.departamento).filter(Boolean))];
  const indef = activos.filter(e => e.tipo_contrato === 'Indefinido').length;
  const pctIndef = activos.length ? Math.round((indef / activos.length) * 100) : 0;

  const ahora = new Date();
  const nuevos = empleados.filter(e => {
    if (!e.fecha_ingreso) return false;
    const d = new Date(e.fecha_ingreso);
    return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear();
  });

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('st-activo', activos.length);
  set('st-total-sub', `de ${total} empleados`);
  set('st-deptos', deptos.length);
  set('st-deptos-lista', deptos.slice(0, 4).join(' · ') + (deptos.length > 4 ? '...' : ''));
  set('st-indef', indef);
  set('st-indef-pct', `${pctIndef}% de la plantilla activa`);
  set('st-nuevos', nuevos.length);
  set('st-nuevo-nombre', nuevos.length ? nuevos.map(e => e.nombre.split(' ')[0]).join(', ') : 'Ninguno este mes');

  const badge = document.getElementById('badge-personal');
  if (badge) badge.textContent = activos.length;
}

// ── RENDER GLOBAL ──
function renderizarTodo() {
  actualizarStats();
  renderTabla();
  llenarSelectJefe();
  llenarDatalistDeptos();
  if (empleadoSeleccionado) {
    const e = empleados.find(x => x.id === empleadoSeleccionado);
    if (e) mostrarPerfil(e.id); else limpiarPerfil();
  }
}

// ── FORMULARIO NUEVO / EDITAR ──
function abrirNuevo() {
  editandoId = null;
  document.getElementById('form-title').textContent = 'Nuevo empleado';
  document.getElementById('btn-txt').textContent = 'Guardar empleado';
  ['f-nombre', 'f-email', 'f-cargo', 'f-depto', 'f-emergencia', 'f-salario'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('f-contrato').value = 'Indefinido';
  document.getElementById('f-estado').value = 'Activo';
  document.getElementById('f-ingreso').value = new Date().toISOString().split('T')[0];
  llenarSelectJefe();
  llenarDatalistDeptos();
  document.getElementById('f-jefe').value = '';
  abrirModal('modal-form');
  setTimeout(() => document.getElementById('f-nombre').focus(), 150);
}

function editarEmpleado(id) {
  const e = empleados.find(x => x.id === id);
  if (!e) return;
  editandoId = id;
  document.getElementById('form-title').textContent = 'Editar empleado';
  document.getElementById('btn-txt').textContent = 'Guardar cambios';
  document.getElementById('f-nombre').value = e.nombre || '';
  document.getElementById('f-email').value = e.email || '';
  document.getElementById('f-cargo').value = e.cargo || '';
  document.getElementById('f-depto').value = e.departamento || '';
  document.getElementById('f-emergencia').value = e.contacto_emergencia || '';
  document.getElementById('f-salario').value = e.salario_base || '';
  document.getElementById('f-ingreso').value = e.fecha_ingreso || '';
  document.getElementById('f-contrato').value = e.tipo_contrato || 'Indefinido';
  document.getElementById('f-estado').value = e.estado || 'Activo';
  llenarSelectJefe(id);
  llenarDatalistDeptos();
  document.getElementById('f-jefe').value = e.jefe_directo || '';
  abrirModal('modal-form');
}

async function guardar() {
  const nombre = document.getElementById('f-nombre').value.trim();
  const email = document.getElementById('f-email').value.trim();
  const cargo = document.getElementById('f-cargo').value.trim();
  const depto = document.getElementById('f-depto').value.trim();
  const ingreso = document.getElementById('f-ingreso').value;

  if (!nombre || !email || !cargo || !depto || !ingreso) {
    toast('Completa los campos obligatorios', 'err');
    return;
  }

  const jefeVal = document.getElementById('f-jefe').value;
  const datos = {
    nombre, email, cargo, departamento: depto,
    jefe_directo: jefeVal ? Number(jefeVal) : null,
    tipo_contrato: document.getElementById('f-contrato').value,
    salario_base: parseFloat(document.getElementById('f-salario').value) || null,
    fecha_ingreso: ingreso || null,
    estado: document.getElementById('f-estado').value,
    contacto_emergencia: document.getElementById('f-emergencia').value.trim() || null,
  };

  const btn = document.getElementById('btn-guardar');
  if (btn) btn.disabled = true;

  if (esDemo()) {
    if (editandoId) {
      const idx = empleados.findIndex(e => e.id === editandoId);
      if (idx >= 0) empleados[idx] = { ...empleados[idx], ...datos };
      toast('Cambios guardados (demo)', 'ok');
    } else {
      empleados.unshift({ id: Date.now(), ...datos });
      toast(`${nombre} agregado (demo)`, 'ok');
    }
    renderizarTodo();
    cerrarModal('modal-form');
    if (btn) btn.disabled = false;
    return;
  }

  if (editandoId) {
    const { error } = await db.from('empleados').update(datos).eq('id', editandoId);
    if (btn) btn.disabled = false;
    if (error) { toast('Error: ' + error.message, 'err'); return; }
    toast(`${nombre} actualizado`, 'ok');
  } else {
    const { error } = await db.from('empleados').insert([datos]);
    if (btn) btn.disabled = false;
    if (error) { toast('Error: ' + error.message, 'err'); return; }
    toast(`${nombre} registrado`, 'ok');
  }
  cerrarModal('modal-form');
}

// ── CAMBIO DE ESTADO ──
function abrirCambioEstado(id) {
  const e = empleados.find(x => x.id === id);
  if (!e) return;
  estadoCambioId = id;
  document.getElementById('estado-nombre').textContent = e.nombre;
  document.getElementById('estado-nuevo').value = e.estado || 'Activo';
  document.getElementById('estado-motivo').value = '';
  abrirModal('modal-estado');
}

async function guardarEstado() {
  const id = estadoCambioId;
  const e = empleados.find(x => x.id === id);
  if (!e) return;
  const nuevo = document.getElementById('estado-nuevo').value;
  const motivo = document.getElementById('estado-motivo').value.trim();

  if (esDemo()) {
    const idx = empleados.findIndex(x => x.id === id);
    if (idx >= 0) empleados[idx].estado = nuevo;
    renderizarTodo();
    toast(`Estado de ${e.nombre} cambiado a ${nuevo}`, 'ok');
    cerrarModal('modal-estado');
    return;
  }

  const { error } = await db.from('empleados').update({ estado: nuevo }).eq('id', id);
  if (error) { toast('Error: ' + error.message, 'err'); return; }

  // Registro de auditoría opcional — no bloquea si la tabla aún no existe
  await db.from('movimientos_empleado').insert([{
    empleado_id: id, tipo: 'Cambio de estado', descripcion: `Estado cambiado a ${nuevo}. ${motivo}`, fecha: new Date().toISOString().split('T')[0]
  }]);
  delete histCache[`${id}-mov`];

  toast(`Estado de ${e.nombre} actualizado`, 'ok');
  cerrarModal('modal-estado');
}

// ── DATOS DEMO ──
function datosDemo() {
  return [
    { id: 1, nombre: 'Ana García', email: 'ana@empresa.com', cargo: 'Gerente RRHH', departamento: 'RRHH', jefe_directo: null, tipo_contrato: 'Indefinido', salario_base: 3500, fecha_ingreso: '2020-01-15', estado: 'Activo', contacto_emergencia: 'Pedro García · +507 6200-0001' },
    { id: 2, nombre: 'Carlos Mora', email: 'carlos@empresa.com', cargo: 'Analista TI', departamento: 'TI', jefe_directo: 1, tipo_contrato: 'Indefinido', salario_base: 2200, fecha_ingreso: '2021-03-10', estado: 'Activo', contacto_emergencia: 'Luisa Mora · +507 6200-0002' },
    { id: 3, nombre: 'Lucía Pérez', email: 'lucia@empresa.com', cargo: 'Diseñadora', departamento: 'Marketing', jefe_directo: 1, tipo_contrato: 'Temporal', salario_base: 1800, fecha_ingreso: '2022-06-01', estado: 'Activo', contacto_emergencia: '' },
    { id: 4, nombre: 'Roberto Sánchez', email: 'roberto@empresa.com', cargo: 'Dev Backend', departamento: 'TI', jefe_directo: 2, tipo_contrato: 'Indefinido', salario_base: 2800, fecha_ingreso: '2021-08-15', estado: 'Activo', contacto_emergencia: '+507 6000-1234' },
    { id: 5, nombre: 'María Jiménez', email: 'maria@empresa.com', cargo: 'Contadora', departamento: 'Finanzas', jefe_directo: 1, tipo_contrato: 'Indefinido', salario_base: 2400, fecha_ingreso: '2020-11-20', estado: 'Activo', contacto_emergencia: '' },
    { id: 6, nombre: 'Diego Vargas', email: 'diego@empresa.com', cargo: 'Vendedor', departamento: 'Comercial', jefe_directo: 1, tipo_contrato: 'Servicios', salario_base: 1500, fecha_ingreso: '2023-02-01', estado: 'Activo', contacto_emergencia: '' },
    { id: 7, nombre: 'Patricia López', email: 'patricia@empresa.com', cargo: 'Asistente RRHH', departamento: 'RRHH', jefe_directo: 1, tipo_contrato: 'Temporal', salario_base: 1200, fecha_ingreso: '2023-09-15', estado: 'Activo', contacto_emergencia: '' },
    { id: 8, nombre: 'Fernando Ruiz', email: 'fernando@empresa.com', cargo: 'Supervisor', departamento: 'Operaciones', jefe_directo: 1, tipo_contrato: 'Indefinido', salario_base: 2600, fecha_ingreso: '2022-04-10', estado: 'Activo', contacto_emergencia: '' },
  ];
}

function esDemo() { return modoDemoActivo; }

function abrirModal(id) { const el = document.getElementById(id); if (el) el.classList.add('open'); }
function cerrarModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('open'); }

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(bg => {
    bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('open'); });
  });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
});

function toast(msg, tipo = '') {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) return;
  const el = document.createElement('div');
  const bgClass = tipo === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : tipo === 'err' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-white border-outline-variant/30 text-primary';
  const iconName = tipo === 'ok' ? 'check_circle' : tipo === 'err' ? 'error' : 'info';
  el.className = `flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-xl text-xs font-bold pointer-events-auto transform translate-y-4 opacity-0 transition-all duration-300 ${bgClass}`;
  el.innerHTML = `<span class="material-symbols-outlined text-base">${iconName}</span><span>${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => el.classList.remove('translate-y-4', 'opacity-0'), 10);
  setTimeout(() => {
    el.classList.add('translate-y-4', 'opacity-0');
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

// ── INICIO ──
async function iniciar() {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  const st = document.getElementById('db-status');

  try {
    if (!db) throw new Error('Sin cliente Supabase');
    const { error } = await db.from('empleados').select('id').limit(1);
    if (error) throw error;

    if (dot) dot.style.background = '#22C55E';
    if (txt) txt.textContent = 'Conectado a Supabase';
    if (st) setTimeout(() => st.classList.add('opacity-0', 'pointer-events-none'), 2000);

    await cargar();
    suscribirRealtime();
  } catch (err) {
    console.error('Fallo de conexión, activando modo demo:', err);
    modoDemoActivo = true;
    if (dot) dot.style.background = '#F59E0B';
    if (txt) txt.textContent = 'Modo demo — Fallback activo';
    if (st) setTimeout(() => st.classList.add('opacity-0', 'pointer-events-none'), 4000);
    empleados = datosDemo();
    renderizarTodo();
  }
}

async function cargar() {
  const { data, error } = await db.from('empleados').select('*').order('created_at', { ascending: false });
  if (error) { toast('Error al cargar: ' + error.message, 'err'); return; }
  empleados = data || [];
  renderizarTodo();
}

function suscribirRealtime() {
  if (!db) return;
  db.channel('personal')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, () => cargar())
    .subscribe();
}

// ── REGISTRO SEGURO EN EL OBJETO WINDOW (para los onclick del HTML) ──
window.renderTabla = renderTabla;
window.filtrarPor = filtrarPor;
window.mostrarPerfil = mostrarPerfil;
window.tabHist = tabHist;
window.abrirNuevo = abrirNuevo;
window.editarEmpleado = editarEmpleado;
window.guardar = guardar;
window.abrirCambioEstado = abrirCambioEstado;
window.guardarEstado = guardarEstado;
window.abrirModal = abrirModal;
window.cerrarModal = cerrarModal;
window.abrirOrganigrama = abrirOrganigrama;
window.seleccionarAreaOrg = seleccionarAreaOrg;

// ── ARRANCAR ──
iniciar();