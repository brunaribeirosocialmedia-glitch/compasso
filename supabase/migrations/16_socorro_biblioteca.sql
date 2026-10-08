-- =====================================================================
-- COMPASSO · 16 · Socorro (Biblioteca viva da equipe)
-- =====================================================================
-- Depende de: 01_base_usuarios_permissoes (eh_membro_ativo, eh_admin)
--
-- Uma biblioteca de estruturas de conteúdo no padrão B Mídia, para a
-- equipe consultar enquanto cria: estruturas de bio por nicho, fórmulas
-- de gancho para Reel e carrossel, CTAs, estrutura de legenda.
--
-- Acesso: toda a equipe ativa LÊ. Só admin cria, edita e remove.
-- É "viva": a admin amplia e refina pela própria tela, sem mexer no código.
-- =====================================================================

create table if not exists public.socorro_categorias (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  ordem     integer not null default 0,
  criado_em timestamptz not null default now()
);

create table if not exists public.socorro_itens (
  id            uuid primary key default gen_random_uuid(),
  categoria_id  uuid not null references public.socorro_categorias (id) on delete cascade,
  titulo        text not null,
  conteudo      text not null,
  nicho         text,
  ordem         double precision not null default 0,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists socorro_itens_categoria_idx on public.socorro_itens (categoria_id, ordem);

create trigger socorro_itens_atualizado_em
  before update on public.socorro_itens
  for each row execute function public.definir_atualizado_em();

-- ---------------------------------------------------------------------
-- Acesso
-- ---------------------------------------------------------------------
alter table public.socorro_categorias enable row level security;
alter table public.socorro_itens      enable row level security;

create policy "Equipe lê categorias"
  on public.socorro_categorias for select to authenticated
  using ((select public.eh_membro_ativo()));
create policy "Admin edita categorias"
  on public.socorro_categorias for all to authenticated
  using ((select public.eh_admin()))
  with check ((select public.eh_admin()));

create policy "Equipe lê itens"
  on public.socorro_itens for select to authenticated
  using ((select public.eh_membro_ativo()));
create policy "Admin edita itens"
  on public.socorro_itens for all to authenticated
  using ((select public.eh_admin()))
  with check ((select public.eh_admin()));

-- Tempo real (para a biblioteca atualizar sozinha quando a admin edita)
alter publication supabase_realtime add table public.socorro_categorias, public.socorro_itens;

-- ---------------------------------------------------------------------
-- Conteúdo inicial (padrão B Mídia) — a admin pode editar tudo depois
-- ---------------------------------------------------------------------
insert into public.socorro_categorias (nome, ordem) values
  ('Estruturas de bio',    1),
  ('Ganchos de Reel',      2),
  ('Ganchos de carrossel', 3),
  ('CTAs',                 4),
  ('Estrutura de legenda', 5)
on conflict do nothing;

-- Estruturas de bio
insert into public.socorro_itens (categoria_id, titulo, conteudo, nicho, ordem) values
((select id from public.socorro_categorias where nome='Estruturas de bio'), 'Como pensar a bio (base)', $b$A bio responde três coisas em segundos: o que é, pra quem é e por que vale.

Linha 1: o que você faz, com clareza. Sem adjetivo vazio.
Linha 2: pra quem é, ou o resultado que entrega.
Linha 3: um diferencial ou uma prova. O que te separa do concorrente.
Linha 4: uma chamada para ação. Um caminho só.

Evite: lista de serviços solta, frase motivacional genérica, emoji no lugar de palavra.$b$, null, 1),
((select id from public.socorro_categorias where nome='Estruturas de bio'), 'Bio · Hotelaria e hospedagem', $b$Linha 1: a experiência, não só o quarto. Ex: Refúgio a 20 minutos da cidade.
Linha 2: pra quem é. Ex: Para quem quer descansar sem abrir mão do conforto.
Linha 3: o detalhe que diferencia. Vista, café, silêncio, atendimento.
Linha 4: Reserve pelo link.

Sensação: calma, cuidado, escapismo.$b$, 'Hotelaria', 2),
((select id from public.socorro_categorias where nome='Estruturas de bio'), 'Bio · Moda feminina', $b$Linha 1: o estilo e a mulher que veste. Ex: Peças para quem se arruma pra si.
Linha 2: o que a marca entrega além da roupa. Confiança, identidade, caimento.
Linha 3: prova ou diferencial. Curadoria, tecido, tamanhos reais.
Linha 4: Novidades e looks no link.

Sensação: desejo, pertencimento, bom gosto.$b$, 'Moda feminina', 3),
((select id from public.socorro_categorias where nome='Estruturas de bio'), 'Bio · Gastronomia', $b$Linha 1: o que se come e a sensação. Ex: Comida de verdade, feita no dia.
Linha 2: o contexto. Bairro, ocasião, pra quem.
Linha 3: o diferencial. Ingrediente, receita, história.
Linha 4: Peça pelo link ou reserve sua mesa.

Sensação: afeto, fome boa, cuidado.$b$, 'Gastronomia', 4),
((select id from public.socorro_categorias where nome='Estruturas de bio'), 'Bio · Serviços e negócios locais', $b$Linha 1: o problema que resolve, em uma frase. Ex: Seu carro limpo sem sair de casa.
Linha 2: pra quem e onde. Bairro, cidade, público.
Linha 3: a prova. Tempo de casa, garantia, número de clientes.
Linha 4: Chame no link ou na DM.

Sensação: confiança, facilidade, proximidade.$b$, 'Serviços', 5);

-- Ganchos de Reel
insert into public.socorro_itens (categoria_id, titulo, conteudo, nicho, ordem) values
((select id from public.socorro_categorias where nome='Ganchos de Reel'), 'O que faz um gancho segurar', $b$Os três primeiros segundos decidem tudo. O gancho cria uma pergunta na cabeça de quem assiste, uma tensão que só o vídeo resolve.

Fale pra uma pessoa, não pra plateia. Direto, sem introdução longa.
O cenário entra junto: a primeira imagem combina com a primeira frase.$b$, null, 1),
((select id from public.socorro_categorias where nome='Ganchos de Reel'), 'Fórmulas de gancho', $b$Erro comum: comece pelo erro que o público comete. Ex: O jeito que você posta hoje afasta cliente.
Verdade incômoda: uma afirmação que contraria o senso comum do nicho.
Promessa específica: o que a pessoa leva até o fim. Ex: Em 20 segundos você entende por que seu story não vende.
Pergunta com tensão: algo que a pessoa quer responder. Ex: Sabe por que sua marca é lembrada só na hora da necessidade?
Antes e depois: mostre o contraste logo na abertura.
Bastidor: o que ninguém vê. Ex: O que acontece antes daquele post ir ao ar.$b$, null, 2),
((select id from public.socorro_categorias where nome='Ganchos de Reel'), 'Gancho por objetivo', $b$Posicionar: comece por uma verdade do nicho que mostra autoridade.
Vender: comece pelo desejo ou pela objeção que trava a compra.
Educar: comece pelo erro ou pela dúvida mais comum.
Conectar: comece por um sentimento que a pessoa reconhece em si.$b$, null, 3);

-- Ganchos de carrossel
insert into public.socorro_itens (categoria_id, titulo, conteudo, nicho, ordem) values
((select id from public.socorro_categorias where nome='Ganchos de carrossel'), 'A primeira tela', $b$A capa tem um trabalho só: fazer deslizar. Ela não resume o conteúdo, ela abre um laço.

Texto curto, legível no feed pequeno. Uma ideia, não três.
Promete o que as próximas telas entregam.
O visual e a frase dizem a mesma coisa.$b$, null, 1),
((select id from public.socorro_categorias where nome='Ganchos de carrossel'), 'Fórmulas de capa', $b$Número e promessa: 3 formas de [resultado] sem [dor].
Erro: o que você faz no [tema] e está te custando [consequência].
Contraste: o que parece certo no [nicho] e trava o seu resultado.
Lista fechada: 5 coisas que toda [público] devia saber sobre [tema].
Pergunta: por que [situação comum] acontece com você.
Para quem: se você é [público], essas telas são pra você.$b$, null, 2),
((select id from public.socorro_categorias where nome='Ganchos de carrossel'), 'Ritmo entre as telas', $b$Capa abre o laço. Telas do meio entregam uma ideia cada. A última fecha e convida.

Nunca oito telas iguais. Varie: texto, respiro, imagem, dado, exemplo.
A última tela tem o CTA. Um só.$b$, null, 3);

-- CTAs
insert into public.socorro_itens (categoria_id, titulo, conteudo, nicho, ordem) values
((select id from public.socorro_categorias where nome='CTAs'), 'Como a B Mídia pensa o CTA', $b$O CTA convida, não empurra. Ação primeiro, condição depois.

Um caminho só por peça. Dividir a atenção é perder a ação.
Fala com quem já está quase decidindo, não com todo mundo.$b$, null, 1),
((select id from public.socorro_categorias where nome='CTAs'), 'CTAs no estilo B Mídia', $b$Conversa com a gente se você quer sua marca desejada além de encontrada.
Chama na DM se isso faz sentido pra você.
Salva esse post pra quando for criar o próximo.
Manda pra aquela pessoa que precisa ler isso.
Comenta a palavra combinada que eu te mando o caminho.
Clica no link enquanto a condição está de pé.$b$, null, 2),
((select id from public.socorro_categorias where nome='CTAs'), 'CTA por objetivo', $b$Visita ao perfil: termine abrindo curiosidade sobre o que mais tem ali.
DM: dê um motivo concreto pra pessoa chamar agora.
Salvamento: mostre que o conteúdo serve pra depois.
Compartilhamento: nomeie quem precisa ver aquilo.$b$, null, 3);

-- Estrutura de legenda
insert into public.socorro_itens (categoria_id, titulo, conteudo, nicho, ordem) values
((select id from public.socorro_categorias where nome='Estrutura de legenda'), 'A estrutura de uma legenda', $b$Título de abertura: impacto, curiosidade ou pergunta com tensão.

Desenvolvimento: storytelling ou progressão de ideia. Blocos de até três linhas, com respiro.

Contraste elegante: dois conceitos em oposição, sem fórmula pronta.

Fechamento: curto e forte. Impacto, não explicação.

CTA: um convite natural, quando fizer sentido.$b$, null, 1),
((select id from public.socorro_categorias where nome='Estrutura de legenda'), 'Regras de ouro da copy', $b$Cada frase existe por uma razão. Corte o que não carrega peso.
Varie o tamanho das frases pra criar ritmo. Uma longa, depois uma curta.
Respeite a inteligência de quem lê. Não explique o óbvio.
Fuja do clichê de marketing e da frase motivacional vazia.
Parágrafo curto. O texto precisa respirar na tela.$b$, null, 2);
