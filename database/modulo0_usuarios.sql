-- ═══════════════════════════════════════════════════════
--  RRHH SISTEMA — Módulo 0: Usuarios y Login
--  Ejecutar en: https://app.supabase.com → SQL Editor
--  (Puedes correr esto en cualquier momento, es independiente
--   de modulo1_candidatos.sql y modulo2_personal.sql)
-- ═══════════════════════════════════════════════════════

-- Necesitamos pgcrypto para poder guardar contraseñas
-- como hash (bcrypt) en lugar de texto plano.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabla de usuarios del sistema (login propio, NO Supabase Auth)
CREATE TABLE IF NOT EXISTS usuarios (
  id             BIGSERIAL PRIMARY KEY,
  nombre         TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  rol            TEXT NOT NULL DEFAULT 'empleado'
                 CHECK (rol IN ('admin','rrhh','empleado')),
  empleado_id    BIGINT REFERENCES empleados(id) ON DELETE SET NULL,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- IMPORTANTE: activamos RLS y NO creamos ninguna policy para
-- 'anon'/'authenticated'. Esto significa que nadie puede hacer
-- SELECT directo a esta tabla desde el navegador (ni siquiera
-- los hashes de contraseña quedan expuestos). El único acceso
-- permitido es a través de la función login_usuario() de abajo.
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────
-- Función de login
-- SECURITY DEFINER: corre con permisos del dueño de la función
-- (no del usuario anónimo), así puede leer la tabla usuarios
-- aunque RLS la esté bloqueando para todos los demás.
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION login_usuario(p_email TEXT, p_password TEXT)
RETURNS TABLE (id BIGINT, nombre TEXT, email TEXT, rol TEXT, empleado_id BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.nombre, u.email, u.rol, u.empleado_id
  FROM usuarios u
  WHERE u.email = lower(trim(p_email))
    AND u.activo = TRUE
    AND u.password_hash = crypt(p_password, u.password_hash);
END;
$$;

-- Solo el rol "anon" (el que usa el navegador con la anon key)
-- puede ejecutar esta función. No puede tocar la tabla directamente.
REVOKE ALL ON FUNCTION login_usuario(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION login_usuario(TEXT, TEXT) TO anon, authenticated;

-- ─────────────────────────────────────────
-- Función auxiliar para crear/actualizar usuarios desde el
-- SQL Editor sin escribir crypt() a mano cada vez.
-- Úsala así:
--   SELECT crear_usuario('Ana García','ana@empresa.com','MiClaveSegura','admin');
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION crear_usuario(
  p_nombre TEXT, p_email TEXT, p_password TEXT, p_rol TEXT DEFAULT 'empleado',
  p_empleado_id BIGINT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  INSERT INTO usuarios (nombre, email, password_hash, rol, empleado_id)
  VALUES (p_nombre, lower(trim(p_email)), crypt(p_password, gen_salt('bf')), p_rol, p_empleado_id)
  ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        nombre = EXCLUDED.nombre,
        rol = EXCLUDED.rol
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION crear_usuario(TEXT, TEXT, TEXT, TEXT, BIGINT) FROM PUBLIC;
-- No se la damos a anon/authenticated: esta función solo debe
-- correrse manualmente desde el SQL Editor (con tu rol de dueño
-- del proyecto), nunca desde el navegador.

-- ─────────────────────────────────────────
-- Usuarios de demo (CAMBIA estas contraseñas antes de exponer
-- el proyecto públicamente; esto es para tu demo de clase)
-- ─────────────────────────────────────────
SELECT crear_usuario('Administrador del Sistema', 'admin@rrhh.com',     'Admin123!',    'admin');
SELECT crear_usuario('Ana García',                 'rrhh@rrhh.com',      'Rrhh123!',     'rrhh');
SELECT crear_usuario('Carlos Mora',                'empleado@rrhh.com',  'Empleado123!', 'empleado', 2);
