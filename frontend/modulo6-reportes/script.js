import { supabase } from '../supabase-client.js';
const db = supabase;

// ── ESTADO ──
let empleados = [];
let candidatos = [];
let capacitaciones = [];
let evaluaciones = [];
let ausencias = null;   // null = tabla aún no existe (Módulo 3 en construcción)
let vacaciones = null;  // null = tabla aún no existe (Módulo 3 en construcción)
let salidas = null;     // null = tabla aún no existe (Módulo 5 en construcción)
let modoDemo = false;

const COLORES = ['#131b2e','#00668a','#7bd0ff','#7073ff','#22c55e','#f59e0b','#a855f7','#14b8a6','#ef4444','#f97316'];
const charts = {};

if (window.Chart) {
  Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
  Chart.defaults.color = '#76777d';
  Chart.defaults.borderColor = '#eceef0';
}

// ── HELPERS ──
function diasEntre(iso1, iso2) {
  if (!iso1 || !iso2) return null;
  const d = Math.round((new Date(iso2) - new Date(iso1)) / 86400000);
  return d >= 0 ? d : null;
}

function destruirChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function pendiente(wrapId, canvasId, titulo, sub) {
  destruirChart(canvasId);
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  wrap.innerHTML = `<div class="pending-wrap">
    <i class="ti ti-hourglass-empty"></i>
    <div class="pw-title">${titulo}</div>
    <div class="pw-sub">${sub}</div>
    <span class="badge-pend" style="margin-top:8px"><i class="ti ti-tools"></i>En construcción</span>
  </div>`;
}

function restaurarCanvas(wrapId, canvasId) {
  const wrap = document.getElementById(wrapId);
  if (wrap && !document.getElementById(canvasId)) {
    wrap.innerHTML = `<canvas id="${canvasId}"></canvas>`;
  }
}

// ── STATS SUPERIORES ──
function renderStats() {
  const activos = empleados.filter(e => e.estado === 'Activo' || !e.estado);
  const deptos = new Set(activos.map(e => e.departamento).filter(Boolean));
  document.getElementById('st-headcount').textContent = activos.length;
  document.getElementById('st-headcount-sub').textContent = `${deptos.size} departamento${deptos.size === 1 ? '' : 's'}`;

  const totalCand = candidatos.length;
  const contratados = candidatos.filter(c => c.estado === 'Contratado');
  const tasaConv = totalCand ? Math.round((contratados.length / totalCand) * 100) : 0;
  document.getElementById('st-conversion').textContent = totalCand ? `${tasaConv}%` : '—';
  document.getElementById('st-conversion-sub').textContent = totalCand ? `${contratados.length} de ${totalCand} candidatos` : 'Sin candidatos registrados';

  const tiempos = contratados.map(c => diasEntre(c.fecha_postulacion, c.fecha_contrato)).filter(d => d !== null);
  const promDias = tiempos.length ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : null;
  document.getElementById('st-tiempo').textContent = promDias !== null ? promDias : '—';

  const rotCard = document.getElementById('st-rotacion-card');
  if (salidas === null) {
    rotCard.classList.add('pending');
    document.getElementById('st-rotacion').textContent = '—';
    document.getElementById('st-rotacion-sub').innerHTML = '<span class="badge-pend"><i class="ti ti-tools"></i>Módulo 5 pendiente</span>';
  } else {
    rotCard.classList.remove('pending');
    const base = activos.length + salidas.length || 1;
    const tasa = Math.round((salidas.length / base) * 100);
    document.getElementById('st-rotacion').textContent = `${tasa}%`;
    document.getElementById('st-rotacion-sub').textContent = `${salidas.length} salida${salidas.length === 1 ? '' : 's'} registrada${salidas.length === 1 ? '' : 's'}`;
  }
}

