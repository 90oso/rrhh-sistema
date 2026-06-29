import { supabase } from '../supabase-client.js';

// Coordenadas objetivo de la Demo (Configúralas con las de tu aula de clases)
const EMPRESA_LAT = 9.012345; 
const EMPRESA_LNG = -79.543210;
const RADIO_MAXIMO_METROS = 50; // Radio límite permitido para marcar asistencia

document.addEventListener('DOMContentLoaded', () => {
    const btnMarcar = document.getElementById('btn-marcar-entrada');
    const txtDistancia = document.getElementById('distancia-info');

    // 1. Fórmula matemática Haversine para calcular distancia exacta en metros entre dos puntos GPS
    function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Radio de la Tierra en metros
        const phi1 = lat1 * Math.PI / 180;
        const phi2 = lat2 * Math.PI / 180;
        const deltaPhi = (lat2 - lat1) * Math.PI / 180;
        const deltaLambda = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
                  Math.cos(phi1) * Math.cos(phi2) *
                  Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Retorna la distancia en metros
    }

    // 2. Lógica para obtener ubicación móvil al presionar el botón
    if (btnMarcar) {
        btnMarcar.addEventListener('click', () => {
            if (!navigator.geolocation) {
                return alert('Tu navegador móvil no soporta geolocalización.');
            }

            txtDistancia.innerText = "Calculando ubicación por GPS...";

            navigator.geolocation.getCurrentPosition(async (position) => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;

                // Calcular la distancia real hasta el salón de clases
                const distanciaMeters = calcularDistanciaHaversine(userLat, userLng, EMPRESA_LAT, EMPRESA_LNG);
                const estaDentro = distanciaMeters <= RADIO_MAXIMO_METROS;

                txtDistancia.innerText = `Distancia calculada: ${distanciaMeters.toFixed(2)} metros.`;

                if (!estaDentro) {
                    alert(`Marcado rechazado. Estás fuera del rango permitido por ${Math.abs(distanciaMeters - RADIO_MAXIMO_METROS).toFixed(1)} metros.`);
                    return;
                }

                // Si está dentro del rango, guardar el marcado en Supabase
                const nuevoMarcado = {
                    tipo: 'entrada',
                    timestamp: new Date().toISOString(),
                    lat: userLat,
                    lng: userLng,
                    distancia_m: parseFloat(distanciaMeters.toFixed(2)),
                    aprobado: true
                };

                const { error } = await supabase.from('asistencia').insert([nuevoMarcado]);
                if (error) {
                    alert('Error al guardar asistencia: ' + error.message);
                } else {
                    alert('¡Marcado de entrada registrado exitosamente!');
                }

            }, (error) => {
                alert('Debes permitir el acceso al GPS para marcar asistencia.');
                txtDistancia.innerText = "Acceso a GPS denegado.";
            }, { enableHighAccuracy: true });
        });
    }

    // 3. Pantalla de la Demo (Proyector): Actualización automática en TIEMPO REAL
    async function cargarDashboardAsistencia() {
        const { data: marcados, error } = await supabase.from('asistencia').select('*').order('timestamp', { ascending: false });
        if (error) return console.error(error);
        renderizarDashboard(marcados);
    }

    function renderizarDashboard(marcados) {
        const tabla = document.getElementById('tabla-asistencia-tiempo-real');
        if (!tabla) return;
        tabla.innerHTML = '';

        marcados.forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(m.timestamp).toLocaleTimeString()}</td>
                <td>${m.tipo.toUpperCase()}</td>
                <td>${m.distancia_m} m</td>
                <td><span class="badge-status">${m.aprobado ? 'Aprobado por GPS' : 'Rechazado'}</span></td>
            `;
            tabla.appendChild(tr);
        });
    }

    // Suscripción a Supabase Realtime (Escucha los cambios en la tabla para la pantalla del Proyector)
    if (document.getElementById('tabla-asistencia-tiempo-real')) {
        cargarDashboardAsistencia();

        supabase
            .channel('cambios-asistencia')
            .on('postgres_changes', { event: 'INSERT', scheme: 'public', table: 'asistencia' }, payload => {
                console.log('Nuevo marcado detectado en tiempo real:', payload.new);
                cargarDashboardAsistencia(); // Refresca instantáneamente el dashboard del proyector
            })
            .subscribe();
    }
});
