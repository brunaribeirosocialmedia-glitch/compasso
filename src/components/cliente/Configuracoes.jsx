import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase, traduzirErro } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useCliente } from '../../pages/AreaCliente'
import { CORES_CLIENTE } from '../../lib/cores'
import { SeletorCor } from '../../pages/Clientes'
import BotaoSalvar, { useSalvar } from '../BotaoSalvar'

export default function Configuracoes() {
  const { permissoes } = useAuth()
  const { cliente, membros, recarregarCliente } = useCliente()
  const [equipe, setEquipe] = useState([])
  const [nome, setNome] = useState(cliente.nome)
  const [descricao, setDescricao] = useState(cliente.descricao || '')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const { estado: estadoSalvar, rodar } = useSalvar()
  const navigate = useNavigate()
  const [confirmacao, setConfirmacao] = useState('')
  const [excluindo, setExcluindo] = useState(false)

  useEffect(() => {
    supabase.from('perfis').select('id, nome, email, papel, ativo').order('nome').then(({ data }) => setEquipe(data || []))
  }, [])

  if (!permissoes.admin) return <Navigate to="../notas" replace />

  async function executar(promessa, mensagem) {
    setErro('')
    setAviso('')
    const { error } = await promessa
    if (error) setErro(traduzirErro(error))
    else if (mensagem) setAviso(mensagem)
    recarregarCliente()
  }

  const salvarDados = (e) => {
    e.preventDefault()
    setErro('')
    setAviso('')
    rodar(async () => {
      const { error } = await supabase.from('clientes').update({ nome: nome.trim(), descricao: descricao.trim() || null }).eq('id', cliente.id)
      if (error) return setErro(traduzirErro(error))
      recarregarCliente()
      return true
    })
  }

  const alternarMembro = (pessoa) => membros.includes(pessoa.id)
    ? executar(supabase.from('cliente_membros').delete().eq('cliente_id', cliente.id).eq('usuario_id', pessoa.id))
    : executar(supabase.from('cliente_membros').insert({ cliente_id: cliente.id, usuario_id: pessoa.id }))

  // Exclusão definitiva: pede o nome do cliente para confirmar
  const nomeConfere = confirmacao.trim().toLowerCase() === cliente.nome.trim().toLowerCase()
  async function excluirCliente() {
    if (!nomeConfere || excluindo) return
    setExcluindo(true)
    setErro('')
    const { error } = await supabase.from('clientes').delete().eq('id', cliente.id)
    setExcluindo(false)
    if (error) return setErro(traduzirErro(error))
    navigate('/clientes', { replace: true })
  }

  const equipeComum = equipe.filter((p) => p.papel !== 'admin' && p.ativo)

  return (
    <div className="configuracoes">
      <section className="cartao secao">
        <h2>Quem acessa este cliente</h2>
        <p className="texto-suave">
          Só as pessoas marcadas veem a Área do Cliente de {cliente.nome}. Administradoras veem todos os clientes.
        </p>
        {equipeComum.length === 0 ? (
          <p className="texto-suave">Ainda não há outras pessoas na equipe. Convide pela página Equipe.</p>
        ) : (
          <ul className="lista-membros">
            {equipeComum.map((p) => (
              <li key={p.id}>
                <label className="marcar">
                  <input type="checkbox" checked={membros.includes(p.id)} onChange={() => alternarMembro(p)} />
                  <span>
                    <strong>{p.nome || 'Sem nome'}</strong>
                    <small className="texto-suave bloco">{p.email}</small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cartao secao">
        <h2>Dados do cliente</h2>
        <form className="formulario" onSubmit={salvarDados}>
          <label className="campo">
            <span>Nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required />
          </label>
          <label className="campo">
            <span>Observações</span>
            <textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Contrato, contatos, links úteis…" />
          </label>
          <div className="campo">
            <span>Cor</span>
            <SeletorCor
              cores={CORES_CLIENTE}
              valor={cliente.cor}
              onChange={(cor) => executar(supabase.from('clientes').update({ cor }).eq('id', cliente.id))}
            />
          </div>
          <BotaoSalvar estado={estadoSalvar} texto="Salvar dados" textoSalvo="Dados salvos" className="alinhar-inicio" disabled={!nome.trim()} />
        </form>
      </section>

      <section className="cartao secao">
        <h2>{cliente.ativo ? 'Arquivar cliente' : 'Cliente arquivado'}</h2>
        <p className="texto-suave">
          {cliente.ativo
            ? 'Clientes arquivados saem da lista principal, mas tarefas, notas e eventos continuam guardados.'
            : 'Este cliente está arquivado. Reative para ele voltar à lista principal.'}
        </p>
        <button
          className="botao botao-secundario alinhar-inicio"
          onClick={() => executar(supabase.from('clientes').update({ ativo: !cliente.ativo }).eq('id', cliente.id),
            cliente.ativo ? 'Cliente arquivado.' : 'Cliente reativado.')}
        >
          {cliente.ativo ? 'Arquivar' : 'Reativar'}
        </button>
      </section>

      <section className="cartao secao zona-perigo">
        <h2>Excluir cliente</h2>
        <p className="texto-suave">
          Apaga de vez a Área do Cliente de {cliente.nome}: tarefas, comentários, calendário, bloco de notas, quadro branco e rotina mensal.
          Não dá para desfazer. Lançamentos do Financeiro, contratos e o prospect continuam guardados, só sem o vínculo com o cliente.
          Se for só uma pausa, prefira arquivar.
        </p>
        <label className="campo">
          <span>Para confirmar, digite o nome do cliente: <strong>{cliente.nome}</strong></span>
          <input value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="off" />
        </label>
        <button className="botao botao-perigo alinhar-inicio" onClick={excluirCliente} disabled={!nomeConfere || excluindo}>
          {excluindo ? 'Excluindo…' : 'Excluir cliente para sempre'}
        </button>
      </section>

      {erro && <p className="alerta alerta-erro">{erro}</p>}
      {aviso && <p className="alerta alerta-ok">{aviso}</p>}
    </div>
  )
}