// ── HEADCOUNT POR DEPARTAMENTO ──
function renderHeadcount() {
  const activos = empleados.filter(e => e.estado === 'Activo' || !e.estado);
  const grupos = {};
  activos.forEach(e => { const d = e.departamento || 'Sin depto.'; grupos[d] = (grupos[d] || 0) + 1; });
  const labels = Object.keys(grupos);
  const data = Object.values(grupos);

  destruirChart('chart-headcount');
  charts['chart-headcount'] = new Chart(document.getElementById('chart-headcount'), {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: COLORES, borderRadius: 6, maxBarThickness: 34 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

// ── DESEMPEÑO PROMEDIO POR ÁREA ──
function renderDesempeno() {
  if (!evaluaciones.length) {
    pendiente('wrap-desempeno', 'chart-desempeno', 'Sin evaluaciones registradas', 'Aún no hay datos del Módulo 4');
    return;
  }
  restaurarCanvas('wrap-desempeno', 'chart-desempeno');
  const empMap = Object.fromEntries(empleados.map(e => [e.id, e.departamento || 'Sin depto.']));
  const grupos = {};
  evaluaciones.forEach(e => {
    const depto = empMap[e.empleado_id] || 'Sin depto.';
    if (!grupos[depto]) grupos[depto] = [];
    grupos[depto].push(Number(e.promedio || 0));
  });
  const labels = Object.keys(grupos);
  const data = labels.map(d => +(grupos[d].reduce((a, b) => a + b, 0) / grupos[d].length).toFixed(2));

  destruirChart('chart-desempeno');
  charts['chart-desempeno'] = new Chart(document.getElementById('chart-desempeno'), {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: '#7073ff', borderRadius: 6, maxBarThickness: 34 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, max: 5 } }
    }
  });
}

// ── CAPACITACIONES COMPLETADAS VS PENDIENTES ──
function renderCapacitaciones() {
  if (!capacitaciones.length) {
    pendiente('wrap-capacitaciones', 'chart-capacitaciones', 'Sin capacitaciones registradas', 'Aún no hay datos del Módulo 4');
    return;
  }
  restaurarCanvas('wrap-capacitaciones', 'chart-capacitaciones');
  const completadas = capacitaciones.filter(c => c.estado === 'Completado').length;
  const enCurso = capacitaciones.filter(c => c.estado === 'Inscrito' || c.estado === 'En curso').length;
  const noCompletadas = capacitaciones.filter(c => c.estado === 'No completado').length;

  destruirChart('chart-capacitaciones');
  charts['chart-capacitaciones'] = new Chart(document.getElementById('chart-capacitaciones'), {
    type: 'doughnut',
    data: {
      labels: ['Completadas', 'Inscrito / En curso', 'No completadas'],
      datasets: [{ data: [completadas, enCurso, noCompletadas], backgroundColor: ['#16A34A', '#F59E0B', '#DC2626'] }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } } }
  });
}

// ── AUSENTISMO POR TIPO ──
function renderAusentismo() {
  if (ausencias === null) {
    pendiente('wrap-ausentismo', 'chart-ausentismo', 'Tabla "ausencias" no disponible', 'Se activará automáticamente cuando el Módulo 3 la publique');
    return;
  }
  if (!ausencias.length) {
    pendiente('wrap-ausentismo', 'chart-ausentismo', 'Sin ausencias registradas', 'El Módulo 3 todavía no tiene movimientos');
    return;
  }
  restaurarCanvas('wrap-ausentismo', 'chart-ausentismo');
  const grupos = {};
  ausencias.forEach(a => { const t = a.tipo || 'Otro'; grupos[t] = (grupos[t] || 0) + (a.dias || 1); });

  destruirChart('chart-ausentismo');
  charts['chart-ausentismo'] = new Chart(document.getElementById('chart-ausentismo'), {
    type: 'doughnut',
    data: { labels: Object.keys(grupos), datasets: [{ data: Object.values(grupos), backgroundColor: COLORES }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } } }
  });
}

