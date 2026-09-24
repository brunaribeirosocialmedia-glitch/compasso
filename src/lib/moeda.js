const formato = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export const formatarMoeda = (valor) => (valor == null || valor === '' ? '—' : formato.format(Number(valor)))

// Aceita "1.500,50", "1500,5", "1500.50" ou "R$ 1.500" → número (ou null se vazio)
export function lerMoeda(texto) {
  if (texto == null) return null
  let t = String(texto).replace(/[^\d,.-]/g, '')
  if (!t) return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  // sem vírgula: "2.000" e "1.500.000" são milhares; "1500.50" é decimal
  else if ((t.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(t)) t = t.replace(/\./g, '')
  const n = Number(t)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN
}

// Valor numérico → texto para o campo de edição ("1500,5" → "1.500,50")
export const paraCampoMoeda = (valor) =>
  valor == null ? '' : Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const FORMAS_PAGAMENTO = {
  pix: 'Pix',
  boleto: 'Boleto',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
  transferencia: 'Transferência',
  dinheiro: 'Dinheiro',
  outro: 'Outro',
}
