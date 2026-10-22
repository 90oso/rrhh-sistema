-- BLOQUEO PREVENTIVO: aplicar solo en una BASE DE PRUEBAS CON RESPALDO.
-- Bloquea el acceso por anon/authenticated hasta que se diseñen políticas
-- de tenant, roles y identidad vía Supabase Auth.
-- ROMPE el prototipo académico existente deliberadamente.
-- No sustituye un diseño completo de RLS ni audita configuraciones ya existentes.
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'empleados','candidatos','asistencia','ausencias','vacaciones',
    'capacitaciones','evaluaciones','movimientos_empleado',
    'capacitaciones_empleado','evaluaciones_empleado','salidas'
  ] LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated',tbl);
    END IF;
  END LOOP;
END $$;
-- NO CREAR POLÍTICAS ALLOW ALL. Se necesita tenant_id, auth.uid() y roles verificados.
