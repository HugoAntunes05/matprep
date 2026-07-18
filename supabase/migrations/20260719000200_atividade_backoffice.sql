-- Tracking detalhado + métricas para backoffice MatPrep

create table if not exists public.aluno_metricas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  perguntas_vistas int not null default 0,
  perguntas_respondidas int not null default 0,
  perguntas_certas int not null default 0,
  segundos_video int not null default 0,
  segundos_estudo int not null default 0,
  licoes_abertas int not null default 0,
  licoes_concluidas int not null default 0,
  materiais_abertos int not null default 0,
  exames_feitos int not null default 0,
  temas_visitados jsonb not null default '[]'::jsonb,
  ultimo_acesso timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atividade_eventos (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null,
  tema text,
  licao text,
  questao_id text,
  material_id text,
  video_id text,
  segundos int not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists atividade_user_idx on public.atividade_eventos(user_id, created_at desc);
create index if not exists atividade_tipo_idx on public.atividade_eventos(tipo, created_at desc);
create index if not exists atividade_tema_idx on public.atividade_eventos(tema);

create table if not exists public.video_progresso (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id text not null,
  contexto text not null default 'geral',
  tema text,
  material_id text not null default '',
  titulo text,
  canal text,
  segundos_vistos int not null default 0,
  ultima_posicao int not null default 0,
  percentual int not null default 0,
  plays int not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, video_id, contexto, material_id)
);

create index if not exists video_progresso_user_idx on public.video_progresso(user_id);

create table if not exists public.licao_progresso (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tema text not null,
  licao text not null,
  aberturas int not null default 0,
  segundos_lidos int not null default 0,
  concluida boolean not null default false,
  primeira_abertura timestamptz,
  ultima_abertura timestamptz,
  concluida_em timestamptz,
  unique (user_id, tema, licao)
);

create index if not exists licao_progresso_user_idx on public.licao_progresso(user_id);

create table if not exists public.pergunta_vistas (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  questao_id text not null,
  tema text,
  modo text,
  vistas int not null default 0,
  respondidas int not null default 0,
  certas int not null default 0,
  erradas int not null default 0,
  segundos_total int not null default 0,
  ultima_vista timestamptz,
  unique (user_id, questao_id, modo)
);

create index if not exists pergunta_vistas_user_idx on public.pergunta_vistas(user_id);

-- RLS
alter table public.aluno_metricas enable row level security;
alter table public.atividade_eventos enable row level security;
alter table public.video_progresso enable row level security;
alter table public.licao_progresso enable row level security;
alter table public.pergunta_vistas enable row level security;

drop policy if exists "metricas_own" on public.aluno_metricas;
create policy "metricas_select_own" on public.aluno_metricas for select using (auth.uid() = user_id);
create policy "metricas_insert_own" on public.aluno_metricas for insert with check (auth.uid() = user_id);
create policy "metricas_update_own" on public.aluno_metricas for update using (auth.uid() = user_id);

drop policy if exists "eventos_insert_own" on public.atividade_eventos;
create policy "eventos_insert_own" on public.atividade_eventos for insert with check (auth.uid() = user_id);
create policy "eventos_select_own" on public.atividade_eventos for select using (auth.uid() = user_id);

create policy "video_select_own" on public.video_progresso for select using (auth.uid() = user_id);
create policy "video_insert_own" on public.video_progresso for insert with check (auth.uid() = user_id);
create policy "video_update_own" on public.video_progresso for update using (auth.uid() = user_id);

create policy "licao_select_own" on public.licao_progresso for select using (auth.uid() = user_id);
create policy "licao_insert_own" on public.licao_progresso for insert with check (auth.uid() = user_id);
create policy "licao_update_own" on public.licao_progresso for update using (auth.uid() = user_id);

create policy "perg_select_own" on public.pergunta_vistas for select using (auth.uid() = user_id);
create policy "perg_insert_own" on public.pergunta_vistas for insert with check (auth.uid() = user_id);
create policy "perg_update_own" on public.pergunta_vistas for update using (auth.uid() = user_id);

-- Atualizar trigger de novo user
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

  insert into public.aluno_metricas (user_id, ultimo_acesso)
  values (new.id, now())
  on conflict (user_id) do nothing;

  return new;
end;
$$;

grant select, insert, update on public.aluno_metricas, public.video_progresso, public.licao_progresso, public.pergunta_vistas to authenticated;
grant insert, select on public.atividade_eventos to authenticated;
grant usage, select on sequence public.atividade_eventos_id_seq to authenticated;
grant usage, select on sequence public.video_progresso_id_seq to authenticated;
grant usage, select on sequence public.licao_progresso_id_seq to authenticated;
grant usage, select on sequence public.pergunta_vistas_id_seq to authenticated;

grant all on public.aluno_metricas, public.atividade_eventos, public.video_progresso, public.licao_progresso, public.pergunta_vistas to service_role;
grant all on all sequences in schema public to service_role;

-- Vista agregada para backoffice (service role)
create or replace view public.admin_alunos_resumo as
select
  p.id as user_id,
  coalesce(p.nome, 'Estudante') as nome,
  p.created_at as registado_em,
  m.perguntas_vistas,
  m.perguntas_respondidas,
  m.perguntas_certas,
  m.segundos_video,
  m.segundos_estudo,
  m.licoes_abertas,
  m.licoes_concluidas,
  m.materiais_abertos,
  m.exames_feitos,
  m.temas_visitados,
  m.ultimo_acesso,
  case when coalesce(m.perguntas_respondidas,0)=0 then 0
       else round(100.0 * m.perguntas_certas / m.perguntas_respondidas) end as precisao_pct,
  pr.streak,
  pr.resp,
  pr.erradas,
  pr.exames as exames_hist,
  pr.licoes as licoes_json,
  pr.updated_at as progresso_updated
from public.perfis p
left join public.aluno_metricas m on m.user_id = p.id
left join public.progresso pr on pr.user_id = p.id;

grant select on public.admin_alunos_resumo to service_role;
