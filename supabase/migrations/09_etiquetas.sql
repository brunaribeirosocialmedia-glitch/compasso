-- =====================================================================
-- COMPASSO · 09 · Etiquetas salvas, com cor
-- =====================================================================
-- Depende de: 01, 02_area_do_cliente.sql
-- As etiquetas ficam numa lista única da agência (servem para todos os
-- clientes). A tarefa continua guardando os nomes em tarefas.etiquetas;
-- renomear ou excluir uma etiqueta atualiza todas as tarefas sozinho.
-- Acesso: qualquer pessoa ativa da equipe.
-- =====================================================================

create table public.etiquetas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(trim(nome)) > 0),
  cor        text not null default '#8a8fa8',
  criado_por uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em  timestamptz not null default now()
);

create unique index etiquetas_nome_idx on public.etiquetas (lower(trim(nome)));

alter table public.etiquetas enable row level security;

create policy "Equipe ativa usa as etiquetas"
  on public.etiquetas for all to authenticated
  using ((select public.eh_membro_ativo()))
  with check ((select public.eh_membro_ativo()));

-- Etiquetas que já estavam nas tarefas viram etiquetas salvas
insert into public.etiquetas (nome)
select distinct on (lower(trim(e))) trim(e)
from public.tarefas t, unnest(t.etiquetas) e
where length(trim(e)) > 0
on conflict do nothing;

-- Renomear/excluir uma etiqueta reflete em todas as tarefas
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
    return old;
  end if;
  if new.nome is distinct from old.nome then
    update public.tarefas set etiquetas = array_replace(etiquetas, old.nome, new.nome)
     where old.nome = any (etiquetas);
  end if;
  return new;
end;
$$;

revoke execute on function public.propagar_etiqueta() from public, anon, authenticated;

create trigger etiquetas_propagar
  after update or delete on public.etiquetas
  for each row execute function public.propagar_etiqueta();

