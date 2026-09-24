-- =====================================================================
-- COMPASSO · 01 · Base: usuários, permissões e códigos de acesso
-- =====================================================================
-- Níveis de acesso:
--   1. Acesso comum   → qualquer membro ativo logado (vê só os clientes
--                       aos quais está associado — ver migration 02)
--   2. Prospecção     → permissão concedida pela admin (pode_prospeccao)
--                       + desbloqueio com o código da Prospecção
--   3. Financeiro     → permissão concedida pela admin (pode_financeiro)
--                       + desbloqueio com o código do Financeiro
--
-- Os códigos nunca ficam legíveis: são guardados com hash (bcrypt) numa
-- tabela sem nenhuma policy de leitura. A verificação acontece só dentro
-- da função desbloquear_area(), que cria um desbloqueio temporário.
-- As tabelas protegidas checam esse desbloqueio via RLS no banco — não
-- adianta "burlar" a tela, o banco recusa.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.papel_usuario as enum ('admin', 'membro');
create type public.area_protegida as enum ('prospeccao', 'financeiro');

-- ---------------------------------------------------------------------
-- Função utilitária: mantém atualizado_em em dia
-- ---------------------------------------------------------------------
create or replace function public.definir_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Perfis (1 por usuário do Supabase Auth)
-- ---------------------------------------------------------------------
create table public.perfis (
  id               uuid primary key references auth.users (id) on delete cascade,
  nome             text not null default '',
  email            text not null,
  avatar_url       text,
  papel            public.papel_usuario not null default 'membro',
  pode_prospeccao  boolean not null default false,
  pode_financeiro  boolean not null default false,
  ativo            boolean not null default true,
  tema             text not null default 'escuro' check (tema in ('claro', 'escuro')),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

comment on table public.perfis is 'Equipe da B Mídia. Permissões (papel, pode_*) só podem ser alteradas por admin.';

create trigger perfis_atualizado_em
  before update on public.perfis
  for each row execute function public.definir_atualizado_em();

-- ---------------------------------------------------------------------
-- Helpers de permissão (SECURITY DEFINER para evitar recursão de RLS)
-- ---------------------------------------------------------------------
create or replace function public.eh_membro_ativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and ativo
  );
$$;

create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and ativo and papel = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- Criação automática do perfil ao cadastrar/convidar um usuário.
-- O PRIMEIRO usuário criado vira admin com acesso a tudo (a Bruna).
-- ---------------------------------------------------------------------
create or replace function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_primeiro boolean;
begin
  select not exists (select 1 from public.perfis) into v_primeiro;

  insert into public.perfis (id, email, nome, papel, pode_prospeccao, pode_financeiro)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(coalesce(new.email, ''), '@', 1)),
    case when v_primeiro then 'admin'::public.papel_usuario else 'membro'::public.papel_usuario end,
    v_primeiro,
    v_primeiro
  );
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

-- ---------------------------------------------------------------------
-- Impede que um membro comum altere as próprias permissões.
-- (Chamadas sem usuário — SQL Editor / service role — passam.)
-- ---------------------------------------------------------------------
create or replace function public.proteger_campos_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.eh_admin() then
    return new;
  end if;

  if new.papel           is distinct from old.papel
  or new.pode_prospeccao is distinct from old.pode_prospeccao
  or new.pode_financeiro is distinct from old.pode_financeiro
  or new.ativo           is distinct from old.ativo
  or new.email           is distinct from old.email then
    raise exception 'Somente administradores podem alterar permissões.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger perfis_proteger_campos
  before update on public.perfis
  for each row execute function public.proteger_campos_perfil();

-- RLS de perfis
alter table public.perfis enable row level security;

create policy "Equipe ativa vê os perfis"
  on public.perfis for select to authenticated
  using ((select public.eh_membro_ativo()) or id = (select auth.uid()));

create policy "Usuário edita o próprio perfil; admin edita todos"
  on public.perfis for update to authenticated
  using (id = (select auth.uid()) or (select public.eh_admin()))
  with check (id = (select auth.uid()) or (select public.eh_admin()));

