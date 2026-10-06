-- =====================================================================
-- COMPASSO · 12 · Obrigações (área Gestão)
-- =====================================================================
-- Depende de: 01, 04_financeiro.sql
--
-- • obrigacoes: o cadastro (DAS, DEFIS, alvará…) — mensal, anual ou única.
-- • obrigacao_ocorrencias: cada vencimento, com status pendente/feito/dispensada.
--   gerar_obrigacoes() cria os vencimentos até o fim do mês seguinte
--   (o app chama ao abrir Obrigações e o Financeiro; o cadastro também
--   chama sozinho quando é criado ou alterado).
-- • "Lançar no Financeiro": o vencimento ganha um custo fixo no mês dele.
--   Feito ⇄ Pago, Pendente ⇄ Pendente, Dispensada ⇄ Cancelado — mudar de
--   um lado muda o outro.
-- Acesso: o mesmo do Financeiro (a área Gestão usa a área 'financeiro').
-- =====================================================================

create table public.obrigacoes (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null check (length(trim(nome)) > 0),
  categoria       text not null default 'imposto'
                    check (categoria in ('imposto', 'declaracao', 'renovacao', 'taxa', 'outro')),
  recorrencia     text not null default 'mensal' check (recorrencia in ('mensal', 'anual', 'unica')),
  dia             smallint check (dia between 1 and 31),          -- mensal e anual
  mes             smallint check (mes between 1 and 12),          -- anual
  data_unica      date,                                           -- única
  valor_estimado  numeric(12, 2) check (valor_estimado >= 0),
  gera_despesa    boolean not null default false,
  observacoes     text,                                           -- onde pagar, quem cuida, login do portal…
  ativo           boolean not null default true,
  -- vencimentos antes desta data não são gerados (evita criar o mês que já passou)
  desde           date not null default (now() at time zone 'America/Sao_Paulo')::date,
  criado_por      uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

create trigger obrigacoes_atualizado_em
  before update on public.obrigacoes
  for each row execute function public.definir_atualizado_em();

create table public.obrigacao_ocorrencias (
  id            uuid primary key default gen_random_uuid(),
  obrigacao_id  uuid not null references public.obrigacoes (id) on delete cascade,
  vencimento    date not null,
  status        text not null default 'pendente' check (status in ('pendente', 'feito', 'dispensada')),
  feito_em      date,
  valor         numeric(12, 2) check (valor >= 0),
  custo_fixo_id uuid references public.fin_custos_fixos (id) on delete set null,
  observacoes   text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (obrigacao_id, vencimento)
);

create index obrigacao_ocorrencias_vencimento_idx on public.obrigacao_ocorrencias (status, vencimento);
create index obrigacao_ocorrencias_custo_idx on public.obrigacao_ocorrencias (custo_fixo_id);

create trigger obrigacao_ocorrencias_atualizado_em
  before update on public.obrigacao_ocorrencias
  for each row execute function public.definir_atualizado_em();

alter table public.obrigacoes            enable row level security;
alter table public.obrigacao_ocorrencias enable row level security;

create policy "Gestão liberada" on public.obrigacoes for all to authenticated
  using ((select public.tem_acesso_area('financeiro'))) with check ((select public.tem_acesso_area('financeiro')));
create policy "Gestão liberada" on public.obrigacao_ocorrencias for all to authenticated
  using ((select public.tem_acesso_area('financeiro'))) with check ((select public.tem_acesso_area('financeiro')));

-- ---------------------------------------------------------------------
-- Apoio
-- ---------------------------------------------------------------------
create or replace function public.obrigacao_categoria_custo(p_categoria text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_categoria
    when 'imposto' then 'Impostos'
    when 'declaracao' then 'Contabilidade'
    when 'renovacao' then 'Renovações'
    when 'taxa' then 'Taxas'
    else 'Outros'
  end;
$$;

-- Dia do mês respeitando meses curtos (31 em fevereiro → 28/29)
create or replace function public.dia_no_mes(p_mes date, p_dia integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select (date_trunc('month', p_mes)::date
          + (least(p_dia, extract(day from date_trunc('month', p_mes) + interval '1 month - 1 day')::integer) - 1));
$$;

-- Cria o custo fixo ligado a um vencimento (devolve o id)
create or replace function public.criar_custo_da_ocorrencia(
  p_obrigacao public.obrigacoes, p_vencimento date, p_valor numeric, p_status text, p_feito_em date
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.fin_custos_fixos
    (descricao, categoria, valor, competencia, data_vencimento, data_pagamento, status, recorrente, observacoes)
  values (
    p_obrigacao.nome,
    public.obrigacao_categoria_custo(p_obrigacao.categoria),
    p_valor,
    date_trunc('month', p_vencimento)::date,
    p_vencimento,
    case when p_status = 'feito' then p_feito_em end,
    (case p_status when 'feito' then 'pago' when 'dispensada' then 'cancelado' else 'pendente' end)::public.status_lancamento,
    false,
    'Lançado pela obrigação “' || p_obrigacao.nome || '” (Gestão › Obrigações).'
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Gera os vencimentos até o fim do mês seguinte
-- ---------------------------------------------------------------------
create or replace function public.gerar_obrigacoes(p_obrigacao_id uuid default null)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_hoje    date := (now() at time zone 'America/Sao_Paulo')::date;
  v_limite  date := (date_trunc('month', v_hoje) + interval '2 months - 1 day')::date;
  v_ob      public.obrigacoes;
  v_mes     date;
  v_venc    date;
  v_datas   date[];
  v_custo   uuid;
  v_total   integer := 0;
begin
  if not (select public.tem_acesso_area('financeiro')) then
    return 0;
  end if;

  for v_ob in
    select * from public.obrigacoes o
    where o.ativo and (p_obrigacao_id is null or o.id = p_obrigacao_id)
  loop
    v_datas := '{}';
    if v_ob.recorrencia = 'mensal' and v_ob.dia is not null then
      v_mes := date_trunc('month', v_ob.desde)::date;
      while v_mes <= v_limite loop
        v_datas := v_datas || public.dia_no_mes(v_mes, v_ob.dia);
        v_mes := (v_mes + interval '1 month')::date;
      end loop;
    elsif v_ob.recorrencia = 'anual' and v_ob.dia is not null and v_ob.mes is not null then
      for v_ano in extract(year from v_ob.desde)::integer .. extract(year from v_limite)::integer loop
        v_datas := v_datas || public.dia_no_mes(make_date(v_ano, v_ob.mes, 1), v_ob.dia);
      end loop;
    elsif v_ob.recorrencia = 'unica' and v_ob.data_unica is not null then
      v_datas := array[v_ob.data_unica];
    end if;

    foreach v_venc in array v_datas loop
      continue when v_venc > v_limite;
      -- única: sempre gera, mesmo que a data já tenha passado; repetidas: só a partir de "desde"
      continue when v_ob.recorrencia <> 'unica' and v_venc < v_ob.desde;
      continue when exists (
        select 1 from public.obrigacao_ocorrencias x where x.obrigacao_id = v_ob.id and x.vencimento = v_venc
      );
      v_custo := null;
      if v_ob.gera_despesa and v_ob.valor_estimado is not null then
        v_custo := public.criar_custo_da_ocorrencia(v_ob, v_venc, v_ob.valor_estimado, 'pendente', null);
      end if;
      insert into public.obrigacao_ocorrencias (obrigacao_id, vencimento, valor, custo_fixo_id)
      values (v_ob.id, v_venc, v_ob.valor_estimado, v_custo);
      v_total := v_total + 1;
    end loop;
  end loop;

  return v_total;
end;
$$;

grant execute on function public.gerar_obrigacoes(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Cadastro criado/alterado → refaz os vencimentos pendentes
-- (só quando muda algo que afeta datas ou valores)
-- ---------------------------------------------------------------------
create or replace function public.obrigacao_regerar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
       (new.nome, new.categoria, new.recorrencia, new.dia, new.mes, new.data_unica, new.valor_estimado, new.gera_despesa, new.ativo)
       is distinct from
       (old.nome, old.categoria, old.recorrencia, old.dia, old.mes, old.data_unica, old.valor_estimado, old.gera_despesa, old.ativo)
     ) then
    -- vencimentos ainda pendentes deste mês em diante são refeitos com os dados novos
    delete from public.obrigacao_ocorrencias
    where obrigacao_id = new.id and status = 'pendente'
      and vencimento >= date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
  elsif tg_op = 'UPDATE' then
    return null;
  end if;
  perform public.gerar_obrigacoes(new.id);
  return null;
end;
$$;

create trigger obrigacoes_regerar
  after insert or update on public.obrigacoes
  for each row execute function public.obrigacao_regerar();

-- ---------------------------------------------------------------------
-- Vencimento ⇄ custo fixo
-- ---------------------------------------------------------------------
create or replace function public.ocorrencia_antes_de_mudar()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ob public.obrigacoes;
begin
  if new.status = 'feito' and new.feito_em is null then
    new.feito_em := (now() at time zone 'America/Sao_Paulo')::date;
  elsif new.status <> 'feito' then
    new.feito_em := null;
  end if;

  -- passou a ter valor e a obrigação lança no Financeiro → cria o custo agora
  if new.custo_fixo_id is null and new.valor is not null and new.status <> 'dispensada' then
    select * into v_ob from public.obrigacoes where id = new.obrigacao_id;
    if v_ob.gera_despesa then
      new.custo_fixo_id := public.criar_custo_da_ocorrencia(v_ob, new.vencimento, new.valor, new.status, new.feito_em);
    end if;
  end if;
  return new;
end;
$$;

create trigger obrigacao_ocorrencias_antes
  before update on public.obrigacao_ocorrencias
  for each row execute function public.ocorrencia_antes_de_mudar();

create or replace function public.ocorrencia_sincronizar_custo()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.status_lancamento :=
    (case new.status when 'feito' then 'pago' when 'dispensada' then 'cancelado' else 'pendente' end)::public.status_lancamento;
begin
  if new.custo_fixo_id is not null then
    update public.fin_custos_fixos c
       set status = v_status,
           data_pagamento = new.feito_em,
           valor = coalesce(new.valor, c.valor)
     where c.id = new.custo_fixo_id
       and (c.status, c.data_pagamento, c.valor) is distinct from (v_status, new.feito_em, coalesce(new.valor, c.valor));
  end if;
  return null;
end;
$$;

create trigger obrigacao_ocorrencias_sincronizar
  after update on public.obrigacao_ocorrencias
  for each row execute function public.ocorrencia_sincronizar_custo();

-- vencimento apagado → o custo ainda pendente sai do Financeiro junto
create or replace function public.ocorrencia_apagar_custo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.custo_fixo_id is not null then
    delete from public.fin_custos_fixos where id = old.custo_fixo_id and status = 'pendente';
  end if;
  return old;
end;
$$;

create trigger obrigacao_ocorrencias_apagar
  after delete on public.obrigacao_ocorrencias
  for each row execute function public.ocorrencia_apagar_custo();

-- custo marcado como pago/cancelado no Financeiro → vencimento acompanha
create or replace function public.custo_sincronizar_ocorrencia()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text := case new.status when 'pago' then 'feito' when 'cancelado' then 'dispensada' else 'pendente' end;
  v_feito  date := case when new.status = 'pago'
                        then coalesce(new.data_pagamento, (now() at time zone 'America/Sao_Paulo')::date) end;
begin
  update public.obrigacao_ocorrencias o
     set status = v_status, feito_em = v_feito, valor = new.valor
   where o.custo_fixo_id = new.id
     and (o.status, o.feito_em, o.valor) is distinct from (v_status, v_feito, new.valor);
  return null;
end;
$$;

create trigger fin_custos_fixos_sincronizar_obrigacao
  after update of status, data_pagamento, valor on public.fin_custos_fixos
  for each row execute function public.custo_sincronizar_ocorrencia();