// ── SALDO DE VACACIONES PENDIENTES ──
function renderVacaciones() {
  const wrap = document.getElementById('wrap-vacaciones');
  if (vacaciones === null) {
    wrap.innerHTML = `<div class="pending-wrap">
      <i class="ti ti-hourglass-empty"></i>
      <div class="pw-title">Tabla "vacaciones" no disponible</div>
      <div class="pw-sub">Se activará automáticamente cuando el Módulo 3 la publique</div>
      <span class="badge-pend" style="margin-top:8px"><i class="ti ti-tools"></i>En construcción</span>
    </div>`;
    return;
  }
  const empMap = Object.fromEntries(empleados.map(e => [e.id, e.nombre]));
  // última solicitud por empleado para conocer su saldo restante actual
  const porEmpleado = {};
  vacaciones.forEach(v => {
    const prev = porEmpleado[v.empleado_id];
    if (!prev || new Date(v.created_at || v.desde) > new Date(prev.created_at || prev.desde)) porEmpleado[v.empleado_id] = v;
  });
  const filas = Object.values(porEmpleado)
    .map(v => ({ nombre: (v.empleados && v.empleados.nombre) || empMap[v.empleado_id] || '—', saldo: Number(v.saldo_restante || 0) }))
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, 8);

  if (!filas.length) {
    wrap.innerHTML = `<div class="pending-wrap"><i class="ti ti-beach"></i><div class="pw-title">Sin solicitudes de vacaciones</div><div class="pw-sub">El Módulo 3 todavía no tiene movimientos</div></div>`;
    return;
  }
  const max = Math.max(...filas.map(f => f.saldo), 1);
  wrap.innerHTML = filas.map(f => `
    <div class="vac-row">
      <span class="vac-name" title="${f.nombre}">${f.nombre}</span>
      <div class="vac-bar-wrap"><div class="vac-bar" style="width:${Math.round((f.saldo / max) * 100)}%"></div></div>
      <span class="vac-days">${f.saldo} días</span>
    </div>`).join('');
}

// ── DISTRIBUCIÓN DE MOTIVOS DE SALIDA ──
function renderSalidas() {
  if (salidas === null) {
    pendiente('wrap-salidas', 'chart-salidas', 'Tabla "salidas" no disponible', 'Se activará automáticamente cuando el Módulo 5 la publique');
    return;
  }
  if (!salidas.length) {
    pendiente('wrap-salidas', 'chart-salidas', 'Sin salidas registradas', 'El Módulo 5 todavía no tiene movimientos');
    return;
  }
  restaurarCanvas('wrap-salidas', 'chart-salidas');
  const grupos = {};
  salidas.forEach(s => { const m = s.motivo || 'Otro'; grupos[m] = (grupos[m] || 0) + 1; });

  destruirChart('chart-salidas');
  charts['chart-salidas'] = new Chart(document.getElementById('chart-salidas'), {
    type: 'pie',
    data: { labels: Object.keys(grupos), datasets: [{ data: Object.values(grupos), backgroundColor: COLORES }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } } }
  });
}

// ── RENDER GLOBAL ──
function renderizarTodo() {
  renderStats();
  renderHeadcount();
  renderDesempeno();
  renderCapacitaciones();
  renderAusentismo();
  renderVacaciones();
  renderSalidas();
  document.getElementById('last-update').textContent = 'Actualizado ' + new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

// ── CARGA DE DATOS ──
async function cargar() {
  const [e, c, cap, ev] = await Promise.all([
    db.from('empleados').select('*'),
    db.from('candidatos').select('*'),
    db.from('capacitaciones').select('*'),
    db.from('evaluaciones').select('*'),
  ]);
  empleados = e.data || [];
  candidatos = c.data || [];
  capacitaciones = cap.data || [];
  evaluaciones = ev.data || [];

  // Tablas de los módulos 3 y 5 — pueden no existir todavía
  const [au, va, sa] = await Promise.all([
    db.from('ausencias').select('*'),
    db.from('vacaciones').select('*,empleados(nombre)'),
    db.from('salidas').select('*'),
  ]);
  ausencias = au.error ? null : (au.data || []);
  vacaciones = va.error ? null : (va.data || []);
  salidas = sa.error ? null : (sa.data || []);

  if (empleados.length === 0 && candidatos.length === 0) {
    cargarDatosDemo();
  }
  renderizarTodo();
}

function suscribirRealtime() {
  db.channel('reportes-dashboard')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, () => cargar())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'candidatos' }, () => cargar())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'capacitaciones' }, () => cargar())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'evaluaciones' }, () => cargar())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ausencias' }, () => cargar())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'vacaciones' }, () => cargar())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'salidas' }, () => cargar())
    .subscribe();
}

