// frontend/supabase-client.js

// 1. Reemplaza estos datos con los de tu proyecto de Supabase
const SUPABASE_URL = "https://dednzlnhhgprlaxsugwi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlZG56bG5oaGdwcmxheHN1Z3dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTk2MjUsImV4cCI6MjA5ODI3NTYyNX0.hiSVsNHBvQg06hDmn9AJkmazC_h8-R-4kzsuBLT6gdQ";

// 2. Cargamos el cliente de Supabase directamente desde su CDN oficial
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// 3. Inicializamos la instancia de la base de datos una sola vez
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
