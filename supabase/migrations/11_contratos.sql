-- =====================================================================
-- COMPASSO · 11 · Contratos (área Gestão)
-- =====================================================================
-- Depende de: 01, 02_area_do_cliente.sql, 03_prospeccao.sql
--
-- • Um contrato por cliente (pode haver mais de um ao longo do tempo:
--   o antigo fica "encerrado" e um novo é cadastrado).
-- • Quando um prospect vira cliente, o contrato nasce sozinho com o
--   valor fechado, a forma de pagamento e o serviço do prospect — mesmo
--   que quem clicou em "Virar cliente" não tenha acesso à Gestão.
-- • O arquivo do contrato (PDF, imagem…) fica no bucket privado
--   "contratos", no caminho <contrato_id>/<nome do arquivo>.
-- Acesso: o mesmo do Financeiro (a área Gestão usa a área 'financeiro').
-- =====================================================================

create table public.contratos (
  id                    uuid primary key default gen_random_uuid(),
  cliente_id            uuid references public.clientes (id) on delete set null,
  prospect_id           uuid references public.prospects (id) on delete set null,
  -- se o cliente for apagado, o nome continua aparecendo no histórico
  nome_cliente          text not null,
  servicos              text,
  valor_mensal          numeric(12, 2) check (valor_mensal >= 0),
  dia_vencimento        smallint check (dia_vencimento between 1 and 31),
  forma_pagamento       public.forma_pagamento,
  inicio                date,
  fim                   date,
  renovacao_automatica  boolean not null default false,
  aviso_previo_dias     smallint not null default 30 check (aviso_previo_dias between 0 and 365),
  status                text not null default 'ativo' check (status in ('ativo', 'encerrado')),
  arquivo_caminho       text,
  arquivo_nome          text,
  observacoes           text,
  criado_por            uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),
  check (fim is null or inicio is null or fim >= inicio)
);

create index contratos_cliente_idx on public.contratos (cliente_id);
create unique index contratos_prospect_unico on public.contratos (prospect_id) where prospect_id is not null;

create trigger contratos_atualizado_em
  before update on public.contratos
  for each row execute function public.definir_atualizado_em();

alter table public.contratos enable row level security;

create policy "Gestão liberada" on public.contratos for all to authenticated
  using ((select public.tem_acesso_area('financeiro'))) with check ((select public.tem_acesso_area('financeiro')));

-- ---------------------------------------------------------------------
-- Prospect virou cliente → contrato criado automaticamente
-- ---------------------------------------------------------------------
create or replace function public.criar_contrato_do_prospect()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.cliente_id is not null and old.cliente_id is null then
    insert into public.contratos (cliente_id, prospect_id, nome_cliente, servicos, valor_mensal, forma_pagamento, inicio, criado_por)
    values (new.cliente_id, new.id, new.empresa, new.servico_pretendido, new.valor_fechado, new.forma_pagamento,
            coalesce(new.fechado_em::date, current_date), auth.uid())
    on conflict (prospect_id) where prospect_id is not null do nothing;
  end if;
  return new;
end;
$$;

create trigger prospects_criar_contrato
  after update of cliente_id on public.prospects
  for each row execute function public.criar_contrato_do_prospect();

-- Prospects que já viraram cliente antes desta migration ganham o contrato também
insert into public.contratos (cliente_id, prospect_id, nome_cliente, servicos, valor_mensal, forma_pagamento, inicio)
select p.cliente_id, p.id, coalesce(c.nome, p.empresa), p.servico_pretendido, p.valor_fechado, p.forma_pagamento,
       coalesce(p.fechado_em::date, p.data_primeiro_contato)
from public.prospects p
left join public.clientes c on c.id = p.cliente_id
where p.cliente_id is not null
on conflict (prospect_id) where prospect_id is not null do nothing;

-- ---------------------------------------------------------------------
-- Arquivos dos contratos (bucket privado, até 20 MB por arquivo)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('contratos', 'contratos', false, 20971520)
on conflict (id) do nothing;

create policy "Contratos: ler com Gestão liberada" on storage.objects for select to authenticated
  using (bucket_id = 'contratos' and (select public.tem_acesso_area('financeiro')));
create policy "Contratos: enviar com Gestão liberada" on storage.objects for insert to authenticated
  with check (bucket_id = 'contratos' and (select public.tem_acesso_area('financeiro')));
create policy "Contratos: trocar com Gestão liberada" on storage.objects for update to authenticated
  using (bucket_id = 'contratos' and (select public.tem_acesso_area('financeiro')));
create policy "Contratos: apagar com Gestão liberada" on storage.objects for delete to authenticated
  using (bucket_id = 'contratos' and (select public.tem_acesso_area('financeiro')));
