import { supabase } from "../supabase-client.js";
console.log("script.js cargado");
const db = supabase;
let modoDemo = false;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ESTADO LOCAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let candidatos = [];
let filtroActual = 'todos';
let vacanteFiltro = null;
let editandoId = null;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTES VISUALES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const COLORES = {
  Postulado:'#6366F1', Preseleccionado:'#8B5CF6', Entrevista:'#0EA5E9',
  Oferta:'#7C3AED', Contratado:'#16A34A', Rechazado:'#94A3B8'
};

const ESTADOS = ['Postulado','Preseleccionado','Entrevista','Oferta','Contratado','Rechazado'];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILIDADES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function iniciales(nombre) {
  return (nombre || '??').split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase();
}

function formatFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es', {day:'2-digit',month:'short',year:'numeric'});
}

async function subirCV(idCandidato) {
  const input = document.getElementById('f-cv-archivo');
  if (!input || !input.files.length) return null;

  const archivo = input.files[0];
  const extension = archivo.name.split(".").pop();
  const nombreArchivo = `${idCandidato}_${Date.now()}.${extension}`;

  const { error } = await db.storage
    .from("hojas-vida")
    .upload(nombreArchivo, archivo, { upsert: true });

  if (error) throw error;

  const { data } = db.storage
    .from("hojas-vida")
    .getPublicUrl(nombreArchivo);

  return data.publicUrl;
}

function diasEntre(iso1, iso2) {
  if (!iso1 || !iso2) return null;
  return Math.round((new Date(iso2) - new Date(iso1)) / 86400000);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONEXIÓN A SUPABASE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function iniciar() {
  console.log("1. Entró a iniciar");
  try {
    console.log("2. Consultando candidatos...");
    const { data, error } = await db
      .from("candidatos")
      .select("id")
      .limit(1);

    const dot = document.getElementById('status-dot');
    const txt = document.getElementById('status-text');
    const statusEl = document.getElementById('db-status');

    if (error) {
      console.log("6. Entró al modo demo");
      modoDemo = true;
      if (dot) dot.style.background = '#F59E0B';
      if (txt) txt.textContent = 'Modo demo';
      candidatos = datosDemo();
      renderizarTodo();
      return;
    }

    console.log("7. Conectado correctamente");
    modoDemo = false;
    if (dot) dot.style.background = '#22C55E';
    if (txt) txt.textContent = 'Conectado';

    await cargarCandidatos();
    suscribirRealtime();
    if (statusEl) setTimeout(() => statusEl.classList.add("opacity-0", "pointer-events-none"), 2000);

  } catch (e) {
    console.error("ERROR EN INICIAR", e);
  }
}

async function cargarCandidatos() {
  const { data, error } = await db
    .from('candidatos')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { toast('Error al cargar datos: ' + error.message, 'err'); return; }
  candidatos = data || [];
  renderizarTodo();
}

function suscribirRealtime() {
  db.channel('candidatos')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'candidatos' }, () => {
      cargarCandidatos();
    })
    .subscribe();
}

