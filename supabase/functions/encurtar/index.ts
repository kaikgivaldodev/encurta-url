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
    // Inicializa o cliente do Supabase com as credenciais internas da Function
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Coleta os dados enviados pelo usuário
    const { url_original, slug_customizado } = await req.json()

    // 1. Validação básica da URL
    if (!url_original) {
      return new Response(JSON.stringify({ error: 'A URL original é obrigatória.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Define o slug (usa o customizado ou gera um aleatório)
    let slug = slug_customizado ? slug_customizado.trim() : gerarSlugAleatorio();

    // 3. Tenta obter o ID do usuário autenticado (se houver JWT válido)
    const { data: { user } } = await supabaseClient.auth.getUser()
    const userId = user ? user.id : null

    // 4. Salva no Banco de Dados
    const { data, error } = await supabaseClient
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

    // 5. Retorna o sucesso com o link encurtado
    return new Response(
      JSON.stringify({ 
        success: true, 
        slug: data.slug,
        url_encurtada: `https://seu-dominio.com/${data.slug}`, // Substitua pelo seu domínio futuro
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