-- =====================================================================
-- COMPASSO · 14 · Aprovação do cliente (a ponte com o Cadência)
-- =====================================================================
-- Depende de: 02_area_do_cliente, 05_ajustes_area_do_cliente,
--             10_rotina_checklist_comentarios
--
-- O que esta migração faz:
--  1) A tarefa passa a carregar a PEÇA: legenda, formato e mídias
--     (imagens/vídeo). As mídias ficam no bucket público "pecas".
--  2) Nova coluna "Aprovado" (entre "Em aprovação" e "Concluído"),
--     tanto para clientes novos quanto para os que já existem.
--  3) Cada cliente ganha um token de aprovação (o link que vai pro
--     cliente: #/aprovar/<token>). Dá para regenerar (revoga o antigo).
--  4) Funções para o cliente (anon, sem login) usar só pelo token:
--     ver as peças "Em aprovação", comentar e aprovar (move p/ "Aprovado").
--
-- ATENÇÃO ao bucket "pecas": é PÚBLICO (quem tiver o endereço da imagem
-- a vê, sem login). É o mesmo modelo do Cadência antigo — conteúdo de
-- social media, feito para ser publicado. Os caminhos são aleatórios
-- (<cliente_id>/<tarefa_id>/<uuid>-<nome>), então não dá para "adivinhar".
-- Enviar/trocar/apagar mídia continua restrito a quem acessa o cliente.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1 · A peça na tarefa
-- ---------------------------------------------------------------------
do $$ begin
  create type public.formato_peca as enum ('feed','carrossel','story','video');
exception when duplicate_object then null;
end $$;

alter table public.tarefas
  add column if not exists legenda     text,
  add column if not exists formato     public.formato_peca,
  add column if not exists midias      jsonb not null default '[]'::jsonb
    check (jsonb_typeof(midias) = 'array'),
  add column if not exists aprovado_em timestamptz;

-- midias = [{ "caminho": "...", "nome": "...", "tipo": "image"|"video", "ordem": 0 }]

-- Bucket público das peças (imagens e vídeo), até 50 MB por arquivo
insert into storage.buckets (id, name, public, file_size_limit)
values ('pecas', 'pecas', true, 52428800)
on conflict (id) do nothing;

-- Leitura é pública (bucket público). Envio/troca/remoção só de quem
-- tem acesso ao cliente. Caminho = <cliente_id>/<tarefa_id>/<arquivo>.
drop policy if exists "Peças: enviar com acesso ao cliente"  on storage.objects;
drop policy if exists "Peças: trocar com acesso ao cliente"  on storage.objects;
drop policy if exists "Peças: apagar com acesso ao cliente"  on storage.objects;

create policy "Peças: enviar com acesso ao cliente"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'pecas'
    and public.tem_acesso_cliente(((storage.foldername(name))[1])::uuid));

create policy "Peças: trocar com acesso ao cliente"
  on storage.objects for update to authenticated
  using (bucket_id = 'pecas'
    and public.tem_acesso_cliente(((storage.foldername(name))[1])::uuid));

create policy "Peças: apagar com acesso ao cliente"
  on storage.objects for delete to authenticated
  using (bucket_id = 'pecas'
    and public.tem_acesso_cliente(((storage.foldername(name))[1])::uuid));


-- ---------------------------------------------------------------------
-- 2 · Coluna "Aprovado" (entre "Em aprovação" e "Concluído")
-- ---------------------------------------------------------------------
-- Mesmos atributos da função original (02_area_do_cliente): security definer.
create or replace function public.criar_colunas_padrao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tarefa_colunas (cliente_id, nome, ordem, marca_concluida) values
    (new.id, 'A fazer',      1, false),
    (new.id, 'Em andamento', 2, false),
    (new.id, 'Em aprovação', 3, false),
    (new.id, 'Aprovado',     4, false),
    (new.id, 'Concluído',    5, true);
  return new;
end;
$$;

