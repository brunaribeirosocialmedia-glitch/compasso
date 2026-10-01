-- =====================================================================
-- COMPASSO · 08 · Coluna "Ideias" no quadro de Tarefas
-- =====================================================================
-- Depende de: 02_area_do_cliente.sql, 05_ajustes_area_do_cliente.sql
-- Ideias vira a primeira coluna do quadro de todos os clientes (os
-- atuais e os novos). Quem já tiver uma coluna "Ideias" não ganha outra.
-- Obs.: ordem 0 é reservada pelo gatilho posicionar_nova_coluna (manda
-- para o fim), então a nova coluna entra com ordem 1 e as demais andam.
-- =====================================================================

with sem_ideias as (
  select c.id
  from public.clientes c
  where not exists (
    select 1 from public.tarefa_colunas tc
    where tc.cliente_id = c.id and lower(trim(tc.nome)) = 'ideias'
  )
)
update public.tarefa_colunas tc
   set ordem = tc.ordem + 1
  from sem_ideias s
 where tc.cliente_id = s.id;

insert into public.tarefa_colunas (cliente_id, nome, ordem, marca_concluida)
select c.id, 'Ideias', 1, false
from public.clientes c
where not exists (
  select 1 from public.tarefa_colunas tc
  where tc.cliente_id = c.id and lower(trim(tc.nome)) = 'ideias'
);

create or replace function public.criar_colunas_padrao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tarefa_colunas (cliente_id, nome, ordem, marca_concluida) values
    (new.id, 'Ideias',        1, false),
    (new.id, 'A fazer',       2, false),
    (new.id, 'Em andamento',  3, false),
    (new.id, 'Em aprovação',  4, false),
    (new.id, 'Concluído',     5, true);
  return new;
end;
$$;

revoke execute on function public.criar_colunas_padrao() from public, anon, authenticated;
