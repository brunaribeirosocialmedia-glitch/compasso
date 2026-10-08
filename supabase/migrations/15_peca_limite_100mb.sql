-- =====================================================================
-- COMPASSO · 15 · Peça: limite de upload 100 MB  (NÃO APLICAR AINDA)
-- =====================================================================
-- Esta migração fica GUARDADA, pronta para o dia em que o projeto
-- Supabase virar plano pago (Pro). No plano gratuito o limite GLOBAL
-- do projeto é travado em 50 MB, então subir só o bucket não adianta
-- (vale sempre o menor entre o global e o do bucket).
--
-- Decisão (08/10/2026): ficar em 50 MB enquanto o plano for gratuito —
-- a interface tem que dizer a verdade do que consegue subir. Cobre
-- praticamente toda imagem e a maioria dos Reels curtos.
--
-- RECEITA para subir para 100 MB quando for Pro:
--   1. Supabase → Storage → Settings → "Upload file size limit": 100 MB.
--   2. Aplicar esta migração (db push).
--   3. No código, em src/components/cliente/MidiasPeca.jsx, trocar
--      "50 * 1024 * 1024" por "100 * 1024 * 1024" e os textos "50 MB"
--      por "100 MB". Publicar.
-- =====================================================================

update storage.buckets
  set file_size_limit = 104857600  -- 100 MB
  where id = 'pecas';
