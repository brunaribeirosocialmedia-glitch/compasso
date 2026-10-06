-- =====================================================================
-- COMPASSO · 13 · Documentos da empresa (área Gestão)
-- =====================================================================
-- Depende de: 01
--
-- • CNPJ, contrato social, certidões, alvarás… com número, emissão,
--   validade (opcional) e o arquivo.
-- • A situação (válido / vence em X dias / vencido) é calculada no app
--   a partir da validade e de aviso_dias.
-- • O arquivo fica no bucket privado "documentos", no caminho
--   <documento_id>/<nome do arquivo>.
-- Acesso: o mesmo do Financeiro (a área Gestão usa a área 'financeiro').
-- =====================================================================

create table public.documentos (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null check (length(trim(nome)) > 0),
  categoria        text not null default 'empresa'
                     check (categoria in ('empresa', 'certidao', 'licenca', 'bancario', 'outro')),
  numero           text,
  emissao          date,
  validade         date,
  aviso_dias       smallint not null default 30 check (aviso_dias between 0 and 365),
  arquivo_caminho  text,
  arquivo_nome     text,
  observacoes      text,
  criado_por       uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  check (validade is null or emissao is null or validade >= emissao)
);

create trigger documentos_atualizado_em
  before update on public.documentos
  for each row execute function public.definir_atualizado_em();

alter table public.documentos enable row level security;

create policy "Gestão liberada" on public.documentos for all to authenticated
  using ((select public.tem_acesso_area('financeiro'))) with check ((select public.tem_acesso_area('financeiro')));

-- ---------------------------------------------------------------------
-- Arquivos (bucket privado, até 20 MB por arquivo)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 20971520)
on conflict (id) do nothing;

create policy "Documentos: ler com Gestão liberada" on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and (select public.tem_acesso_area('financeiro')));
create policy "Documentos: enviar com Gestão liberada" on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and (select public.tem_acesso_area('financeiro')));
create policy "Documentos: trocar com Gestão liberada" on storage.objects for update to authenticated
  using (bucket_id = 'documentos' and (select public.tem_acesso_area('financeiro')));
create policy "Documentos: apagar com Gestão liberada" on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and (select public.tem_acesso_area('financeiro')));
