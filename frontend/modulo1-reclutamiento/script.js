import { supabase } from "../supabase-client.js";
console.log("script.js cargado");
const db = supabase;
let modoDemo = false;
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ESTADO LOCAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let candidatos = [];
let filtroActual = 'todos';
let editandoId = null;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTES VISUALES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const COLORES = {
  Postulado:'#6366F1', Preseleccionado:'#8B5CF6', Entrevista:'#0EA5E9',
  Oferta:'#7C3AED', Contratado:'#16A34A', Rechazado:'#94A3B8'
};
const BADGES = {
  Postulado:'b-gray', Preseleccionado:'b-blue', Entrevista:'b-yellow',
  Oferta:'b-purple', Contratado:'b-green', Rechazado:'b-red'
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

        console.log("3. Resultado:", data);
        console.log("4. Error:", error);

        const dot = document.getElementById('status-dot');
        const txt = document.getElementById('status-text');
        const statusEl = document.getElementById('db-status');

        console.log("5. Elementos HTML", dot, txt, statusEl);

        if (error) {

            console.log("6. Entró al modo demo");

            modoDemo = true;

            dot.style.background = '#F59E0B';
            txt.textContent = 'Modo demo';

            candidatos = datosDemo();

            renderizarTodo();

            return;
        }

        console.log("7. Conectado correctamente");

        modoDemo = false;

        dot.style.background = '#22C55E';
        txt.textContent = 'Conectado';

        await cargarCandidatos();

        console.log("8. cargarCandidatos terminó");

        suscribirRealtime();

        console.log("9. Realtime iniciado");

        setTimeout(() => statusEl.classList.add("hidden"), 2000);

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

// Realtime — actualización automática en todos los navegadores
function suscribirRealtime() {
  db.channel('candidatos')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'candidatos' }, () => {
      cargarCandidatos();
    })
    .subscribe();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATOS DEMO (sin Supabase)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
// RENDER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderizarTodo() {
  actualizarStats();
  actualizarPipeline();
  renderTabla();
}

function actualizarStats() {
  const total = candidatos.length;
  const proceso = candidatos.filter(c=>['Preseleccionado','Entrevista','Oferta'].includes(c.estado)).length;
  const contratados = candidatos.filter(c=>c.estado==='Contratado');
  const tasa = total > 0 ? Math.round((contratados.length / total) * 100) : 0;

  // Tiempo promedio postulación→contrato
  const tiempos = contratados
    .map(c => diasEntre(c.fecha_postulacion, c.fecha_contrato))
    .filter(d => d !== null && d >= 0);
  const promDias = tiempos.length > 0 ? Math.round(tiempos.reduce((a,b)=>a+b,0) / tiempos.length) : '—';

  document.getElementById('st-total').textContent = total;
  document.getElementById('st-proceso').textContent = proceso;
  document.getElementById('st-contratados').textContent = contratados.length;
  document.getElementById('st-tasa').textContent = `↑ Tasa conversión ${tasa}%`;
  document.getElementById('st-dias').textContent = promDias;
  document.getElementById('badge-total').textContent = total;
  document.getElementById('fc-todos').textContent = total;
}

function actualizarPipeline() {
  const p = (e) => candidatos.filter(c=>c.estado===e).length;
  ['Postulado','Preseleccionado','Entrevista','Oferta','Contratado','Rechazado'].forEach((e,i) => {
    document.getElementById(`p-${i}`).textContent = p(e);
  });
}

