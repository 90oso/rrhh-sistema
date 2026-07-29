# RRHH Sistema 🏢

Un sistema completo de gestión de Recursos Humanos diseñado para simplificar la administración de empleados, nóminas, ausencias y documentación.

---

## 📋 Descripción

<!-- Agrega aquí la descripción detallada de tu proyecto -->
RRHH Sistema es una aplicación web moderna para la gestión integral de recursos humanos. Proporciona herramientas para:

- Administración de empleados
- Gestión de nóminas
- Control de ausencias y permisos
- Documentación de personal
- Reportes y análisis

---

## ✨ Características

- ✅ Gestión centralizada de empleados
- ✅ Cálculo automático de nóminas
- ✅ Control de asistencia y permisos
- ✅ Generación de reportes
- ✅ Interface responsiva y moderna
- ✅ Seguridad y control de accesos
- ✅ Base de datos robusta

---

## 📸 Capturas de Pantalla

### Dashboard Principal
![Dashboard](./docs/images/dashboard.png)

### Gestión de Empleados
![Empleados](./docs/images/empleados.png)

### Reportes
![Reportes](./docs/images/reportes.png)

---

## 🚀 Instalación

### Requisitos Previos
- Node.js (v14 o superior)
- npm o yarn
- MySQL/PostgreSQL
- Git

### Pasos de Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/90oso/rrhh-sistema.git
cd rrhh-sistema

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env

# 4. Ejecutar migraciones de base de datos
npm run migrate

# 5. Iniciar el servidor
npm start
```

---

## 💻 Uso

### Iniciar la Aplicación
```bash
npm start
```

La aplicación estará disponible en: `http://localhost:3000`

### Estructura del Proyecto
```
rrhh-sistema/
├── frontend/          # Interfaz de usuario
├── database/          # Scripts y migraciones
├── index.html         # Página principal
├── .env.example       # Ejemplo de configuración
└── README.md          # Este archivo
```

---

## ⚙️ Configuración

Edita el archivo `.env` con tus configuraciones:

```env
# Base de Datos
DB_HOST=localhost
DB_PORT=3306
DB_NAME=rrhh_db
DB_USER=root
DB_PASSWORD=your_password

# Servidor
PORT=3000
NODE_ENV=development

# Seguridad
JWT_SECRET=your_secret_key
```

---

## 📁 Estructura del Proyecto

```
.
├── frontend/              # Frontend de la aplicación
│   ├── src/
│   ├── public/
│   └── package.json
├── database/              # Base de datos
│   ├── migrations/
│   └── seeds/
├── docs/                  # Documentación
│   └── images/           # Imágenes para README
├── index.html            # Página inicial
└── README.md             # Este archivo
```

---

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Para contribuir:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

---

## 📧 Contacto

**Autor:** 90oso  
**Email:** tu-email@example.com  
**GitHub:** [@90oso](https://github.com/90oso)

---

## 🙏 Agradecimientos

Gracias a todos los que han contribuido a este proyecto y a la comunidad open source.

---

**Última actualización:** Julio 2026
