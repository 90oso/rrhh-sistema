import { supabase } from '../supabase-client.js';
const db = supabase;

// ── GEOCERCA (configurable; persiste en localStorage) ──
const SEDE_DEFAULT = { lat: 9.0238, lng: -79.5300, radio: 150 };
function getSede() {
  try { const s = JSON.parse(localStorage.getItem('geofence_m3')); if (s && s.lat) return s; } catch (e) {}
  return SEDE_DEFAULT;
}
function setSede(s) { localStorage.setItem('geofence_m3', JSON.stringify(s)); }

// ── ESTADO ──
let empleados = [];
let asistencia = [];   // marcaciones de HOY
let ausencias = [];
let vacaciones = [];
let vista = 'marcaciones';
let sideTab = 'ausencias';
let filtroMarc = 'todos';
let modoDemoActivo = false;
let cargando = true;

const HOY = new Date().toISOString().split('T')[0];

// ── HELPERS ──
const AV_COLORS = ['#8B5CF6', '#3B82F6', '#EC4899', '#0EA5E9', '#10B981', '#F59E0B', '#6366F1', '#14B8A6', '#EF4444', '#F97316'];
const avColor = id => AV_COLORS[(id || 0) % AV_COLORS.length];
const iniciales = n => (n || '??').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
const nombreDe = id => (empleados.find(e => e.id === id)?.nombre) || ('Empleado #' + id);
const cargoDe = id => (empleados.find(e => e.id === id)?.cargo) || '';
const fmtHora = iso => iso ? new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '—';
const fmtFecha = iso => { if (!iso) return '—'; const d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('es', { day: '2-digit', month: 'short' }); };
const rangoActivo = (ini, fin) => ini && fin && HOY >= ini && HOY <= fin;

