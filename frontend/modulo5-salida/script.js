import { supabase } from '../supabase-client.js';
const db = supabase;

// ── ESTADO ──
// "bajas" contiene las filas de la tabla real `salidas` (empleado_id, fecha_salida,
// motivo, porque_se_va, mejoraria, recomendaria, observaciones y los 4 booleanos
// de checklist). No existen tablas separadas de entrevista/checklist.
let empleados = [];
let bajas = [];
let filtroTipo = 'todos';
let ordenActual = 'fecha-desc';
let bajaSeleccionada = null;
let perfilTab = 'info';
let entrevistaBajaId = null;
let cargando = true;
let modoDemoActivo = false;
const TIPOS = ['Renuncia', 'Despido', 'Jubilación', 'Fin de contrato', 'Otro'];
let tipoBajaSel = 'Renuncia';

// checklist de offboarding: 4 columnas booleanas reales de `salidas`
const CHECKLIST_ITEMS = [
  { key: 'equipo_entregado', label: 'Equipo entregado', icon: 'laptop_mac' },
  { key: 'accesos_revocados', label: 'Accesos revocados', icon: 'lock' },
  { key: 'liquidacion_firmada', label: 'Liquidación firmada', icon: 'fact_check' },
  { key: 'entrevista_realizada', label: 'Entrevista de salida realizada', icon: 'forum' },
];
function estadoOffboarding(b) {
  const done = CHECKLIST_ITEMS.filter(it => b[it.key]).length;
  if (done === 0) return 'Pendiente';
  if (done === CHECKLIST_ITEMS.length) return 'Completado';
  return 'En proceso';
}

// ── HELPERS ──
const AV_COLORS = ['#8B5CF6', '#3B82F6', '#EC4899', '#0EA5E9', '#10B981', '#F59E0B', '#6366F1', '#14B8A6', '#EF4444', '#F97316'];
function avColor(id) { return AV_COLORS[(id || 0) % AV_COLORS.length]; }
function iniciales(nombre) { return (nombre || '??').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase(); }
function fmtFecha(iso) { if (!iso) return '—'; const d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }); }

function fmtRel(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  const hoy = new Date(); hoy.setHours(12, 0, 0, 0);
  const dias = Math.round((d - hoy) / 86400000);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias === -1) return 'ayer';
  if (dias > 0) return dias > 60 ? `en ${Math.round(dias / 30)} meses` : `en ${dias} días`;
  const abs = -dias;
  return abs > 60 ? `hace ${Math.round(abs / 30)} meses` : `hace ${abs} días`;
}