function renderTabla() {
  const busqueda = (document.getElementById('search-input').value || '').toLowerCase();
  const filas = candidatos.filter(c => {
    const matchFiltro = filtroActual === 'todos' || c.estado === filtroActual;
    const matchBusqueda = !busqueda ||
      (c.nombre||'').toLowerCase().includes(busqueda) ||
      (c.cargo||'').toLowerCase().includes(busqueda) ||
      (c.email||'').toLowerCase().includes(busqueda);
    return matchFiltro && matchBusqueda;
  });

  const tbody = document.getElementById('tbody');
  if (filas.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6"><i class="ti ti-user-off" style="font-size:24px;display:block;margin:0 auto 8px;color:#CBD5E1"></i>Sin candidatos${filtroActual!=='todos'?' en esta etapa':''}</td></tr>`;
    return;
  }

  tbody.innerHTML = filas.map(c => {
    const ini = iniciales(c.nombre);
    const col = COLORES[c.estado] || '#94A3B8';
    const badge = BADGES[c.estado] || 'b-gray';
    const fecha = formatFecha(c.fecha_postulacion);
    const entrev = c.entrevista || '—';
    const entrevStyle = entrev === '—' ? 'color:var(--text-4)' : '';

    let acciones = '';
    if (c.estado === 'Rechazado') {
      acciones = `<span style="font-size:12px;color:var(--text-4)">${c.motivo_rechazo || 'Sin motivo registrado'}</span>`;
    } else if (c.estado === 'Contratado') {
      acciones = `
        <button class="btn btn-sm btn-green-outline" onclick="verHV(${c.id})">Ver perfil →</button>
        <button class="btn btn-sm" onclick="editarCandidato(${c.id})" title="Editar"><i class="ti ti-edit"></i></button>`;
    } else if (c.estado === 'Oferta') {
      acciones = `
        <button class="btn btn-sm" onclick="verHV(${c.id})">Ver HV</button>
        <button class="btn btn-sm btn-success" onclick="confirmarContratar(${c.id})"><i class="ti ti-check"></i>Contratar</button>`;
    } else {
      const idx = ESTADOS.indexOf(c.estado);
      const siguiente = (idx >= 0 && idx < ESTADOS.length - 2) ? ESTADOS[idx + 1] : null;
      acciones = `
        <button class="btn btn-sm" onclick="verHV(${c.id})">Ver HV</button>
        ${siguiente ? `<button class="btn btn-sm btn-blue-outline" onclick="confirmarAvanzar(${c.id})">Avanzar</button>` : ''}
        <button class="btn btn-sm" onclick="editarCandidato(${c.id})" title="Editar"><i class="ti ti-edit"></i></button>
        <button class="btn btn-sm btn-danger" onclick="confirmarEliminar(${c.id})" title="Eliminar"><i class="ti ti-trash"></i></button>`;
    }

    return `<tr data-estado="${c.estado}">
      <td>
        <div style="display:flex;align-items:center;gap:9px">
          <div class="av" style="background:${col}">${ini}</div>
          <div>
            <div style="font-weight:500;font-size:13px">${c.nombre}</div>
            <div style="font-size:11px;color:var(--text-4)">${c.email}</div>
          </div>
        </div>
      </td>

      <td>${c.cargo}</td>

      <td>${fecha}</td>

      <td style="${entrevStyle}">${entrev}</td>

      <td>
        <span class="badge ${badge}">
          ${c.estado}
        </span>
      </td>

      <!-- NUEVA COLUMNA DEL CV -->
      <td style="text-align:center">

        ${
          c.cv_archivo

          ? `<i class="ti ti-file-type-pdf"
                 style="color:#DC2626;font-size:19px"
                 title="CV almacenado"></i>`

          : c.cv_link

          ? `<i class="ti ti-link"
                 style="color:#2563EB;font-size:18px"
                 title="CV mediante enlace"></i>`

          : "-"

        }

      </td>

      <td>
        <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
          ${acciones}
        </div>
      </td>

    </tr>`;
  }).join('');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILTROS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function filtrarPor(estado, el) {
  filtroActual = estado;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  if (el) {
    el.classList.add('active');
  } else {
    // Desde pipeline — activar chip correspondiente
    const chips = document.querySelectorAll('.chip');
    chips.forEach(c => {
      if (c.textContent.trim() === estado) c.classList.add('active');
    });
    if (estado === 'todos') chips[0].classList.add('active');
  }
  renderTabla();
}

function filtrarTabla() { renderTabla(); }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VER HV
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function verHV(id) {
  const c = candidatos.find(x => x.id === id);
  if (!c) return;
  const ini = iniciales(c.nombre);
  const col = COLORES[c.estado] || '#94A3B8';
  const badge = BADGES[c.estado] || 'b-gray';

  document.getElementById('hv-content').innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;padding-bottom:16px;border-bottom:1px solid var(--border-light)">
      <div class="av" style="background:${col};width:52px;height:52px;font-size:17px">${ini}</div>
      <div>
        <div style="font-size:16px;font-weight:600;margin-bottom:4px">${c.nombre}</div>
        <div style="font-size:13px;color:var(--text-3);margin-bottom:7px">${c.email}</div>
        <span class="badge ${badge}">${c.estado}</span>
      </div>
    </div>
    <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Información del proceso</div>
    <div class="hv-field"><span class="hv-field-lbl">Cargo solicitado</span><span class="hv-field-val">${c.cargo}</span></div>
    <div class="hv-field"><span class="hv-field-lbl">Fecha postulación</span><span class="hv-field-val">${formatFecha(c.fecha_postulacion)}</span></div>
    <div class="hv-field"><span class="hv-field-lbl">Entrevista</span><span class="hv-field-val">${c.entrevista || '—'}</span></div>
    ${c.fecha_contrato ? `<div class="hv-field"><span class="hv-field-lbl">Fecha contrato</span><span class="hv-field-val">${formatFecha(c.fecha_contrato)}</span></div>` : ''}
    ${c.cv_link ? `<div class="hv-field"><span class="hv-field-lbl">CV / portafolio</span><span class="hv-field-val"><a href="${c.cv_link}" target="_blank" style="color:var(--blue)">Ver CV →</a></span></div>` : ''}
    ${c.cv_archivo ? `<div class="hv-field"><span class="hv-field-lbl">Hoja de vida</span><span class="hv-field-val"><ahref="${c.cv_archivo}"target="_blank"style="color:var(--blue)">Descargar PDF →</a></span></div>` : ''}
    ${c.motivo_rechazo ? `<div class="hv-field"><span class="hv-field-lbl">Motivo rechazo</span><span class="hv-field-val" style="color:var(--red)">${c.motivo_rechazo}</span></div>` : ''}
    ${c.comentario ? `<div style="margin-top:14px;padding:10px 12px;background:#F8FAFC;border-radius:8px;font-size:13px;color:var(--text-2);border-left:3px solid var(--blue)"><div style="font-size:11px;color:var(--text-3);font-weight:500;margin-bottom:4px">Comentario del entrevistador</div>${c.comentario}</div>` : ''}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px">
      ${c.estado !== 'Contratado' && c.estado !== 'Rechazado' ? `<button class="btn btn-sm btn-blue-outline" onclick="cerrarModal('modal-hv');confirmarAvanzar(${c.id})">Avanzar etapa</button>` : ''}
      <button class="btn btn-sm" onclick="cerrarModal('modal-hv');editarCandidato(${c.id})"><i class="ti ti-edit"></i>Editar</button>
      <button class="btn btn-sm" onclick="cerrarModal('modal-hv')">Cerrar</button>
    </div>`;

  abrirModal('modal-hv');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FORMULARIO NUEVO / EDITAR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function abrirNuevo() {
  editandoId = null;
  document.getElementById('form-title').textContent = 'Agregar candidato';
  document.getElementById('btn-guardar-txt').textContent = 'Guardar candidato';
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
  document.getElementById('form-title').textContent = 'Editar candidato';
  document.getElementById('btn-guardar-txt').textContent = 'Guardar cambios';
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
  document.getElementById('motivo-group').style.display = estado === 'Rechazado' ? '' : 'none';
}

async function guardar() {
  const nombre = document.getElementById('f-nombre').value.trim();
  const email  = document.getElementById('f-email').value.trim();
  const cargo  = document.getElementById('f-cargo').value.trim();
  const estado = document.getElementById('f-estado').value;

  // Validar
  let ok = true;
  ['f-nombre','f-email','f-cargo'].forEach(id => {
    const el = document.getElementById(id);
    if (!el.value.trim()) { el.classList.add('error'); ok = false; }
    else el.classList.remove('error');
  });
  if (estado === 'Rechazado' && !document.getElementById('f-motivo').value) {
    document.getElementById('f-motivo').classList.add('error'); ok = false;
  }
  if (!ok) { toast('Completa los campos obligatorios', 'err'); return; }

  const datos = {
    nombre, email, cargo, estado,
    fecha_postulacion: document.getElementById('f-fecha').value || null,
    entrevista: document.getElementById('f-entrevista').value.trim() || null,
    cv_link: document.getElementById('f-cv').value.trim() || null,
    comentario: document.getElementById('f-comentario').value.trim() || null,
    motivo_rechazo: document.getElementById('f-motivo').value || null,
    fecha_contrato: estado === 'Contratado' ? (new Date().toISOString().split('T')[0]) : null,
  };

  const btnG = document.getElementById('btn-guardar');
  btnG.disabled = true;

  if (esDemo()) {
    // Modo demo — solo memoria local
    if (editandoId) {
      const idx = candidatos.findIndex(c => c.id === editandoId);
      if (idx >= 0) candidatos[idx] = { ...candidatos[idx], ...datos };
      toast('Cambios guardados (modo demo)');
    } else {
      candidatos.unshift({ id: Date.now(), ...datos });
      toast(`${nombre} agregado (modo demo)`);
    }
    renderizarTodo();
    cerrarModal('modal-form');
    btnG.disabled = false;
    return;
  }

  if (editandoId) {
    const { error } = await db.from('candidatos').update(datos).eq('id', editandoId);
    if (error) { toast('Error al guardar: ' + error.message, 'err'); btnG.disabled = false; return; }
    toast(`${nombre} actualizado`);
  } else {
    const { error } = await db.from('candidatos').insert([datos]);
    if (error) { toast('Error al guardar: ' + error.message, 'err'); btnG.disabled = false; return; }
    toast(`${nombre} agregado`);
  }
  cerrarModal('modal-form');
  btnG.disabled = false;
  // Realtime actualizará la tabla automáticamente
  if (esDemo()) renderizarTodo();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AVANZAR ETAPA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function confirmarAvanzar(id) {
  const c = candidatos.find(x => x.id === id);
  if (!c) return;
  const idx = ESTADOS.indexOf(c.estado);
  if (idx < 0 || idx >= ESTADOS.length - 2) return;
  const siguiente = ESTADOS[idx + 1];

  confirmar(
    `Avanzar a ${c.nombre}`,
    `Mover de <strong>${c.estado}</strong> a <strong>${siguiente}</strong>`,
    'warn',
    async () => {
      await actualizarEstado(id, siguiente);
      toast(`${c.nombre} avanzó a ${siguiente}`, 'ok');
    }
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONTRATAR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function confirmarContratar(id) {
  const c = candidatos.find(x => x.id === id);
  if (!c) return;

  confirmar(
    `Contratar a ${c.nombre}`,
    `Confirmar contratación para el cargo <strong>${c.cargo}</strong>.<br>Su perfil se enviará automáticamente al Módulo 2 — Personal.`,
    'success',
    async () => {
      const hoy = new Date().toISOString().split('T')[0];
      await actualizarEstado(id, 'Contratado', { fecha_contrato: hoy });
      // Aquí se puede hacer insert en tabla empleados (Módulo 2)
      await enviarAPersonal(c, hoy);
      toast(`✓ ${c.nombre} contratado exitosamente`, 'ok');
    },
    'Contratar',
    'btn-success'
  );
}

async function enviarAPersonal(c, fechaIngreso) {
  if (esDemo()) return;
  // Insertar en tabla empleados para que Módulo 2 lo reciba
  await db.from('empleados').insert([{
    nombre: c.nombre,
    email: c.email,
    cargo: c.cargo,
    fecha_ingreso: fechaIngreso,
    estado: 'Activo',
    origen_candidato_id: c.id,
  }]).select();
  // Errores silenciosos — la tabla puede no existir aún en demos
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ELIMINAR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function confirmarEliminar(id) {
  const c = candidatos.find(x => x.id === id);
  if (!c) return;
  confirmar(
    `Eliminar candidato`,
    `¿Eliminar a <strong>${c.nombre}</strong>? Esta acción no se puede deshacer.`,
    'warn',
    async () => {
      if (esDemo()) {
        candidatos = candidatos.filter(x => x.id !== id);
        renderizarTodo();
      } else {
        const { error } = await db.from('candidatos').delete().eq('id', id);
        if (error) { toast('Error al eliminar', 'err'); return; }
      }
      toast(`${c.nombre} eliminado`);
    },
    'Eliminar',
    'btn btn-danger'
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ACTUALIZAR ESTADO (Supabase o demo)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function actualizarEstado(id, nuevoEstado, extras = {}) {
  if (esDemo()) {
    const idx = candidatos.findIndex(c => c.id === id);
    if (idx >= 0) candidatos[idx] = { ...candidatos[idx], estado: nuevoEstado, ...extras };
    renderizarTodo();
    return;
  }
  const { error } = await db.from('candidatos').update({ estado: nuevoEstado, ...extras }).eq('id', id);
  if (error) toast('Error al actualizar: ' + error.message, 'err');
  // Realtime actualizará la tabla
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MODAL HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function abrirModal(id) { document.getElementById(id).classList.add('open'); }
function cerrarModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.overlay').forEach(bg => {
  bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('open'); });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.overlay.open').forEach(m => m.classList.remove('open'));
});

// Confirmar genérico
function confirmar(titulo, cuerpo, tipo, accion, btnTxt='Confirmar', btnClass='btn-success') {
  const iconMap = { warn:'ti-alert-triangle', success:'ti-check-circle' };
  const bgMap = { warn:'background:#FFFBEB;color:#D97706', success:'background:#F0FDF4;color:#16A34A' };
  document.getElementById('confirm-icon').style.cssText = bgMap[tipo]||bgMap.warn;
  document.getElementById('confirm-icon').innerHTML = `<i class="ti ${iconMap[tipo]||iconMap.warn}"></i>`;
  document.getElementById('confirm-title').textContent = titulo;
  document.getElementById('confirm-body').innerHTML = cuerpo;
  const ok = document.getElementById('confirm-ok');
  ok.textContent = btnTxt;
  ok.className = 'btn ' + btnClass;
  ok.onclick = async () => {
    cerrarModal('modal-confirm');
    await accion();
  };
  abrirModal('modal-confirm');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOAST
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function toast(msg, tipo='') {
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = `toast ${tipo==='ok'?'toast-ok':tipo==='err'?'toast-err':''}`;
  el.innerHTML = `<i class="ti ${tipo==='ok'?'ti-check':tipo==='err'?'ti-x':'ti-info-circle'}"></i>${msg}`;
  wrap.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DETECTAR MODO DEMO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function esDemo() {
    return modoDemo;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ARRANCAR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
iniciar();
// Hacer visibles las funciones para los onclick del HTML
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
