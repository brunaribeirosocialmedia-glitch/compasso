import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

// Chama aoMudar() sempre que alguém altera uma das tabelas deste cliente.
export function useTempoReal(tabelas, clienteId, aoMudar) {
  const callback = useRef(aoMudar)
  callback.current = aoMudar

  const chave = tabelas.join(',')
  useEffect(() => {
    if (!clienteId) return
    let timer
    const disparar = () => {
      clearTimeout(timer)
      timer = setTimeout(() => callback.current(), 250) // agrupa rajadas de mudanças
    }
    const canal = supabase.channel(`cliente-${clienteId}-${chave}`)
    chave.split(',').forEach((tabela) => {
      const filtro = { schema: 'public', table: tabela, filter: `cliente_id=eq.${clienteId}` }
      canal.on('postgres_changes', { ...filtro, event: 'INSERT' }, disparar)
      canal.on('postgres_changes', { ...filtro, event: 'UPDATE' }, disparar)
      // o Supabase não filtra exclusões por coluna: qualquer exclusão nessa tabela recarrega
      canal.on('postgres_changes', { schema: 'public', table: tabela, event: 'DELETE' }, disparar)
    })
    canal.subscribe()
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(canal)
    }
  }, [chave, clienteId])
}