-- Backfill: clientes que ainda não têm a coluna "Aprovado"
do $$
declare
  c record;
  v_ordem_concluida integer;
begin
  for c in select id from public.clientes loop
    if not exists (
      select 1 from public.tarefa_colunas tc
      where tc.cliente_id = c.id and lower(trim(tc.nome)) = 'aprovado'
    ) then
      select tc.ordem into v_ordem_concluida
        from public.tarefa_colunas tc
        where tc.cliente_id = c.id and tc.marca_concluida
        order by tc.ordem limit 1;

      if v_ordem_concluida is null then
        -- sem coluna de concluídos: joga "Aprovado" pro fim
        select coalesce(max(tc.ordem), 0) + 1 into v_ordem_concluida
          from public.tarefa_colunas tc where tc.cliente_id = c.id;
        insert into public.tarefa_colunas (cliente_id, nome, ordem, marca_concluida)
          values (c.id, 'Aprovado', v_ordem_concluida, false);
      else
        -- empurra "Concluído" (e o que vier depois) +1 e põe "Aprovado" no lugar
        update public.tarefa_colunas tc set ordem = tc.ordem + 1
          where tc.cliente_id = c.id and tc.ordem >= v_ordem_concluida;
        insert into public.tarefa_colunas (cliente_id, nome, ordem, marca_concluida)
          values (c.id, 'Aprovado', v_ordem_concluida, false);
      end if;
    end if;
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 3 · Token de aprovação por cliente
-- ---------------------------------------------------------------------
alter table public.clientes
  add column if not exists token_aprovacao text unique;

update public.clientes
  set token_aprovacao = replace(gen_random_uuid()::text, '-', '')
                     || replace(gen_random_uuid()::text, '-', '')
  where token_aprovacao is null;

alter table public.clientes
  alter column token_aprovacao
    set default (replace(gen_random_uuid()::text, '-', '')
              || replace(gen_random_uuid()::text, '-', ''));

alter table public.clientes
  alter column token_aprovacao set not null;

