-- =====================================================================
-- COMPASSO · 03 · Prospecção
-- =====================================================================
-- Depende de: 01 (e 02, pela ligação opcional prospect → cliente)
-- Acesso: tem_acesso_area('prospeccao') = permissão + código digitado
-- =====================================================================

create type public.status_prospect as enum ('frio', 'morno', 'quente');
create type public.forma_pagamento as enum
  ('pix', 'boleto', 'cartao_credito', 'cartao_debito', 'transferencia', 'dinheiro', 'outro');

create table public.prospects (
  id                     uuid primary key default gen_random_uuid(),
  -- visão em lista
  empresa                text not null,
  responsavel            text,
  contato                text,
  status                 public.status_prospect not null default 'frio',
  data_primeiro_contato  date not null default current_date,
  servico_pretendido     text,
  -- perfil do prospect
  valor_estimado         numeric(12, 2) check (valor_estimado >= 0),
  valor_fechado          numeric(12, 2) check (valor_fechado >= 0),
  data_pagamento         date,
  forma_pagamento        public.forma_pagamento,
  -- quando fecha negócio e vira cliente
  cliente_id             uuid references public.clientes (id) on delete set null,
  criado_por             uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);

create index prospects_status_idx on public.prospects (status, data_primeiro_contato desc);

create trigger prospects_atualizado_em
  before update on public.prospects
  for each row execute function public.definir_atualizado_em();

-- Anotações do perfil (histórico com data e autor)
create table public.prospect_anotacoes (
  id           uuid primary key default gen_random_uuid(),
  prospect_id  uuid not null references public.prospects (id) on delete cascade,
  texto        text not null,
  autor_id     uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em    timestamptz not null default now()
);

create index prospect_anotacoes_idx on public.prospect_anotacoes (prospect_id, criado_em desc);

-- RLS
alter table public.prospects          enable row level security;
alter table public.prospect_anotacoes enable row level security;

create policy "Prospecção liberada: acesso total"
  on public.prospects for all to authenticated
  using ((select public.tem_acesso_area('prospeccao')))
  with check ((select public.tem_acesso_area('prospeccao')));

create policy "Prospecção liberada: anotações"
  on public.prospect_anotacoes for all to authenticated
  using ((select public.tem_acesso_area('prospeccao')))
  with check ((select public.tem_acesso_area('prospeccao')));
