-- =====================================================================
-- COMPASSO · 04 · Financeiro + calculadora de precificação
-- =====================================================================
-- Depende de: 01, 02 (clientes) e 03 (forma_pagamento, prospects)
-- Acesso: tem_acesso_area('financeiro') = permissão + código digitado
--
-- Convenção: "competencia" é sempre o 1º dia do mês a que o valor
-- pertence (ex.: 2026-09-01 = setembro/2026).
--
-- Lógica da calculadora (cobrança por entrega, não por hora):
--   base fixa do mês  = custos fixos + colaboradores (tipo fixo) + pró-labore
--   custo fixo/entrega = base fixa do mês ÷ nº de entregas do mês
--   custo real         = custo fixo/entrega + custos variáveis da entrega
--                        (inclui IA e colaboradores pagos por entrega)
--   margem             = valor cobrado − custo real
-- =====================================================================

create type public.status_lancamento as enum ('pendente', 'pago', 'cancelado');
create type public.categoria_custo_variavel as enum
  ('ia', 'freelancer', 'impulsionamento', 'producao', 'software', 'deslocamento', 'outro');
create type public.tipo_pagamento_colaborador as enum ('fixo', 'por_entrega');

-- ---------------------------------------------------------------------
-- Entregas (base da calculadora: cada peça/pacote entregue no mês)
-- ---------------------------------------------------------------------
create table public.fin_entregas (
  id             uuid primary key default gen_random_uuid(),
  descricao      text not null,
  cliente_id     uuid references public.clientes (id) on delete set null,
  tipo_servico   text,                                   -- ex.: carrossel, reels, gestão mensal
  competencia    date not null check (competencia = date_trunc('month', competencia)::date),
  data_entrega   date,
  valor_cobrado  numeric(12, 2) not null default 0 check (valor_cobrado >= 0),
  observacoes    text,
  criado_por     uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index fin_entregas_competencia_idx on public.fin_entregas (competencia);

-- ---------------------------------------------------------------------
-- Faturamento
-- ---------------------------------------------------------------------
create table public.fin_faturamento (
  id                uuid primary key default gen_random_uuid(),
  descricao         text not null,
  cliente_id        uuid references public.clientes (id) on delete set null,
  prospect_id       uuid references public.prospects (id) on delete set null,
  valor             numeric(12, 2) not null check (valor >= 0),
  competencia       date not null check (competencia = date_trunc('month', competencia)::date),
  data_vencimento   date,
  data_recebimento  date,
  status            public.status_lancamento not null default 'pendente',
  forma_pagamento   public.forma_pagamento,
  observacoes       text,
  criado_por        uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

create index fin_faturamento_competencia_idx on public.fin_faturamento (competencia);

-- ---------------------------------------------------------------------
-- Custos fixos
-- ---------------------------------------------------------------------
create table public.fin_custos_fixos (
  id               uuid primary key default gen_random_uuid(),
  descricao        text not null,
  categoria        text,                                  -- ex.: software, contador, internet
  valor            numeric(12, 2) not null check (valor >= 0),
  competencia      date not null check (competencia = date_trunc('month', competencia)::date),
  data_vencimento  date,
  data_pagamento   date,
  status           public.status_lancamento not null default 'pendente',
  recorrente       boolean not null default true,         -- sugere repetir no mês seguinte
  observacoes      text,
  criado_por       uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

create index fin_custos_fixos_competencia_idx on public.fin_custos_fixos (competencia);

-- ---------------------------------------------------------------------
-- Custos variáveis (inclui gastos com IA)
-- ---------------------------------------------------------------------
create table public.fin_custos_variaveis (
  id             uuid primary key default gen_random_uuid(),
  descricao      text not null,
  categoria      public.categoria_custo_variavel not null default 'outro',
  ferramenta     text,                                    -- ex.: ChatGPT, Midjourney, Claude
  valor          numeric(12, 2) not null check (valor >= 0),
  competencia    date not null check (competencia = date_trunc('month', competencia)::date),
  data           date,
  entrega_id     uuid references public.fin_entregas (id) on delete set null,
  cliente_id     uuid references public.clientes (id) on delete set null,
  status         public.status_lancamento not null default 'pago',
  observacoes    text,
  criado_por     uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index fin_custos_variaveis_competencia_idx on public.fin_custos_variaveis (competencia);
create index fin_custos_variaveis_entrega_idx     on public.fin_custos_variaveis (entrega_id);

-- ---------------------------------------------------------------------
-- Pagamento de colaboradores
-- ---------------------------------------------------------------------
create table public.fin_pagamentos_colaboradores (
  id               uuid primary key default gen_random_uuid(),
  colaborador      text not null,
  perfil_id        uuid references public.perfis (id) on delete set null,  -- se tiver login no Compasso
  descricao        text,
  tipo             public.tipo_pagamento_colaborador not null default 'fixo',
  entrega_id       uuid references public.fin_entregas (id) on delete set null,  -- quando tipo = por_entrega
  valor            numeric(12, 2) not null check (valor >= 0),
  competencia      date not null check (competencia = date_trunc('month', competencia)::date),
  data_pagamento   date,
  status           public.status_lancamento not null default 'pendente',
  forma_pagamento  public.forma_pagamento,
  observacoes      text,
  criado_por       uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

create index fin_pag_colab_competencia_idx on public.fin_pagamentos_colaboradores (competencia);
create index fin_pag_colab_entrega_idx     on public.fin_pagamentos_colaboradores (entrega_id);

-- ---------------------------------------------------------------------
-- Pró-labore da Bruna
-- ---------------------------------------------------------------------
create table public.fin_pro_labore (
  id              uuid primary key default gen_random_uuid(),
  valor           numeric(12, 2) not null check (valor >= 0),
  competencia     date not null check (competencia = date_trunc('month', competencia)::date),
  data_pagamento  date,
  status          public.status_lancamento not null default 'pendente',
  observacoes     text,
  criado_por      uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

create index fin_pro_labore_competencia_idx on public.fin_pro_labore (competencia);

-- atualizado_em
create trigger fin_entregas_atualizado_em        before update on public.fin_entregas                 for each row execute function public.definir_atualizado_em();
create trigger fin_faturamento_atualizado_em     before update on public.fin_faturamento              for each row execute function public.definir_atualizado_em();
create trigger fin_custos_fixos_atualizado_em    before update on public.fin_custos_fixos             for each row execute function public.definir_atualizado_em();
create trigger fin_custos_var_atualizado_em      before update on public.fin_custos_variaveis         for each row execute function public.definir_atualizado_em();
create trigger fin_pag_colab_atualizado_em       before update on public.fin_pagamentos_colaboradores for each row execute function public.definir_atualizado_em();
create trigger fin_pro_labore_atualizado_em      before update on public.fin_pro_labore               for each row execute function public.definir_atualizado_em();

-- ---------------------------------------------------------------------
-- RLS: tudo exige Financeiro liberado
-- ---------------------------------------------------------------------
alter table public.fin_entregas                 enable row level security;
alter table public.fin_faturamento              enable row level security;
alter table public.fin_custos_fixos             enable row level security;
alter table public.fin_custos_variaveis         enable row level security;
alter table public.fin_pagamentos_colaboradores enable row level security;
alter table public.fin_pro_labore               enable row level security;

create policy "Financeiro liberado" on public.fin_entregas                 for all to authenticated
  using ((select public.tem_acesso_area('financeiro'))) with check ((select public.tem_acesso_area('financeiro')));
create policy "Financeiro liberado" on public.fin_faturamento              for all to authenticated
  using ((select public.tem_acesso_area('financeiro'))) with check ((select public.tem_acesso_area('financeiro')));
create policy "Financeiro liberado" on public.fin_custos_fixos             for all to authenticated
  using ((select public.tem_acesso_area('financeiro'))) with check ((select public.tem_acesso_area('financeiro')));
create policy "Financeiro liberado" on public.fin_custos_variaveis         for all to authenticated
  using ((select public.tem_acesso_area('financeiro'))) with check ((select public.tem_acesso_area('financeiro')));
create policy "Financeiro liberado" on public.fin_pagamentos_colaboradores for all to authenticated
  using ((select public.tem_acesso_area('financeiro'))) with check ((select public.tem_acesso_area('financeiro')));
create policy "Financeiro liberado" on public.fin_pro_labore               for all to authenticated
  using ((select public.tem_acesso_area('financeiro'))) with check ((select public.tem_acesso_area('financeiro')));

-- =====================================================================
-- Views de resumo (security_invoker: herdam o RLS acima)
-- Lançamentos com status 'cancelado' não entram em nenhuma soma.
-- =====================================================================

-- Resumo do mês: faturamento, custos e custo fixo por entrega
create view public.fin_resumo_mensal
with (security_invoker = true) as
with meses as (
  select competencia from public.fin_faturamento
  union select competencia from public.fin_custos_fixos
  union select competencia from public.fin_custos_variaveis
  union select competencia from public.fin_pagamentos_colaboradores
  union select competencia from public.fin_pro_labore
  union select competencia from public.fin_entregas
),
fat as (
  select competencia,
         sum(valor)                                   as total,
         sum(valor) filter (where status = 'pago')    as recebido
  from public.fin_faturamento where status <> 'cancelado' group by competencia
),
fixos as (
  select competencia, sum(valor) as total
  from public.fin_custos_fixos where status <> 'cancelado' group by competencia
),
variaveis as (
  select competencia,
         sum(valor)                                 as total,
         sum(valor) filter (where categoria = 'ia') as ia
  from public.fin_custos_variaveis where status <> 'cancelado' group by competencia
),
colab as (
  select competencia,
         sum(valor) filter (where tipo = 'fixo')        as fixo,
         sum(valor) filter (where tipo = 'por_entrega') as por_entrega
  from public.fin_pagamentos_colaboradores where status <> 'cancelado' group by competencia
),
pl as (
  select competencia, sum(valor) as total
  from public.fin_pro_labore where status <> 'cancelado' group by competencia
),
ent as (
  select competencia, count(*) as qtd, sum(valor_cobrado) as cobrado
  from public.fin_entregas group by competencia
),
base as (
  select
    m.competencia,
    coalesce(fat.total, 0)           as faturamento,
    coalesce(fat.recebido, 0)        as faturamento_recebido,
    coalesce(fixos.total, 0)         as custos_fixos,
    coalesce(colab.fixo, 0)          as colaboradores_fixos,
    coalesce(pl.total, 0)            as pro_labore,
    coalesce(variaveis.total, 0)     as custos_variaveis,
    coalesce(variaveis.ia, 0)        as gastos_ia,
    coalesce(colab.por_entrega, 0)   as colaboradores_por_entrega,
    coalesce(ent.qtd, 0)::int        as total_entregas,
    coalesce(ent.cobrado, 0)         as total_cobrado_entregas
  from meses m
  left join fat       using (competencia)
  left join fixos     using (competencia)
  left join variaveis using (competencia)
  left join colab     using (competencia)
  left join pl        using (competencia)
  left join ent       using (competencia)
)
select
  base.*,
  (custos_fixos + colaboradores_fixos + pro_labore)                         as base_fixa,
  round((custos_fixos + colaboradores_fixos + pro_labore)
        / nullif(total_entregas, 0), 2)                                     as custo_fixo_por_entrega,
  (custos_fixos + colaboradores_fixos + pro_labore
   + custos_variaveis + colaboradores_por_entrega)                          as custo_total,
  faturamento - (custos_fixos + colaboradores_fixos + pro_labore
                 + custos_variaveis + colaboradores_por_entrega)            as resultado
from base;

-- Custo real e margem de cada entrega registrada
create view public.fin_custo_entregas
with (security_invoker = true) as
with var as (
  select entrega_id,
         sum(valor)                                 as total,
         sum(valor) filter (where categoria = 'ia') as ia
  from public.fin_custos_variaveis
  where entrega_id is not null and status <> 'cancelado'
  group by entrega_id
),
colab as (
  select entrega_id, sum(valor) as total
  from public.fin_pagamentos_colaboradores
  where entrega_id is not null and tipo = 'por_entrega' and status <> 'cancelado'
  group by entrega_id
),
calc as (
  select
    e.id                                         as entrega_id,
    e.descricao,
    e.cliente_id,
    e.tipo_servico,
    e.competencia,
    e.data_entrega,
    e.valor_cobrado,
    coalesce(r.custo_fixo_por_entrega, 0)        as custo_fixo_rateado,
    coalesce(var.total, 0) + coalesce(colab.total, 0) as custos_variaveis,
    coalesce(var.ia, 0)                          as custo_ia
  from public.fin_entregas e
  left join public.fin_resumo_mensal r on r.competencia = e.competencia
  left join var   on var.entrega_id   = e.id
  left join colab on colab.entrega_id = e.id
)
select
  calc.*,
  custo_fixo_rateado + custos_variaveis                                     as custo_real,
  valor_cobrado - (custo_fixo_rateado + custos_variaveis)                   as margem_valor,
  round(100 * (valor_cobrado - (custo_fixo_rateado + custos_variaveis))
        / nullif(valor_cobrado, 0), 1)                                      as margem_percentual
from calc;

-- ---------------------------------------------------------------------
-- Calculadora de precificação (simulação, não grava nada)
--   p_competencia        mês de referência para os custos fixos
--   p_custos_variaveis   custos variáveis da entrega (sem IA)
--   p_custo_ia           gasto com IA nessa entrega
--   p_valor_cobrado      preço que pretende cobrar (opcional)
--   p_total_entregas     sobrescreve o nº de entregas do mês (opcional,
--                        útil para planejar um mês que ainda não fechou)
--   p_margem_desejada    % de margem alvo para sugerir preço (opcional)
-- ---------------------------------------------------------------------
create or replace function public.fin_simular_preco(
  p_competencia       date,
  p_custos_variaveis  numeric default 0,
  p_custo_ia          numeric default 0,
  p_valor_cobrado     numeric default null,
  p_total_entregas    integer default null,
  p_margem_desejada   numeric default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_mes         date := date_trunc('month', p_competencia)::date;
  v_base_fixa   numeric := 0;
  v_entregas    integer;
  v_fixo_ent    numeric;
  v_custo_real  numeric;
  v_margem      numeric;
begin
  if not public.tem_acesso_area('financeiro') then
    raise exception 'Financeiro bloqueado. Digite o código de acesso.' using errcode = '42501';
  end if;

  select r.base_fixa, r.total_entregas
    into v_base_fixa, v_entregas
  from public.fin_resumo_mensal r
  where r.competencia = v_mes;

  v_base_fixa := coalesce(v_base_fixa, 0);
  v_entregas  := coalesce(p_total_entregas, v_entregas, 0);

  if v_entregas <= 0 then
    return jsonb_build_object(
      'ok', false,
      'erro', 'Informe o número de entregas do mês para diluir os custos fixos.',
      'base_fixa_mes', v_base_fixa
    );
  end if;

  v_fixo_ent   := round(v_base_fixa / v_entregas, 2);
  v_custo_real := v_fixo_ent + coalesce(p_custos_variaveis, 0) + coalesce(p_custo_ia, 0);

  if p_valor_cobrado is not null then
    v_margem := p_valor_cobrado - v_custo_real;
  end if;

  return jsonb_build_object(
    'ok',                     true,
    'competencia',            v_mes,
    'base_fixa_mes',          v_base_fixa,
    'total_entregas',         v_entregas,
    'custo_fixo_por_entrega', v_fixo_ent,
    'custos_variaveis',       coalesce(p_custos_variaveis, 0),
    'custo_ia',               coalesce(p_custo_ia, 0),
    'custo_real',             v_custo_real,
    'valor_cobrado',          p_valor_cobrado,
    'margem_valor',           v_margem,
    'margem_percentual',      case when coalesce(p_valor_cobrado, 0) > 0
                                   then round(100 * v_margem / p_valor_cobrado, 1) end,
    'preco_sugerido',         case when p_margem_desejada is not null and p_margem_desejada < 100
                                   then round(v_custo_real / (1 - p_margem_desejada / 100), 2) end
  );
end;
$$;

revoke execute on function public.fin_simular_preco(date, numeric, numeric, numeric, integer, numeric) from public, anon;
grant  execute on function public.fin_simular_preco(date, numeric, numeric, numeric, integer, numeric) to authenticated;
