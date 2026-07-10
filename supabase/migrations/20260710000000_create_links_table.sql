-- Criar a tabela de links
create table public.links (
  id bigint generated always as identity primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  url_original text not null,
  slug text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  click_count integer default 0 not null
);

-- Habilitar o RLS (Row Level Security)
alter table public.links enable row level security;

-- Políticas de Acesso (Segurança Granular)

-- 1. Permitir que usuários autenticados visualizem seus próprios links no painel
create policy "Permitir visualização de links próprios"
on public.links for select
to authenticated
using (auth.uid() = user_id);

-- 2. Permitir que usuários autenticados insiram links vinculados à própria conta
create policy "Permitir inserção de usuários autenticados"
on public.links for insert
to authenticated
with check (auth.uid() = user_id);

-- 3. Permitir que visitantes anônimos (sem login) encurtem links (user_id nulo)
create policy "Permitir inserção de usuários anônimos"
on public.links for insert
to anon
with check (user_id is null);

-- 4. Permitir que usuários autenticados excluam apenas seus próprios links
create policy "Permitir exclusão de links próprios"
on public.links for delete
to authenticated
using (auth.uid() = user_id);
