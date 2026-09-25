import { FORMAS_PAGAMENTO } from '../../lib/moeda'

export const STATUS_LANCAMENTO = { pendente: 'Pendente', pago: 'Pago', cancelado: 'Cancelado' }

export const CATEGORIAS_VARIAVEIS = {
  ia: 'IA',
  freelancer: 'Freelancer',
  impulsionamento: 'Impulsionamento',
  producao: 'Produção',
  software: 'Software',
  deslocamento: 'Deslocamento',
  outro: 'Outro',
}

const opcoesClientes = (apoio) => Object.fromEntries(apoio.clientes.map((c) => [c.id, c.nome]))
const opcoesEntregas = (apoio) => Object.fromEntries(apoio.entregas.map((e) => [e.id, e.descricao]))

/*
  Cada seção descreve uma tabela do Financeiro:
  campos    → formulário de criação/edição
  colunas   → o que aparece na lista
  dataPago  → campo de data preenchido ao "marcar como pago"
  repetir   → pode copiar lançamentos do mês anterior (filtro dos que se repetem)
*/
export const SECOES = {
  faturamento: {
    tabela: 'fin_faturamento',
    titulo: 'Faturamento',
    novo: 'Nova receita',
    vazio: 'Nenhuma receita lançada neste mês.',
    dataPago: 'data_recebimento',
    rotuloPago: 'Recebido',
    rotuloMarcar: 'Marcar recebido',
    repetir: () => true,
    campos: [
      { chave: 'descricao', rotulo: 'Descrição', tipo: 'texto', obrigatorio: true, largura: 'toda', dica: 'Mensalidade setembro, pacote de reels…' },
      { chave: 'cliente_id', rotulo: 'Cliente', tipo: 'select', opcoes: opcoesClientes },
      { chave: 'valor', rotulo: 'Valor', tipo: 'moeda', obrigatorio: true },
      { chave: 'data_vencimento', rotulo: 'Vencimento', tipo: 'data' },
      { chave: 'data_recebimento', rotulo: 'Recebido em', tipo: 'data' },
      { chave: 'status', rotulo: 'Status', tipo: 'status' },
      { chave: 'forma_pagamento', rotulo: 'Forma de pagamento', tipo: 'select', opcoes: () => FORMAS_PAGAMENTO },
      { chave: 'observacoes', rotulo: 'Observações', tipo: 'area', largura: 'toda' },
    ],
    padrao: { status: 'pendente' },
    colunas: ['descricao', 'cliente_id', 'data_vencimento', 'status', 'valor'],
  },

  'custos-fixos': {
    tabela: 'fin_custos_fixos',
    titulo: 'Custos fixos',
    novo: 'Novo custo fixo',
    vazio: 'Nenhum custo fixo lançado neste mês.',
    dataPago: 'data_pagamento',
    rotuloPago: 'Pago',
    rotuloMarcar: 'Marcar pago',
    repetir: (item) => item.recorrente,
    campos: [
      { chave: 'descricao', rotulo: 'Descrição', tipo: 'texto', obrigatorio: true, largura: 'toda', dica: 'Canva, contador, internet…' },
      { chave: 'categoria', rotulo: 'Categoria', tipo: 'texto', sugestoes: ['Software', 'Contabilidade', 'Internet e telefone', 'Aluguel', 'Equipamentos', 'Impostos', 'Outros'] },
      { chave: 'valor', rotulo: 'Valor', tipo: 'moeda', obrigatorio: true },
      { chave: 'data_vencimento', rotulo: 'Vencimento', tipo: 'data' },
      { chave: 'data_pagamento', rotulo: 'Pago em', tipo: 'data' },
      { chave: 'status', rotulo: 'Status', tipo: 'status' },
      { chave: 'recorrente', rotulo: 'Repete todo mês', tipo: 'marcar' },
      { chave: 'observacoes', rotulo: 'Observações', tipo: 'area', largura: 'toda' },
    ],
    padrao: { status: 'pendente', recorrente: true },
    colunas: ['descricao', 'categoria', 'data_vencimento', 'status', 'valor'],
  },

  'custos-variaveis': {
    tabela: 'fin_custos_variaveis',
    titulo: 'Custos variáveis',
    novo: 'Novo custo variável',
    vazio: 'Nenhum custo variável lançado neste mês.',
    dataPago: 'data',
    rotuloPago: 'Pago',
    rotuloMarcar: 'Marcar pago',
    campos: [
      { chave: 'descricao', rotulo: 'Descrição', tipo: 'texto', obrigatorio: true, largura: 'toda', dica: 'Imagens do carrossel, créditos de vídeo…' },
      { chave: 'categoria', rotulo: 'Categoria', tipo: 'select', opcoes: () => CATEGORIAS_VARIAVEIS, obrigatorio: true },
      { chave: 'ferramenta', rotulo: 'Ferramenta', tipo: 'texto', sugestoes: ['ChatGPT', 'Claude', 'Midjourney', 'Canva', 'CapCut', 'ElevenLabs', 'Runway'] },
      { chave: 'valor', rotulo: 'Valor', tipo: 'moeda', obrigatorio: true },
      { chave: 'data', rotulo: 'Data', tipo: 'data' },
      { chave: 'entrega_id', rotulo: 'Entrega (para a calculadora)', tipo: 'select', opcoes: opcoesEntregas, vazio: 'Custo geral do mês' },
      { chave: 'cliente_id', rotulo: 'Cliente', tipo: 'select', opcoes: opcoesClientes },
      { chave: 'status', rotulo: 'Status', tipo: 'status' },
      { chave: 'observacoes', rotulo: 'Observações', tipo: 'area', largura: 'toda' },
    ],
    padrao: { status: 'pago', categoria: 'ia' },
    colunas: ['descricao', 'categoria', 'entrega_id', 'status', 'valor'],
  },

  colaboradores: {
    tabela: 'fin_pagamentos_colaboradores',
    titulo: 'Pagamento de colaboradores',
    novo: 'Novo pagamento',
    vazio: 'Nenhum pagamento de colaborador lançado neste mês.',
    dataPago: 'data_pagamento',
    rotuloPago: 'Pago',
    rotuloMarcar: 'Marcar pago',
    repetir: (item) => item.tipo === 'fixo',
    campos: [
      { chave: 'colaborador', rotulo: 'Colaborador(a)', tipo: 'texto', obrigatorio: true },
      { chave: 'descricao', rotulo: 'Descrição', tipo: 'texto', dica: 'Edição de vídeos, design…' },
      { chave: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, opcoes: () => ({ fixo: 'Fixo mensal (entra nos custos fixos)', por_entrega: 'Por entrega (custo da entrega)' }) },
      { chave: 'entrega_id', rotulo: 'Entrega', tipo: 'select', opcoes: opcoesEntregas, mostrarSe: (f) => f.tipo === 'por_entrega' },
      { chave: 'valor', rotulo: 'Valor', tipo: 'moeda', obrigatorio: true },
      { chave: 'data_pagamento', rotulo: 'Pago em', tipo: 'data' },
      { chave: 'status', rotulo: 'Status', tipo: 'status' },
      { chave: 'forma_pagamento', rotulo: 'Forma de pagamento', tipo: 'select', opcoes: () => FORMAS_PAGAMENTO },
      { chave: 'observacoes', rotulo: 'Observações', tipo: 'area', largura: 'toda' },
    ],
    padrao: { status: 'pendente', tipo: 'fixo' },
    colunas: ['colaborador', 'descricao', 'tipo', 'status', 'valor'],
  },

  'pro-labore': {
    tabela: 'fin_pro_labore',
    titulo: 'Pró-labore da Bruna',
    novo: 'Lançar pró-labore',
    vazio: 'Pró-labore deste mês ainda não lançado.',
    dataPago: 'data_pagamento',
    rotuloPago: 'Pago',
    rotuloMarcar: 'Marcar pago',
    repetir: () => true,
    campos: [
      { chave: 'valor', rotulo: 'Valor', tipo: 'moeda', obrigatorio: true },
      { chave: 'data_pagamento', rotulo: 'Pago em', tipo: 'data' },
      { chave: 'status', rotulo: 'Status', tipo: 'status' },
      { chave: 'observacoes', rotulo: 'Observações', tipo: 'area', largura: 'toda' },
    ],
    padrao: { status: 'pendente' },
    colunas: ['descricao_fixa', 'data_pagamento', 'status', 'valor'],
  },
}

export const ROTULOS_COLUNA = {
  descricao: 'Descrição',
  descricao_fixa: 'Descrição',
  cliente_id: 'Cliente',
  categoria: 'Categoria',
  colaborador: 'Colaborador(a)',
  tipo: 'Tipo',
  entrega_id: 'Entrega',
  data_vencimento: 'Vencimento',
  data_pagamento: 'Pago em',
  status: 'Status',
  valor: 'Valor',
}