create policy "Admin remove perfis"
  on public.perfis for delete to authenticated
  using ((select public.eh_admin()) and id <> (select auth.uid()));

-- ---------------------------------------------------------------------
-- Códigos de acesso (Prospecção / Financeiro)
-- Sem policies = ninguém lê pela API. Só as funções abaixo tocam aqui.
-- ---------------------------------------------------------------------
create table public.codigos_acesso (
  area            public.area_protegida primary key,
  codigo_hash     text not null,
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references public.perfis (id) on delete set null
);

alter table public.codigos_acesso enable row level security;
revoke all on public.codigos_acesso from anon, authenticated;

-- Desbloqueios temporários (quem digitou o código certo, até quando)
create table public.desbloqueios (
  usuario_id  uuid not null references public.perfis (id) on delete cascade,
  area        public.area_protegida not null,
  expira_em   timestamptz not null,
  criado_em   timestamptz not null default now(),
  primary key (usuario_id, area)
);

alter table public.desbloqueios enable row level security;
revoke insert, update on public.desbloqueios from anon, authenticated;

create policy "Usuário vê os próprios desbloqueios"
  on public.desbloqueios for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy "Usuário encerra os próprios desbloqueios"
  on public.desbloqueios for delete to authenticated
  using (usuario_id = (select auth.uid()));

-- Registro de tentativas (proteção contra força bruta + auditoria)
create table public.tentativas_codigo (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null references public.perfis (id) on delete cascade,
  area        public.area_protegida not null,
  sucesso     boolean not null,
  criado_em   timestamptz not null default now()
);

create index tentativas_codigo_usuario_idx
  on public.tentativas_codigo (usuario_id, area, criado_em desc);

alter table public.tentativas_codigo enable row level security;
revoke insert, update, delete on public.tentativas_codigo from anon, authenticated;

create policy "Admin audita tentativas"
  on public.tentativas_codigo for select to authenticated
  using ((select public.eh_admin()));

-- ---------------------------------------------------------------------
-- tem_acesso_area(): usada pelas policies de Prospecção e Financeiro.
-- Exige: membro ativo + permissão concedida + desbloqueio válido.
-- ---------------------------------------------------------------------
create or replace function public.tem_acesso_area(p_area public.area_protegida)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfis p
    join public.desbloqueios d
      on d.usuario_id = p.id and d.area = p_area and d.expira_em > now()
    where p.id = auth.uid()
      and p.ativo
      and case p_area
            when 'prospeccao' then p.pode_prospeccao
            when 'financeiro' then p.pode_financeiro
          end
  );
$$;

-- ---------------------------------------------------------------------
-- desbloquear_area(): o usuário digita o código na tela.
-- Retorna {ok, expira_em} ou {ok:false, erro}.
-- Regras: 5 erros em 15 min bloqueiam novas tentativas por 15 min.
--         Desbloqueio vale 4 horas (ou até o usuário sair).
-- ---------------------------------------------------------------------
create or replace function public.desbloquear_area(
  p_area   public.area_protegida,
  p_codigo text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_permitido boolean;
  v_hash      text;
  v_falhas    int;
  v_expira    timestamptz := now() + interval '4 hours';
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'erro', 'Faça login para continuar.');
  end if;

  select p.ativo and case p_area
                       when 'prospeccao' then p.pode_prospeccao
                       when 'financeiro' then p.pode_financeiro
                     end
    into v_permitido
  from public.perfis p
  where p.id = v_uid;

  if not coalesce(v_permitido, false) then
    return jsonb_build_object('ok', false, 'erro', 'Você não tem permissão para esta área.');
  end if;

  select count(*) into v_falhas
  from public.tentativas_codigo t
  where t.usuario_id = v_uid
    and t.area = p_area
    and not t.sucesso
    and t.criado_em > now() - interval '15 minutes';

  if v_falhas >= 5 then
    return jsonb_build_object('ok', false,
      'erro', 'Muitas tentativas incorretas. Aguarde 15 minutos e tente de novo.');
  end if;

  select c.codigo_hash into v_hash
  from public.codigos_acesso c
  where c.area = p_area;

  if v_hash is null then
    return jsonb_build_object('ok', false,
      'erro', 'O código desta área ainda não foi definido pela administração.');
  end if;

  if extensions.crypt(coalesce(p_codigo, ''), v_hash) <> v_hash then
    insert into public.tentativas_codigo (usuario_id, area, sucesso)
    values (v_uid, p_area, false);
    return jsonb_build_object('ok', false, 'erro', 'Código incorreto.');
  end if;

  insert into public.tentativas_codigo (usuario_id, area, sucesso)
  values (v_uid, p_area, true);

  insert into public.desbloqueios (usuario_id, area, expira_em)
  values (v_uid, p_area, v_expira)
  on conflict (usuario_id, area)
  do update set expira_em = excluded.expira_em, criado_em = now();

  return jsonb_build_object('ok', true, 'expira_em', v_expira);
