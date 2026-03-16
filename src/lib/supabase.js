import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://almoejkachpjbtrmbvwh.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsbW9lamthY2hwamJ0cm1idndoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NjI1NTMsImV4cCI6MjA4OTEzODU1M30.fI8462mkzpBULeOW_xAG4EjnjNTVL915oUmU7CtSy74'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
