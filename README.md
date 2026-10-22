# Suite RRHH · evaluación comercial

El sistema existente, históricamente llamado TalentHub B2B, es un prototipo académico. **No está autorizado para tratar datos laborales reales ni para venderse como un SaaS seguro en su estado actual**: la autenticación con contraseña compartida, sesiones gestionadas por navegador y políticas RLS sin verificar son impedimentos críticos.

## Demo comercial independiente

[Probar `docs/index.html`](docs/index.html): empleados ficticios, pipeline de contratación, aprobación de permisos, búsqueda y exportación CSV; sin acceso a Supabase. Puede publicarse como página estática desde `/docs` cuando se integren los cambios a la rama principal.

## Antes de un piloto con personas reales

Implementar Supabase Auth, definir roles y autorizaciones basados en identidad verificada, aplicar RLS por organización en todas las tablas y comprobar con pruebas de acceso cruzado, registrar modificaciones sensibles, respaldos, borrado y documentación de privacidad. **Nunca usar `demo123` con empleados reales.**

El nombre comercial es provisional: debe verificarse su disponibilidad antes de registrarlo o anunciarlo.

---

# TalentHub B2B — Sistema de RRHH

Sistema web de Recursos Humanos con acceso por rol (Empleado, Gerente, RRHH, Admin), construido como un conjunto de módulos HTML/JS independientes que comparten un login único y una base de datos en **Supabase (PostgreSQL)**.

Cada rol inicia sesión desde una misma pantalla y es redirigido automáticamente al módulo que le corresponde.

<img width="1080" height="720" alt="image" src="https://github.com/user-attachments/assets/15884c00-c094-479f-9fe4-defb5aa6204b" />



## Características

- **Login único con enrutamiento por rol**: el sistema busca el correo en la tabla `empleados` y redirige a cada usuario al módulo que le corresponde.
- **Protección de módulos** (`auth-guard.js`): cada módulo verifica sesión y permisos antes de mostrarse, y oculta del menú los enlaces a módulos no permitidos.
- **Modo claro / oscuro** persistente y compartido entre el login y todos los módulos (`localStorage`).
- **Personalización de perfil** (nombre visible, cargo y color de avatar) desde cualquier módulo.
- **Datos en tiempo real** vía Supabase Realtime en las tablas principales.
- **Accesibilidad**: diálogos con foco atrapado, regiones `aria-live`, atajos de teclado y búsqueda mejorada, aplicados de forma global (`user-prefs.js`).

## Módulos

| # | Módulo | Descripción | Acceso |
|---|--------|-------------|--------|
| 1 | **Reclutamiento** | Gestión de candidatos: postulación, entrevistas, oferta y contratación (pasan automáticamente a `empleados`). | RRHH, Admin |
| 2 | **Personal** | Ficha del empleado: datos generales, capacitaciones, evaluaciones de desempeño e historial de movimientos. | RRHH, Admin |
| 3 | **Control Diario** | Asistencia / control diario del empleado. | Empleado, RRHH, Admin |
| 4 | **Desarrollo** | Seguimiento de capacitaciones y evaluaciones (alimentado por el Módulo 2). | RRHH, Admin |
| 5 | **Salida (Offboarding)** | Registro de bajas: motivo, entrevista de salida, checklist de equipo/accesos/liquidación. | RRHH, Admin |
| 6 | **Reportes Gerenciales** | Indicadores y reportes agregados de todo el sistema. | Gerente, Admin |


<img width="1080" height="720" alt="image" src="https://github.com/user-attachments/assets/8987d4f6-d991-43b4-9965-a7866e97c686" />


## Arquitectura

```
Navegador (HTML + JS por módulo)
        │
        ├── frontend/supabase-client.js   → cliente único de Supabase (CDN, sin build)
        ├── frontend/shared/auth-guard.js → protege cada módulo según el rol en sessionStorage
        └── frontend/shared/user-prefs.js → tema claro/oscuro y preferencias de perfil
        │
        ▼
   Supabase (PostgreSQL + Realtime)
```

