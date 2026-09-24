// Cores de identificação dos clientes e das notas (funcionam no claro e no escuro)
export const CORES_CLIENTE = [
  '#7c6cf2', '#4f8cff', '#2bb3a3', '#5fb85f', '#e0a800',
  '#f07b3f', '#e5566d', '#c060d0', '#8a8fa8', '#b08a5a',
]

export const CORES_NOTA = [
  { nome: 'Padrão', valor: null },
  { nome: 'Amarelo', valor: '#e0a800' },
  { nome: 'Verde', valor: '#5fb85f' },
  { nome: 'Azul', valor: '#4f8cff' },
  { nome: 'Rosa', valor: '#e5566d' },
  { nome: 'Lilás', valor: '#7c6cf2' },
]

export const PRIORIDADES = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
}

export const TIPOS_EVENTO = {
  reuniao: 'Reunião',
  gravacao: 'Gravação',
  entrega: 'Entrega',
  publicacao: 'Publicação',
  outro: 'Outro',
}
