-- =====================================================================
-- COMPASSO · 02 · Área do Cliente (Tarefas, Calendário, Bloco de Notas)
-- =====================================================================
-- Depende de: 01_base_usuarios_permissoes.sql
-- Regra de acesso: só vê a Área do Cliente quem está associado a ele
-- (tabela cliente_membros). Admin vê todas.
-- =====================================================================

create type public.prioridade_tarefa as enum ('baixa', 'media', 'alta', 'urgente');
create type public.tipo_evento as enum ('reuniao', 'gravacao', 'entrega', 'publicacao', 'outro');

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------
create table public.clientes (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  slug            text unique,                 -- mesmo identificador usado no Cadência (?cliente=)
  cor             text,                        -- cor de destaque na interface (#hex)
  descricao       text,
  ativo           boolean not null default true,
  criado_por      uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

create trigger clientes_atualizado_em
  before update on public.clientes
  for each row execute function public.definir_atualizado_em();

-- Quem está associado a cada cliente
create table public.cliente_membros (
  cliente_id     uuid not null references public.clientes (id) on delete cascade,
  usuario_id     uuid not null references public.perfis (id) on delete cascade,
  adicionado_em  timestamptz not null default now(),
  primary key (cliente_id, usuario_id)
);

create index cliente_membros_usuario_idx on public.cliente_membros (usuario_id);

create or replace function public.tem_acesso_cliente(p_cliente_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.eh_admin()
      or exists (
           select 1
           from public.cliente_membros m
           join public.perfis p on p.id = m.usuario_id
           where m.cliente_id = p_cliente_id
             and m.usuario_id = auth.uid()
             and p.ativo
         );
$$;

revoke execute on function public.tem_acesso_cliente(uuid) from public, anon;
grant  execute on function public.tem_acesso_cliente(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Tarefas: colunas de status configuráveis por cliente (kanban)
-- ---------------------------------------------------------------------
create table public.tarefa_colunas (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid not null references public.clientes (id) on delete cascade,
  nome             text not null,
  cor              text,
  ordem            integer not null default 0,
  marca_concluida  boolean not null default false,  -- mover para cá = tarefa concluída
  criado_em        timestamptz not null default now(),
  unique (id, cliente_id)                            -- permite FK composta em tarefas
);

create index tarefa_colunas_cliente_idx on public.tarefa_colunas (cliente_id, ordem);

-- Colunas padrão ao criar um cliente
create or replace function public.criar_colunas_padrao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tarefa_colunas (cliente_id, nome, ordem, marca_concluida) values
    (new.id, 'A fazer',       1, false),
    (new.id, 'Em andamento',  2, false),
    (new.id, 'Em aprovação',  3, false),
    (new.id, 'Concluído',     4, true);
  return new;
end;
$$;

revoke execute on function public.criar_colunas_padrao() from public, anon, authenticated;

create trigger clientes_colunas_padrao
  after insert on public.clientes
  for each row execute function public.criar_colunas_padrao();

-- ---------------------------------------------------------------------
-- Tarefas
-- ---------------------------------------------------------------------
create table public.tarefas (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references public.clientes (id) on delete cascade,
  coluna_id       uuid not null,
  titulo          text not null,
  descricao       text,
  responsavel_id  uuid references public.perfis (id) on delete set null,
  prioridade      public.prioridade_tarefa,
  data_inicio     date,
  prazo           date,
  etiquetas       text[] not null default '{}',
  ordem           double precision not null default 0,   -- posição dentro da coluna (arrastar e soltar)
  concluida_em    timestamptz,
  criado_por      uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  -- garante que a coluna pertence ao mesmo cliente da tarefa
  foreign key (coluna_id, cliente_id)
    references public.tarefa_colunas (id, cliente_id) on delete restrict,
  check (data_inicio is null or prazo is null or data_inicio <= prazo)
);

create index tarefas_cliente_coluna_idx on public.tarefas (cliente_id, coluna_id, ordem);
create index tarefas_prazo_idx          on public.tarefas (cliente_id, prazo) where prazo is not null;
create index tarefas_responsavel_idx    on public.tarefas (responsavel_id);

create trigger tarefas_atualizado_em
  before update on public.tarefas
  for each row execute function public.definir_atualizado_em();

-- Preenche/limpa concluida_em conforme a coluna
create or replace function public.sincronizar_conclusao_tarefa()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_concluida boolean;
begin
  if tg_op = 'UPDATE' and new.coluna_id is not distinct from old.coluna_id then
    return new;
  end if;

  select c.marca_concluida into v_concluida
  from public.tarefa_colunas c
  where c.id = new.coluna_id;

  if v_concluida then
    new.concluida_em := coalesce(new.concluida_em, now());
  else
    new.concluida_em := null;
  end if;
  return new;
end;
$$;

create trigger tarefas_conclusao
  before insert or update of coluna_id on public.tarefas
  for each row execute function public.sincronizar_conclusao_tarefa();

-- ---------------------------------------------------------------------
-- Calendário: eventos avulsos (reuniões, gravações, publicações...)
-- Os prazos das tarefas aparecem automaticamente via view calendario_itens
-- ---------------------------------------------------------------------
create table public.eventos (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references public.clientes (id) on delete cascade,
  titulo         text not null,
  descricao      text,
  tipo           public.tipo_evento not null default 'outro',
  inicio         timestamptz not null,
  fim            timestamptz,
  dia_inteiro    boolean not null default false,
  criado_por     uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);

create index eventos_cliente_inicio_idx on public.eventos (cliente_id, inicio);

create trigger eventos_atualizado_em
  before update on public.eventos
  for each row execute function public.definir_atualizado_em();

-- ---------------------------------------------------------------------
-- Bloco de Notas
-- ---------------------------------------------------------------------
create table public.notas (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references public.clientes (id) on delete cascade,
  titulo         text,
  conteudo       text not null default '',
  fixada         boolean not null default false,
  cor            text,
  tarefa_id      uuid references public.tarefas (id) on delete set null,  -- preenchido quando vira tarefa
  autor_id       uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index notas_cliente_idx on public.notas (cliente_id, fixada desc, atualizado_em desc);

create trigger notas_atualizado_em
  before update on public.notas
  for each row execute function public.definir_atualizado_em();

-- Transforma uma nota em tarefa (numa só operação)
create or replace function public.converter_nota_em_tarefa(
  p_nota_id   uuid,
  p_coluna_id uuid default null
)
returns uuid
language plpgsql
volatile
security invoker          -- respeita o RLS de quem chama
set search_path = ''
as $$
declare
  v_nota    public.notas;
  v_coluna  uuid := p_coluna_id;
  v_tarefa  uuid;
begin
  select * into v_nota from public.notas where id = p_nota_id;
  if not found then
    raise exception 'Nota não encontrada.';
  end if;

  if v_coluna is null then
    select c.id into v_coluna
    from public.tarefa_colunas c
    where c.cliente_id = v_nota.cliente_id
    order by c.ordem
    limit 1;
  end if;

  insert into public.tarefas (cliente_id, coluna_id, titulo, descricao)
  values (
    v_nota.cliente_id,
    v_coluna,
    coalesce(nullif(trim(v_nota.titulo), ''), left(v_nota.conteudo, 80), 'Nova tarefa'),
    v_nota.conteudo
  )
  returning id into v_tarefa;

  update public.notas set tarefa_id = v_tarefa where id = p_nota_id;
  return v_tarefa;
end;
$$;

revoke execute on function public.converter_nota_em_tarefa(uuid, uuid) from public, anon;
grant  execute on function public.converter_nota_em_tarefa(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- View do Calendário: eventos + prazos de tarefas, já filtrados pelo RLS
-- ---------------------------------------------------------------------
create view public.calendario_itens
with (security_invoker = true) as
  select
    'evento'::text        as origem,
    e.id,
    e.cliente_id,
    e.titulo,
    e.tipo::text          as tipo,
    e.inicio,
    e.fim,
    e.dia_inteiro,
    null::uuid            as responsavel_id,
    false                 as concluida
  from public.eventos e
union all
  select
    'tarefa'::text,
    t.id,
    t.cliente_id,
    t.titulo,
    'prazo',
    t.prazo::timestamptz,
    null,
    true,
    t.responsavel_id,
    t.concluida_em is not null
  from public.tarefas t
  where t.prazo is not null;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.clientes        enable row level security;
alter table public.cliente_membros enable row level security;
alter table public.tarefa_colunas  enable row level security;
alter table public.tarefas         enable row level security;
alter table public.eventos         enable row level security;
alter table public.notas           enable row level security;

-- Clientes: associados veem; só admin cria/edita/remove
create policy "Associados veem o cliente"
  on public.clientes for select to authenticated
  using (public.tem_acesso_cliente(id));

create policy "Admin cria clientes"
  on public.clientes for insert to authenticated
  with check ((select public.eh_admin()));

create policy "Admin edita clientes"
  on public.clientes for update to authenticated
  using ((select public.eh_admin())) with check ((select public.eh_admin()));

create policy "Admin remove clientes"
  on public.clientes for delete to authenticated
  using ((select public.eh_admin()));

-- Associações: quem tem acesso ao cliente vê a equipe dele; só admin altera
create policy "Associados veem a equipe do cliente"
  on public.cliente_membros for select to authenticated
  using (public.tem_acesso_cliente(cliente_id));

create policy "Admin associa membros"
  on public.cliente_membros for insert to authenticated
  with check ((select public.eh_admin()));

create policy "Admin desassocia membros"
  on public.cliente_membros for delete to authenticated
  using ((select public.eh_admin()));

-- Colunas, Tarefas, Eventos e Notas: acesso total para associados ao cliente
create policy "Associados acessam colunas"
  on public.tarefa_colunas for all to authenticated
  using (public.tem_acesso_cliente(cliente_id))
  with check (public.tem_acesso_cliente(cliente_id));

create policy "Associados acessam tarefas"
  on public.tarefas for all to authenticated
  using (public.tem_acesso_cliente(cliente_id))
  with check (public.tem_acesso_cliente(cliente_id));

create policy "Associados acessam eventos"
  on public.eventos for all to authenticated
  using (public.tem_acesso_cliente(cliente_id))
  with check (public.tem_acesso_cliente(cliente_id));

create policy "Associados acessam notas"
  on public.notas for all to authenticated
  using (public.tem_acesso_cliente(cliente_id))
  with check (public.tem_acesso_cliente(cliente_id));

-- ---------------------------------------------------------------------
-- Tempo real: quem estiver com o board aberto vê as mudanças na hora
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table
  public.tarefas, public.tarefa_colunas, public.eventos, public.notas;
