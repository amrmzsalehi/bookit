// ============================================================
// STEP 1: Your Supabase connection file
// ------------------------------------------------------------
// HOW TO GET YOUR VALUES:
//   1. Go to supabase.com → log in → open your project
//   2. Click the "Settings" gear icon (bottom left sidebar)
//   3. Click "API" in the settings menu
//   4. Copy "Project URL" → paste below as VITE_SUPABASE_URL
//   5. Under "Project API Keys" copy "anon public" key
//      → paste below as VITE_SUPABASE_ANON_KEY
//
// Then create a file called .env in your project ROOT folder
// (same level as package.json) and put:
//
//   VITE_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
//
// ============================================================

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)
