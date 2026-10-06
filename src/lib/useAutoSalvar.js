import { useEffect, useRef, useState } from 'react'

/*
  Salvamento automático de um formulário (mesmo comportamento da janela da tarefa).
  montar(form) → { campos } prontos para gravar, ou { erro } quando algo está inválido
  gravar(campos) → promessa que devolve true quando gravou
  Devolve o estado ('salvo' | 'pendente' | 'salvando' | 'erro'), o erro de validação
  e salvarAgora(), que grava o que faltar (usar antes de fechar).
*/
export function useAutoSalvar(form, { montar, gravar, espera = 800 }) {
  const [estado, setEstado] = useState('salvo')
  const [erroValidacao, setErroValidacao] = useState('')
  const ultimoSalvo = useRef(null)
  const atual = useRef({ form, montar, gravar })
  atual.current = { form, montar, gravar }
  if (ultimoSalvo.current === null) {
    const inicial = montar(form)
    ultimoSalvo.current = inicial.campos ? JSON.stringify(inicial.campos) : ''
  }

  async function salvarAgora() {
    const resultado = atual.current.montar(atual.current.form)
    if (resultado.erro) {
      setErroValidacao(resultado.erro)
      return false
    }
    const chave = JSON.stringify(resultado.campos)
    if (chave === ultimoSalvo.current) {
      setEstado('salvo')
      return true
    }
    setEstado('salvando')
    const ok = (await atual.current.gravar(resultado.campos)) === true
    if (!ok) {
      setEstado('erro')
      return false
    }
    ultimoSalvo.current = chave
    // se a pessoa continuou digitando enquanto gravava, ainda há algo pendente
    const depois = atual.current.montar(atual.current.form)
    setEstado(depois.campos && JSON.stringify(depois.campos) === chave ? 'salvo' : 'pendente')
    return true
  }

  useEffect(() => {
    const resultado = montar(form)
    setErroValidacao(resultado.erro || '')
    if (resultado.erro || JSON.stringify(resultado.campos) === ultimoSalvo.current) return
    setEstado('pendente')
    const t = setTimeout(salvarAgora, espera)
    return () => clearTimeout(t)
  }, [form]) // eslint-disable-line react-hooks/exhaustive-deps

  // avisa o navegador se a pessoa tentar fechar a aba com algo não gravado
  const pendente = estado !== 'salvo'
  useEffect(() => {
    if (!pendente) return
    const aviso = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [pendente])

  return { estado, erroValidacao, salvarAgora }
}

// Fechar uma janela com salvamento automático: grava antes; se falhar, fica aberta
// com o aviso e a segunda tentativa de fechar sai mesmo assim.
export function useFecharSalvando(salvarAgora, aoFechar) {
  const fechando = useRef(false)
  const falhou = useRef(false)
  return async function fechar() {
    if (fechando.current) return
    if (falhou.current) return aoFechar()
    fechando.current = true
    const ok = await salvarAgora()
    fechando.current = false
    if (ok) aoFechar()
    else falhou.current = true
  }
}