// Haversine: distancia en metros entre dos coordenadas GPS
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3, rad = Math.PI / 180;
  const dPhi = (lat2 - lat1) * rad, dLam = (lon2 - lon1) * rad;
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLam / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── BADGES ──
function badge(text, cls) { return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${cls}">${text}</span>`; }
const tipoMarcBadge = t => badge(t, t === 'Entrada' ? 'bg-green-50 text-green-700 ring-green-600/20' : 'bg-sky-50 text-sky-700 ring-sky-600/20');
const zonaBadge = m => m.lat == null
  ? badge('Manual', 'bg-gray-50 text-gray-700 ring-gray-600/20')
  : (m.aprobado ? badge('En zona', 'bg-green-50 text-green-700 ring-green-600/20') : badge('Fuera de zona', 'bg-red-50 text-red-700 ring-red-600/20'));
const ausBadgeClass = t => ({ 'Incapacidad': 'bg-purple-50 text-purple-700 ring-purple-600/20', 'Personal': 'bg-sky-50 text-sky-700 ring-sky-600/20', 'No justificada': 'bg-red-50 text-red-700 ring-red-600/20', 'Feriado': 'bg-green-50 text-green-700 ring-green-600/20' }[t] || 'bg-gray-50 text-gray-700 ring-gray-600/20');
const vacBadgeClass = e => ({ 'Pendiente': 'bg-amber-50 text-amber-700 ring-amber-600/20', 'Aprobado': 'bg-green-50 text-green-700 ring-green-600/20', 'Rechazado': 'bg-red-50 text-red-700 ring-red-600/20' }[e] || 'bg-gray-50 text-gray-700 ring-gray-600/20');

// ── RELOJ ──
function tickReloj() {
  const n = new Date();
  const r = document.getElementById('reloj');
  const f = document.getElementById('reloj-fecha');
  if (r) r.textContent = n.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (f) f.textContent = n.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
setInterval(tickReloj, 1000); tickReloj();

// ── ESTADO DEL PERSONAL (derivado de las 3 tablas) ──
function estadoEmpleado(emp) {
  const vac = vacaciones.find(v => v.empleado_id === emp.id && v.estado === 'Aprobado' && rangoActivo(v.fecha_inicio, v.fecha_fin));
  if (vac) return { tipo: 'Vacaciones', badge: badge('Vacaciones', 'bg-purple-50 text-purple-700 ring-purple-600/20'), detalle: `hasta ${fmtFecha(vac.fecha_fin)}` };
  const aus = ausencias.find(a => a.empleado_id === emp.id && rangoActivo(a.fecha_inicio, a.fecha_fin));
  if (aus) return { tipo: 'Ausente', badge: badge(aus.tipo, ausBadgeClass(aus.tipo)), detalle: `hasta ${fmtFecha(aus.fecha_fin)}` };
  const marcas = asistencia.filter(m => m.empleado_id === emp.id).sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
  const entrada = marcas.find(m => m.tipo === 'Entrada');
  const ultima = marcas[marcas.length - 1];
  if (entrada && ultima && ultima.tipo === 'Salida') {
    const hrs = ((new Date(ultima.fecha_hora) - new Date(entrada.fecha_hora)) / 3600000).toFixed(1);
    return { tipo: 'Completo', badge: badge('Jornada completa', 'bg-sky-50 text-sky-700 ring-sky-600/20'), detalle: `${fmtHora(entrada.fecha_hora)} → ${fmtHora(ultima.fecha_hora)} · ${hrs} h` };
  }
  if (entrada) return { tipo: 'Presente', badge: badge('Presente', 'bg-green-50 text-green-700 ring-green-600/20'), detalle: `entró ${fmtHora(entrada.fecha_hora)}` };
  return { tipo: 'SinMarcar', badge: badge('Sin marcar', 'bg-amber-50 text-amber-700 ring-amber-600/20'), detalle: '' };
}

// ── KPIs ──
function actualizarStats() {
  const activos = empleados.filter(e => (e.estado || 'Activo') === 'Activo');
  const estados = activos.map(e => estadoEmpleado(e));
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('k-presentes', estados.filter(s => s.tipo === 'Presente').length);
  set('k-ausentes', estados.filter(s => s.tipo === 'Ausente').length);
  set('k-vacaciones', estados.filter(s => s.tipo === 'Vacaciones').length);
  set('k-fuera', asistencia.filter(m => m.aprobado === false).length);
  set('badge-hoy', asistencia.length);
  const sr = document.getElementById('sede-radio');
  if (sr) sr.textContent = getSede().radio + ' m';
}

// ── TABS: VISTA PRINCIPAL / PANEL LATERAL ──
function setTabActive(activeId, idleId) {
  const a = document.getElementById(activeId), b = document.getElementById(idleId);
  if (a) { a.classList.add('bg-white', 'shadow-sm', 'text-primary'); a.classList.remove('text-on-surface-variant'); }
  if (b) { b.classList.remove('bg-white', 'shadow-sm', 'text-primary'); b.classList.add('text-on-surface-variant'); }
}

function cambiarVista(v) {
  vista = v;
  if (v === 'marcaciones') setTabActive('tab-marc', 'tab-personal'); else setTabActive('tab-personal', 'tab-marc');
  renderChips(); renderTabla();
}

function renderChips() {
  const row = document.getElementById('filter-row');
  if (!row) return;
  if (vista !== 'marcaciones') { row.innerHTML = ''; return; }
  const n = f => f === 'todos' ? asistencia.length
    : f === 'fuera' ? asistencia.filter(m => m.aprobado === false).length
    : asistencia.filter(m => m.tipo === f).length;
  const activeClass = 'bg-primary text-white shadow-sm';
  const idleClass = 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest';
  const chip = (f, lbl) => `<button class="chip px-3 py-1 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${filtroMarc === f ? activeClass : idleClass}" onclick="filtrarMarc('${f}')">${lbl}<span class="text-[10px] font-extrabold rounded-full px-1.5 min-w-[16px] text-center ${filtroMarc === f ? 'bg-white/25 text-white' : 'bg-surface-container-highest text-on-surface-variant'}">${n(f)}</span></button>`;
  row.innerHTML = chip('todos', 'Todas') + chip('Entrada', 'Entradas') + chip('Salida', 'Salidas') + chip('fuera', 'Fuera de zona');
}
function filtrarMarc(f) { filtroMarc = f; renderChips(); renderTabla(); }

function filaCargando(cols) {
  return `<tr><td colspan="${cols}" class="py-10 text-center"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div></td></tr>`;
}

function renderTabla() {
  const thead = document.getElementById('thead');
  const tbody = document.getElementById('tbody');
  if (!thead || !tbody) return;
  const busq = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
  const thCls = 'pb-3 text-[10px] text-on-surface-variant uppercase tracking-widest font-bold';

  if (vista === 'marcaciones') {
    thead.innerHTML = `<tr class="border-b border-outline-variant/20"><th class="${thCls} pl-2">Empleado</th><th class="${thCls}">Tipo</th><th class="${thCls}">Hora</th><th class="${thCls}">Distancia</th><th class="${thCls} pr-2">Validación GPS</th></tr>`;
    if (cargando) { tbody.innerHTML = filaCargando(5); return; }
    let lista = asistencia.filter(m => {
      const matchF = filtroMarc === 'todos' || (filtroMarc === 'fuera' ? m.aprobado === false : m.tipo === filtroMarc);
      const matchB = !busq || nombreDe(m.empleado_id).toLowerCase().includes(busq);
      return matchF && matchB;
    }).sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));
    const pill = document.getElementById('tbl-count'); if (pill) pill.textContent = lista.length;
    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-on-surface-variant text-sm"><span class="material-symbols-outlined text-2xl block opacity-40 mb-1">fingerprint</span>Sin marcaciones hoy todavía</td></tr>`;
      return;
    }
    tbody.innerHTML = lista.map(m => `<tr class="border-b border-outline-variant/10 text-xs hover:bg-surface-container-low/40 transition-colors">
      <td class="py-3 pl-2">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-[11px] shadow-sm flex-shrink-0" style="background:${avColor(m.empleado_id)}">${iniciales(nombreDe(m.empleado_id))}</div>
          <div>
            <div class="font-bold text-primary">${nombreDe(m.empleado_id)}</div>
            <div class="text-[10px] text-on-surface-variant opacity-80">${cargoDe(m.empleado_id)}</div>
          </div>
        </div>
      </td>
      <td class="py-3">${tipoMarcBadge(m.tipo)}</td>
      <td class="py-3 font-bold text-primary tabular-nums">${fmtHora(m.fecha_hora)}</td>
      <td class="py-3 text-on-surface-variant">${m.distancia_m != null ? Math.round(m.distancia_m) + ' m' : '—'}</td>
      <td class="py-3 pr-2">${zonaBadge(m)}</td>
    </tr>`).join('');
    return;
  }

  // vista: estado del personal
  thead.innerHTML = `<tr class="border-b border-outline-variant/20"><th class="${thCls} pl-2">Empleado</th><th class="${thCls}">Estado hoy</th><th class="${thCls} pr-2">Detalle</th></tr>`;
  if (cargando) { tbody.innerHTML = filaCargando(3); return; }
  let lista = empleados.filter(e => (e.estado || 'Activo') === 'Activo' && (!busq || e.nombre.toLowerCase().includes(busq)));
  const pill = document.getElementById('tbl-count'); if (pill) pill.textContent = lista.length;
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="py-12 text-center text-on-surface-variant text-sm">Sin empleados activos</td></tr>`;
    return;
  }
  const orden = { 'SinMarcar': 0, 'Ausente': 1, 'Presente': 2, 'Vacaciones': 3, 'Completo': 4 };
  const conEstado = lista.map(e => ({ e, s: estadoEmpleado(e) })).sort((a, b) => orden[a.s.tipo] - orden[b.s.tipo]);
  tbody.innerHTML = conEstado.map(({ e, s }) => `<tr class="border-b border-outline-variant/10 text-xs hover:bg-surface-container-low/40 transition-colors">
    <td class="py-3 pl-2">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-[11px] shadow-sm flex-shrink-0" style="background:${avColor(e.id)}">${iniciales(e.nombre)}</div>
        <div>
          <div class="font-bold text-primary">${e.nombre}</div>
          <div class="text-[10px] text-on-surface-variant opacity-80">${e.cargo || ''}</div>
        </div>
      </div>
    </td>
    <td class="py-3">${s.badge}</td>
    <td class="py-3 pr-2 text-on-surface-variant">${s.detalle}</td>
  </tr>`).join('');
}

// ── PANEL LATERAL ──
function cambiarSideTab(t) {
  sideTab = t;
  if (t === 'ausencias') setTabActive('stab-aus', 'stab-vac'); else setTabActive('stab-vac', 'stab-aus');
  const txt = document.getElementById('btn-side-add-txt');
  const btn = document.getElementById('btn-side-add');
  if (txt) txt.textContent = t === 'ausencias' ? 'Registrar ausencia' : 'Solicitar vacaciones';
  if (btn) btn.onclick = t === 'ausencias' ? abrirAusencia : abrirVacaciones;
  renderSide();
}

function renderSide() {
  const box = document.getElementById('side-list');
  if (!box) return;
  if (sideTab === 'ausencias') {
    if (!ausencias.length) { box.innerHTML = `<div class="text-center py-6 text-on-surface-variant"><span class="material-symbols-outlined text-2xl block mb-2 opacity-40">event_busy</span><p class="text-xs">Sin ausencias registradas</p></div>`; return; }
    box.innerHTML = [...ausencias].sort((a, b) => (b.fecha_inicio || '').localeCompare(a.fecha_inicio || '')).map(a => `
      <div class="border border-outline-variant/20 rounded-2xl p-3 hover:shadow-sm transition-all">
        <div class="flex items-center gap-2 mb-1">
          <div class="w-6 h-6 rounded-full flex items-center justify-center font-bold text-white text-[9px] flex-shrink-0" style="background:${avColor(a.empleado_id)}">${iniciales(nombreDe(a.empleado_id))}</div>
          <span class="text-xs font-bold text-primary flex-1 truncate">${nombreDe(a.empleado_id)}</span>
          ${badge(a.tipo, ausBadgeClass(a.tipo))}
        </div>
        <div class="text-[11px] text-on-surface-variant flex items-center gap-1">
          <span class="material-symbols-outlined text-xs">calendar_month</span>
          ${fmtFecha(a.fecha_inicio)} → ${fmtFecha(a.fecha_fin)}
          ${rangoActivo(a.fecha_inicio, a.fecha_fin) ? '<span class="ml-1 inline-flex items-center rounded-full px-1.5 py-0 text-[9px] font-bold ring-1 ring-inset bg-orange-50 text-orange-700 ring-orange-600/20">Activa</span>' : ''}
        </div>
        ${a.observaciones ? `<div class="text-[11px] text-on-surface-variant opacity-70 italic mt-1">"${a.observaciones}"</div>` : ''}
      </div>`).join('');
    return;
  }
  if (!vacaciones.length) { box.innerHTML = `<div class="text-center py-6 text-on-surface-variant"><span class="material-symbols-outlined text-2xl block mb-2 opacity-40">beach_access</span><p class="text-xs">Sin solicitudes de vacaciones</p></div>`; return; }
  box.innerHTML = [...vacaciones].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).map(v => `
    <div class="border border-outline-variant/20 rounded-2xl p-3 hover:shadow-sm transition-all">
      <div class="flex items-center gap-2 mb-1">
        <div class="w-6 h-6 rounded-full flex items-center justify-center font-bold text-white text-[9px] flex-shrink-0" style="background:${avColor(v.empleado_id)}">${iniciales(nombreDe(v.empleado_id))}</div>
        <span class="text-xs font-bold text-primary flex-1 truncate">${nombreDe(v.empleado_id)}</span>
        ${badge(v.estado, vacBadgeClass(v.estado))}
      </div>
      <div class="text-[11px] text-on-surface-variant flex items-center gap-1">
        <span class="material-symbols-outlined text-xs">calendar_month</span>
        ${fmtFecha(v.fecha_inicio)} → ${fmtFecha(v.fecha_fin)} · <strong class="text-primary">${v.dias || 0} día${(v.dias || 0) !== 1 ? 's' : ''}</strong>
      </div>
      ${v.comentario ? `<div class="text-[11px] text-on-surface-variant opacity-70 italic mt-1">"${v.comentario}"</div>` : ''}
      ${v.estado === 'Pendiente' ? `<div class="flex gap-1.5 mt-2">
        <button class="flex-1 flex items-center justify-center gap-1 bg-green-50 hover:bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1.5 rounded-lg transition-all" onclick="resolverVacacion(${v.id},'Aprobado')"><span class="material-symbols-outlined text-xs">check</span>Aprobar</button>
        <button class="flex-1 flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1.5 rounded-lg transition-all" onclick="confirmarRechazo(${v.id})"><span class="material-symbols-outlined text-xs">close</span>Rechazar</button>
      </div>` : ''}
    </div>`).join('');
}

// ── MARCACIÓN GPS ──
function siguienteTipo(empId) {
  const marcas = asistencia.filter(m => m.empleado_id === empId).sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
  const ultima = marcas[marcas.length - 1];
  return ultima && ultima.tipo === 'Entrada' ? 'Salida' : 'Entrada';
}

function actualizarBotonMarcar() {
  const empId = Number(document.getElementById('marc-empleado')?.value);
  const btn = document.getElementById('btn-marcar');
  const txt = document.getElementById('btn-marcar-txt');
  if (!btn || !txt) return;
  const tipo = empId ? siguienteTipo(empId) : 'Entrada';
  txt.textContent = 'Marcar ' + tipo;
  if (tipo === 'Entrada') {
    btn.classList.remove('bg-orange-600', 'hover:bg-orange-700', 'shadow-orange-600/20');
    btn.classList.add('bg-green-600', 'hover:bg-green-700', 'shadow-green-600/20');
  } else {
    btn.classList.remove('bg-green-600', 'hover:bg-green-700', 'shadow-green-600/20');
    btn.classList.add('bg-orange-600', 'hover:bg-orange-700', 'shadow-orange-600/20');
  }
}

function setGeoRing(dentro) {
  const ring = document.getElementById('geo-ring');
  const icon = document.getElementById('geo-ring-icon');
  if (ring) {
    ring.classList.remove('border-green-500/60', 'border-red-500/60', 'border-outline-variant/50');
    ring.classList.add(dentro ? 'border-green-500/60' : 'border-red-500/60');
  }
  if (icon) {
    icon.classList.remove('text-green-600', 'text-red-600', 'text-on-surface-variant');
    icon.classList.add(dentro ? 'text-green-600' : 'text-red-600');
  }
}

async function marcar() {
  const empId = Number(document.getElementById('marc-empleado')?.value);
  if (!empId) { toast('Selecciona un empleado', 'err'); return; }
  const tipo = siguienteTipo(empId);
  const btn = document.getElementById('btn-marcar');
  const status = document.getElementById('geo-status');

  if (!navigator.geolocation) { toast('Este navegador no soporta geolocalización — usa marcación manual', 'err'); return; }

  if (btn) btn.disabled = true;
  if (status) status.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span><span>Obteniendo ubicación GPS...</span>';

  navigator.geolocation.getCurrentPosition(async pos => {
    const sede = getSede();
    const dist = haversine(pos.coords.latitude, pos.coords.longitude, sede.lat, sede.lng);
    const dentro = dist <= sede.radio;

    setGeoRing(dentro);
    if (status) status.innerHTML = dentro
      ? `<span class="material-symbols-outlined text-sm text-green-600">verified</span><span class="text-green-700 font-semibold">A ${Math.round(dist)} m de la sede — dentro de la zona</span>`
      : `<span class="material-symbols-outlined text-sm text-red-600">location_off</span><span class="text-red-700 font-semibold">A ${Math.round(dist)} m — fuera de la zona (${sede.radio} m)</span>`;

    const registro = {
      empleado_id: empId,
      tipo,
      fecha_hora: new Date().toISOString(),
      lat: +pos.coords.latitude.toFixed(7),
      lng: +pos.coords.longitude.toFixed(7),
      distancia_m: +dist.toFixed(2),
      aprobado: dentro
    };

    if (esDemo()) {
      asistencia.push({ id: Date.now(), ...registro });
      toast(dentro ? `${tipo} registrada (demo)` : `${tipo} registrada FUERA de zona (demo)`, dentro ? 'ok' : 'warn');
      renderizarTodo();
      if (btn) btn.disabled = false;
      return;
    }

    const { error } = await db.from('asistencia').insert([registro]);
    if (btn) btn.disabled = false;
    if (error) { toast('Error: ' + error.message, 'err'); return; }
    toast(dentro ? `${tipo} registrada correctamente` : `${tipo} registrada, pero FUERA de la zona permitida`, dentro ? 'ok' : 'warn');
    await cargar();
  }, err => {
    if (btn) btn.disabled = false;
    if (status) status.innerHTML = '<span class="material-symbols-outlined text-sm text-red-600">gps_off</span><span class="text-red-700 font-semibold">GPS denegado — permite la ubicación o usa marcación manual</span>';
    toast('No se pudo obtener la ubicación', 'err');
  }, { enableHighAccuracy: true, timeout: 12000 });
}

// ── MARCACIÓN MANUAL ──
function abrirManual() { llenarSelect('man-empleado'); abrirModal('modal-manual'); }
async function guardarManual() {
  const empId = Number(document.getElementById('man-empleado').value);
  const tipo = document.getElementById('man-tipo').value;
  if (!empId) { toast('Selecciona un empleado', 'err'); return; }
  const registro = { empleado_id: empId, tipo, fecha_hora: new Date().toISOString(), lat: null, lng: null, distancia_m: null, aprobado: true };
  const btn = document.getElementById('btn-man-guardar'); if (btn) btn.disabled = true;
  if (esDemo()) {
    asistencia.push({ id: Date.now(), ...registro });
    toast(`${tipo} manual registrada (demo)`, 'ok');
    renderizarTodo(); cerrarModal('modal-manual');
    if (btn) btn.disabled = false; return;
  }
  const { error } = await db.from('asistencia').insert([registro]);
  if (btn) btn.disabled = false;
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  toast(`${tipo} manual registrada`, 'ok');
  cerrarModal('modal-manual'); await cargar();
}

// ── AUSENCIAS ──
function abrirAusencia() {
  llenarSelect('aus-empleado');
  document.getElementById('aus-inicio').value = HOY;
  document.getElementById('aus-fin').value = HOY;
  document.getElementById('aus-obs').value = '';
  abrirModal('modal-ausencia');
}
async function guardarAusencia() {
  const empId = Number(document.getElementById('aus-empleado').value);
  const ini = document.getElementById('aus-inicio').value;
  const fin = document.getElementById('aus-fin').value;
  if (!empId || !ini || !fin) { toast('Completa empleado y fechas', 'err'); return; }
  if (fin < ini) { toast('La fecha final no puede ser anterior a la inicial', 'err'); return; }
  const datos = { empleado_id: empId, tipo: document.getElementById('aus-tipo').value, fecha_inicio: ini, fecha_fin: fin, observaciones: document.getElementById('aus-obs').value.trim() || null };
  const btn = document.getElementById('btn-aus-guardar'); if (btn) btn.disabled = true;
  if (esDemo()) {
    ausencias.push({ id: Date.now(), ...datos });
    toast('Ausencia registrada (demo)', 'ok');
    renderizarTodo(); cerrarModal('modal-ausencia');
    if (btn) btn.disabled = false; return;
  }
  const { error } = await db.from('ausencias').insert([datos]);
  if (btn) btn.disabled = false;
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  toast('Ausencia registrada', 'ok');
  cerrarModal('modal-ausencia'); await cargar();
}

// ── VACACIONES ──
function abrirVacaciones() {
  llenarSelect('vac-empleado');
  document.getElementById('vac-inicio').value = '';
  document.getElementById('vac-fin').value = '';
  document.getElementById('vac-dias').value = '0';
  document.getElementById('vac-comentario').value = '';
  abrirModal('modal-vacaciones');
}
function calcularDias() {
  const ini = document.getElementById('vac-inicio').value;
  const fin = document.getElementById('vac-fin').value;
  let dias = 0;
  if (ini && fin && fin >= ini) dias = Math.round((new Date(fin) - new Date(ini)) / 86400000) + 1;
  document.getElementById('vac-dias').value = dias;
}
async function guardarVacaciones() {
  const empId = Number(document.getElementById('vac-empleado').value);
  const ini = document.getElementById('vac-inicio').value;
  const fin = document.getElementById('vac-fin').value;
  const dias = Number(document.getElementById('vac-dias').value);
  if (!empId || !ini || !fin || dias < 1) { toast('Completa empleado y un rango de fechas válido', 'err'); return; }
  const datos = { empleado_id: empId, fecha_inicio: ini, fecha_fin: fin, dias, estado: 'Pendiente', comentario: document.getElementById('vac-comentario').value.trim() || null };
  const btn = document.getElementById('btn-vac-guardar'); if (btn) btn.disabled = true;
  if (esDemo()) {
    vacaciones.push({ id: Date.now(), created_at: new Date().toISOString(), ...datos });
    toast('Solicitud enviada (demo)', 'ok');
    cambiarSideTab('vacaciones'); renderizarTodo(); cerrarModal('modal-vacaciones');
    if (btn) btn.disabled = false; return;
  }
  const { error } = await db.from('vacaciones').insert([datos]);
  if (btn) btn.disabled = false;
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  toast('Solicitud de vacaciones enviada', 'ok');
  cambiarSideTab('vacaciones');
  cerrarModal('modal-vacaciones'); await cargar();
}
async function resolverVacacion(id, estado) {
  if (esDemo()) {
    const v = vacaciones.find(x => x.id === id); if (v) v.estado = estado;
    toast(`Solicitud ${estado.toLowerCase()} (demo)`, estado === 'Aprobado' ? 'ok' : 'warn');
    renderizarTodo(); return;
  }
  const { error } = await db.from('vacaciones').update({ estado }).eq('id', id);
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  toast(`Solicitud ${estado.toLowerCase()}`, estado === 'Aprobado' ? 'ok' : 'warn');
  await cargar();
}
function confirmarRechazo(id) {
  document.getElementById('confirm-title').textContent = '¿Rechazar solicitud?';
  document.getElementById('confirm-body').textContent = 'La solicitud quedará marcada como Rechazada. El empleado podrá enviar una nueva.';
  const ok = document.getElementById('confirm-ok');
  ok.innerHTML = '<span class="material-symbols-outlined text-sm align-middle">close</span> Rechazar';
  ok.onclick = () => { cerrarModal('modal-confirm'); resolverVacacion(id, 'Rechazado'); };
  abrirModal('modal-confirm');
}

// ── SEDE ──
function abrirSede() {
  const s = getSede();
  document.getElementById('sede-lat').value = s.lat;
  document.getElementById('sede-lng').value = s.lng;
  document.getElementById('sede-radio-inp').value = s.radio;
  abrirModal('modal-sede');
}
function guardarSede() {
  const lat = parseFloat(document.getElementById('sede-lat').value);
  const lng = parseFloat(document.getElementById('sede-lng').value);
  const radio = parseInt(document.getElementById('sede-radio-inp').value);
  if (isNaN(lat) || isNaN(lng) || isNaN(radio) || radio < 10) { toast('Valores inválidos', 'err'); return; }
  setSede({ lat, lng, radio });
  actualizarStats();
  toast('Geocerca actualizada', 'ok');
  cerrarModal('modal-sede');
}
function usarMiUbicacion() {
  if (!navigator.geolocation) { toast('Sin soporte de geolocalización', 'err'); return; }
  toast('Obteniendo tu ubicación...', '');
  navigator.geolocation.getCurrentPosition(pos => {
    document.getElementById('sede-lat').value = pos.coords.latitude.toFixed(7);
    document.getElementById('sede-lng').value = pos.coords.longitude.toFixed(7);
    toast('Ubicación capturada — guarda para aplicar', 'ok');
  }, () => toast('No se pudo obtener tu ubicación', 'err'), { enableHighAccuracy: true, timeout: 12000 });
}

// ── SELECTS ──
function llenarSelect(id) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const activos = empleados.filter(e => (e.estado || 'Activo') === 'Activo');
  sel.innerHTML = activos.length
    ? activos.map(e => `<option value="${e.id}">${e.nombre} — ${e.cargo || ''}</option>`).join('')
    : '<option value="">Sin empleados activos</option>';
}

// ── RENDER TODO ──
function renderizarTodo() {
  actualizarStats();
  renderChips();
  renderTabla();
  renderSide();
  const selMarc = document.getElementById('marc-empleado');
  const valorPrevio = selMarc ? selMarc.value : '';
  llenarSelect('marc-empleado');
  if (selMarc && valorPrevio) selMarc.value = valorPrevio;
  actualizarBotonMarcar();
}

function esDemo() { return modoDemoActivo; }
function abrirModal(id) { const el = document.getElementById(id); if (el) { el.classList.add('open'); setTimeout(() => el.querySelector('input,select,textarea')?.focus(), 120); } }
function cerrarModal(id) { document.getElementById(id)?.classList.remove('open'); }

// ── INICIO ──
async function iniciar() {
  const dot = document.getElementById('status-dot'), txt = document.getElementById('status-text'), st = document.getElementById('db-status');
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
    cargarDatosDemo(); cargando = false; renderizarTodo();
  }
}

async function cargar() {
  try {
    const inicioHoy = HOY + 'T00:00:00';
    const [e, a, au, va] = await Promise.all([
      db.from('empleados').select('*'),
      db.from('asistencia').select('*').gte('fecha_hora', inicioHoy).order('fecha_hora', { ascending: false }),
      db.from('ausencias').select('*').order('fecha_inicio', { ascending: false }),
      db.from('vacaciones').select('*').order('created_at', { ascending: false }),
    ]);
    empleados = e.data || [];
    asistencia = a.data || [];
    ausencias = au.data || [];
    vacaciones = va.data || [];
    if (empleados.length === 0) cargarDatosDemo();
    cargando = false;
    renderizarTodo();
  } catch (err) {
    console.error('Error cargando colecciones:', err);
    modoDemoActivo = true;
    cargarDatosDemo(); cargando = false; renderizarTodo();
  }
}

function suscribirRealtime() {
  if (!db) return;
  db.channel('control-diario')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'asistencia' }, () => cargar())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ausencias' }, () => cargar())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'vacaciones' }, () => cargar())
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
  const h = (hh, mm) => { const d = new Date(); d.setHours(hh, mm, 0, 0); return d.toISOString(); };
  asistencia = [
    { id: 1, empleado_id: 1, tipo: 'Entrada', fecha_hora: h(7, 55), lat: 9.0239, lng: -79.5301, distancia_m: 18.4, aprobado: true },
    { id: 2, empleado_id: 2, tipo: 'Entrada', fecha_hora: h(8, 2), lat: 9.0241, lng: -79.5299, distancia_m: 36.2, aprobado: true },
    { id: 3, empleado_id: 4, tipo: 'Entrada', fecha_hora: h(8, 10), lat: 9.0301, lng: -79.5220, distancia_m: 1120.5, aprobado: false },
    { id: 4, empleado_id: 5, tipo: 'Entrada', fecha_hora: h(7, 48), lat: null, lng: null, distancia_m: null, aprobado: true },
    { id: 5, empleado_id: 2, tipo: 'Salida', fecha_hora: h(12, 5), lat: 9.0240, lng: -79.5300, distancia_m: 22.1, aprobado: true },
  ];
  const addDias = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]; };
  ausencias = [
    { id: 1, empleado_id: 6, tipo: 'Incapacidad', fecha_inicio: addDias(-1), fecha_fin: addDias(2), observaciones: 'Certificado médico CSS por 4 días.' },
    { id: 2, empleado_id: 8, tipo: 'Personal', fecha_inicio: addDias(-6), fecha_fin: addDias(-6), observaciones: 'Trámite personal aprobado por su supervisor.' },
  ];
  vacaciones = [
    { id: 1, empleado_id: 3, fecha_inicio: addDias(-3), fecha_fin: addDias(4), dias: 8, estado: 'Aprobado', comentario: 'Vacaciones anuales programadas.', created_at: new Date().toISOString() },
    { id: 2, empleado_id: 7, fecha_inicio: addDias(10), fecha_fin: addDias(17), dias: 8, estado: 'Pendiente', comentario: 'Viaje familiar.', created_at: new Date().toISOString() },
  ];
}

// ── EVENTOS GLOBALES ──
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(bg => bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('open'); }));
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    e.preventDefault(); document.getElementById('search-input')?.focus();
  }
});

window.addEventListener('error', (e) => {
  console.error('Error fatal capturado:', e.error || e.message);
  const st = document.getElementById('db-status');
  if (st) {
    st.classList.remove('opacity-0', 'pointer-events-none');
    const t = document.getElementById('status-text'), d = document.getElementById('status-dot');
    if (t) t.textContent = 'Error cargando el módulo — revisa la consola';
    if (d) d.style.background = '#EF4444';
  }
});

function toast(msg, tipo = '') {
  const wrap = document.getElementById('toast-wrap'); if (!wrap) return;
  const el = document.createElement('div');
  const bgClass = tipo === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : tipo === 'err' ? 'bg-red-50 border-red-200 text-red-800' : tipo === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-white border-outline-variant/30 text-primary';
  const iconName = tipo === 'ok' ? 'check_circle' : tipo === 'err' ? 'error' : tipo === 'warn' ? 'warning' : 'info';
  el.className = `flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-xl text-xs font-bold pointer-events-auto transform translate-y-4 opacity-0 transition-all duration-300 ${bgClass}`;
  el.innerHTML = `<span class="material-symbols-outlined text-base">${iconName}</span><span>${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => el.classList.remove('translate-y-4', 'opacity-0'), 10);
  setTimeout(() => { el.classList.add('translate-y-4', 'opacity-0'); setTimeout(() => el.remove(), 300); }, 3200);
}

// ── EXPORTS (para onclick en HTML) ──
window.marcar = marcar;
window.actualizarBotonMarcar = actualizarBotonMarcar;
window.cambiarVista = cambiarVista;
window.cambiarSideTab = cambiarSideTab;
window.filtrarMarc = filtrarMarc;
window.renderTabla = renderTabla;
window.abrirManual = abrirManual;
window.guardarManual = guardarManual;
window.abrirAusencia = abrirAusencia;
window.guardarAusencia = guardarAusencia;
window.abrirVacaciones = abrirVacaciones;
window.guardarVacaciones = guardarVacaciones;
window.calcularDias = calcularDias;
window.resolverVacacion = resolverVacacion;
window.confirmarRechazo = confirmarRechazo;
window.abrirSede = abrirSede;
window.guardarSede = guardarSede;
window.usarMiUbicacion = usarMiUbicacion;
window.cerrarModal = cerrarModal;

// ── ARRANCAR ──
renderTabla(); // spinner mientras carga
iniciar();