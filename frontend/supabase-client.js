// Configuración local separada del código. No conectar datos reales sin Auth y RLS.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL)
  && !!SUPABASE_ANON_KEY;
export const supabase = configured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : new Proxy({}, {
      get() {
        throw new Error('Supabase no está configurado. Usa docs/index.html para una demostración segura.');
      }
    });