No hay backend propio ni build step: cada módulo es un `index.html` + `script.js` que se conecta directo a Supabase desde el navegador usando la anon key (protegida por RLS, ver [Seguridad](#seguridad)).

## Estructura del repositorio

```
rrhh-sistema/
├── index.html                      # Login (punto de entrada)
├── frontend/
│   ├── supabase-client.js          # Configuración del cliente Supabase
│   ├── shared/
│   │   ├── styles.css
│   │   ├── auth-guard.js           # Control de acceso por módulo
│   │   └── user-prefs.js           # Tema y personalización de perfil
│   ├── modulo1-reclutamiento/
│   ├── modulo2-personal/
│   ├── modulo3-control/
│   ├── modulo4-desarrollo/
│   ├── modulo5-salida/
│   └── modulo6-reportes/
├── database/
│   ├── modulo1_candidatos.sql      # Tablas candidatos + empleados
│   ├── modulo2_personal.sql        # Capacitaciones, evaluaciones, movimientos
│   └── modulo5_salida.sql          # Tabla de salidas / offboarding
└── docs/
    └── screenshots/                # 👉 aquí van tus capturas de pantalla
```

## Requisitos previos

- Una cuenta y un proyecto en [Supabase](https://supabase.com).
- Un servidor estático simple para servir los archivos (no es obligatorio, pero evita problemas de CORS/módulos ES al abrir `index.html` directo con `file://`). Por ejemplo:
  - `npx serve .`
  - `python -m http.server`
  - La extensión "Live Server" de VS Code.

## Instalación y configuración

1. **Clona el repositorio**

   ```bash
   git clone https://github.com/90oso/rrhh-sistema.git
   cd rrhh-sistema
   ```

2. **Crea un proyecto en Supabase** y copia tu `Project URL` y `anon public key` desde *Settings → API*.

3. **Configura el cliente** en `frontend/supabase-client.js`:

   ```js
   const SUPABASE_URL = "https://tu-proyecto.supabase.co";
   const SUPABASE_ANON_KEY = "tu-anon-key";
   ```

4. **Ejecuta las migraciones SQL** (ver siguiente sección) en el *SQL Editor* de Supabase.

5. **Sirve el proyecto** con un servidor estático y abre `index.html`:

   ```bash
   npx serve .
   ```

## Base de datos

Los scripts en `database/` deben ejecutarse **en orden**, desde el SQL Editor de Supabase:

1. `modulo1_candidatos.sql` — crea `candidatos` y `empleados` (base de todo el sistema).
2. `modulo2_personal.sql` — amplía `empleados` y crea `capacitaciones_empleado`, `evaluaciones_empleado`, `movimientos_empleado`.
3. `modulo5_salida.sql` — crea `salidas`, con trigger que marca al empleado como `Inactivo` al registrar su baja.

Cada script habilita **Realtime** en su(s) tabla(s) principal(es) y algunos incluyen datos de ejemplo para poder probar el sistema de inmediato.

## Cuentas de demostración

El login incluye accesos rápidos de prueba (contraseña única `demo123` para el resto de usuarios reales):

| Rol | Correo demo | Va directo a |
|---|---|---|
| Empleado | `empleado.demo@empresa.com` | Control Diario |
| Gerente | `gerente.demo@empresa.com` | Reportes Gerenciales |
| RRHH | `rrhh.demo@empresa.com` | Reclutamiento, Personal, Control Diario, Desarrollo, Salida |

> Estas cuentas simulan la sesión en el navegador sin pasar por la tabla `empleados`; para probar con datos reales, crea un registro en `empleados` con el correo deseado y usa la contraseña `demo123` en el formulario de login.

## Roles y permisos

El acceso a cada módulo está definido en un único mapa (`ACCESO_POR_ROL`), replicado en el login y en `auth-guard.js`:

| Rol | Módulos permitidos |
|---|---|
| **Empleado** | Control Diario |
| **Gerente** | Reportes Gerenciales |
| **RRHH** | Reclutamiento, Personal, Control Diario, Desarrollo, Salida |
| **Admin** | Todos los anteriores + Reportes + Configuración |

## Seguridad

Este proyecto se apoya en la **anon key** de Supabase, pensada para exponerse en el cliente. Antes de usarlo con datos reales:

- Activa **Row Level Security (RLS)** en todas las tablas y define políticas por rol/usuario.
- No dependas solo de la validación en el frontend (`auth-guard.js`): es una capa de UX, no de seguridad.
- Considera migrar la autenticación de la contraseña compartida (`demo123`) a **Supabase Auth** para un entorno de producción.

## Tecnologías

- HTML5 + CSS3 (Tailwind vía utilidades) + JavaScript (ES Modules, sin build)
- [Supabase](https://supabase.com) (PostgreSQL, Realtime) vía `@supabase/supabase-js` desde CDN
- Google Fonts (Plus Jakarta Sans) y Material Symbols

## Roadmap

- [ ] Migrar autenticación a Supabase Auth
- [ ] Políticas RLS por tabla
- [ ] Tests automatizados
- [ ] Exportación de reportes (PDF/Excel)
