-- ═══════════════════════════════════════════════════════
--  RRHH SISTEMA — Módulo 2: Personal
--  Ejecutar en: https://app.supabase.com → SQL Editor
--  (Requiere haber ejecutado modulo1_candidatos.sql antes)
-- ═══════════════════════════════════════════════════════

-- Tabla empleados (ya creada en Módulo 1, ampliada aquí)
-- Agregar columnas si no existen
ALTER TABLE empleados
  ADD COLUMN IF NOT EXISTS telefono TEXT,
  ADD COLUMN IF NOT EXISTS notas TEXT;

-- Tabla de capacitaciones por empleado (alimenta Módulo 4)
CREATE TABLE IF NOT EXISTS capacitaciones_empleado (
  id            BIGSERIAL PRIMARY KEY,
  empleado_id   BIGINT NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  fecha         DATE,
  horas         INTEGER,
  proveedor     TEXT,
  estado        TEXT DEFAULT 'Completado'
                CHECK (estado IN ('Inscrito','En curso','Completado','No completado')),
  descripcion   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de evaluaciones de desempeño (alimenta Módulo 4)
CREATE TABLE IF NOT EXISTS evaluaciones_empleado (
  id               BIGSERIAL PRIMARY KEY,
  empleado_id      BIGINT NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  fecha            DATE NOT NULL,
  puntualidad      NUMERIC(3,1),
  trabajo_equipo   NUMERIC(3,1),
  resultados       NUMERIC(3,1),
  liderazgo        NUMERIC(3,1),
  promedio         NUMERIC(3,2) GENERATED ALWAYS AS (
                     (COALESCE(puntualidad,0)+COALESCE(trabajo_equipo,0)+COALESCE(resultados,0)+COALESCE(liderazgo,0))/4
                   ) STORED,
  descripcion      TEXT,
  evaluador        TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de movimientos / historial del empleado
CREATE TABLE IF NOT EXISTS movimientos_empleado (
  id           BIGSERIAL PRIMARY KEY,
  empleado_id  BIGINT NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL,  -- 'Cambio de cargo', 'Cambio de estado', 'Ingreso', etc.
  descripcion  TEXT,
  fecha        DATE DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE empleados;

-- Datos de ejemplo
INSERT INTO empleados (nombre, email, telefono, cargo, departamento, jefe_directo_id, tipo_contrato, salario_base, fecha_ingreso, estado, contacto_emergencia) VALUES
  ('Ana García',     'ana@empresa.com',      '+507 6100-0001', 'Gerente RRHH',    'RRHH',        NULL, 'Indefinido', 3500, '2020-01-15', 'Activo', 'Pedro García · +507 6200-0001'),
  ('Carlos Mora',    'carlos@empresa.com',   '+507 6100-0002', 'Analista TI',     'TI',          1,    'Indefinido', 2200, '2021-03-10', 'Activo', 'Luisa Mora · +507 6200-0002'),
  ('Lucía Pérez',    'lucia@empresa.com',    '+507 6100-0003', 'Diseñadora',      'Marketing',   1,    'Temporal',   1800, '2022-06-01', 'Activo', ''),
  ('Roberto Sánchez','roberto@empresa.com',  '+507 6100-0004', 'Dev Backend',     'TI',          2,    'Indefinido', 2800, '2021-08-15', 'Activo', '+507 6000-1234'),
  ('María Jiménez',  'maria@empresa.com',    '+507 6100-0005', 'Contadora',       'Finanzas',    1,    'Indefinido', 2400, '2020-11-20', 'Activo', ''),
  ('Diego Vargas',   'diego@empresa.com',    '+507 6100-0006', 'Vendedor',        'Comercial',   1,    'Servicios',  1500, '2023-02-01', 'Activo', ''),
  ('Patricia López', 'patricia@empresa.com', '+507 6100-0007', 'Asistente RRHH',  'RRHH',        1,    'Temporal',   1200, '2023-09-15', 'Activo', ''),
  ('Fernando Ruiz',  'fernando@empresa.com', '+507 6100-0008', 'Supervisor',      'Operaciones', 1,    'Indefinido', 2600, '2022-04-10', 'Activo', '');

-- Registrar ingreso en movimientos
INSERT INTO movimientos_empleado (empleado_id, tipo, descripcion, fecha)
SELECT id, 'Ingreso', 'Ingreso a la empresa — cargo: '||cargo, fecha_ingreso FROM empleados;

-- Capacitaciones de ejemplo
INSERT INTO capacitaciones_empleado (empleado_id, nombre, fecha, horas, proveedor, estado) VALUES
  (4, 'Seguridad Industrial', '2026-03-15', 8,  'Instituto Nacional', 'Completado'),
  (4, 'Excel Avanzado',       '2026-01-10', 16, 'Capacita Panama',    'Completado'),
  (2, 'Ciberseguridad',       '2026-02-20', 24, 'ISACA',              'Completado');

-- Evaluaciones de ejemplo
INSERT INTO evaluaciones_empleado (empleado_id, fecha, puntualidad, trabajo_equipo, resultados, liderazgo, evaluador) VALUES
  (4, '2026-04-01', 4.5, 4.0, 4.2, 4.0, 'Ana García'),
  (4, '2025-12-01', 4.0, 3.8, 4.0, 3.8, 'Ana García'),
  (2, '2026-04-01', 4.8, 4.5, 4.3, 4.0, 'Ana García');