end;
$$;

-- Encerra o desbloqueio (botão "sair da área" / logout)
create or replace function public.bloquear_area(p_area public.area_protegida default null)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.desbloqueios
  where usuario_id = auth.uid()
    and (p_area is null or area = p_area);
$$;

-- Admin define/troca o código de uma área.
-- Trocar o código derruba todos os desbloqueios ativos daquela área.
-- Pode ser chamada pelo app (admin logada) ou pelo SQL Editor do Supabase.
create or replace function public.definir_codigo_area(
  p_area   public.area_protegida,
  p_codigo text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.eh_admin() then
    raise exception 'Somente administradores podem definir códigos.' using errcode = '42501';
  end if;

  if p_codigo is null or length(trim(p_codigo)) < 4 then
    raise exception 'O código precisa ter pelo menos 4 caracteres.';
  end if;

  insert into public.codigos_acesso (area, codigo_hash, atualizado_em, atualizado_por)
  values (p_area, extensions.crypt(p_codigo, extensions.gen_salt('bf', 10)), now(), auth.uid())
  on conflict (area) do update
    set codigo_hash    = excluded.codigo_hash,
        atualizado_em  = now(),
        atualizado_por = excluded.atualizado_por;

  delete from public.desbloqueios where area = p_area;
end;
$$;

-- Resumo para a interface: o que mostrar no menu
create or replace function public.minhas_permissoes()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'admin',               p.papel = 'admin',
    'pode_prospeccao',     p.pode_prospeccao,
    'pode_financeiro',     p.pode_financeiro,
    'prospeccao_liberada', public.tem_acesso_area('prospeccao'),
    'financeiro_liberado', public.tem_acesso_area('financeiro')
  )
  from public.perfis p
  where p.id = auth.uid() and p.ativo;
$$;

-- ---------------------------------------------------------------------
-- Execução de funções: nada para anônimos
-- ---------------------------------------------------------------------
revoke execute on function public.eh_membro_ativo()                                   from public, anon;
revoke execute on function public.eh_admin()                                          from public, anon;
revoke execute on function public.tem_acesso_area(public.area_protegida)             from public, anon;
revoke execute on function public.desbloquear_area(public.area_protegida, text)      from public, anon;
revoke execute on function public.bloquear_area(public.area_protegida)               from public, anon;
revoke execute on function public.definir_codigo_area(public.area_protegida, text)   from public, anon;
revoke execute on function public.minhas_permissoes()                                from public, anon;
revoke execute on function public.criar_perfil_novo_usuario()                        from public, anon, authenticated;

grant execute on function public.eh_membro_ativo()                                   to authenticated;
grant execute on function public.eh_admin()                                          to authenticated;
grant execute on function public.tem_acesso_area(public.area_protegida)             to authenticated;
grant execute on function public.desbloquear_area(public.area_protegida, text)      to authenticated;
grant execute on function public.bloquear_area(public.area_protegida)               to authenticated;
grant execute on function public.definir_codigo_area(public.area_protegida, text)   to authenticated;
grant execute on function public.minhas_permissoes()                                to authenticated;