function datosDemo() {
  return [
    {id:1,nombre:'Valeria Núñez',email:'valeria@email.com',cargo:'Diseñadora UX',fecha_postulacion:'2026-05-05',entrevista:'—',estado:'Postulado',cv_link:'',comentario:'',motivo_rechazo:'',fecha_contrato:null},
    {id:2,nombre:'Sofía Castro',email:'sofia@email.com',cargo:'Dev Frontend',fecha_postulacion:'2026-05-03',entrevista:'Sin agendar',estado:'Preseleccionado',cv_link:'',comentario:'Buena presentación',motivo_rechazo:'',fecha_contrato:null},
    {id:3,nombre:'Manuel Torres',email:'manuel@email.com',cargo:'Analista Datos',fecha_postulacion:'2026-04-28',entrevista:'12 May 2026 · 10:00',estado:'Entrevista',cv_link:'',comentario:'',motivo_rechazo:'',fecha_contrato:null},
    {id:4,nombre:'Andrés Mejía',email:'andres@email.com',cargo:'Dev Backend',fecha_postulacion:'2026-04-20',entrevista:'02 May · Aprobado',estado:'Oferta',cv_link:'',comentario:'Excelente perfil técnico',motivo_rechazo:'',fecha_contrato:null},
    {id:5,nombre:'José Ramírez',email:'jose@email.com',cargo:'Vendedor',fecha_postulacion:'2026-04-10',entrevista:'22 Abr · Aprobado',estado:'Contratado',cv_link:'',comentario:'',motivo_rechazo:'',fecha_contrato:'2026-04-28'},
    {id:6,nombre:'Carmen Flores',email:'carmen@email.com',cargo:'Contadora',fecha_postulacion:'2026-04-15',entrevista:'25 Abr · No apto',estado:'Rechazado',cv_link:'',comentario:'',motivo_rechazo:'Sin competencias requeridas',fecha_contrato:null},
  ];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RENDERIZADO GENERAL Y FILTRADO POR VACANTE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderizarTodo() {
  actualizarStats();
  actualizarPipeline();
  renderVacantesPipeline();
  renderTabla();
}

function renderVacantesPipeline() {
  const container = document.getElementById('vacancies-pipeline-container');
  if (!container) return;

  const grupos = {};
  candidatos.forEach(c => {
    if (!grupos[c.cargo]) grupos[c.cargo] = [];
    grupos[c.cargo].push(c);
  });

  const vacantesDisponibles = Object.keys(grupos);
  if (vacantesDisponibles.length === 0) {
    container.innerHTML = `<div class="text-center py-12 text-on-surface-variant text-xs font-medium">No hay vacantes registradas.</div>`;
    return;
  }

  container.innerHTML = vacantesDisponibles.map(vacante => {
    const listado = grupos[vacante];
    const esActiva = vacanteFiltro === vacante;
    
    return `
      <div onclick="filtrarPorVacante('${vacante}')" class="p-4 rounded-2xl border cursor-pointer transition-all flex justify-between items-center ${esActiva ? 'border-primary bg-primary-container/10 shadow-sm' : 'border-outline-variant/20 bg-surface-container-lowest hover:bg-surface-container-low/50'}" style="${esActiva ? 'border-width: 2px;' : ''}">
        <div>
          <h4 class="text-xs font-bold text-primary tracking-tight">${vacante}</h4>
          <p class="text-[10px] font-medium text-on-surface-variant opacity-70 mt-0.5">${listado.length} candidatos asociados</p>
        </div>
        <span class="material-symbols-outlined text-sm ${esActiva ? 'text-primary' : 'text-on-surface-variant'}">chevron_right</span>
      </div>
    `;
  }).join('');
}

function filtrarPorVacante(vacante) {
  vacanteFiltro = vacante;
  const badge = document.getElementById('filtro-vacante-badge');
  const txtNombre = document.getElementById('nombre-vacante-filtro');
  if (badge && txtNombre) {
    txtNombre.textContent = vacante;
    badge.classList.remove('hidden');
  }
  renderizarTodo();
}

function limpiarFiltroVacanteCompleto() {
  vacanteFiltro = null;
  const badge = document.getElementById('filtro-vacante-badge');
  if (badge) badge.classList.add('hidden');
  renderizarTodo();
}

function actualizarStats() {
  const total = candidatos.length;
  const proceso = candidatos.filter(c=>['Preseleccionado','Entrevista','Oferta'].includes(c.estado)).length;
  const contratados = candidatos.filter(c=>c.estado==='Contratado');
  const tasa = total > 0 ? Math.round((contratados.length / total) * 100) : 0;

  const tiempos = contratados
    .map(c => diasEntre(c.fecha_postulacion, c.fecha_contrato))
    .filter(d => d !== null && d >= 0);
  const promDias = tiempos.length > 0 ? Math.round(tiempos.reduce((a,b)=>a+b,0) / tiempos.length) : '—';

  document.getElementById('st-total').textContent = total;
  document.getElementById('st-proceso').textContent = proceso;
  document.getElementById('st-contratados').textContent = contratados.length;
  document.getElementById('st-tasa').innerHTML = `<span class="material-symbols-outlined text-sm">trending_up</span> <span>Tasa conversión ${tasa}%</span>`;
  document.getElementById('st-dias').textContent = promDias;
  document.getElementById('badge-total').textContent = total;
  document.getElementById('fc-todos').textContent = total;
}

function actualizarPipeline() {
  const p = (e) => candidatos.filter(c=>c.estado===e).length;
  ESTADOS.forEach((e,i) => {
    const el = document.getElementById(`p-${i}`);
    if (el) el.textContent = p(e);
  });
}

function renderTabla() {
  const busqueda = (document.getElementById('search-input').value || '').toLowerCase();
  
  const filas = candidatos.filter(c => {
    const matchFiltro = filtroActual === 'todos' || c.estado === filtroActual;
    const matchVacante = !vacanteFiltro || c.cargo === vacanteFiltro;
    const matchBusqueda = !busqueda ||
      (c.nombre||'').toLowerCase().includes(busqueda) ||
      (c.cargo||'').toLowerCase().includes(busqueda) ||
      (c.email||'').toLowerCase().includes(busqueda);
    return matchFiltro && matchVacante && matchBusqueda;
  });

  const tbody = document.getElementById('tbody');
  if (filas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-on-surface-variant text-sm"><span class="material-symbols-outlined text-2xl block opacity-40 mb-1">person_off</span>Sin candidatos registrados${filtroActual!=='todos'?' en esta etapa':''}${vacanteFiltro?' para esta vacante':''}</td></tr>`;
    return;
  }

  tbody.innerHTML = filas.map(c => {
    const ini = iniciales(c.nombre);
    const col = COLORES[c.estado] || '#94A3B8';
    
    const badgeClases = {
      Postulado: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
      Preseleccionado: 'bg-purple-50 text-purple-700 ring-purple-600/20',
      Entrevista: 'bg-sky-50 text-sky-700 ring-sky-600/20',
      Oferta: 'bg-pink-50 text-pink-700 ring-pink-600/20',
      Contratado: 'bg-green-50 text-green-700 ring-green-600/20',
      Rechazado: 'bg-slate-50 text-slate-700 ring-slate-600/20'
    }[c.estado] || 'bg-gray-50 text-gray-700 ring-gray-600/20';

    const fecha = formatFecha(c.fecha_postulacion);
    const entrev = c.entrevista || '—';

    let acciones = '';
    if (c.estado === 'Rechazado') {
      acciones = `<span class="text-xs font-semibold text-error text-right block">${c.motivo_rechazo || 'Sin motivo'}</span>`;
    } else if (c.estado === 'Contratado') {
      acciones = `
        <button class="bg-green-600 hover:bg-green-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all" onclick="verHV(${c.id})">Ver perfil →</button>
        <button class="text-on-surface-variant hover:text-primary p-1 flex items-center" onclick="editarCandidato(${c.id})" title="Editar"><span class="material-symbols-outlined text-lg">edit</span></button>`;
    } else if (c.estado === 'Oferta') {
      acciones = `
        <button class="bg-surface-container-high hover:bg-surface-container-highest text-primary text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all" onclick="verHV(${c.id})">Ver CV</button>
        <button class="bg-green-600 hover:bg-green-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-sm transition-all active:scale-95" onclick="confirmarContratar(${c.id})"><span class="material-symbols-outlined text-sm">check</span>Contratar</button>`;
    } else {
      const idx = ESTADOS.indexOf(c.estado);
      const siguiente = (idx >= 0 && idx < ESTADOS.length - 2) ? ESTADOS[idx + 1] : null;
      acciones = `
        <button class="bg-surface-container-high hover:bg-surface-container-highest text-primary text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all" onclick="verHV(${c.id})">Ver CV</button>
        ${siguiente ? `<button class="bg-primary hover:bg-black text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all active:scale-95" onclick="confirmarAvanzar(${c.id})">Avanzar</button>` : ''}
        <button class="text-on-surface-variant hover:text-primary p-1 flex items-center" onclick="editarCandidato(${c.id})" title="Editar"><span class="material-symbols-outlined text-lg">edit</span></button>
        <button class="text-error hover:bg-error-container/40 p-1 rounded-xl flex items-center transition-colors" onclick="confirmarEliminar(${c.id})" title="Eliminar"><span class="material-symbols-outlined text-lg">delete</span></button>`;
    }

    let cvIcon = '—';
    if (c.cv_archivo) {
      cvIcon = `<a href="${c.cv_archivo}" target="_blank" class="text-error hover:scale-110 transition-transform flex items-center justify-center" title="Descargar PDF"><span class="material-symbols-outlined text-lg">picture_as_pdf</span></a>`;
    } else if (c.cv_link) {
      cvIcon = `<a href="${c.cv_link}" target="_blank" class="text-indigo-600 hover:scale-110 transition-transform flex items-center justify-center" title="Ver Link externo"><span class="material-symbols-outlined text-lg">link</span></a>`;
    }

    return `<tr class="border-b border-outline-variant/10 text-xs text-primary hover:bg-surface-container-low/40 transition-colors">
      <td class="py-3.5 pl-2">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-[11px] shadow-sm" style="background:${col}">${ini}</div>
          <div>
            <div class="font-bold text-primary">${c.nombre}</div>
            <div class="text-[10px] text-on-surface-variant opacity-80">${c.email}</div>
          </div>
        </div>
      </td>
      <td class="py-3.5 font-semibold text-primary">${c.cargo}</td>
      <td class="py-3.5 text-on-surface-variant">${fecha}</td>
      <td class="py-3.5 text-on-surface-variant font-medium">${entrev}</td>
      <td class="py-3.5">
        <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${badgeClases}">
          ${c.estado}
        </span>
      </td>
      <td class="py-3.5 text-center">${cvIcon}</td>
      <td class="py-3.5 pr-2">
        <div class="flex justify-end gap-2 items-center">
          ${acciones}
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILTROS DE ESTADO (CHIPS)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function filtrarPor(estado, el) {
  filtroActual = estado;
  document.querySelectorAll('.chip').forEach(c => {
    c.classList.remove('bg-primary', 'text-white', 'font-semibold', 'shadow-sm');
    c.classList.add('bg-surface-container-high', 'text-on-surface-variant', 'font-medium');
  });

  if (el) {
    el.classList.remove('bg-surface-container-high', 'text-on-surface-variant', 'font-medium');
    el.classList.add('bg-primary', 'text-white', 'font-semibold', 'shadow-sm');
  }
  renderTabla();
}

function filtrarTabla() { renderTabla(); }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VER EXPEDIENTE INTEGRAL (HV)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function verHV(id) {
  const c = candidatos.find(x => x.id === id);
  if (!c) return;
  const ini = iniciales(c.nombre);
  const col = COLORES[c.estado] || '#94A3B8';

  document.getElementById('hv-content').innerHTML = `
    <div class="flex items-center gap-4 mb-5 pb-4 border-b border-outline-variant/20">
      <div class="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow" style="background:${col}">${ini}</div>
      <div>
        <h4 class="text-base font-bold text-primary tracking-tight">${c.nombre}</h4>
        <p class="text-xs text-on-surface-variant">${c.email}</p>
      </div>
    </div>
    <div class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-3">Información de la Vacante</div>
    <div class="space-y-2 text-xs">
      <div class="flex justify-between py-1.5 border-b border-outline-variant/10"><span class="font-bold text-primary">Vacante solicitada:</span><span class="text-on-surface-variant font-medium">${c.cargo}</span></div>
      <div class="flex justify-between py-1.5 border-b border-outline-variant/10"><span class="font-bold text-primary">Fecha postulación:</span><span class="text-on-surface-variant">${formatFecha(c.fecha_postulacion)}</span></div>
      <div class="flex justify-between py-1.5 border-b border-outline-variant/10"><span class="font-bold text-primary">Fase actual del proceso:</span><span class="font-bold" style="color:${col}">${c.estado}</span></div>
      <div class="flex justify-between py-1.5 border-b border-outline-variant/10"><span class="font-bold text-primary">Agenda / Entrevista:</span><span class="text-on-surface-variant font-medium">${c.entrevista || '—'}</span></div>
      ${c.fecha_contrato ? `<div class="flex justify-between py-1.5 border-b border-outline-variant/10"><span class="font-bold text-primary">Fecha de ingreso:</span><span class="text-on-surface-variant">${formatFecha(c.fecha_contrato)}</span></div>` : ''}
      ${c.cv_link ? `<div class="flex justify-between py-1.5 border-b border-outline-variant/10"><span class="font-bold text-primary">CV / Enlace externo:</span><a href="${c.cv_link}" target="_blank" class="text-indigo-600 font-bold hover:underline flex items-center gap-0.5">Abrir Link <span class="material-symbols-outlined text-[10px]">open_in_new</span></a></div>` : ''}
      ${c.cv_archivo ? `<div class="flex justify-between py-1.5 border-b border-outline-variant/10"><span class="font-bold text-primary">Hoja de Vida Almacenada:</span><a href="${c.cv_archivo}" target="_blank" class="text-indigo-600 font-bold hover:underline flex items-center gap-0.5">Descargar PDF <span class="material-symbols-outlined text-[10px]">download</span></a></div>` : ''}
      ${c.motivo_rechazo ? `<div class="flex justify-between py-1.5 border-b border-outline-variant/10"><span class="font-bold text-error">Motivo de rechazo:</span><span class="text-error font-bold">${c.motivo_rechazo}</span></div>` : ''}
    </div>
    ${c.comentario ? `
      <div class="mt-4 p-3 bg-surface rounded-2xl border border-outline-variant/20 border-l-4 border-l-primary text-xs">
        <div class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Notas / Observaciones del Evaluador</div>
        <p class="text-primary leading-relaxed">${c.comentario}</p>
      </div>` : ''}
    <div class="flex gap-2 justify-end mt-6 pt-3 border-t border-outline-variant/10">
      ${c.estado !== 'Contratado' && c.estado !== 'Rechazado' ? `<button class="px-3 py-1.5 text-xs font-bold text-white bg-primary rounded-xl hover:bg-black transition-all" onclick="cerrarModal('modal-hv');confirmarAvanzar(${c.id})">Avanzar etapa</button>` : ''}
      <button class="px-3 py-1.5 text-xs font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-xl transition-colors flex items-center gap-1" onclick="cerrarModal('modal-hv');editarCandidato(${c.id})"><span class="material-symbols-outlined text-xs">edit</span>Editar</button>
      <button class="px-3 py-1.5 text-xs font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors" onclick="cerrarModal('modal-hv')">Cerrar</button>
    </div>`;

  abrirModal('modal-hv');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FORMULARIO: CRUD MANTENIMIENTO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function abrirNuevo() {
  editandoId = null;
  document.getElementById('form-title').textContent = 'Agregar Candidato';
  document.getElementById('btn-guardar-txt').textContent = 'Guardar Cambios';
  document.getElementById('f-nombre').value = '';
  document.getElementById('f-email').value = '';
  document.getElementById('f-cargo').value = '';
  document.getElementById('f-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('f-estado').value = 'Postulado';
  document.getElementById('f-entrevista').value = '';
  document.getElementById('f-cv').value = '';
  document.getElementById('f-comentario').value = '';
  document.getElementById('f-motivo').value = '';
  toggleMotivoRechazo('Postulado');
  abrirModal('modal-form');
  setTimeout(() => document.getElementById('f-nombre').focus(), 150);
}

function editarCandidato(id) {
  const c = candidatos.find(x => x.id === id);
  if (!c) return;
  editandoId = id;
  document.getElementById('form-title').textContent = 'Editar Candidato';
  document.getElementById('btn-guardar-txt').textContent = 'Guardar Cambios';
  document.getElementById('f-nombre').value = c.nombre || '';
  document.getElementById('f-email').value = c.email || '';
  document.getElementById('f-cargo').value = c.cargo || '';
  document.getElementById('f-fecha').value = c.fecha_postulacion || '';
  document.getElementById('f-estado').value = c.estado || 'Postulado';
  document.getElementById('f-entrevista').value = c.entrevista || '';
  document.getElementById('f-cv').value = c.cv_link || '';
  document.getElementById('f-comentario').value = c.comentario || '';
  document.getElementById('f-motivo').value = c.motivo_rechazo || '';
  toggleMotivoRechazo(c.estado);
  abrirModal('modal-form');
}

document.getElementById('f-estado').addEventListener('change', e => {
  toggleMotivoRechazo(e.target.value);
});

function toggleMotivoRechazo(estado) {
  const motivoGroup = document.getElementById('motivo-group');
  if (motivoGroup) {
    if (estado === 'Rechazado') motivoGroup.classList.remove('hidden');
    else motivoGroup.classList.add('hidden');
  }
}

async function guardar() {
  const nombre = document.getElementById('f-nombre').value.trim();
  const email  = document.getElementById('f-email').value.trim();
  const cargo  = document.getElementById('f-cargo').value.trim();
  const estado = document.getElementById('f-estado').value;

  let ok = true;
  ['f-nombre','f-email','f-cargo'].forEach(id => {
    const el = document.getElementById(id);
    if (!el.value.trim()) { el.classList.add('border-error', 'ring-1', 'ring-error/20'); ok = false; }
    else el.classList.remove('border-error', 'ring-1', 'ring-error/20');
  });

  if (estado === 'Rechazado' && !document.getElementById('f-motivo').value) {
    document.getElementById('f-motivo').classList.add('border-error', 'ring-1', 'ring-error/20'); ok = false;
  } else {
    document.getElementById('f-motivo').classList.remove('border-error', 'ring-1', 'ring-error/20');
  }
  if (!ok) { toast('Completa los campos obligatorios', 'err'); return; }

  const datos = {
    nombre, email, cargo, estado,
    fecha_postulacion: document.getElementById('f-fecha').value || null,
    entrevista: document.getElementById('f-entrevista').value.trim() || null,
    cv_link: document.getElementById('f-cv').value.trim() || null,
    comentario: document.getElementById('f-comentario').value.trim() || null,
    motivo_rechazo: estado === 'Rechazado' ? document.getElementById('f-motivo').value : null,
    fecha_contrato: estado === 'Contratado' ? (new Date().toISOString().split('T')[0]) : null,
  };

  const btnG = document.getElementById('btn-guardar');
  if (btnG) btnG.disabled = true;

  if (esDemo()) {
    if (editandoId) {
      const idx = candidatos.findIndex(c => c.id === editandoId);
      if (idx >= 0) candidatos[idx] = { ...candidatos[idx], ...datos };
      toast('Cambios guardados (modo demo)', 'ok');
    } else {
      candidatos.unshift({ id: Date.now(), ...datos });
      toast(`${nombre} agregado (modo demo)`, 'ok');
    }
    renderizarTodo();
    cerrarModal('modal-form');
    if (btnG) btnG.disabled = false;
    return;
  }

  if (editandoId) {
    const { error } = await db.from('candidatos').update(datos).eq('id', editandoId);
    const urlCV = await subirCV(editandoId);
    if(urlCV){
      await db.from("candidatos").update({cv_archivo:urlCV}).eq("id",editandoId);
    }
    if (error) { toast('Error al guardar: ' + error.message, 'err'); if (btnG) btnG.disabled = false; return; }
    toast(`${nombre} actualizado`, 'ok');
  } else {
    const { data: nuevo, error } = await db.from('candidatos').insert([datos]).select().single();
    if (error) { toast('Error al guardar: ' + error.message, 'err'); if (btnG) btnG.disabled = false; return; }
    toast(`${nombre} agregado`, 'ok');
    const urlCV = await subirCV(nuevo.id);
    if(urlCV) { 
      await db.from("candidatos").update({cv_archivo:urlCV}).eq("id", nuevo.id);
    }
  }
  cerrarModal('modal-form');
  if (btnG) btnG.disabled = false;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ACCIONES EJECUTIVAS DEL PIPELINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function confirmarAvanzar(id) {
  const c = candidatos.find(x => x.id === id);
  if (!c) return;
  const idx = ESTADOS.indexOf(c.estado);
  if (idx < 0 || idx >= ESTADOS.length - 2) return;
  const siguiente = ESTADOS[idx + 1];

  confirmar(
    `Avanzar a ${c.nombre}`,
    `¿Mover de la etapa <strong>${c.estado}</strong> a <strong>${siguiente}</strong>?`,
    'warn',
    async () => {
      await actualizarEstado(id, siguiente);
      toast(`${c.nombre} avanzó a ${siguiente}`, 'ok');
    }
  );
}

function confirmarContratar(id) {
  const c = candidatos.find(x => x.id === id);
  if (!c) return;

  confirmar(
    `Contratar a ${c.nombre}`,
    `Confirmar contratación para la vacante: <strong>${c.cargo}</strong>.<br><br>Su expediente se transferirá de manera automatizada al ecosistema del Módulo 2 — Personal.`,
    'success',
    async () => {
      const hoy = new Date().toISOString().split('T')[0];
      await actualizarEstado(id, 'Contratado', { fecha_contrato: hoy });
      await enviarAPersonal(c, hoy);
      toast(`✓ ${c.nombre} contratado exitosamente`, 'ok');
    },
    'Contratar',
    'bg-green-600 hover:bg-green-700'
  );
}

async function enviarAPersonal(c, fechaIngreso) {
  if (esDemo()) return;
  await db.from('empleados').insert([{
    nombre: c.nombre,
    email: c.email,
    cargo: c.cargo,
    fecha_ingreso: fechaIngreso,
    estado: 'Activo',
    origen_candidato_id: c.id,
  }]);
}

function confirmarEliminar(id) {
  const c = candidatos.find(x => x.id === id);
  if (!c) return;
  confirmar(
    `Eliminar candidato`,
    `¿Estás seguro de que deseas eliminar a <strong>${c.nombre}</strong> del sistema? Esta operación es definitiva.`,
    'warn',
    async () => {
      if (esDemo()) {
        candidatos = candidatos.filter(x => x.id !== id);
        renderizarTodo();
      } else {
        const { error } = await db.from('candidatos').delete().eq('id', id);
        if (error) { toast('Error al eliminar', 'err'); return; }
      }
      toast(`${c.nombre} eliminado con éxito`, 'ok');
    },
    'Eliminar',
    'bg-error hover:bg-red-700'
  );
}

async function actualizarEstado(id, nuevoEstado, extras = {}) {
  if (esDemo()) {
    const idx = candidatos.findIndex(c => c.id === id);
    if (idx >= 0) candidatos[idx] = { ...candidatos[idx], estado: nuevoEstado, ...extras };
    renderizarTodo();
    return;
  }
  const { error } = await db.from('candidatos').update({ estado: nuevoEstado, ...extras }).eq('id', id);
  if (error) toast('Error al actualizar: ' + error.message, 'err');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MODAL HELPERS (OVERLAYS)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function abrirModal(id) { document.getElementById(id).classList.add('open'); }
function cerrarModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(bg => {
  bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('open'); });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
});

function confirmar(titulo, cuerpo, tipo, accion, btnTxt='Confirmar', btnClass='bg-primary hover:bg-black') {
  const iconMap = { warn:'warning', success:'check_circle' };
  const bgMap = { warn:'background:#FFFBEB;color:#D97706', success:'background:#F0FDF4;color:#16A34A' };
  
  const iconContainer = document.getElementById('confirm-icon');
  if (iconContainer) {
    iconContainer.style.cssText = bgMap[tipo] || bgMap.warn;
    iconContainer.innerHTML = `<span class="material-symbols-outlined">${iconMap[tipo] || 'warning'}</span>`;
  }
  
  document.getElementById('confirm-title').textContent = titulo;
  document.getElementById('confirm-body').innerHTML = cuerpo;
  
  const ok = document.getElementById('confirm-ok');
  if (ok) {
    ok.textContent = btnTxt;
    ok.className = `px-5 py-2 text-xs font-bold text-white rounded-xl transition-all active:scale-95 cursor-pointer ${btnClass}`;
    ok.onclick = async () => {
      cerrarModal('modal-confirm');
      await accion();
    };
  }
  abrirModal('modal-confirm');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOAST NOTIFICATIONS (Tailwind & Symbols)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function toast(msg, tipo='') {
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

function esDemo() { return modoDemo; }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INITIALIZATION & GLOBAL BINDING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
iniciar();

window.guardar = guardar;
window.abrirNuevo = abrirNuevo;
window.editarCandidato = editarCandidato;
window.verHV = verHV;
window.filtrarPor = filtrarPor;
window.filtrarTabla = filtrarTabla;
window.confirmarEliminar = confirmarEliminar;
window.confirmarContratar = confirmarContratar;
window.confirmarAvanzar = confirmarAvanzar;
window.cerrarModal = cerrarModal;
window.filtrarPorVacante = filtrarPorVacante;
window.limpiarFiltroVacanteCompleto = limpiarFiltroVacanteCompleto;
