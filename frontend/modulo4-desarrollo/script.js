import { supabase } from '../supabase-client.js';
const db = supabase;

// ── ESTADO GENERAL ──
let empleados = [];
let capacitaciones = [];
let evaluaciones = [];
let filtroDepto = 'todos';
let empleadoSeleccionado = null;
let histTab = 'cap';
let modoDemoActivo = false;

// ── HELPERS GENERALES ──
const AV_COLORS = ['#7073ff', '#00668a', '#EC4899', '#0EA5E9', '#10B981', '#F59E0B', '#6366F1', '#14B8A6', '#EF4444', '#F97316'];
function avColor(id) { return AV_COLORS[(id || 0) % AV_COLORS.length]; }
function iniciales(nombre) { return (nombre || '??').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase(); }
function fmtFecha(iso) { if (!iso) return '—'; const d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }); }
function diasHasta(iso) { if (!iso) return null; const hoy = new Date(); const d = new Date(iso + 'T12:00:00'); return Math.round((d - hoy) / 86400000); }
function estrellas(prom) { const n = Math.round(prom || 0); return '★'.repeat(n) + '☆'.repeat(5 - n); }

function capBadge(e) {
  const m = { Inscrito: 'bg-sky-50 text-sky-700 ring-sky-600/20', ['En curso']: 'bg-amber-50 text-amber-700 ring-amber-600/20', Completado: 'bg-green-50 text-green-700 ring-green-600/20', ['No completado']: 'bg-red-50 text-red-700 ring-red-600/20' };
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${m[e] || 'bg-gray-50 text-gray-700 ring-gray-600/20'}">${e}</span>`;
}

// ── RATINGS DEL MODAL ──
function actualizarRating(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const v = parseFloat(el.value);
  const numEl = document.getElementById('rv-' + id.split('-')[1]);
  if (numEl) numEl.textContent = v.toFixed(0);
  recalcPromedio();
}

function recalcPromedio() {
  const ids = ['r-punt', 'r-equipo', 'r-result', 'r-lider'];
  const vals = ids.map(id => {
    const el = document.getElementById(id);
    return el ? parseFloat(el.value) : 4;
  });
  const prom = vals.reduce((a, b) => a + b, 0) / vals.length;
  const promEl = document.getElementById('eval-promedio');
  if (promEl) promEl.textContent = prom.toFixed(2);
}

// ── FILTROS DEPTO ──
function renderFiltrosDeptoLimpio() {
  const deptos = [...new Set(empleados.map(e => e.departamento).filter(Boolean))];
  const row = document.getElementById('filter-row');
  const activeClass = 'bg-primary text-white shadow-sm';
  const idleClass = 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest';
  if (row) {
    row.innerHTML = `<span class="text-xs text-on-surface-variant font-medium">Departamento:</span>
      <button class="chip px-3 py-1 text-xs font-semibold rounded-full transition-all ${filtroDepto === 'todos' ? activeClass : idleClass}" onclick="filtrarPor('todos',this)">Todos</button>
      ${deptos.map(d => `<button class="chip px-3 py-1 text-xs font-semibold rounded-full transition-all ${filtroDepto === d ? activeClass : idleClass}" onclick="filtrarPor('${d.replace(/'/g, "\\'")}',this)">${d}</button>`).join('')}`;
  }
}

function filtrarPor(depto, el) {
  filtroDepto = depto;
  renderFiltrosDeptoLimpio();
  renderTabla();
}

