-- IP do aluno + favoritos no backoffice

alter table public.aluno_metricas
  add column if not exists ultimo_ip text;

alter table public.atividade_eventos
  add column if not exists ip text;

create index if not exists atividade_ip_idx on public.atividade_eventos(ip);
create index if not exists metricas_ip_idx on public.aluno_metricas(ultimo_ip);

create table if not exists public.admin_favoritos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_favoritos enable row level security;

grant all on public.admin_favoritos to service_role;

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
  m.ultimo_ip,
  (f.user_id is not null) as favorito,
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
left join public.progresso pr on pr.user_id = p.id
left join public.admin_favoritos f on f.user_id = p.id;

grant select on public.admin_alunos_resumo to service_role;