function badge(text, cls) { return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${cls}">${text}</span>`; }

function tipoBadge(tipo) {
  const m = { 'Renuncia': 'bg-sky-50 text-sky-700 ring-sky-600/20', 'Despido': 'bg-red-50 text-red-700 ring-red-600/20', 'Jubilación': 'bg-purple-50 text-purple-700 ring-purple-600/20', 'Fin de contrato': 'bg-orange-50 text-orange-700 ring-orange-600/20', 'Otro': 'bg-gray-50 text-gray-700 ring-gray-600/20' };
  return badge(tipo || 'Sin especificar', m[tipo] || 'bg-gray-50 text-gray-700 ring-gray-600/20');
}

function offBadge(estado) {
  const m = { 'Pendiente': 'bg-amber-50 text-amber-700 ring-amber-600/20', 'En proceso': 'bg-orange-50 text-orange-700 ring-orange-600/20', 'Completado': 'bg-green-50 text-green-700 ring-green-600/20' };
  return badge(estado, m[estado] || 'bg-gray-50 text-gray-700 ring-gray-600/20');
}

function calcAntiguedad(fechaIngreso, fechaSalida) {
  if (!fechaIngreso) return '—';
  const ini = new Date(fechaIngreso + 'T12:00:00');
  const fin = fechaSalida ? new Date(fechaSalida + 'T12:00:00') : new Date();
  const diff = fin - ini;
  const anios = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  const meses = Math.floor((diff % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
  if (anios > 0) return `${anios} año${anios > 1 ? 's' : ''} ${meses} mes${meses !== 1 ? 'es' : ''}`;
  return `${meses} mes${meses !== 1 ? 'es' : ''}`;
}

// contador animado para stats
const statPrev = {};
function animarNumero(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const from = statPrev[id] ?? 0;
  statPrev[id] = target;
  if (from === target) { el.textContent = target; return; }
  const dur = 600, t0 = performance.now();
  function tick(t) {
    const p = Math.min((t - t0) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (target - from) * eased);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// mini gráfico de barras: bajas de los últimos 6 meses (hero)
function renderMiniChart() {
  const box = document.getElementById('mini-chart');
  if (!box) return;
  const hoy = new Date();
  const meses = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({ y: d.getFullYear(), m: d.getMonth(), lbl: d.toLocaleDateString('es', { month: 'narrow' }) });
  }
  const counts = meses.map(mm => bajas.filter(b => {
    if (!b.fecha_salida) return false;
    const d = new Date(b.fecha_salida + 'T12:00:00');
    return d.getMonth() === mm.m && d.getFullYear() === mm.y;
  }).length);
  const max = Math.max(...counts, 1);
  box.innerHTML = meses.map((mm, i) =>
    `<div class="flex-1 flex flex-col items-center gap-1 h-full justify-end" title="${counts[i]} baja${counts[i] !== 1 ? 's' : ''} — ${mm.lbl.toUpperCase()}">
      <div class="w-full max-w-[16px] rounded-t bg-sky-400/80" style="height:${Math.max(counts[i] / max * 44, 3)}px"></div>
      <span class="text-[9px] text-on-surface-variant font-bold uppercase">${mm.lbl}</span>
    </div>`).join('');
}

// gráfico grande: bajas de los últimos 12 meses
function renderHistorico() {
  const box = document.getElementById('hist-chart');
  const foot = document.getElementById('hist-foot');
  if (!box) return;
  const hoy = new Date();
  const meses = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({ y: d.getFullYear(), m: d.getMonth(), lbl: d.toLocaleDateString('es', { month: 'short' }).replace('.', '') });
  }
  const counts = meses.map(mm => bajas.filter(b => {
    if (!b.fecha_salida) return false;
    const d = new Date(b.fecha_salida + 'T12:00:00');
    return d.getMonth() === mm.m && d.getFullYear() === mm.y;
  }).length);
  const max = Math.max(...counts, 1);
  box.innerHTML = meses.map((mm, i) =>
    `<div class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end min-w-0" title="${counts[i]} baja${counts[i] !== 1 ? 's' : ''} — ${mm.lbl.toUpperCase()} ${mm.y}">
      <div class="w-full max-w-[24px] rounded-t bg-sky-400/80" style="height:${Math.max(counts[i] / max * 130, 3)}px"></div>
      <span class="text-[9px] text-on-surface-variant font-bold uppercase whitespace-nowrap">${mm.lbl}</span>
    </div>`).join('');

  if (foot) {
    const totalPeriodo = counts.reduce((a, b) => a + b, 0);
    const promedioMes = (totalPeriodo / 12).toFixed(1);
    const hayDatos = counts.some(c => c > 0);
    const picoIdx = counts.indexOf(max);
    const mesPico = (hayDatos && picoIdx >= 0) ? meses[picoIdx].lbl.toUpperCase() : '—';
    foot.innerHTML = `
      <div><div class="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-0.5">Total período</div><div class="text-xl font-extrabold text-primary tabular-nums">${totalPeriodo}</div></div>
      <div><div class="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-0.5">Promedio mensual</div><div class="text-xl font-extrabold text-primary tabular-nums">${promedioMes}</div></div>
      <div><div class="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-0.5">Mes con más bajas</div><div class="text-base font-extrabold text-primary">${mesPico}</div></div>`;
  }
}

// desglose por motivo de salida
const MOTIVO_COLORS = { 'Renuncia': '#2563EB', 'Despido': '#DC2626', 'Jubilación': '#7C3AED', 'Fin de contrato': '#EA580C', 'Otro': '#9AA4BB' };
function renderMotivos() {
  const box = document.getElementById('motivos-list');
  if (!box) return;
  const total = bajas.length;
  if (!total) {
    box.innerHTML = `<div class="text-center py-6 text-on-surface-variant"><span class="material-symbols-outlined text-2xl block mb-2 opacity-40">donut_large</span><p class="text-xs">Sin bajas registradas todavía</p></div>`;
    return;
  }
  const filas = TIPOS.map(t => ({ tipo: t, n: bajas.filter(b => b.motivo === t).length }))
    .filter(f => f.n > 0)
    .sort((a, b) => b.n - a.n);

  box.innerHTML = filas.map(f => {
    const pct = Math.round(f.n / total * 100);
    const color = MOTIVO_COLORS[f.tipo] || '#9AA4BB';
    return `<div class="flex items-center gap-2.5 py-2">
      <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${color}"></span>
      <span class="text-xs font-semibold text-on-surface-variant w-28 flex-shrink-0">${f.tipo}</span>
      <div class="flex-1 h-2 bg-surface-container-high rounded-full overflow-hidden"><div class="h-full rounded-full" style="width:${pct}%;background:${color}"></div></div>
      <span class="text-xs font-bold text-primary w-14 text-right tabular-nums">${f.n} · ${pct}%</span>
    </div>`;
  }).join('');

  // % que recomendaría la empresa (campo `recomendaria` de `salidas`)
  const foot = document.getElementById('motivo-foot');
  if (!foot) return;
  const conEntrevista = bajas.filter(b => b.recomendaria);
  if (!conEntrevista.length) {
    foot.innerHTML = `<div class="text-[11px] text-on-surface-variant font-semibold">Aún no hay entrevistas de salida registradas</div>`;
    return;
  }
  const recomiendan = conEntrevista.filter(b => (b.recomendaria || '').toLowerCase().startsWith('s')).length;
  const pctRec = Math.round(recomiendan / conEntrevista.length * 100);
  const colorClass = pctRec >= 70 ? 'text-green-600' : pctRec >= 40 ? 'text-amber-600' : 'text-red-600';
  foot.innerHTML = `
    <div>
      <div class="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Recomendarían la empresa</div>
      <div class="text-[11px] text-on-surface-variant mt-0.5">${recomiendan} de ${conEntrevista.length} entrevistas de salida</div>
    </div>
    <div class="text-2xl font-extrabold tabular-nums ${colorClass}">${pctRec}%</div>`;
}

// ── TIPO DE BAJA (segmentado) ──
function selTipo(el) {
  tipoBajaSel = el.dataset.tipo;
  document.querySelectorAll('#tipo-grid .tipo-opt').forEach(o => {
    o.classList.remove('border-primary', 'bg-primary/5');
    o.classList.add('border-outline-variant/30');
    o.querySelector('span.material-symbols-outlined')?.classList.remove('text-primary');
    o.querySelector('span.material-symbols-outlined')?.classList.add('text-on-surface-variant');
    o.querySelector('span:last-child')?.classList.remove('text-primary');
    o.querySelector('span:last-child')?.classList.add('text-on-surface-variant');
  });
  el.classList.remove('border-outline-variant/30');
  el.classList.add('border-primary', 'bg-primary/5');
  el.querySelector('span.material-symbols-outlined')?.classList.remove('text-on-surface-variant');
  el.querySelector('span.material-symbols-outlined')?.classList.add('text-primary');
  el.querySelector('span:last-child')?.classList.remove('text-on-surface-variant');
  el.querySelector('span:last-child')?.classList.add('text-primary');
}

// ── FILTROS / BÚSQUEDA / ORDEN ──
function filtrarPor(tipo) {
  filtroTipo = tipo;
  renderChips();
  renderTabla();
}

function renderChips() {
  const row = document.getElementById('filter-row');
  if (!row) return;
  const conteo = t => t === 'todos' ? bajas.length : bajas.filter(b => b.motivo === t).length;
  const activeClass = 'bg-primary text-white shadow-sm';
  const idleClass = 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest';
  const chip = (t, lbl) => `<button class="chip px-3 py-1 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${filtroTipo === t ? activeClass : idleClass}" onclick="filtrarPor('${t}')">${lbl}<span class="text-[10px] font-extrabold rounded-full px-1.5 min-w-[16px] text-center ${filtroTipo === t ? 'bg-white/25 text-white' : 'bg-surface-container-highest text-on-surface-variant'}">${conteo(t)}</span></button>`;
  row.innerHTML = `<span class="text-xs text-on-surface-variant font-medium mr-1">Tipo:</span>` +
    chip('todos', 'Todos') + TIPOS.map(t => chip(t, t)).join('');
}

let debounceTimer = null;
function onBuscar() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(renderTabla, 160);
}

function cambiarOrden(v) { ordenActual = v; renderTabla(); }

// ── TABLA ──
function filaCargando(cols) {
  return `<tr><td colspan="${cols}" class="py-10 text-center"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div></td></tr>`;
}

function renderTabla() {
  const tbody = document.getElementById('tbody');
  if (!tbody) return;

  if (cargando) { tbody.innerHTML = filaCargando(5); return; }

  const sInp = document.getElementById('search-input');
  const busqueda = (sInp ? sInp.value : '').toLowerCase().trim();

  let lista = bajas.filter(b => {
    const emp = empleados.find(e => e.id === b.empleado_id);
    const nombre = emp ? emp.nombre.toLowerCase() : '';
    const matchT = filtroTipo === 'todos' || b.motivo === filtroTipo;
    const matchB = !busqueda || nombre.includes(busqueda) || (b.porque_se_va || '').toLowerCase().includes(busqueda);
    return matchT && matchB;
  });

  const pctDe = b => Math.round(CHECKLIST_ITEMS.filter(it => b[it.key]).length / CHECKLIST_ITEMS.length * 100);
  const nombreDe = b => (empleados.find(e => e.id === b.empleado_id)?.nombre) || '';

  lista.sort((a, b) => {
    switch (ordenActual) {
      case 'fecha-asc': return new Date(a.fecha_salida) - new Date(b.fecha_salida);
      case 'nombre': return nombreDe(a).localeCompare(nombreDe(b), 'es');
      case 'progreso': return pctDe(a) - pctDe(b);
      default: return new Date(b.fecha_salida) - new Date(a.fecha_salida);
    }
  });

  const pill = document.getElementById('tbl-count');
  if (pill) pill.textContent = lista.length;

  if (!lista.length) {
    const conBusqueda = busqueda || filtroTipo !== 'todos';
    tbody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-on-surface-variant text-sm">
      <span class="material-symbols-outlined text-2xl block opacity-40 mb-1">${conBusqueda ? 'filter_alt_off' : 'group_remove'}</span>
      ${conBusqueda ? 'Sin resultados con los filtros actuales' : 'Sin bajas registradas'}
      ${conBusqueda ? '<br><button class="mt-2.5 flex items-center gap-1 mx-auto bg-surface-container-high hover:bg-surface-container-highest text-primary text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all" onclick="resetFiltros()"><span class="material-symbols-outlined text-sm">restart_alt</span>Limpiar filtros</button>' : ''}
    </td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(b => {
    const emp = empleados.find(e => e.id === b.empleado_id);
    const nombre = emp ? emp.nombre : 'Empleado #' + b.empleado_id;
    const cargo = emp ? emp.cargo : '';
    const ini = iniciales(nombre);
    const col = avColor(b.empleado_id);
    const pct = pctDe(b);
    const isSelected = bajaSeleccionada === b.id;

    return `<tr onclick="seleccionarBaja(${b.id})" class="cursor-pointer border-b border-outline-variant/10 text-xs hover:bg-surface-container-low/40 transition-colors ${isSelected ? 'bg-primary/5' : ''}">
      <td class="py-3 pl-2">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-[11px] shadow-sm flex-shrink-0" style="background:${col}">${ini}</div>
          <div>
            <div class="font-bold text-primary">${nombre}</div>
            <div class="text-[10px] text-on-surface-variant opacity-80">${cargo}</div>
          </div>
        </div>
      </td>
      <td class="py-3">${tipoBadge(b.motivo)}</td>
      <td class="py-3">
        <div class="font-bold text-primary">${fmtFecha(b.fecha_salida)}</div>
        <div class="text-[10px] text-on-surface-variant">${fmtRel(b.fecha_salida)}</div>
      </td>
      <td class="py-3">
        <div class="flex items-center gap-2">
          ${offBadge(estadoOffboarding(b))}
          <div class="w-12 h-1.5 bg-surface-container-high rounded-full overflow-hidden"><div class="h-full rounded-full" style="width:${pct}%;background:${pct === 100 ? '#16A34A' : '#2563EB'}"></div></div>
          <span class="text-[10px] text-on-surface-variant font-bold tabular-nums">${pct}%</span>
        </div>
      </td>
      <td class="py-3 pr-2 text-right"><button class="w-7 h-7 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors" title="Ver expediente" onclick="event.stopPropagation();seleccionarBaja(${b.id})"><span class="material-symbols-outlined text-base">chevron_right</span></button></td>
    </tr>`;
  }).join('');
}

function resetFiltros() {
  filtroTipo = 'todos';
  const inp = document.getElementById('search-input');
  if (inp) inp.value = '';
  onBuscar();
  renderChips();
  renderTabla();
}

// ── PERFIL / DETALLE ──
function seleccionarBaja(id) {
  if (bajaSeleccionada !== id) perfilTab = 'info';
  bajaSeleccionada = id;
  renderPerfil();
  renderTabla();
  if (window.innerWidth <= 1200) {
    document.getElementById('perfil-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function ringSVG(pct) {
  const r = 24, c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  const color = pct === 100 ? '#16A34A' : '#2563EB';
  return `<div class="relative w-[58px] h-[58px] flex-shrink-0" title="Progreso de offboarding">
    <svg width="58" height="58" viewBox="0 0 58 58" style="transform:rotate(-90deg)">
      <circle cx="29" cy="29" r="${r}" fill="none" stroke="#EDF1F8" stroke-width="5"></circle>
      <circle cx="29" cy="29" r="${r}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" style="transition:stroke-dashoffset .8s"></circle>
    </svg>
    <div class="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-primary">${pct}%</div>
  </div>`;
}

function renderPerfil() {
  const b = bajas.find(x => x.id === bajaSeleccionada);
  if (!b) return;

  const emp = empleados.find(e => e.id === b.empleado_id);
  const nombre = emp ? emp.nombre : 'Empleado #' + b.empleado_id;
  const cargo = emp ? emp.cargo : '—';
  const depto = emp ? emp.departamento : '—';
  const ini = iniciales(nombre);
  const col = avColor(b.empleado_id);

  const tieneEntrevista = !!b.porque_se_va;
  const ckDone = CHECKLIST_ITEMS.filter(it => b[it.key]).length;
  const ckTotal = CHECKLIST_ITEMS.length;
  const pct = Math.round((ckDone / ckTotal) * 100);

  const pBox = document.getElementById('perfil-content');
  if (!pBox) return;

  const tabCls = t => `px-3 py-2 text-[11px] cursor-pointer border-b-2 -mb-px font-semibold transition-all flex items-center gap-1 ${perfilTab === t ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-primary'}`;

  pBox.innerHTML = `
    <div class="flex items-center gap-3.5 mb-4">
      <div class="w-[52px] h-[52px] rounded-2xl flex items-center justify-center font-bold text-white text-base shadow flex-shrink-0" style="background:${col}">${ini}</div>
      <div class="flex-1 min-w-0">
        <div class="text-base font-bold text-primary mb-0.5 truncate">${nombre}</div>
        <div class="text-xs text-on-surface-variant mb-1.5 truncate">${cargo} · ${depto}</div>
        <div class="flex gap-1.5 flex-wrap">${tipoBadge(b.motivo)}${offBadge(estadoOffboarding(b))}</div>
      </div>
      ${ringSVG(pct)}
    </div>
    <div class="flex gap-0 border-b border-outline-variant/20 mb-3.5">
      <div class="${tabCls('info')}" onclick="cambiarTab('info')"><span class="material-symbols-outlined text-sm">badge</span>Información</div>
      <div class="${tabCls('entrevista')}" onclick="cambiarTab('entrevista')"><span class="material-symbols-outlined text-sm">forum</span>Entrevista ${tieneEntrevista ? '✓' : ''}</div>
      <div class="${tabCls('checklist')}" onclick="cambiarTab('checklist')"><span class="material-symbols-outlined text-sm">checklist</span>Checklist ${ckDone}/${ckTotal}</div>
    </div>
    <div id="tab-content" class="min-h-[80px]">${renderTabContent(b, emp, tieneEntrevista, pct)}</div>
    <div class="flex gap-2 mt-4 flex-wrap">
      ${!tieneEntrevista ? `<button class="flex items-center gap-1.5 bg-surface-container-high hover:bg-surface-container-highest text-primary text-[11px] font-bold px-3 py-2 rounded-xl transition-all" onclick="abrirEntrevista(${b.id})"><span class="material-symbols-outlined text-sm">forum</span>Entrevista de salida</button>` : ''}
      <button class="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold px-3 py-2 rounded-xl transition-all" onclick="confirmarEliminar(${b.id})"><span class="material-symbols-outlined text-sm">delete</span>Eliminar baja</button>
    </div>`;
}

function cambiarTab(tab) {
  perfilTab = tab;
  renderPerfil();
}

function renderTabContent(b, emp, tieneEntrevista, pct) {
  if (perfilTab === 'info') {
    return `
      <div class="flex justify-between py-1.5 text-xs gap-3"><span class="text-on-surface-variant">Fecha de ingreso</span><span class="font-semibold text-primary text-right">${fmtFecha(emp?.fecha_ingreso)}</span></div>
      <div class="flex justify-between py-1.5 text-xs gap-3"><span class="text-on-surface-variant">Fecha de salida</span><span class="font-semibold text-primary text-right">${fmtFecha(b.fecha_salida)} <span class="text-on-surface-variant font-normal">(${fmtRel(b.fecha_salida)})</span></span></div>
      <div class="flex justify-between py-1.5 text-xs gap-3"><span class="text-on-surface-variant">Antigüedad</span><span class="font-semibold text-primary text-right">${calcAntiguedad(emp?.fecha_ingreso, b.fecha_salida)}</span></div>
      <div class="flex justify-between py-1.5 text-xs gap-3"><span class="text-on-surface-variant">Tipo de baja</span><span class="font-semibold text-primary text-right">${b.motivo}</span></div>
      <div class="flex justify-between py-1.5 text-xs gap-3"><span class="text-on-surface-variant">Offboarding</span><span class="text-right">${offBadge(estadoOffboarding(b))}</span></div>
      ${b.observaciones ? `<div class="mt-3 p-3 bg-surface-container-low rounded-xl text-xs text-on-surface-variant"><strong class="text-primary"><span class="material-symbols-outlined text-xs align-middle">sticky_note_2</span> Observaciones:</strong><br>${b.observaciones}</div>` : ''}`;
  }

  if (perfilTab === 'entrevista') {
    if (!tieneEntrevista) {
      return `<div class="text-center py-6 text-on-surface-variant">
        <span class="material-symbols-outlined text-2xl block mb-2 opacity-40">forum</span>
        <p class="text-xs">No se ha realizado entrevista de salida</p>
        <button class="mt-3 flex items-center gap-1 mx-auto bg-surface-container-high hover:bg-surface-container-highest text-primary text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all" onclick="abrirEntrevista(${b.id})"><span class="material-symbols-outlined text-sm">forum</span>Registrar entrevista</button>
      </div>`;
    }

    const recomienda = (b.recomendaria || '').toLowerCase().startsWith('s');

    return `
      <div class="mb-3.5">
        <div class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">¿Por qué se va?</div>
        <div class="p-3 bg-surface-container-low rounded-xl text-xs text-on-surface-variant font-medium">${b.porque_se_va || '—'}</div>
      </div>
      <div class="flex justify-between py-1.5 text-xs gap-3"><span class="text-on-surface-variant">¿Recomendaría la empresa?</span><span class="text-right">${b.recomendaria ? (recomienda ? badge('Sí', 'bg-green-50 text-green-700 ring-green-600/20') : badge('No', 'bg-red-50 text-red-700 ring-red-600/20')) : '—'}</span></div>
      ${b.mejoraria ? `<div class="mt-2.5"><div class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Qué mejoraría</div><div class="p-3 bg-amber-50 rounded-xl text-xs text-amber-800 italic font-medium">"${b.mejoraria}"</div></div>` : ''}`;
  }

  if (perfilTab === 'checklist') {
    return `
      <div class="flex items-center gap-2.5 mb-3">
        <div class="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden"><div class="h-full rounded-full transition-all" style="width:${pct}%;background:${pct === 100 ? '#16A34A' : '#2563EB'}"></div></div>
        <span class="text-xs font-bold tabular-nums" style="color:${pct === 100 ? '#16A34A' : '#2563EB'}">${pct}%</span>
      </div>
      ${pct === 100 ? `<div class="flex items-center gap-2 px-3 py-2.5 bg-green-50 rounded-xl mb-2.5 text-xs text-green-800 font-semibold"><span class="material-symbols-outlined text-base">celebration</span>¡Offboarding completado!</div>` : ''}
      ${CHECKLIST_ITEMS.map(it => `
        <div class="flex items-center gap-2.5 py-2 rounded-xl transition-all hover:bg-surface-container-low ${b[it.key] ? 'opacity-55' : ''}">
          <button class="w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${b[it.key] ? 'bg-green-600 border-green-600' : 'border-outline-variant/50 hover:border-primary'}" onclick="toggleCheck(${b.id}, '${it.key}', ${!b[it.key]})" title="${b[it.key] ? 'Marcar pendiente' : 'Marcar completado'}">
            ${b[it.key] ? '<span class="material-symbols-outlined text-white text-sm">check</span>' : ''}
          </button>
          <span class="material-symbols-outlined text-base text-on-surface-variant">${it.icon}</span>
          <span class="text-xs text-on-surface-variant font-medium flex-1 ${b[it.key] ? 'line-through' : ''}">${it.label}</span>
        </div>`).join('')}`;
  }

  return '';
}

// ── CONFETTI (al completar offboarding) ──
function lanzarConfetti() {
  const colores = ['#2563EB', '#16A34A', '#F59E0B', '#EC4899', '#8B5CF6', '#F97316'];
  for (let i = 0; i < 36; i++) {
    const c = document.createElement('div');
    c.className = 'confetti-piece';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = colores[i % colores.length];
    c.style.animationDuration = (1.4 + Math.random() * 1.4) + 's';
    c.style.animationDelay = (Math.random() * .3) + 's';
    c.style.width = c.style.height = (5 + Math.random() * 6) + 'px';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 3200);
  }
}

// ── TOGGLE CHECKLIST (booleanos directos de la fila `salidas`) ──
async function toggleCheck(bajaId, key, nuevoEstado) {
  const b = bajas.find(x => x.id === bajaId);
  if (!b) return;
  const antes = CHECKLIST_ITEMS.filter(it => b[it.key]).length;

  if (esDemo()) {
    b[key] = nuevoEstado;
    celebrarSiCompleto(b, antes);
    renderizarTodo();
    return;
  }

  const { error } = await db.from('salidas').update({ [key]: nuevoEstado }).eq('id', bajaId);
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  b[key] = nuevoEstado;
  celebrarSiCompleto(b, antes);
  await cargar();
}

function celebrarSiCompleto(b, antes) {
  if (!b) return;
  const done = CHECKLIST_ITEMS.filter(it => b[it.key]).length;
  if (done === CHECKLIST_ITEMS.length && antes < CHECKLIST_ITEMS.length) {
    lanzarConfetti();
    toast('¡Offboarding completado!', 'ok');
  }
}

// ── MODAL BAJA ──
function abrirModalBaja() {
  try {
    document.getElementById('baja-obs').value = '';
    document.getElementById('baja-fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-baja-title').textContent = 'Registrar baja de empleado';
    tipoBajaSel = 'Renuncia';
    const primerChip = document.querySelector('#tipo-grid .tipo-opt[data-tipo="Renuncia"]');
    if (primerChip) selTipo(primerChip);
  } catch (e) {}
  llenarSelectEmpleados();
  abrirModal('modal-baja');
}

async function guardarBaja() {
  const empId = Number(document.getElementById('baja-empleado').value);
  const fecha = document.getElementById('baja-fecha').value;
  if (!empId || !fecha) { toast('Completa empleado y fecha de salida', 'err'); return; }

  const datos = {
    empleado_id: empId,
    motivo: tipoBajaSel,
    fecha_salida: fecha,
    observaciones: document.getElementById('baja-obs').value.trim() || null,
  };

  const btn = document.getElementById('btn-baja-guardar');
  if (btn) btn.disabled = true;

  if (esDemo()) {
    const nueva = { id: Date.now(), equipo_entregado: false, accesos_revocados: false, liquidacion_firmada: false, entrevista_realizada: false, ...datos };
    bajas.unshift(nueva);
    toast('Baja registrada (demo)', 'ok');
    bumpBadge();
    cerrarModal('modal-baja');
    renderizarTodo();
    seleccionarBaja(nueva.id);
    if (btn) btn.disabled = false;
    return;
  }

  const { data, error } = await db.from('salidas').insert([datos]).select();
  if (btn) btn.disabled = false;
  if (error) { toast('Error: ' + error.message, 'err'); return; }

  toast('Baja registrada correctamente', 'ok');
  bumpBadge();
  cerrarModal('modal-baja');
  await cargar();
  if (data && data[0]) seleccionarBaja(data[0].id);
}

function bumpBadge() {
  const el = document.getElementById('badge-bajas');
  if (!el) return;
  el.classList.add('scale-125');
  setTimeout(() => el.classList.remove('scale-125'), 350);
}

// ── MODAL ENTREVISTA ──
function abrirEntrevista(bajaId) {
  entrevistaBajaId = bajaId;
  try {
    document.getElementById('ent-motivo').value = '';
    document.getElementById('ent-sugerencias').value = '';
    document.getElementById('ent-recomienda').value = 'Sí';
    const b = bajas.find(x => x.id === bajaId);
    const emp = empleados.find(e => e.id === b?.empleado_id);
    const desc = document.getElementById('ent-desc');
    if (desc && emp) desc.textContent = `Retroalimentación de ${emp.nombre} antes de su salida.`;
  } catch (e) {}
  abrirModal('modal-entrevista');
}

async function guardarEntrevista() {
  const motivo = document.getElementById('ent-motivo').value.trim();
  if (!motivo) { toast('Indica por qué se va el empleado', 'err'); return; }

  const datos = {
    porque_se_va: motivo,
    mejoraria: document.getElementById('ent-sugerencias').value.trim() || null,
    recomendaria: document.getElementById('ent-recomienda').value,
    entrevista_realizada: true
  };

  const btn = document.getElementById('btn-ent-guardar');
  if (btn) btn.disabled = true;

  if (esDemo()) {
    const b = bajas.find(x => x.id === entrevistaBajaId);
    if (b) Object.assign(b, datos);
    toast('Entrevista de salida registrada (demo)', 'ok');
    perfilTab = 'entrevista';
    cerrarModal('modal-entrevista');
    renderizarTodo();
    if (btn) btn.disabled = false;
    return;
  }

  const { error } = await db.from('salidas').update(datos).eq('id', entrevistaBajaId);
  if (btn) btn.disabled = false;
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  toast('Entrevista de salida registrada', 'ok');
  perfilTab = 'entrevista';
  cerrarModal('modal-entrevista');
  await cargar();
}

// ── ELIMINAR BAJA ──
function confirmarEliminar(bajaId) {
  const b = bajas.find(x => x.id === bajaId);
  const emp = empleados.find(e => e.id === b?.empleado_id);
  document.getElementById('confirm-title').textContent = '¿Eliminar baja?';
  document.getElementById('confirm-body').textContent = `Se eliminará el registro de baja de ${emp?.nombre || 'este empleado'}, junto con los datos de su entrevista y checklist. Esta acción no se puede deshacer.`;
  document.getElementById('confirm-ok').onclick = () => eliminarBaja(bajaId);
  abrirModal('modal-confirm');
}

async function eliminarBaja(bajaId) {
  cerrarModal('modal-confirm');

  if (esDemo()) {
    bajas = bajas.filter(x => x.id !== bajaId);
    bajaSeleccionada = null;
    toast('Baja eliminada correctamente (demo)', 'ok');
    renderizarTodo();
    resetPerfil();
    return;
  }

  const { error } = await db.from('salidas').delete().eq('id', bajaId);
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  bajaSeleccionada = null;
  toast('Baja eliminada correctamente', 'ok');
  await cargar();
  resetPerfil();
}

function resetPerfil() {
  const pBox = document.getElementById('perfil-content');
  if (pBox) pBox.innerHTML = `<div class="text-center py-6 text-on-surface-variant">
    <span class="material-symbols-outlined text-3xl block mb-2 opacity-40">meeting_room</span>
    <p class="text-xs font-bold text-on-surface-variant">Expediente de salida</p>
    <p class="text-xs mt-1">Selecciona una baja de la lista para ver su detalle, entrevista y checklist</p>
  </div>`;
}

// ── SELECTS ──
function llenarSelectEmpleados() {
  const bajasIds = new Set(bajas.map(b => b.empleado_id));
  const disponibles = empleados.filter(e => !bajasIds.has(e.id) && (e.estado || 'Activo') === 'Activo');
  const opts = disponibles.length
    ? disponibles.map(e => `<option value="${e.id}">${e.nombre} — ${e.cargo || ''}</option>`).join('')
    : '<option value="">No hay empleados disponibles</option>';
  const sel = document.getElementById('baja-empleado');
  if (sel) sel.innerHTML = opts;
}

// ── STATS ──
function actualizarStats() {
  const ahora = new Date();
  const bajasMes = bajas.filter(b => {
    if (!b.fecha_salida) return false;
    const d = new Date(b.fecha_salida);
    return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear();
  });

  const pendientes = bajas.filter(b => estadoOffboarding(b) !== 'Completado');
  const entrevistasTotal = bajas.filter(b => b.entrevista_realizada).length;

  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  animarNumero('st-total', bajas.length);
  setTxt('st-total-sub', `${bajas.length} registrada${bajas.length !== 1 ? 's' : ''} en el sistema`);
  animarNumero('st-mes', bajasMes.length);
  setTxt('st-mes-sub', bajasMes.length ? `${bajasMes.length} en ${ahora.toLocaleDateString('es', { month: 'long' })}` : 'Ninguna este mes');

  const mesPrev = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
  const bajasPrev = bajas.filter(b => {
    if (!b.fecha_salida) return false;
    const d = new Date(b.fecha_salida);
    return d.getMonth() === mesPrev.getMonth() && d.getFullYear() === mesPrev.getFullYear();
  }).length;
  const trendEl = document.getElementById('st-mes-trend');
  if (trendEl) {
    const diff = bajasMes.length - bajasPrev;
    const nombrePrev = mesPrev.toLocaleDateString('es', { month: 'long' });
    trendEl.classList.remove('bg-orange-50', 'text-orange-700', 'bg-green-50', 'text-green-700', 'bg-gray-50', 'text-gray-600');
    if (diff > 0) {
      trendEl.classList.add('bg-orange-50', 'text-orange-700');
      trendEl.innerHTML = `<span class="material-symbols-outlined text-xs">trending_up</span>+${diff} vs ${nombrePrev} (${bajasPrev})`;
    } else if (diff < 0) {
      trendEl.classList.add('bg-green-50', 'text-green-700');
      trendEl.innerHTML = `<span class="material-symbols-outlined text-xs">trending_down</span>${diff} vs ${nombrePrev} (${bajasPrev})`;
    } else {
      trendEl.classList.add('bg-gray-50', 'text-gray-600');
      trendEl.innerHTML = `<span class="material-symbols-outlined text-xs">remove</span>igual que ${nombrePrev} (${bajasPrev})`;
    }
    trendEl.style.visibility = 'visible';
  }
  animarNumero('st-entrevistas', entrevistasTotal);
  setTxt('st-entrevistas-sub', `${entrevistasTotal} de salida realizada${entrevistasTotal !== 1 ? 's' : ''}`);
  animarNumero('st-pendientes', pendientes.length);
  setTxt('st-pendientes-sub', `${pendientes.length} proceso${pendientes.length !== 1 ? 's' : ''} sin completar`);
  setTxt('badge-bajas', bajas.length);
  renderMiniChart();
}

// ── AUTO-SELECCIÓN INICIAL ──
let autoSelHecha = false;
function autoSeleccionarPrimera() {
  if (autoSelHecha || bajaSeleccionada !== null || !bajas.length) return;
  autoSelHecha = true;
  const primera = [...bajas].sort((a, b) => new Date(b.fecha_salida) - new Date(a.fecha_salida))[0];
  bajaSeleccionada = primera.id;
  perfilTab = 'info';
  renderPerfil();
  renderTabla();
}

// ── RENDER TODO ──
function renderizarTodo() {
  actualizarStats();
  renderChips();
  renderTabla();
  renderHistorico();
  renderMotivos();
  if (bajaSeleccionada) renderPerfil();
  autoSeleccionarPrimera();
}

function esDemo() { return modoDemoActivo; }
function abrirModal(id) { const el = document.getElementById(id); if (el) { el.classList.add('open'); setTimeout(() => el.querySelector('input,select,textarea')?.focus(), 120); } }
function cerrarModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('open'); }

// ── INICIO ──
async function iniciar() {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  const st = document.getElementById('db-status');

  try {
    if (!db) throw new Error('Cliente de Supabase no inicializado');
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
    cargarDatosDemo();
    cargando = false;
    renderizarTodo();
  }
}

async function cargar() {
  try {
    const [e, s] = await Promise.all([
      db.from('empleados').select('*'),
      db.from('salidas').select('*').order('fecha_salida', { ascending: false }),
    ]);

    empleados = e.data || [];
    bajas = s.data || [];

    cargando = false;
    renderizarTodo();
  } catch (err) {
    console.error('Error cargando colecciones:', err);
    modoDemoActivo = true;
    cargarDatosDemo();
    cargando = false;
    renderizarTodo();
  }
}

function suscribirRealtime() {
  if (!db) return;
  db.channel('salida')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'salidas' }, () => cargar())
    .subscribe();
}

// ── DATOS DEMO ──
function cargarDatosDemo() {
  empleados = [
    { id: 1, nombre: 'Ana García', cargo: 'Gerente RRHH', departamento: 'RRHH', fecha_ingreso: '2020-01-15', estado: 'Activo' },
    { id: 2, nombre: 'Carlos Mora', cargo: 'Analista TI', departamento: 'TI', fecha_ingreso: '2021-03-10', estado: 'Activo' },
    { id: 3, nombre: 'Lucía Pérez', cargo: 'Diseñadora', departamento: 'Marketing', fecha_ingreso: '2022-06-01', estado: 'Activo' },
    { id: 4, nombre: 'Roberto Sánchez', cargo: 'Dev Backend', departamento: 'TI', fecha_ingreso: '2021-08-15', estado: 'Activo' },
    { id: 5, nombre: 'María Jiménez', cargo: 'Contadora', departamento: 'Finanzas', fecha_ingreso: '2020-11-20', estado: 'Activo' },
    { id: 6, nombre: 'Diego Vargas', cargo: 'Vendedor', departamento: 'Comercial', fecha_ingreso: '2023-02-01', estado: 'Activo' },
    { id: 7, nombre: 'Patricia López', cargo: 'Asistente RRHH', departamento: 'RRHH', fecha_ingreso: '2023-09-15', estado: 'Activo' },
    { id: 8, nombre: 'Fernando Ruiz', cargo: 'Supervisor', departamento: 'Operaciones', fecha_ingreso: '2022-04-10', estado: 'Activo' },
  ];
  const addDias = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]; };
  bajas = [
    { id: 1, empleado_id: 3, fecha_salida: addDias(-20), motivo: 'Renuncia', observaciones: 'Salida amigable, buen desempeño durante su estancia.', porque_se_va: 'Mejor oferta salarial y posición de liderazgo en otra empresa', mejoraria: 'Mejorar las oportunidades de crecimiento interno y revisar escalas salariales del mercado.', recomendaria: 'Sí', equipo_entregado: true, accesos_revocados: true, liquidacion_firmada: true, entrevista_realizada: true },
    { id: 2, empleado_id: 6, fecha_salida: addDias(-5), motivo: 'Fin de contrato', observaciones: 'Contrato no renovado por reestructuración del área comercial.', porque_se_va: null, mejoraria: null, recomendaria: null, equipo_entregado: false, accesos_revocados: false, liquidacion_firmada: true, entrevista_realizada: false },
  ];
}

