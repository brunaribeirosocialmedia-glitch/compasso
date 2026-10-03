-- =====================================================================
-- COMPASSO · 10 · Rotina mensal, checklist e comentários nas tarefas
-- =====================================================================
-- Depende de: 01, 02_area_do_cliente.sql, 09_etiquetas.sql
--
-- • Checklist: lista de itens dentro da tarefa (tarefas.checklist).
-- • Comentários: conversa da equipe dentro de cada tarefa.
-- • Rotina mensal: tarefas fixas de cada cliente que se repetem todo mês.
--   A função gerar_rotina_do_mes() cria as tarefas do mês atual uma única
--   vez por item (rotina_geracoes guarda o que já foi gerado — se alguém
--   excluir a tarefa, ela não volta). O app chama a função ao abrir a
--   tela Início e o quadro de Tarefas.
-- Acesso: o mesmo das tarefas (quem está associado ao cliente; admin vê tudo).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Checklist da tarefa: [{ "id": "...", "texto": "...", "feito": false }]
-- ---------------------------------------------------------------------
alter table public.tarefas
  add column checklist jsonb not null default '[]'::jsonb
    check (jsonb_typeof(checklist) = 'array');

-- ---------------------------------------------------------------------
-- Comentários
-- ---------------------------------------------------------------------
create table public.tarefa_comentarios (
  id          uuid primary key default gen_random_uuid(),
  tarefa_id   uuid not null references public.tarefas (id) on delete cascade,
  cliente_id  uuid not null references public.clientes (id) on delete cascade,
  autor_id    uuid references public.perfis (id) on delete set null default auth.uid(),
  texto       text not null check (length(trim(texto)) > 0),
  criado_em   timestamptz not null default now(),
  editado_em  timestamptz
);

create index tarefa_comentarios_tarefa_idx  on public.tarefa_comentarios (tarefa_id, criado_em);
create index tarefa_comentarios_cliente_idx on public.tarefa_comentarios (cliente_id);

-- O cliente do comentário é sempre o cliente da tarefa
create or replace function public.comentario_definir_cliente()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select t.cliente_id into new.cliente_id from public.tarefas t where t.id = new.tarefa_id;
  if tg_op = 'UPDATE' then
    new.autor_id := old.autor_id;
    new.criado_em := old.criado_em;
    new.editado_em := now();
  end if;
  return new;
end;
$$;

create trigger tarefa_comentarios_cliente
  before insert or update on public.tarefa_comentarios
  for each row execute function public.comentario_definir_cliente();

alter table public.tarefa_comentarios enable row level security;

create policy "Associados leem comentários"
  on public.tarefa_comentarios for select to authenticated
  using (public.tem_acesso_cliente(cliente_id));

create policy "Associados comentam"
  on public.tarefa_comentarios for insert to authenticated
  with check (public.tem_acesso_cliente(cliente_id) and autor_id = (select auth.uid()));

create policy "Autor edita o próprio comentário"
  on public.tarefa_comentarios for update to authenticated
  using (autor_id = (select auth.uid()))
  with check (autor_id = (select auth.uid()) and public.tem_acesso_cliente(cliente_id));

create policy "Autor ou admin exclui comentário"
  on public.tarefa_comentarios for delete to authenticated
  using (autor_id = (select auth.uid()) or (select public.eh_admin()));

-- ---------------------------------------------------------------------
-- Rotina mensal
-- ---------------------------------------------------------------------
create table public.rotina_itens (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references public.clientes (id) on delete cascade,
  titulo          text not null check (length(trim(titulo)) > 0),
  descricao       text,
  responsavel_id  uuid references public.perfis (id) on delete set null,
  prioridade      public.prioridade_tarefa,
  dia_inicio      smallint check (dia_inicio between 1 and 31),
  dia_prazo       smallint not null check (dia_prazo between 1 and 31),
  etiquetas       text[] not null default '{}',
  checklist       jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  ativo           boolean not null default true,
  criado_por      uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em       timestamptz not null default now(),
  check (dia_inicio is null or dia_inicio <= dia_prazo)
);

create index rotina_itens_cliente_idx on public.rotina_itens (cliente_id, dia_prazo);

alter table public.rotina_itens enable row level security;

create policy "Associados acessam a rotina"
  on public.rotina_itens for all to authenticated
  using (public.tem_acesso_cliente(cliente_id))
  with check (public.tem_acesso_cliente(cliente_id));

-- Tarefa gerada por um item da rotina
alter table public.tarefas
  add column rotina_item_id uuid references public.rotina_itens (id) on delete set null;

