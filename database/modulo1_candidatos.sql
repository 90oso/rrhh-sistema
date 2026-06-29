-- ═══════════════════════════════════════════════════════
--  RRHH SISTEMA — Módulo 1: Reclutamiento
--  Ejecutar en: https://app.supabase.com → SQL Editor
-- ═══════════════════════════════════════════════════════

-- Tabla de candidatos
CREATE TABLE IF NOT EXISTS candidatos (
  id               BIGSERIAL PRIMARY KEY,
  nombre           TEXT NOT NULL,
  email            TEXT NOT NULL,
  cargo            TEXT NOT NULL,
  fecha_postulacion DATE,
  entrevista       TEXT,
  estado           TEXT NOT NULL DEFAULT 'Postulado'
                   CHECK (estado IN ('Postulado','Preseleccionado','Entrevista','Oferta','Contratado','Rechazado')),
  cv_link          TEXT,
  comentario       TEXT,
  motivo_rechazo   TEXT,
  fecha_contrato   DATE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de empleados (recibe contratados del Módulo 1)
CREATE TABLE IF NOT EXISTS empleados (
  id                   BIGSERIAL PRIMARY KEY,
  nombre               TEXT NOT NULL,
  email                TEXT,
  cargo                TEXT,
  departamento         TEXT,
  jefe_directo         TEXT,
  tipo_contrato        TEXT DEFAULT 'Indefinido'
                       CHECK (tipo_contrato IN ('Indefinido','Temporal','Servicios')),
  salario_base         NUMERIC(12,2),
  contacto_emergencia  TEXT,
  fecha_ingreso        DATE,
  estado               TEXT NOT NULL DEFAULT 'Activo'
                       CHECK (estado IN ('Activo','Suspendido','Inactivo')),
  origen_candidato_id  BIGINT REFERENCES candidatos(id),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER candidatos_updated_at
  BEFORE UPDATE ON candidatos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER empleados_updated_at
  BEFORE UPDATE ON empleados
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Habilitar Realtime en candidatos
ALTER PUBLICATION supabase_realtime ADD TABLE candidatos;

-- Datos de ejemplo
INSERT INTO candidatos (nombre, email, cargo, fecha_postulacion, entrevista, estado, comentario) VALUES
  ('Valeria Núñez',  'valeria@email.com', 'Diseñadora UX',  '2026-05-05', NULL,                    'Postulado',       NULL),
  ('Sofía Castro',   'sofia@email.com',   'Dev Frontend',   '2026-05-03', 'Sin agendar',            'Preseleccionado', 'Buena presentación'),
  ('Manuel Torres',  'manuel@email.com',  'Analista Datos', '2026-04-28', '12 May 2026 · 10:00',   'Entrevista',      NULL),
  ('Andrés Mejía',   'andres@email.com',  'Dev Backend',    '2026-04-20', '02 May · Aprobado',      'Oferta',          'Excelente perfil técnico'),
  ('José Ramírez',   'jose@email.com',    'Vendedor',       '2026-04-10', '22 Abr · Aprobado',      'Contratado',      NULL),
  ('Carmen Flores',  'carmen@email.com',  'Contadora',      '2026-04-15', '25 Abr · No apto',       'Rechazado',       NULL);

UPDATE candidatos SET motivo_rechazo = 'Sin competencias requeridas', fecha_contrato = NULL WHERE nombre = 'Carmen Flores';
UPDATE candidatos SET fecha_contrato = '2026-04-28' WHERE nombre = 'José Ramírez';
