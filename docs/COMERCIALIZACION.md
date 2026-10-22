# Auditoría de comercialización — Suite RRHH

## Veredicto
**Potencial para pymes, pero el legado no está listo para datos de colaboradores reales.** El prototipo contiene seis módulos útiles y frontend multipágina. Tiene valor como implementación personalizable, no aún como SaaS multiempresa.

## Hallazgos críticos verificables
1. `index.html` valida la contraseña fija `demo123`. Sin Supabase Auth, comprobar el correo contra `empleados` no es demostrar identidad.
2. `frontend/shared/auth-guard.js` lee `rol` desde `sessionStorage`; la persona puede alterarlo. Ocultar enlaces no protege datos.
3. Las tablas de prueba incluyen salarios, teléfonos, CV y datos personales. Sin RLS sólida en la propia base, la clave pública permite consultas no autorizadas.
4. `frontend/supabase-client.js` original contenía proyecto/clave `anon` en el código. La nueva rama desacopla la configuración y **no concede acceso por defecto**. La clave anon no es un secreto en el diseño de Supabase, pero sin RLS validada el proyecto se expone.
5. SQL y JS no están alineados: el módulo 2 inserta `jefe_directo_id` cuando el esquema original usaba `jefe_directo`; el login busca `rol` sin que el SQL inicial lo crease. Esta rama agrega columnas explícitas.
6. Los scripts disponibles crean `capacitaciones_empleado` y `evaluaciones_empleado`, mientras que módulos 4 y 6 consultan `capacitaciones` y `evaluaciones`. También se usan tablas `asistencia`, `ausencias` y `vacaciones` sin migraciones correspondientes en este repositorio. **No asumir integración real completa.**
7. Numerosas plantillas usan `innerHTML`; cada entrada desde usuario/BD necesita escape o DOM seguro para evitar XSS.

## Implementación objetivo por orden
**P0:** Supabase Auth, roles y permisos respaldados en BD; RLS por `tenant_id`/usuario; migraciones completas e idempotentes; pruebas de acceso horizontal/vertical.
**P1:** unificar modelos y nombres de tablas; contratación transaccional; calendario laboral, permisos y vacaciones, roles gerente/RRHH, registro de auditoría.
**P2:** reportes exportables, importación segura, políticas de retención, multiempresa, facturación y panel administrador.
**P3:** integrar nómina panameña solo después de revisar CSS/MITRADEL/DGI con especialista; no se debe prometer nómina hoy.

## Demo actual
`docs/index.html` funciona sin Supabase, con candidatos ficticios, pipeline, contratación simulada, permisos, directorio y CSV. Es **un simulador interactivo, no una verificación de seis módulos reales**.

## Seguridad
`database/SECURITY_LOCKDOWN.sql` es opcional y restrictivo: revoca el acceso directo anon/authenticated a tablas conocidas; requiere revisión, respaldo y definición de nuevas políticas ANTES de aplicarlo. Rompe el prototipo legado intencionalmente si se ejecuta. La configuración de Supabase ahora parte vacía.

## Validación comercial
Comparables visibles en Panamá: Boxento anuncia precios por empleado (https://boxento.com/es-pa/pricing/) y Alobri módulos con nómina local (https://alobri.com/paises/panama/). Para competir, especializarse por tamaño y sector (pymes, clínicas pequeñas, consultoras), implementación y soporte, sin vender módulos inexistentes.
Entrevistas a gerentes RRHH: retrasos en contratos, asistencia, ausencias, rotación, volumen de procesos. KPI: horas administrativas ahorradas y reducción de errores.

**Marco de privacidad:** https://antai.gob.pa/reglamentan-ley-81-de-proteccion-de-datos-personales/
