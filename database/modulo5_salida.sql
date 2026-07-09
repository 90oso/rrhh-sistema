-- ═══════════════════════════════════════════════════════
--  RRHH SISTEMA — Módulo 5: Salida (Offboarding)
--  Ejecutar en: https://app.supabase.com → SQL Editor
--  (Requiere haber ejecutado modulo1_candidatos.sql antes
-- ═══════════════════════════════════════════════════════

create table if not exists public.salidas (
  id bigint generated always as identity not null,
  empleado_id bigint null,
  fecha_salida date null,
  motivo text null,
  porque_se_va text null,
  mejoraria text null,
  recomendaria text null,
  observaciones text null,
  equipo_entregado boolean null default false,
  accesos_revocados boolean null default false,
  liquidacion_firmada boolean null default false,
  entrevista_realizada boolean null default false,
  created_at timestamp with time zone null default now(),
  constraint salidas_pkey primary key (id),
  constraint salidas_empleado_id_fkey foreign key (empleado_id) references empleados (id),
  constraint salidas_motivo_check check (
    (
      motivo = any (
        array[
          'Renuncia'::text,
          'Despido'::text,
          'Jubilación'::text,
          'Fin de contrato'::text,
          'Otro'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

-- Al insertar una baja, marca al empleado como Inactivo automáticamente.
-- (empleados.estado tiene el check 'Activo' | 'Suspendido' | 'Inactivo', ver modulo1_candidatos.sql)
create or replace function actualizar_estado_empleado()
returns trigger as $$
begin
  update empleados set estado = 'Inactivo' where id = new.empleado_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_salida_empleado on salidas;
create trigger trg_salida_empleado
after insert on salidas for each row
execute function actualizar_estado_empleado();

-- Habilitar Realtime en la tabla
alter publication supabase_realtime add table salidas;

-- Datos de ejemplo
-- (Asume que existen empleados con id 3 y 6 del modulo2_personal.sql)
insert into salidas (empleado_id, fecha_salida, motivo, observaciones, porque_se_va, mejoraria, recomendaria, equipo_entregado, accesos_revocados, liquidacion_firmada, entrevista_realizada) values
  (3, '2026-06-30', 'Renuncia', 'Salida amigable, buen desempeño durante su estancia.',
   'Mejor oferta salarial y posición de liderazgo en otra empresa',
   'Mejorar las oportunidades de crecimiento interno y revisar escalas salariales del mercado.',
   'Sí', true, true, true, true),
  (6, '2026-07-15', 'Fin de contrato', 'Contrato no renovado por reestructuración del área comercial.',
   null, null, null, false, false, true, false);
