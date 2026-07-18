-- MatPrep schema: conteúdo do curso + progresso do estudante
-- Project: rnxyxernvliyxpwldjee

create extension if not exists "pgcrypto";

-- ========== Conteúdo (leitura pública) ==========

create table if not exists public.temas (
  id text primary key,
  titulo text not null,
  icone text,
  dif text,
  duracao text,
  grad text,
  descricao text,
  video jsonb,
  teoria jsonb not null default '[]'::jsonb,
  formulas jsonb not null default '[]'::jsonb,
  exemplo jsonb,
  erros jsonb not null default '[]'::jsonb,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.questoes (
  id text primary key,
  tema text not null references public.temas(id) on delete cascade,
  dif text,
  enunciado text not null,
  ops jsonb not null default '[]'::jsonb,
  correta int not null default 0,
  passos jsonb not null default '[]'::jsonb,
  fonte text,
  created_at timestamptz not null default now()
);

create table if not exists public.abertas (
  id text primary key,
  tema text not null references public.temas(id) on delete cascade,
  enunciado text not null,
  resolucao text,
  fonte text,
  created_at timestamptz not null default now()
);

create table if not exists public.materiais (
  id text primary key,
  tipo text not null,
  tema text references public.temas(id) on delete set null,
  titulo text not null,
  ficheiro text,
  video jsonb,
  created_at timestamptz not null default now()
);

create index if not exists questoes_tema_idx on public.questoes(tema);
create index if not exists abertas_tema_idx on public.abertas(tema);
create index if not exists materiais_tipo_idx on public.materiais(tipo);

-- ========== Progresso (por utilizador autenticado) ==========

create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.progresso (
  user_id uuid primary key references auth.users(id) on delete cascade,
  streak int not null default 1,
  last_dia text,
  licoes jsonb not null default '{}'::jsonb,
  ultima jsonb,
  resp jsonb not null default '{"t":0,"c":0,"seq":0,"maxSeq":0,"tempo":0,"porTema":{}}'::jsonb,
  erradas jsonb not null default '[]'::jsonb,
  rever jsonb not null default '[]'::jsonb,
  hist jsonb not null default '{}'::jsonb,
  exames jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- ========== RLS ==========

alter table public.temas enable row level security;
alter table public.questoes enable row level security;
alter table public.abertas enable row level security;
alter table public.materiais enable row level security;
alter table public.perfis enable row level security;
alter table public.progresso enable row level security;

-- Conteúdo: qualquer pessoa (anon / authenticated) pode ler
drop policy if exists "temas_read" on public.temas;
create policy "temas_read" on public.temas for select using (true);

drop policy if exists "questoes_read" on public.questoes;
create policy "questoes_read" on public.questoes for select using (true);

drop policy if exists "abertas_read" on public.abertas;
create policy "abertas_read" on public.abertas for select using (true);

drop policy if exists "materiais_read" on public.materiais;
create policy "materiais_read" on public.materiais for select using (true);

-- Perfis: só o próprio
drop policy if exists "perfis_select_own" on public.perfis;
create policy "perfis_select_own" on public.perfis for select using (auth.uid() = id);

drop policy if exists "perfis_insert_own" on public.perfis;
create policy "perfis_insert_own" on public.perfis for insert with check (auth.uid() = id);

drop policy if exists "perfis_update_own" on public.perfis;
create policy "perfis_update_own" on public.perfis for update using (auth.uid() = id);

-- Progresso: só o próprio
drop policy if exists "progresso_select_own" on public.progresso;
create policy "progresso_select_own" on public.progresso for select using (auth.uid() = user_id);

drop policy if exists "progresso_insert_own" on public.progresso;
create policy "progresso_insert_own" on public.progresso for insert with check (auth.uid() = user_id);

drop policy if exists "progresso_update_own" on public.progresso;
create policy "progresso_update_own" on public.progresso for update using (auth.uid() = user_id);

-- Criar perfil + progresso automaticamente no signup (inclui anonymous)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', 'Estudante'))
  on conflict (id) do nothing;

  insert into public.progresso (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Permissões API
grant usage on schema public to anon, authenticated;
grant select on public.temas, public.questoes, public.abertas, public.materiais to anon, authenticated;
grant select, insert, update on public.perfis, public.progresso to authenticated;
grant select on public.temas, public.questoes, public.abertas, public.materiais to service_role;
grant all on public.perfis, public.progresso, public.temas, public.questoes, public.abertas, public.materiais to service_role;