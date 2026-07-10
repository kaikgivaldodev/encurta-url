import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Headers básicos de CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Trata pre-flight requests do CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const paths = url.pathname.split('/').filter(Boolean)
  const slug = paths[paths.length - 1]

  // Se o slug for inválido ou for o próprio nome da rota da function 'r'
  if (!slug || slug === 'r') {
    return new Response(JSON.stringify({ error: "Slug inválido ou ausente." }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    // Inicializa o cliente com a Service Role Key para ignorar as restrições RLS
    // e poder atualizar a tabela de links anonimamente.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Busca a URL original associada ao slug
    const { data: linkData, error } = await supabaseAdmin
      .from('links')
      .select('url_original, click_count')
      .eq('slug', slug)
      .single()

    if (error || !linkData) {
      return new Response(JSON.stringify({ error: "Link não encontrado no banco de dados." }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Incrementa a contagem de cliques (click_count)
    await supabaseAdmin
      .from('links')
      .update({ click_count: (linkData.click_count || 0) + 1 })
      .eq('slug', slug)

    // 3. Responde com o redirecionamento temporário HTTP 307
    return new Response(null, {
      status: 307,
      headers: {
        "Location": linkData.url_original,
        "Cache-Control": "no-store, max-age=0"
      }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
