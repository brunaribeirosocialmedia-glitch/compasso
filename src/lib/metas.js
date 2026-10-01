import { supabase } from './supabase'
import { paraISO } from './datas'

// competência = 1º dia do mês, no formato AAAA-MM-01
export function competenciaDe(data = new Date()) {
  return paraISO(new Date(data.getFullYear(), data.getMonth(), 1))
}

export function proximoMes(competencia) {
  const [a, m] = competencia.split('-').map(Number)
  return paraISO(new Date(a, m, 1))
}

// Meta que vale no mês: a mais recente cadastrada até ele
export async function buscarMeta(area, competencia) {
  const { data } = await supabase.from('metas').select('*')
    .eq('area', area).lte('competencia', competencia)
    .order('competencia', { ascending: false }).limit(1).maybeSingle()
  return data
}

// Grava a meta a partir deste mês (os seguintes herdam até alguém mudar)
export function salvarMeta(area, competencia, valor) {
  return supabase.from('metas').upsert({ area, competencia, valor })
}

// Soma do valor fechado na Prospecção dentro do mês
export async function fechadoNoMes(competencia) {
  const { data } = await supabase.from('prospects').select('valor_fechado')
    .gte('fechado_em', competencia).lt('fechado_em', proximoMes(competencia))
  return (data || []).reduce((soma, p) => soma + Number(p.valor_fechado || 0), 0)
}

// Quanto do mês já passou (0 a 1). Meses passados contam como completos.
export function ritmoEsperado(competencia, hoje = new Date()) {
  const atual = competenciaDe(hoje)
  if (competencia < atual) return 1
  if (competencia > atual) return 0
  const dias = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()
  return hoje.getDate() / dias
}

// Leitura sem números: longe, no ritmo, perto ou batida
export function situacaoMeta(atual, meta, esperado) {
  const fracao = meta > 0 ? atual / meta : 0
  if (fracao >= 1) return { chave: 'batida', nome: 'Meta batida!', fracao }
  if (fracao >= 0.8) return { chave: 'perto', nome: 'Perto da meta', fracao }
  if (fracao >= esperado) return { chave: 'ritmo', nome: 'No ritmo', fracao }
  return { chave: 'longe', nome: 'Longe da meta', fracao }
}