-- O que já foi gerado em cada mês (competência = dia 1 do mês)
create table public.rotina_geracoes (
  rotina_item_id  uuid not null references public.rotina_itens (id) on delete cascade,
  competencia     date not null,
  tarefa_id       uuid references public.tarefas (id) on delete set null,
  gerado_em       timestamptz not null default now(),
  primary key (rotina_item_id, competencia)
);

alter table public.rotina_geracoes enable row level security;

create policy "Associados veem as gerações"
  on public.rotina_geracoes for select to authenticated
  using (exists (
    select 1 from public.rotina_itens r
    where r.id = rotina_item_id and public.tem_acesso_cliente(r.cliente_id)
  ));
-- inserções só pela função abaixo

-- Cria as tarefas do mês atual que ainda não foram geradas.
-- p_cliente_id nulo = todos os clientes ativos que a pessoa acessa.
-- Item criado no meio do mês só entra neste mês se o prazo ainda não passou.
-- Devolve quantas tarefas foram criadas.
create or replace function public.gerar_rotina_do_mes(p_cliente_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoje        date := (now() at time zone 'America/Sao_Paulo')::date;
  v_competencia date := date_trunc('month', v_hoje)::date;
  v_ultimo_dia  integer := extract(day from (v_competencia + interval '1 month - 1 day'))::integer;
  v_item        record;
  v_coluna      uuid;
  v_ordem       double precision;
  v_prazo       date;
  v_tarefa      uuid;
  v_total       integer := 0;
begin
  if not (select public.eh_membro_ativo()) then
    return 0;
  end if;

  for v_item in
    select r.*
    from public.rotina_itens r
    join public.clientes c on c.id = r.cliente_id
    where r.ativo
      and c.ativo
      and (p_cliente_id is null or r.cliente_id = p_cliente_id)
      and public.tem_acesso_cliente(r.cliente_id)
      and not exists (
        select 1 from public.rotina_geracoes g
        where g.rotina_item_id = r.id and g.competencia = v_competencia
      )
    order by r.cliente_id, r.dia_prazo, r.criado_em
    for update of r skip locked
  loop
    v_prazo := v_competencia + (least(v_item.dia_prazo, v_ultimo_dia) - 1);

    -- criado neste mês com o prazo já vencido: começa só no mês que vem
    if (v_item.criado_em at time zone 'America/Sao_Paulo')::date >= v_competencia and v_prazo < v_hoje then
      continue;
    end if;

    -- primeira coluna que não seja "Ideias" nem de concluídas
    select tc.id into v_coluna
    from public.tarefa_colunas tc
    where tc.cliente_id = v_item.cliente_id
    order by (tc.marca_concluida or lower(trim(tc.nome)) = 'ideias'), tc.ordem
    limit 1;

    if v_coluna is null then
      continue;
    end if;

    select coalesce(max(t.ordem), 0) + 1024 into v_ordem
    from public.tarefas t where t.coluna_id = v_coluna;

    insert into public.tarefas
      (cliente_id, coluna_id, titulo, descricao, responsavel_id, prioridade,
       data_inicio, prazo, etiquetas, checklist, ordem, rotina_item_id)
    values
      (v_item.cliente_id, v_coluna, v_item.titulo, v_item.descricao, v_item.responsavel_id, v_item.prioridade,
       case when v_item.dia_inicio is not null
            then v_competencia + (least(v_item.dia_inicio, v_ultimo_dia) - 1) end,
       v_prazo, v_item.etiquetas,
       (select coalesce(jsonb_agg(jsonb_set(i, '{feito}', 'false'::jsonb)), '[]'::jsonb)
          from jsonb_array_elements(v_item.checklist) i),
       v_ordem, v_item.id)
    returning id into v_tarefa;

    insert into public.rotina_geracoes (rotina_item_id, competencia, tarefa_id)
    values (v_item.id, v_competencia, v_tarefa)
    on conflict do nothing;

    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

revoke execute on function public.gerar_rotina_do_mes(uuid) from public, anon;
grant  execute on function public.gerar_rotina_do_mes(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Renomear/excluir etiqueta também reflete na rotina
-- ---------------------------------------------------------------------
create or replace function public.propagar_etiqueta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.tarefas set etiquetas = array_remove(etiquetas, old.nome)
     where old.nome = any (etiquetas);
    update public.rotina_itens set etiquetas = array_remove(etiquetas, old.nome)
     where old.nome = any (etiquetas);
    return old;
  end if;
  if new.nome is distinct from old.nome then
    update public.tarefas set etiquetas = array_replace(etiquetas, old.nome, new.nome)
     where old.nome = any (etiquetas);
    update public.rotina_itens set etiquetas = array_replace(etiquetas, old.nome, new.nome)
     where old.nome = any (etiquetas);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Tempo real
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.tarefa_comentarios, public.rotina_itens;
