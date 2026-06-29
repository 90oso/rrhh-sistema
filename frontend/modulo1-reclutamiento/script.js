import { supabase } from '../supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-postulante');
    const inputBuscar = document.getElementById('buscar-candidato');
    const filterEstado = document.getElementById('filtro-estado');

    // 1. Registrar Postulante
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            
            const nuevoCandidato = {
                nombre: formData.get('nombre'),
                cargo: formData.get('cargo'),
                fecha_postulacion: new Date().toISOString().split('T')[0],
                cv_link: formData.get('cv_link'),
                estado: 'Postulado'
            };

            const { error } = await supabase.from('candidatos').insert([nuevoCandidato]);
            if (error) {
                alert('Error al registrar postulante: ' + error.message);
            } else {
                alert('¡Postulante registrado con éxito!');
                form.reset();
                cargarCandidatos();
            }
        });
    }

    // 2. Cargar y Filtrar Candidatos
    async function cargarCandidatos() {
        let query = supabase.from('candidatos').select('*');

        if (filterEstado && filterEstado.value) {
            query = query.eq('estado', filterEstado.value);
        }
        if (inputBuscar && inputBuscar.value) {
            query = query.ilike('nombre', `%${inputBuscar.value}%`);
        }

        const { data: candidatos, error } = await query;
        if (error) return console.error(error);

        renderizarTabla(candidatos);
    }

    function renderizarTabla(candidatos) {
        const tabla = document.getElementById('tabla-candidatos');
        if (!tabla) return;
        tabla.innerHTML = '';

        candidatos.forEach(cand => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${cand.nombre}</td>
                <td>${cand.cargo}</td>
                <td>
                    <select class="change-estado" data-id="${cand.id}">
                        <option value="Postulado" ${cand.estado === 'Postulado' ? 'selected' : ''}>Postulado</option>
                        <option value="Preseleccionado" ${cand.estado === 'Preseleccionado' ? 'selected' : ''}>Preseleccionado</option>
                        <option value="Entrevista" ${cand.estado === 'Entrevista' ? 'selected' : ''}>Entrevista</option>
                        <option value="Oferta" ${cand.estado === 'Oferta' ? 'selected' : ''}>Oferta</option>
                        <option value="Contratado" ${cand.estado === 'Contratado' ? 'selected' : ''}>Contratado</option>
                        <option value="Rechazado" ${cand.estado === 'Rechazado' ? 'selected' : ''}>Rechazado</option>
                    </select>
                </td>
                <td>
                    ${cand.estado === 'Contratado' 
                        ? `<button class="btn-contratar" data-id="${cand.id}" disabled>Ya Contratado</button>`
                        : `<button class="btn-contratar" data-id="${cand.id}">Contratar</button>`
                    }
                </td>
            `;
            tabla.appendChild(tr);
        });

        // Eventos para cambiar estado dinámicamente
        document.querySelectorAll('.change-estado').forEach(select => {
            select.addEventListener('change', async (e) => {
                const id = e.target.dataset.id;
                const nuevoEstado = e.target.value;
                await supabase.from('candidatos').update({ estado: nuevoEstado }).eq('id', id);
                cargarCandidatos();
            });
        });

        // Botón "Contratar" -> Traspasa datos al Módulo 2
        document.querySelectorAll('.btn-contratar').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                
                // Obtener datos del candidato seleccionado
                const { data: cand } = await supabase.from('candidatos').select('*').eq('id', id).single();
                
                if (cand) {
                    // Insertar en la tabla de empleados (Módulo 2)
                    const nuevoEmpleado = {
                        nombre: cand.nombre,
                        cargo: cand.cargo,
                        estado_empleado: 'Activo'
                    };
                    
                    const { error: errorEmp } = await supabase.from('empleados').insert([nuevoEmpleado]);
                    
                    if (!errorEmp) {
                        // Cambiar estado en reclutamiento a Contratado
                        await supabase.from('candidatos').update({ estado: 'Contratado' }).eq('id', id);
                        alert(`¡${cand.nombre} ha sido trasladado exitosamente a Personal!`);
                        cargarCandidatos();
                    } else {
                        alert('Error al trasladar a personal: ' + errorEmp.message);
                    }
                }
            });
        });
    }

    if (inputBuscar) inputBuscar.addEventListener('input', cargarCandidatos);
    if (filterEstado) filterEstado.addEventListener('change', cargarCandidatos);
    cargarCandidatos();
});
