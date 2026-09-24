// Datas "puras" (prazo, dia) circulam como texto AAAA-MM-DD, sempre no horário local.

export function paraISO(data) {
  const a = data.getFullYear()
  const m = String(data.getMonth() + 1).padStart(2, '0')
  const d = String(data.getDate()).padStart(2, '0')
  return `${a}-${m}-${d}`
}

export function deISO(texto) {
  const [a, m, d] = texto.split('-').map(Number)
  return new Date(a, m - 1, d)
}

export const hojeISO = () => paraISO(new Date())

export function formatarData(texto, opcoes = { day: '2-digit', month: 'short' }) {
  if (!texto) return ''
  return deISO(texto).toLocaleDateString('pt-BR', opcoes).replace('.', '')
}

export function formatarHora(dataHora) {
  return new Date(dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// Situação do prazo em relação a hoje
export function situacaoPrazo(prazo, concluida) {
  if (!prazo || concluida) return ''
  const hoje = hojeISO()
  if (prazo < hoje) return 'atrasado'
  if (prazo === hoje) return 'hoje'
  return ''
}

// Valor para <input type="datetime-local"> a partir de um timestamptz
export function paraCampoDataHora(dataHora) {
  if (!dataHora) return ''
  const d = new Date(dataHora)
  return `${paraISO(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Semanas (domingo a sábado) que cobrem o mês inteiro
export function semanasDoMes(ano, mes) {
  const inicio = new Date(ano, mes, 1)
  inicio.setDate(inicio.getDate() - inicio.getDay())
  const semanas = []
  const cursor = new Date(inicio)
  do {
    const semana = []
    for (let i = 0; i < 7; i++) {
      semana.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    semanas.push(semana)
  } while (cursor.getMonth() === mes)
  return semanas
}