// ── EVENT LISTENERS ──
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(bg => {
    bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('open'); });
  });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    e.preventDefault();
    document.getElementById('search-input')?.focus();
  }
});

window.addEventListener('error', (e) => {
  console.error('Error fatal capturado:', e.error || e.message);
  const st = document.getElementById('db-status');
  if (st) {
    st.classList.remove('opacity-0', 'pointer-events-none');
    const txt = document.getElementById('status-text');
    const dot = document.getElementById('status-dot');
    if (txt) txt.textContent = 'Error cargando el módulo — revisa la consola';
    if (dot) dot.style.background = '#EF4444';
  }
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
  setTimeout(() => { el.classList.add('translate-y-4', 'opacity-0'); setTimeout(() => el.remove(), 300); }, 3200);
}

// ── WINDOW EXPORTS (para onclick en HTML) ──
window.renderTabla = renderTabla;
window.filtrarPor = filtrarPor;
window.seleccionarBaja = seleccionarBaja;
window.cambiarTab = cambiarTab;
window.toggleCheck = toggleCheck;
window.abrirModalBaja = abrirModalBaja;
window.guardarBaja = guardarBaja;
window.abrirEntrevista = abrirEntrevista;
window.guardarEntrevista = guardarEntrevista;
window.confirmarEliminar = confirmarEliminar;
window.cerrarModal = cerrarModal;
window.selTipo = selTipo;
window.onBuscar = onBuscar;
window.cambiarOrden = cambiarOrden;
window.resetFiltros = resetFiltros;

// ── ARRANCAR ──
renderChips();
renderTabla(); // spinner mientras carga
iniciar();