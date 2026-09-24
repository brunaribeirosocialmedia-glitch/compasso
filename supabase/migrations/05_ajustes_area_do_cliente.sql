-- =====================================================================
-- COMPASSO · 05 · Ajustes da Área do Cliente
-- =====================================================================
-- 1. Calendário: o prazo das tarefas é uma data (sem hora). Convertê-lo
--    para timestamptz no fuso do servidor (UTC) fazia o prazo aparecer
--    no dia anterior no Brasil. A view passa a expor a coluna "dia",
--    sempre no horário de Brasília.
-- 2. Nova coluna vai para o fim do board automaticamente.
-- =====================================================================

drop view if exists public.calendario_itens;

create view public.calendario_itens
with (security_invoker = true) as
  select
    'evento'::text                                            as origem,
    e.id,
    e.cliente_id,
    e.titulo,
    e.tipo::text                                              as tipo,
    (e.inicio at time zone 'America/Sao_Paulo')::date         as dia,
    e.inicio,
    e.fim,
    e.dia_inteiro,
    null::uuid                                                as responsavel_id,
    false                                                     as concluida
  from public.eventos e
union all
  select
    'tarefa'::text,
    t.id,
    t.cliente_id,
    t.titulo,
    'prazo',
    t.prazo,
    null,
    null,
    true,
    t.responsavel_id,
    t.concluida_em is not null
  from public.tarefas t
  where t.prazo is not null;

create or replace function public.posicionar_nova_coluna()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ordem = 0 then
    select coalesce(max(c.ordem), 0) + 1 into new.ordem
    from public.tarefa_colunas c
    where c.cliente_id = new.cliente_id;
  end if;
  return new;
end;
$$;

create trigger tarefa_colunas_posicao
  before insert on public.tarefa_colunas
  for each row execute function public.posicionar_nova_coluna();