-- Gera um token novo (derruba o link antigo). Só quem acessa o cliente.
create or replace function public.regenerar_token_aprovacao(p_cliente_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_token text;
begin
  if not public.tem_acesso_cliente(p_cliente_id) then
    raise exception 'sem acesso a este cliente';
  end if;
  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');
  update public.clientes set token_aprovacao = v_token where id = p_cliente_id;
  return v_token;
end;
$$;

revoke execute on function public.regenerar_token_aprovacao(uuid) from public, anon;
grant  execute on function public.regenerar_token_aprovacao(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 4 · Comentário do cliente (sem login)
-- ---------------------------------------------------------------------
alter table public.tarefa_comentarios
  add column if not exists autor_nome text,
  add column if not exists origem text not null default 'equipe'
    check (origem in ('equipe','cliente'));


-- ---------------------------------------------------------------------
-- 5 · Funções que o cliente usa só pelo token (anon)
-- ---------------------------------------------------------------------

-- 5.1 · Quadro de aprovação: peças "Em aprovação" + histórico "Aprovado"
create or replace function public.aprovacao_quadro(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente record;
  v_result  jsonb;
begin
  select id, nome into v_cliente
    from public.clientes
    where token_aprovacao = p_token and ativo;

  if v_cliente.id is null then
    return null;  -- token inválido ou cliente inativo
  end if;

  select jsonb_build_object(
    'cliente', jsonb_build_object('nome', v_cliente.nome),
    'pendentes', coalesce((
      select jsonb_agg(p order by p.ordem)
      from (
        select
          t.id, t.titulo, t.descricao, t.legenda,
          t.formato::text as formato, t.midias, t.prazo, t.ordem,
          coalesce((
            select jsonb_agg(jsonb_build_object(
                     'texto',  cm.texto,
                     'autor',  coalesce(cm.autor_nome, pf.nome, 'Equipe'),
                     'origem', cm.origem,
                     'criado_em', cm.criado_em
                   ) order by cm.criado_em)
            from public.tarefa_comentarios cm
            left join public.perfis pf on pf.id = cm.autor_id
            where cm.tarefa_id = t.id
          ), '[]'::jsonb) as comentarios
        from public.tarefas t
        join public.tarefa_colunas tc on tc.id = t.coluna_id
        where t.cliente_id = v_cliente.id
          and lower(trim(tc.nome)) = 'em aprovação'
      ) p
    ), '[]'::jsonb),
    'aprovados', coalesce((
      select jsonb_agg(p order by p.aprovado_em desc nulls last)
      from (
        select t.id, t.titulo, t.legenda, t.formato::text as formato,
               t.midias, t.aprovado_em
        from public.tarefas t
        join public.tarefa_colunas tc on tc.id = t.coluna_id
        where t.cliente_id = v_cliente.id
          and lower(trim(tc.nome)) = 'aprovado'
      ) p
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.aprovacao_quadro(text) from public;
grant  execute on function public.aprovacao_quadro(text) to anon, authenticated;


-- 5.2 · Comentar numa peça
create or replace function public.aprovacao_comentar(
  p_token text, p_tarefa_id uuid, p_nome text, p_texto text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_cliente uuid;
begin
  select id into v_cliente
    from public.clientes where token_aprovacao = p_token and ativo;
  if v_cliente is null then raise exception 'token inválido'; end if;

  if length(trim(coalesce(p_texto, ''))) = 0 then
    raise exception 'comentário vazio';
  end if;

  -- a peça precisa ser deste cliente e estar em aprovação ou já aprovada
  if not exists (
    select 1 from public.tarefas t
    join public.tarefa_colunas tc on tc.id = t.coluna_id
    where t.id = p_tarefa_id and t.cliente_id = v_cliente
      and lower(trim(tc.nome)) in ('em aprovação','aprovado')
  ) then
    raise exception 'peça não disponível para comentário';
  end if;

  insert into public.tarefa_comentarios (tarefa_id, texto, autor_nome, origem)
  values (p_tarefa_id, trim(p_texto),
          nullif(trim(coalesce(p_nome, '')), ''), 'cliente');
end;
$$;

revoke execute on function public.aprovacao_comentar(text,uuid,text,text) from public;
grant  execute on function public.aprovacao_comentar(text,uuid,text,text) to anon, authenticated;


-- 5.3 · Aprovar: move a peça para a coluna "Aprovado"
create or replace function public.aprovacao_aprovar(p_token text, p_tarefa_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente      uuid;
  v_col_aprovado uuid;
  v_ordem        double precision;
begin
  select id into v_cliente
    from public.clientes where token_aprovacao = p_token and ativo;
  if v_cliente is null then raise exception 'token inválido'; end if;

  -- precisa estar em "Em aprovação" deste cliente
  if not exists (
    select 1 from public.tarefas t
    join public.tarefa_colunas tc on tc.id = t.coluna_id
    where t.id = p_tarefa_id and t.cliente_id = v_cliente
      and lower(trim(tc.nome)) = 'em aprovação'
  ) then
    raise exception 'peça não está em aprovação';
  end if;

  select id into v_col_aprovado
    from public.tarefa_colunas
    where cliente_id = v_cliente and lower(trim(nome)) = 'aprovado'
    order by ordem limit 1;
  if v_col_aprovado is null then
    raise exception 'coluna "Aprovado" não existe para este cliente';
  end if;

  select coalesce(max(ordem), 0) + 1024 into v_ordem
    from public.tarefas where coluna_id = v_col_aprovado;

  update public.tarefas
    set coluna_id = v_col_aprovado, ordem = v_ordem, aprovado_em = now()
    where id = p_tarefa_id;
end;
$$;

revoke execute on function public.aprovacao_aprovar(text,uuid) from public;
grant  execute on function public.aprovacao_aprovar(text,uuid) to anon, authenticated;
