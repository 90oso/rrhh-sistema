# Publicar y presentar la demostración de Suite RRHH

## Estado
La página `docs/index.html` es una demostración interactiva autónoma y ficticia, probada en navegador Chromium mediante GitHub Actions. No representa certificación de producción.

## Publicación en GitHub Pages
1. Abrir el repositorio `90oso/rrhh-sistema` → **Settings** → **Pages**.
2. En **Build and deployment** elegir **Deploy from a branch**.
3. Seleccionar rama `feat/commercial-demo-2026-10` y carpeta **/docs**, luego guardar.
4. Verificar el despliegue en **Actions** y abrir la URL cuando GitHub la publique.
5. Opcional: revisar y fusionar el PR, y cambiar Pages a rama `main`, carpeta **/docs**.

**No publicar credenciales, bases reales ni información personal.** La demo se publica en GitHub Pages; la aplicación de producción necesita hosting y controles independientes.

## Guion de demostración
1. Abrir **Reclutamiento**, añadir candidata ficticia.
2. Cambiar etapa a Contratado.
3. Comprobar su entrada al directorio.
4. Registrar y aprobar permisos de esa persona.
5. Exportar CSV y restablecer datos.

## Mensaje para comprador
Gestión de personal y procesos de contratación para pymes, no nómina implementada.

## Advertencias
El sistema legado requiere reescritura de autenticación/RLS y reparación de migraciones antes de datos reales.

## Más información
- [Evaluación multidisciplinaria](COMERCIALIZACION.md)
- [Pull request]( https://github.com/90oso/rrhh-sistema/pull/3 )
