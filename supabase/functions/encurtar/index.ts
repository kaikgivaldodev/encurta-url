import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Configuração dos cabeçalhos CORS para permitir chamadas do seu Front-end
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para gerar um slug aleatório de 6 caracteres (estilo Bitly)
function gerarSlugAleatorio(tamanho = 6): string {
  const caracteres = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let resultado = '';
  for (let i = 0; i < tamanho; i++) {
    resultado += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  return resultado;
}

serve(async (req) => {
  // Trata requisições OPTIONS (Pre-flight do CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/, '').trim();

    let userId: string | null = null;
    
    // Inicializa o cliente Admin para operações de sistema
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    if (token.startsWith('sk_live_')) {
      // 1. Autenticação via Chave de API
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
      if (listError) {
        console.error('[Edge Function] Erro ao listar usuários:', listError)
      } else if (users) {
        const found = users.find((u) => u.user_metadata?.api_key === token)
        if (found) {
          userId = found.id
        }
      }

      if (!userId) {
        return new Response(JSON.stringify({ error: 'Chave de API inválida ou expirada.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else {
      // 2. Autenticação via JWT de Sessão Padrão
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      )
      const { data: { user } } = await supabaseClient.auth.getUser()
      userId = user ? user.id : null
    }

    // Coleta os dados enviados pelo usuário
    const { url_original, slug_customizado } = await req.json()

    // 3. Validação básica da URL
    if (!url_original) {
      return new Response(JSON.stringify({ error: 'A URL original é obrigatória.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Define o slug (usa o customizado ou gera um aleatório)
    let slug = slug_customizado ? slug_customizado.trim() : gerarSlugAleatorio();

    // 5. Salva no Banco de Dados usando o cliente Admin (para aceitar o user_id mesmo sem sessão JWT ativa no RLS)
    const { data, error } = await supabaseAdmin
      .from('links')
      .insert([
        { 
          url_original, 
          slug, 
          user_id: userId 
        }
      ])
      .select()
      .single()

    // Se der erro de duplicidade no slug customizado
    if (error) {
      return new Response(JSON.stringify({ error: 'Este link/slug já está em uso.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 6. Retorna o sucesso com o link encurtado
    return new Response(
      JSON.stringify({ 
        success: true, 
        slug: data.slug,
        url_encurtada: `https://encurta-url-rho.vercel.app/${data.slug}`,
        url_original: data.url_original 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})