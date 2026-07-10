// supabase-init.js — Módulo ESM que inicializa o cliente Supabase e o expõe globalmente
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://vysxsmmdhcrmzcvkvuvn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5c3hzbW1kaGNybXpjdmt2dXZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MDM5NzMsImV4cCI6MjA5OTE3OTk3M30.NWSynp2tWWh7E3xueUAnqtNcrovhSFgFTqvI6t2MifQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Expõe globalmente para o script.js clássico
window.supabase = supabase;

// Monitora mudanças de auth e dispara evento customizado
supabase.auth.onAuthStateChange((event, session) => {
    const authEvent = new CustomEvent('supabase-auth-change', {
        detail: { event, session }
    });
    window.dispatchEvent(authEvent);
});

console.log('[EncurtaURL] Supabase inicializado com sucesso.');