// ── DATOS DEMO (cuando no hay conexión real o la base está vacía) ──
function cargarDatosDemo() {
  modoDemo = true;
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
  candidatos = [
    { id: 1, nombre: 'Valeria Núñez', cargo: 'Diseñadora UX', fecha_postulacion: '2026-05-05', estado: 'Postulado' },
    { id: 2, nombre: 'Sofía Castro', cargo: 'Dev Frontend', fecha_postulacion: '2026-05-03', estado: 'Preseleccionado' },
    { id: 3, nombre: 'Manuel Torres', cargo: 'Analista Datos', fecha_postulacion: '2026-04-28', estado: 'Entrevista' },
    { id: 4, nombre: 'Andrés Mejía', cargo: 'Dev Backend', fecha_postulacion: '2026-04-20', estado: 'Oferta' },
    { id: 5, nombre: 'José Ramírez', cargo: 'Vendedor', fecha_postulacion: '2026-04-10', estado: 'Contratado', fecha_contrato: '2026-04-28' },
    { id: 6, nombre: 'Carmen Flores', cargo: 'Contadora', fecha_postulacion: '2026-04-15', estado: 'Rechazado' },
  ];
  capacitaciones = [
    { id: 1, empleado_id: 4, nombre: 'Seguridad Industrial', fecha: '2026-03-15', horas: 8, estado: 'Completado' },
    { id: 2, empleado_id: 4, nombre: 'Excel Avanzado', fecha: '2026-01-10', horas: 16, estado: 'Completado' },
    { id: 3, empleado_id: 2, nombre: 'Ciberseguridad', fecha: '2026-02-20', horas: 24, estado: 'Completado' },
    { id: 4, empleado_id: 2, nombre: 'AWS Cloud Practitioner', fecha: '2026-06-10', horas: 12, estado: 'En curso' },
    { id: 5, empleado_id: 6, nombre: 'Técnicas de Venta Consultiva', fecha: '2026-05-02', horas: 6, estado: 'Inscrito' },
    { id: 6, empleado_id: 3, nombre: 'Adobe Creative Cloud', fecha: '2025-11-20', horas: 10, estado: 'Completado' },
  ];
  evaluaciones = [
    { id: 1, empleado_id: 4, fecha: '2026-04-01', promedio: 4.18 },
    { id: 2, empleado_id: 4, fecha: '2025-12-01', promedio: 3.90 },
    { id: 3, empleado_id: 2, fecha: '2026-04-01', promedio: 4.40 },
    { id: 4, empleado_id: 6, fecha: '2026-03-15', promedio: 3.58 },
    { id: 5, empleado_id: 1, fecha: '2026-04-01', promedio: 4.62 },
  ];
  ausencias = [
    { id: 1, empleado_id: 3, tipo: 'Incapacidad', dias: 1, fecha: '2026-06-10' },
    { id: 2, empleado_id: 6, tipo: 'No justificada', dias: 1, fecha: '2026-05-02' },
    { id: 3, empleado_id: 4, tipo: 'Personal', dias: 1, fecha: '2026-04-28' },
    { id: 4, empleado_id: 7, tipo: 'Feriado', dias: 1, fecha: '2026-05-01' },
  ];
  vacaciones = [
    { id: 1, empleado_id: 2, empleados: { nombre: 'Carlos Mora' }, saldo_restante: 10, created_at: '2026-05-19' },
    { id: 2, empleado_id: 5, empleados: { nombre: 'María Jiménez' }, saldo_restante: 15, created_at: '2026-06-02' },
    { id: 3, empleado_id: 1, empleados: { nombre: 'Ana García' }, saldo_restante: 12, created_at: '2026-05-12' },
    { id: 4, empleado_id: 7, empleados: { nombre: 'Patricia López' }, saldo_restante: 6, created_at: '2026-04-01' },
  ];
  salidas = null; // Módulo 5 aún no existe — se mantiene en estado "pendiente" incluso en demo
}

// ── INICIO ──
async function iniciar() {
  const dot = document.getElementById('sdot');
  const txt = document.getElementById('stxt');
  const st = document.getElementById('db-status');
  try {
    const { error } = await db.from('empleados').select('id').limit(1);
    if (error) throw error;
    dot.style.background = '#22C55E';
    txt.textContent = 'Conectado a Supabase';
    setTimeout(() => st.classList.add('hidden'), 2000);
    await cargar();
    suscribirRealtime();
  } catch (err) {
    console.error('Fallo de conexión, activando modo demo:', err);
    dot.style.background = '#F59E0B';
    txt.textContent = 'Modo demo — Fallback activo';
    setTimeout(() => st.classList.add('hidden'), 4000);
    cargarDatosDemo();
    renderizarTodo();
  }
}

window.actualizar = () => modoDemo ? renderizarTodo() : cargar();

iniciar();
