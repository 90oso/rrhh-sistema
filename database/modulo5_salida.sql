-- ═══════════════════════════════════════════════════════
--  RRHH SISTEMA — Módulo 5: Salida (Offboarding)
--  Ejecutar en: https://app.supabase.com → SQL Editor
--  (Requiere haber ejecutado modulo2_personal.sql antes)
-- ═══════════════════════════════════════════════════════

-- Registro de bajas de empleados
CREATE TABLE IF NOT EXISTS bajas_empleado (
  id                  BIGSERIAL PRIMARY KEY,
  empleado_id         BIGINT NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  tipo_baja           TEXT NOT NULL
                      CHECK (tipo_baja IN ('Voluntaria','Involuntaria','Fin de contrato','Jubilación')),
  motivo              TEXT,
  fecha_salida        DATE NOT NULL,
  observaciones       TEXT,
  estado_offboarding  TEXT DEFAULT 'Pendiente'
                      CHECK (estado_offboarding IN ('Pendiente','En proceso','Completado')),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Entrevistas de salida
CREATE TABLE IF NOT EXISTS entrevistas_salida (
  id                          BIGSERIAL PRIMARY KEY,
  baja_id                     BIGINT NOT NULL REFERENCES bajas_empleado(id) ON DELETE CASCADE,
  motivo_principal            TEXT,
  ambiente_laboral            INTEGER CHECK (ambiente_laboral BETWEEN 1 AND 5),
  relacion_jefe               INTEGER CHECK (relacion_jefe BETWEEN 1 AND 5),
  oportunidades_crecimiento   INTEGER CHECK (oportunidades_crecimiento BETWEEN 1 AND 5),
  recomendaria                BOOLEAN,
  sugerencias                 TEXT,
  entrevistador               TEXT,
  fecha                       DATE DEFAULT CURRENT_DATE,
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- Checklist de offboarding
CREATE TABLE IF NOT EXISTS checklist_offboarding (
  id                BIGSERIAL PRIMARY KEY,
  baja_id           BIGINT NOT NULL REFERENCES bajas_empleado(id) ON DELETE CASCADE,
  item              TEXT NOT NULL,
  completado        BOOLEAN DEFAULT FALSE,
  responsable       TEXT,
  fecha_completado  DATE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Realtime en las tablas nuevas
ALTER PUBLICATION supabase_realtime ADD TABLE bajas_empleado;
ALTER PUBLICATION supabase_realtime ADD TABLE entrevistas_salida;
ALTER PUBLICATION supabase_realtime ADD TABLE checklist_offboarding;

-- Datos de ejemplo
-- (Asume que existen empleados con id 3 y 6 del modulo2_personal.sql)

INSERT INTO bajas_empleado (empleado_id, tipo_baja, motivo, fecha_salida, observaciones, estado_offboarding) VALUES
  (3, 'Voluntaria',      'Oportunidad laboral en otra empresa',  '2026-06-30', 'Salida amigable, buen desempeño durante su estancia.', 'Completado'),
  (6, 'Fin de contrato', 'Contrato de servicios profesionales finalizado', '2026-07-15', 'Contrato no renovado por reestructuración del área comercial.', 'En proceso');

INSERT INTO entrevistas_salida (baja_id, motivo_principal, ambiente_laboral, relacion_jefe, oportunidades_crecimiento, recomendaria, sugerencias, entrevistador, fecha) VALUES
  (1, 'Mejor oferta salarial y posición de liderazgo en otra empresa', 4, 4, 3, TRUE,
   'Mejorar las oportunidades de crecimiento interno y revisar escalas salariales del mercado.',
   'Ana García', '2026-06-28');

INSERT INTO checklist_offboarding (baja_id, item, completado, responsable, fecha_completado) VALUES
  (1, 'Devolución de laptop y equipo asignado',       TRUE,  'TI - Carlos Mora',       '2026-06-28'),
  (1, 'Devolución de tarjeta de acceso / badge',      TRUE,  'Seguridad',               '2026-06-28'),
  (1, 'Desactivación de correo corporativo',          TRUE,  'TI - Carlos Mora',       '2026-06-29'),
  (1, 'Desactivación de accesos a sistemas',          TRUE,  'TI - Carlos Mora',       '2026-06-29'),
  (1, 'Firma de carta de renuncia aceptada',          TRUE,  'RRHH - Ana García',      '2026-06-25'),
  (1, 'Cálculo y pago de finiquito / liquidación',    TRUE,  'Finanzas - María Jiménez','2026-06-30'),
  (1, 'Entrevista de salida realizada',               TRUE,  'RRHH - Ana García',      '2026-06-28'),
  (1, 'Transferencia de conocimiento documentada',    TRUE,  'Marketing',               '2026-06-27'),
  (2, 'Devolución de laptop y equipo asignado',       FALSE, 'TI - Carlos Mora',       NULL),
  (2, 'Devolución de tarjeta de acceso / badge',      FALSE, 'Seguridad',               NULL),
  (2, 'Desactivación de correo corporativo',          FALSE, 'TI - Carlos Mora',       NULL),
  (2, 'Desactivación de accesos a sistemas',          FALSE, 'TI - Carlos Mora',       NULL),
  (2, 'Firma de documento de fin de contrato',        TRUE,  'RRHH - Ana García',      '2026-07-08'),
  (2, 'Cálculo y pago de finiquito / liquidación',    FALSE, 'Finanzas - María Jiménez',NULL),
  (2, 'Entrevista de salida realizada',               FALSE, 'RRHH - Ana García',      NULL),
  (2, 'Transferencia de conocimiento documentada',    FALSE, 'Comercial',               NULL);