// ── TABLA ──
function renderTabla() {
  const sInp = document.getElementById('search-input');
  const busqueda = (sInp ? sInp.value : '').toLowerCase();
  const lista = empleados.filter(e => {
    const matchD = filtroDepto === 'todos' || e.departamento === filtroDepto;
    const matchB = !busqueda || (e.nombre || '').toLowerCase().includes(busqueda) || (e.cargo || '').toLowerCase().includes(busqueda);
    return matchD && matchB;
  });

  const tbody = document.getElementById('tbody');
  if (!tbody) return;

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-12 text-center text-on-surface-variant text-sm"><span class="material-symbols-outlined text-2xl block opacity-40 mb-1">person_off</span>Sin empleados</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(e => {
    const ini = iniciales(e.nombre);
    const col = avColor(e.id);
    const prom = promedioEmpleado(e.id);
    const capCount = capacitaciones.filter(c => c.empleado_id === e.id).length;
    const capComp = capacitaciones.filter(c => c.empleado_id === e.id && c.estado === 'Completado').length;
    return `<tr onclick="mostrarPerfil(${e.id})" class="cursor-pointer border-b border-outline-variant/10 text-xs hover:bg-surface-container-low/40 transition-colors ${empleadoSeleccionado === e.id ? 'bg-primary/5' : ''}">
      <td class="py-3 pl-2">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-[11px] shadow-sm flex-shrink-0" style="background:${col}">${ini}</div>
          <div>
            <div class="font-bold text-primary">${e.nombre}</div>
            <div class="text-[10px] text-on-surface-variant opacity-80">${e.cargo || '—'}</div>
          </div>
        </div>
      </td>
      <td class="py-3">${prom !== null ? `<span class="text-amber-500 tracking-wide">${estrellas(prom)}</span> <span class="text-on-surface-variant font-semibold">${prom.toFixed(2)}</span>` : '<span class="text-on-surface-variant">Sin evaluar</span>'}</td>
      <td class="py-3 text-on-surface-variant font-medium">${capComp}/${capCount} completadas</td>
      <td class="py-3 pr-2 text-right"><button class="w-7 h-7 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors" onclick="event.stopPropagation();mostrarPerfil(${e.id})"><span class="material-symbols-outlined text-base">visibility</span></button></td>
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
  const prom = promedioEmpleado(e.id);
  const cap = capacitaciones.filter(c => c.empleado_id === id).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const evs = evaluaciones.filter(c => c.empleado_id === id).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const pBox = document.getElementById('perfil-content');
  if (pBox) {
    pBox.innerHTML = `
      <div class="flex items-center gap-4 mb-4 pb-4 border-b border-outline-variant/10">
        <div class="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow" style="background:${col}">${ini}</div>
        <div>
          <div class="text-base font-bold text-primary mb-0.5">${e.nombre}</div>
          <div class="text-xs text-on-surface-variant mb-1.5">${e.cargo || '—'} · Depto. ${e.departamento || '—'}</div>
          ${prom !== null ? `<span class="text-amber-500 text-xs">${estrellas(prom)}</span> <span class="text-xs font-bold text-primary">${prom.toFixed(2)}/5</span>` : '<span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset bg-gray-50 text-gray-700 ring-gray-600/20">Sin evaluaciones</span>'}
        </div>
      </div>
      <div class="flex gap-0 border-b border-outline-variant/20 mb-3.5 -mt-1">
        <div class="px-4 py-2 text-xs cursor-pointer border-b-2 -mb-px font-semibold transition-all ${histTab === 'cap' ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-primary'}" onclick="tabHist('cap',this)">Capacitaciones (${cap.length})</div>
        <div class="px-4 py-2 text-xs cursor-pointer border-b-2 -mb-px font-semibold transition-all ${histTab === 'eval' ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-primary'}" onclick="tabHist('eval',this)">Evaluaciones (${evs.length})</div>
      </div>
      <div id="hist-content">${renderHistContent(histTab, cap, evs)}</div>
      <div class="flex gap-2 mt-4 flex-wrap">
        <button class="flex items-center gap-1.5 bg-surface-container-high hover:bg-surface-container-highest text-primary text-[11px] font-bold px-3 py-2 rounded-xl transition-all" onclick="abrirCapacitacion(${id})"><span class="material-symbols-outlined text-sm">workspace_premium</span>Nueva capacitación</button>
        <button class="flex items-center gap-1.5 bg-primary hover:bg-black text-white text-[11px] font-bold px-3 py-2 rounded-xl transition-all active:scale-95" onclick="abrirEvaluacion(${id})"><span class="material-symbols-outlined text-sm">star</span>Nueva evaluación</button>
      </div>`;
  }

  renderTabla();
}

function tabHist(tab, el) {
  histTab = tab;
  const cap = capacitaciones.filter(c => c.empleado_id === empleadoSeleccionado).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const evs = evaluaciones.filter(c => c.empleado_id === empleadoSeleccionado).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  mostrarPerfil(empleadoSeleccionado);
}

function renderHistContent(tab, cap, evs) {
  if (tab === 'cap') {
    if (!cap.length) return `<div class="text-center py-5 text-on-surface-variant text-xs">Sin capacitaciones registradas</div>`;
    return cap.map(c => `
      <div class="flex items-start gap-2.5 py-2 border-b border-outline-variant/10 text-xs last:border-b-0">
        <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-sky-50 text-sky-700"><span class="material-symbols-outlined text-sm">workspace_premium</span></div>
        <div class="flex-1">
          <div class="flex justify-between items-center">
            <span class="font-semibold text-on-surface-variant">${c.nombre}</span>
            ${capBadge(c.estado)}
          </div>
          <div class="text-on-surface-variant opacity-70 mt-0.5">${fmtFecha(c.fecha)} · ${c.horas || 0}h${c.proveedor ? ` · ${c.proveedor}` : ''}</div>
        </div>
      </div>`).join('');
  }
  if (!evs.length) return `<div class="text-center py-5 text-on-surface-variant text-xs">Sin evaluaciones registradas</div>`;
  return evs.map(e => `
    <div class="flex items-start gap-2.5 py-2 border-b border-outline-variant/10 text-xs last:border-b-0">
      <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-50 text-amber-700"><span class="material-symbols-outlined text-sm">star</span></div>
      <div class="flex-1">
        <div class="flex justify-between items-center">
          <span class="font-semibold text-on-surface-variant">Promedio: ${Number(e.promedio).toFixed(2)}/5</span>
          <span class="text-on-surface-variant opacity-70">${fmtFecha(e.fecha)}</span>
        </div>
        <div class="text-on-surface-variant opacity-70 mt-0.5">Puntualidad ${e.puntualidad} · Equipo ${e.trabajo_equipo} · Resultados ${e.resultados} · Liderazgo ${e.liderazgo}</div>
        ${e.comentarios ? `<div class="text-on-surface-variant mt-1 italic">"${e.comentarios}"</div>` : ''}
      </div>
    </div>`).join('');
}

// ── VENCIMIENTOS ──
function renderVencimientos() {
  const wrap = document.getElementById('venc-wrap');
  if (!wrap) return;

  const prox = capacitaciones
    .filter(c => c.fecha_vencimiento)
    .map(c => ({ ...c, dias: diasHasta(c.fecha_vencimiento) }))
    .filter(c => c.dias !== null && c.dias >= 0 && c.dias <= 60)
    .sort((a, b) => a.dias - b.dias);

  if (!prox.length) {
    wrap.innerHTML = `<div class="text-center py-4 text-on-surface-variant text-xs">Sin certificaciones por vencer</div>`;
    return;
  }
  wrap.innerHTML = prox.map(c => {
    const emp = empleados.find(e => e.id === c.empleado_id);
    return `<div class="flex items-start gap-2.5 py-2 border-b border-outline-variant/10 text-xs last:border-b-0">
      <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-red-50 text-red-700"><span class="material-symbols-outlined text-sm">warning</span></div>
      <div>
        <div class="font-semibold text-on-surface-variant">${c.nombre} — ${emp ? emp.nombre : '—'}</div>
        <div class="text-on-surface-variant opacity-70 mt-0.5">Vence en ${c.dias} día${c.dias === 1 ? '' : 's'} · ${fmtFecha(c.fecha_vencimiento)}</div>
      </div>
    </div>`;
  }).join('');
}

// ── SELECTS ──
function llenarSelectsEmpleado() {
  const opts = empleados.map(e => `<option value="${e.id}">${e.nombre} — ${e.cargo || ''}</option>`).join('');
  const sCap = document.getElementById('cap-empleado');
  const sEval = document.getElementById('eval-empleado');
  if (sCap) sCap.innerHTML = opts;
  if (sEval) sEval.innerHTML = opts;
}

// ── STATS ──
function actualizarStats() {
  const proms = empleados.map(e => promedioEmpleado(e.id)).filter(p => p !== null);
  const promGeneral = proms.length ? (proms.reduce((a, b) => a + b, 0) / proms.length) : 0;

  const completadas = capacitaciones.filter(c => c.estado === 'Completado').length;
  const pendientes = capacitaciones.filter(c => c.estado === 'Inscrito' || c.estado === 'En curso').length;
  const totalCap = capacitaciones.length;
  const pct = totalCap ? Math.round((completadas / totalCap) * 100) : 0;

  const ahora = new Date();
  const evalMes = evaluaciones.filter(e => {
    if (!e.fecha) return false;
    const d = new Date(e.fecha);
    return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear();
  });

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('st-promedio', promGeneral ? promGeneral.toFixed(2) : '—');
  set('st-promedio-sub', proms.length ? `sobre 5.0 · ${proms.length} evaluados` : 'Sin evaluaciones aún');
  set('st-cap-comp', completadas);
  set('st-cap-pct', totalCap ? `${pct}% del total (${totalCap})` : 'Sin registros');
  set('st-cap-pend', pendientes);
  set('st-eval-total', evaluaciones.length);
  set('st-eval-mes', evalMes.length ? `+${evalMes.length} este mes` : 'Ninguna este mes');

  const barComp = document.getElementById('bar-cap-comp');
  if (barComp) barComp.style.width = (totalCap ? pct : 0) + '%';
}

// ── RENDER GLOBAL ──
function renderizarTodo() {
  actualizarStats();
  renderFiltrosDeptoLimpio();
  renderTabla();
  renderVencimientos();
  llenarSelectsEmpleado();
  if (empleadoSeleccionado) mostrarPerfil(empleadoSeleccionado);
}

// ── MODAL CAPACITACIÓN ──
function abrirCapacitacion(empId) {
  try {
    document.getElementById('cap-nombre').value = '';
    document.getElementById('cap-proveedor').value = '';
    document.getElementById('cap-horas').value = '';
    document.getElementById('cap-vencimiento').value = '';
    document.getElementById('cap-estado').value = 'Completado';
    document.getElementById('cap-fecha').value = new Date().toISOString().split('T')[0];
    if (empId) document.getElementById('cap-empleado').value = empId;
  } catch (e) { }
  abrirModal('modal-cap');
}

async function guardarCapacitacion() {
  const empId = Number(document.getElementById('cap-empleado').value);
  const nombre = document.getElementById('cap-nombre').value.trim();
  if (!empId || !nombre) { toast('Completa empleado y nombre de la capacitación', 'err'); return; }

  const datos = {
    empleado_id: empId,
    nombre,
    fecha: document.getElementById('cap-fecha').value || null,
    horas: parseInt(document.getElementById('cap-horas').value) || null,
    proveedor: document.getElementById('cap-proveedor').value.trim() || null,
    estado: document.getElementById('cap-estado').value,
    fecha_vencimiento: document.getElementById('cap-vencimiento').value || null,
  };

  const btn = document.getElementById('btn-cap-guardar');
  if (btn) btn.disabled = true;

  if (esDemo()) {
    capacitaciones.unshift({ id: Date.now(), ...datos });
    toast(`Capacitación registrada (demo)`, 'ok');
    renderizarTodo();
    cerrarModal('modal-cap');
    if (btn) btn.disabled = false;
    return;
  }

  const { error } = await db.from('capacitaciones').insert([datos]);
  if (btn) btn.disabled = false;
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  toast('Capacitación registrada', 'ok');
  cerrarModal('modal-cap');
  await cargar();
}

// ── MODAL EVALUACIÓN ──
function abrirEvaluacion(empId) {
  try {
    ['r-punt', 'r-equipo', 'r-result', 'r-lider'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = 4;
      actualizarRating(id);
    });
    document.getElementById('eval-desc').value = '';
    document.getElementById('eval-fecha').value = new Date().toISOString().split('T')[0];
    if (empId) document.getElementById('eval-empleado').value = empId;
  } catch (e) { }
  abrirModal('modal-eval');
}

async function guardarEvaluacion() {
  const empId = Number(document.getElementById('eval-empleado').value);
  if (!empId) { toast('Selecciona un empleado', 'err'); return; }

  // Las columnas de nota son INTEGER (check 1-5) en la DB: redondeamos para evitar
  // errores de inserción si el slider trajera un valor decimal.
  const punt = Math.round(parseFloat(document.getElementById('r-punt').value));
  const equipo = Math.round(parseFloat(document.getElementById('r-equipo').value));
  const result = Math.round(parseFloat(document.getElementById('r-result').value));
  const lider = Math.round(parseFloat(document.getElementById('r-lider').value));
  const promedio = Number(((punt + equipo + result + lider) / 4).toFixed(2));

  const datos = {
    empleado_id: empId,
    fecha: document.getElementById('eval-fecha').value || new Date().toISOString().split('T')[0],
    puntualidad: punt, trabajo_equipo: equipo, resultados: result, liderazgo: lider,
    promedio,
    comentarios: document.getElementById('eval-desc').value.trim() || null,
  };

  const btn = document.getElementById('btn-eval-guardar');
  if (btn) btn.disabled = true;

  if (esDemo()) {
    evaluaciones.unshift({ id: Date.now(), ...datos });
    toast('Evaluación registrada (demo)', 'ok');
    renderizarTodo();
    cerrarModal('modal-eval');
    if (btn) btn.disabled = false;
    return;
  }

  const { error } = await db.from('evaluaciones').insert([datos]);
  if (btn) btn.disabled = false;
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  toast('Evaluación registrada', 'ok');
  cerrarModal('modal-eval');
  await cargar();
}

function promedioEmpleado(id) {
  const evs = evaluaciones.filter(e => e.empleado_id === id);
  if (!evs.length) return null;
  return evs.reduce((a, e) => a + Number(e.promedio || 0), 0) / evs.length;
}

function esDemo() { return modoDemoActivo; }

function abrirModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function cerrarModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

// ── INICIO ──
async function iniciar() {
  try {
    const dCap = document.getElementById('cap-fecha');
    const dEval = document.getElementById('eval-fecha');
    if (dCap) dCap.value = new Date().toISOString().split('T')[0];
    if (dEval) dEval.value = new Date().toISOString().split('T')[0];
  } catch (e) { }

  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  const st = document.getElementById('db-status');

  try {
    const { error } = await db.from('empleados').select('id').limit(1);
    if (error) throw error;

    if (dot) dot.style.background = '#22C55E';
    if (txt) txt.textContent = 'Conectado a Supabase';
    if (st) setTimeout(() => st.classList.add('opacity-0', 'pointer-events-none'), 2000);

    await cargar();
    suscribirRealtime();
  } catch (err) {
    console.error('Fallo de conexión o base de datos vacía, activando fallback demo:', err);
    modoDemoActivo = true;
    if (dot) dot.style.background = '#F59E0B';
    if (txt) txt.textContent = 'Modo demo — Fallback activo';
    if (st) setTimeout(() => st.classList.add('opacity-0', 'pointer-events-none'), 4000);
    cargarDatosDemo();
    renderizarTodo();
  }
}

async function cargar() {
  try {
    const [e, c, ev] = await Promise.all([
      db.from('empleados').select('*'),
      db.from('capacitaciones').select('*').order('fecha', { ascending: false }),
      db.from('evaluaciones').select('*').order('fecha', { ascending: false }),
    ]);

    empleados = e.data || [];
    capacitaciones = c.data || [];
    evaluaciones = ev.data || [];

    if (empleados.length === 0) {
      cargarDatosDemo();
    }

    renderizarTodo();
  } catch (err) {
    console.error('Error cargando colecciones:', err);
    modoDemoActivo = true;
    cargarDatosDemo();
    renderizarTodo();
  }
}

function suscribirRealtime() {
  if (!db) return;
  db.channel('desarrollo')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'capacitaciones' }, () => cargar())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'evaluaciones' }, () => cargar())
    .subscribe();
}

// ── DATOS DEMO ──
function cargarDatosDemo() {
  empleados = [
    { id: 1, nombre: 'Ana García', cargo: 'Gerente RRHH', departamento: 'RRHH', estado: 'Activo' },
    { id: 2, nombre: 'Carlos Mora', cargo: 'Analista TI', departamento: 'TI', estado: 'Activo' },
    { id: 3, nombre: 'Lucía Pérez', cargo: 'Diseñadora', departamento: 'Marketing', estado: 'Activo' },
    { id: 4, nombre: 'Roberto Sánchez', cargo: 'Dev Backend', departamento: 'TI', estado: 'Activo' },
    { id: 5, nombre: 'María Jiménez', cargo: 'Contadora', departamento: 'Finanzas', estado: 'Activo' },
    { id: 6, nombre: 'Diego Vargas', cargo: 'Vendedor', departamento: 'Comercial', estado: 'Activo' },
    { id: 7, nombre: 'Patricia López', cargo: 'Asistente RRHH', departamento: 'RRHH', estado: 'Activo' },
    { id: 8, nombre: 'Fernando Ruiz', cargo: 'Supervisor', departamento: 'Operaciones', estado: 'Activo' },
  ];
  capacitaciones = [
    { id: 1, empleado_id: 4, nombre: 'Seguridad Industrial', fecha: '2026-03-15', horas: 8, proveedor: 'Instituto Nacional', estado: 'Completado' },
    { id: 2, empleado_id: 4, nombre: 'Excel Avanzado', fecha: '2026-01-10', horas: 16, proveedor: 'Capacita Panamá', estado: 'Completado' },
    { id: 3, empleado_id: 2, nombre: 'Ciberseguridad', fecha: '2026-02-20', horas: 24, proveedor: 'ISACA', estado: 'Completado' },
    { id: 4, empleado_id: 2, nombre: 'AWS Cloud Practitioner', fecha: '2026-06-10', horas: 12, proveedor: 'AWS Academy', estado: 'En curso' },
    { id: 5, empleado_id: 6, nombre: 'Técnicas de Venta Consultiva', fecha: '2026-05-02', horas: 6, proveedor: 'Capacita Panamá', estado: 'Inscrito' },
    { id: 6, empleado_id: 3, nombre: 'Adobe Creative Cloud', fecha: '2025-11-20', horas: 10, proveedor: 'Adobe', estado: 'Completado' },
  ];
  evaluaciones = [
    { id: 1, empleado_id: 4, fecha: '2026-04-01', puntualidad: 4.5, trabajo_equipo: 4.0, resultados: 4.2, liderazgo: 4.0, promedio: 4.18, comentarios: 'Buen desempeño técnico' },
    { id: 2, empleado_id: 4, fecha: '2025-12-01', puntualidad: 4.0, trabajo_equipo: 3.8, resultados: 4.0, liderazgo: 3.8, promedio: 3.90, comentarios: null },
    { id: 3, empleado_id: 2, fecha: '2026-04-01', puntualidad: 4.8, trabajo_equipo: 4.5, resultados: 4.3, liderazgo: 4.0, promedio: 4.40, comentarios: 'Excelente proactividad' },
    { id: 4, empleado_id: 6, fecha: '2026-03-15', puntualidad: 3.5, trabajo_equipo: 4.0, resultados: 3.8, liderazgo: 3.0, promedio: 3.58, comentarios: null },
  ];
}

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

// ── REGISTRO SEGURO EN EL OBJETO WINDOW (para los onclick del HTML) ──
window.renderTabla = renderTabla;
window.abrirCapacitacion = abrirCapacitacion;
window.guardarCapacitacion = guardarCapacitacion;
window.abrirEvaluacion = abrirEvaluacion;
window.guardarEvaluacion = guardarEvaluacion;
window.cerrarModal = cerrarModal;
window.filtrarPor = filtrarPor;
window.mostrarPerfil = mostrarPerfil;
window.tabHist = tabHist;
window.actualizarRating = actualizarRating;

// ── ARRANCAR ──
iniciar();