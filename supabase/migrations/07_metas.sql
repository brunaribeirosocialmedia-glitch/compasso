-- =====================================================================
-- COMPASSO · 07 · Metas (resumão da tela inicial)
-- =====================================================================
-- Depende de: 01, 03_prospeccao.sql, 04_financeiro.sql
-- 1. Metas mensais de Prospecção (valor fechado no mês) e Financeiro
--    (faturamento do mês). Vale a meta mais recente até o mês consultado,
--    então não é preciso cadastrar de novo todo mês.
-- 2. prospects.fechado_em: dia em que o negócio fechou, para saber
--    quanto foi fechado em cada mês.
-- Acesso: o mesmo das áreas (permissão + código digitado).
-- =====================================================================

create table public.metas (
  area           public.area_protegida not null,
  competencia    date not null check (competencia = date_trunc('month', competencia)::date),
  valor          numeric(12, 2) not null check (valor > 0),
  criado_por     uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  primary key (area, competencia)
);

create trigger metas_atualizado_em
  before update on public.metas
  for each row execute function public.definir_atualizado_em();

alter table public.metas enable row level security;

create policy "Área liberada: metas"
  on public.metas for all to authenticated
  using ((select public.tem_acesso_area(area)))
  with check ((select public.tem_acesso_area(area)));

-- ---------------------------------------------------------------------
-- Data de fechamento dos prospects
-- ---------------------------------------------------------------------
alter table public.prospects add column fechado_em date;

-- Fechados antes desta migration: usa a última alteração como aproximação
update public.prospects
   set fechado_em = (atualizado_em at time zone 'America/Sao_Paulo')::date
 where valor_fechado is not null;

create or replace function public.registrar_fechamento_prospect()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.valor_fechado is null then
    new.fechado_em := null;
  elsif new.fechado_em is null then
    new.fechado_em := (now() at time zone 'America/Sao_Paulo')::date;
  end if;
  return new;
end;
$$;

create trigger prospects_fechado_em
  before insert or update of valor_fechado on public.prospects
  for each row execute function public.registrar_fechamento_prospect();
