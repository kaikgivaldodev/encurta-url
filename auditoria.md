# 📋 Relatório de Auditoria Técnica e Planejamento SaaS: Encurtador de URL

Este documento apresenta uma auditoria detalhada de ponta a ponta do estado atual do sistema **EncurtaURL** e serve como guia para a migração completa de um protótipo estático (com dados simulados) para um SaaS de alta performance integrado ao **Supabase** (estilo Bit.ly).

---

## 1. 📂 Mapeamento e Diagnóstico da Estrutura Atual

### A. Frontend (`index.html`, `styles.css` e `script.js`)
*   **Estado Geral**: A aplicação frontend é uma SPA (Single Page Application) estática escrita em Vanilla HTML, CSS e JavaScript. Ela está rodando localmente na porta `http://localhost:3000`.
*   **Interface (UI)**: Possui um design dark mode premium moderno com acentos amarelos (`#ffd32a`), popups modal com desfoque de fundo e responsividade.
*   **Autenticação**: O fluxo de login, cadastro de contas e login social com o Google são completamente simulados (mocks) em `script.js` utilizando JWT fictício gerado no lado do cliente.
*   **Persistência**: O histórico de links do dashboard e as estatísticas de cliques utilizam dados salvos na memória temporária do navegador (`mockHistory`). Qualquer atualização da página (F5) limpa o histórico.
*   **Segurança**: O código original do frontend continha uma chave de API do Adfly exposta em texto puro no cliente.

### B. Configuração do Supabase (`supabase/config.toml`)
*   **Projeto Remoto**: Vinculado e sincronizado com o projeto ID `vysxsmmdhcrmzcvkvuvn`.
*   **Configuração de Funções**: A função `encurtar` está devidamente registrada com `verify_jwt = false`. O entrypoint aponta corretamente para `./functions/encurtar/index.ts`.

### C. Edge Function (`supabase/functions/encurtar/index.ts`)
*   **Estado Geral**: O deploy da função foi concluído com sucesso utilizando o bundling no servidor do Supabase (`--use-api`).
*   **Lógica Atualizada**:
    1.  Eliminou a dependência de serviços externos (Adfly).
    2.  Recebe `url_original` e `slug_customizado`.
    3.  Gera automaticamente um slug alfanumérico aleatório de 6 caracteres (estilo Bit.ly) caso o usuário não informe um slug customizado.
    4.  Cria o cliente do Supabase passando os cabeçalhos de autorização e tenta persistir o registro no banco de dados, retornando o link encurtado formatado.

---

## 2. ⚠️ Pontos Críticos e Vulnerabilidades Atuais

### 🚨 Inexistência da Tabela de Links no Banco de Dados
A Edge Function `encurtar` tenta inserir dados na tabela `links` do Supabase. Para que a gravação não falhe, essa tabela deve ser criada no Postgres com os campos correspondentes e as devidas políticas de segurança RLS (Row Level Security) ativadas.

### 🚨 Roteamento e Redirecionamento (O Fluxo Principal)
Para que o redirecionamento própria funcione (ex: `dominio.com/slug` direcionando para a URL longa), o sistema precisa interceptar os acessos.
*   Se o site for hospedado de forma estática, acessar `dominio.com/slug` retornará erro **404 Not Found**.
*   **Solução Recomendada**: Utilizar uma Edge Function de redirecionamento dedicada (ex: `/functions/v1/r/slug`) ou configurar regras de Rewrite no servidor de hospedagem para que todas as rotas redirecionem para o backend.

### 🚨 Falta de Conexão Real no Frontend
O frontend (`script.js`) ainda não está se comunicando com o banco de dados Supabase real e ainda contém a lógica de requisição legada do Adfly. É necessário substituir as funções mockadas de autenticação e persistência por chamadas reais usando o cliente `@supabase/supabase-js`.

---

## 3. 🛠️ Plano de Ação Técnico para Evolução (Bit.ly Style)

Para transformar o protótipo atual em um SaaS funcional de alto desempenho, os seguintes passos devem ser seguidos pelo desenvolvedor (ou passados para o Claude):

### Passo 1: Executar o Schema SQL no Supabase
Execute o script abaixo no editor de SQL do painel do Supabase para criar a tabela de links com indexação otimizada e segurança de acesso:

```sql
-- Criar a tabela de links
create table public.links (
  id bigint generated always as identity primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  url_original text not null,
  slug text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  cliques integer default 0 not null
);

-- Habilitar o RLS (Row Level Security)
alter table public.links enable row level security;

-- Políticas de Acesso
-- 1. Leitura pública de links pelo Slug (para que qualquer visitante seja redirecionado)
create policy "Permitir leitura pública de links"
on public.links for select
using (true);

-- 2. Inserção de links para usuários autenticados
create policy "Permitir inserção de usuários autenticados"
on public.links for insert
to authenticated
with check (auth.uid() = user_id);

-- 3. Inserção de links para visitantes anônimos (sem login)
create policy "Permitir inserção de usuários anônimos"
on public.links for insert
to anon
with check (user_id is null);

-- 4. Exibição de links próprios no histórico de cada usuário autenticado
create policy "Permitir visualização de links próprios"
on public.links for select
to authenticated
using (auth.uid() = user_id);

-- 5. Exclusão de links próprios
create policy "Permitir exclusão de links próprios"
on public.links for delete
to authenticated
using (auth.uid() = user_id);
```

### Passo 2: Implementar a Edge Function de Redirecionamento Rápido (`/r`)
Crie uma nova Edge Function em `supabase/functions/r/index.ts` responsável por buscar o slug no banco, incrementar cliques de forma assíncrona e redirecionar instantaneamente o navegador do usuário (HTTP 307).

**Código sugerido para a função `r`:**
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const url = new URL(req.url)
  const paths = url.pathname.split('/')
  const slug = paths[paths.length - 1]

  if (!slug || slug === 'r') {
    return new Response("Slug inválido.", { status: 400 })
  }

  // Inicializa o cliente com Service Role Key para ignorar RLS e atualizar a tabela
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // 1. Busca a URL original
  const { data: linkData, error } = await supabaseAdmin
    .from('links')
    .select('url_original, cliques')
    .eq('slug', slug)
    .single()

  if (error || !linkData) {
    return new Response("Link não encontrado.", { status: 404 })
  }

  // 2. Incrementa a contagem de cliques
  await supabaseAdmin
    .from('links')
    .update({ cliques: linkData.cliques + 1 })
    .eq('slug', slug)

  // 3. Responde com o redirecionamento temporário HTTP 307
  return new Response(null, {
    status: 307,
    headers: {
      "Location": linkData.url_original,
      "Cache-Control": "no-store, max-age=0"
    }
  })
})
```

### Passo 3: Integrar o Supabase Client no Frontend
1.  No arquivo `index.html`, insira o script CDN do Supabase antes do fechamento do `<body>`:
    ```html
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    ```
2.  No arquivo `script.js`, inicialize o cliente real e substitua as rotinas de cadastro, login e histórico:
    ```javascript
    const supabase = supabase.createClient('SUA_URL_DO_SUPABASE', 'SUA_ANON_KEY')
    ```
3.  Atualize a função `encurtarUrl()` para enviar um POST chamando a URL da sua Edge Function remota (`https://vysxsmmdhcrmzcvkvuvn.supabase.co/functions/v1/encurtar`).
