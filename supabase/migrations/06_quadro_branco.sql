-- =====================================================================
-- COMPASSO · 06 · Quadro Branco (um por cliente)
-- =====================================================================
-- Depende de: 02_area_do_cliente.sql
-- O quadro guarda os elementos do Excalidraw (post-its, setas, textos…)
-- como jsonb. As imagens coladas ficam numa tabela separada para não
-- serem regravadas a cada mudança no quadro.
-- Acesso: as mesmas pessoas que acessam o cliente (tem_acesso_cliente).
-- =====================================================================

create table public.quadros (
  cliente_id      uuid primary key references public.clientes (id) on delete cascade,
  elementos       jsonb not null default '[]'::jsonb,
  fundo           text,                         -- cor de fundo escolhida no quadro
  revisao         uuid,                         -- muda a cada gravação; evita reler o próprio salvamento
  atualizado_por  uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

create trigger quadros_atualizado_em
  before update on public.quadros
  for each row execute function public.definir_atualizado_em();

create table public.quadro_arquivos (
  cliente_id  uuid not null references public.clientes (id) on delete cascade,
  id          text not null,                    -- id do arquivo dentro do Excalidraw
  mime        text not null,
  data_url    text not null,
  criado_por  uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em   timestamptz not null default now(),
  primary key (cliente_id, id)
);

alter table public.quadros         enable row level security;
alter table public.quadro_arquivos enable row level security;

create policy "Associados acessam o quadro"
  on public.quadros for all to authenticated
  using (public.tem_acesso_cliente(cliente_id))
  with check (public.tem_acesso_cliente(cliente_id));

create policy "Associados acessam imagens do quadro"
  on public.quadro_arquivos for all to authenticated
  using (public.tem_acesso_cliente(cliente_id))
  with check (public.tem_acesso_cliente(cliente_id));

-- Tempo real: quem estiver com o quadro aberto recebe as mudanças dos outros
alter publication supabase_realtime add table public.quadros;
