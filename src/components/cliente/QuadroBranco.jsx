import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Excalidraw, MainMenu, WelcomeScreen, CaptureUpdateAction,
  getSceneVersion, reconcileElements, restoreElements,
} from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { supabase, traduzirErro } from '../../lib/supabase'
import { useTempoReal } from '../../lib/useTempoReal'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useCliente } from '../../pages/AreaCliente'

const ESPERA_SALVAR = 1000 // ms depois da última mudança

function arquivosDoBanco(linhas) {
  const arquivos = {}
  for (const a of linhas || []) {
    arquivos[a.id] = { id: a.id, mimeType: a.mime, dataURL: a.data_url, created: Date.parse(a.criado_em) }
  }
  return arquivos
}

export default function QuadroBranco() {
  const { cliente } = useCliente()
  const { tema } = useTheme()
  const { perfil } = useAuth()
  const [inicial, setInicial] = useState(null)   // cena carregada do banco
  const [estado, setEstado] = useState('salvo')  // 'salvo' | 'pendente' | 'salvando' | 'erro'
  const [erro, setErro] = useState('')

  const api = useRef(null)
  const versaoSalva = useRef(0)            // getSceneVersion do que está no banco
  const arquivosSalvos = useRef(new Set()) // ids de imagens já gravadas
  const minhasRevisoes = useRef(new Set()) // gravações feitas por esta aba
  const timer = useRef(null)
  const salvando = useRef(null)            // promessa do salvamento em andamento

  // ---------------------------------------------------------------- carregar
  useEffect(() => {
    let ativo = true
    ;(async () => {
      const [{ data: q, error: e1 }, { data: arqs, error: e2 }] = await Promise.all([
        supabase.from('quadros').select('elementos, fundo').eq('cliente_id', cliente.id).maybeSingle(),
        supabase.from('quadro_arquivos').select('id, mime, data_url, criado_em').eq('cliente_id', cliente.id),
      ])
      if (!ativo) return
      if (e1 || e2) { setErro(traduzirErro(e1 || e2)); setEstado('erro') }
      const elementos = restoreElements(q?.elementos || [], null)
      versaoSalva.current = getSceneVersion(elementos)
      arquivosSalvos.current = new Set((arqs || []).map((a) => a.id))
      setInicial({
        elements: elementos,
        appState: q?.fundo ? { viewBackgroundColor: q.fundo } : {},
        files: arquivosDoBanco(arqs),
        scrollToContent: true,
      })
    })()
    return () => { ativo = false }
  }, [cliente.id])

  // ---------------------------------------------------------------- salvar
  const salvar = useCallback(async () => {
    clearTimeout(timer.current)
    const excalidraw = api.current
    if (!excalidraw) return
    if (salvando.current) await salvando.current

    const tarefa = (async () => {
      const elementos = excalidraw.getSceneElementsIncludingDeleted()
      const versao = getSceneVersion(elementos)
      const arquivos = excalidraw.getFiles()
      const usados = new Set(elementos.filter((el) => el.type === 'image' && !el.isDeleted && el.fileId).map((el) => el.fileId))
      const novos = [...usados].filter((id) => !arquivosSalvos.current.has(id) && arquivos[id]?.dataURL)
      if (versao === versaoSalva.current && novos.length === 0) { setEstado('salvo'); return }

      setEstado('salvando')
      if (novos.length) {
        const { error } = await supabase.from('quadro_arquivos').upsert(
          novos.map((id) => ({ cliente_id: cliente.id, id, mime: arquivos[id].mimeType, data_url: arquivos[id].dataURL })),
          { onConflict: 'cliente_id,id', ignoreDuplicates: true },
        )
        if (error) { setErro(traduzirErro(error)); setEstado('erro'); return }
        novos.forEach((id) => arquivosSalvos.current.add(id))
      }

      const revisao = crypto.randomUUID()
      minhasRevisoes.current.add(revisao)
      const { error } = await supabase.from('quadros').upsert({
        cliente_id: cliente.id,
        elementos,
        fundo: excalidraw.getAppState().viewBackgroundColor,
        revisao,
        atualizado_por: perfil?.id,
      })
      if (error) { setErro(traduzirErro(error)); setEstado('erro'); return }
      versaoSalva.current = versao
      setErro('')
      // se algo mudou enquanto gravava, o próximo onChange agenda outro salvamento
      setEstado(getSceneVersion(excalidraw.getSceneElementsIncludingDeleted()) === versao ? 'salvo' : 'pendente')
    })()
    salvando.current = tarefa
    await tarefa
    salvando.current = null
  }, [cliente.id, perfil?.id])

  const aoMudar = useCallback((elementos) => {
    if (getSceneVersion(elementos) === versaoSalva.current) return
    setEstado('pendente')
    clearTimeout(timer.current)
    timer.current = setTimeout(salvar, ESPERA_SALVAR)
  }, [salvar])

  // grava o que estiver pendente ao trocar de aba do cliente ou fechar o navegador
  const estadoRef = useRef(estado)
  estadoRef.current = estado
  useEffect(() => {
    const aoSair = () => { if (estadoRef.current !== 'salvo') salvar() }
    window.addEventListener('beforeunload', aoSair)
    return () => {
      window.removeEventListener('beforeunload', aoSair)
      aoSair()
    }
  }, [salvar])

  // ---------------------------------------------------------------- tempo real
  const receberMudancas = useCallback(async () => {
    const excalidraw = api.current
    if (!excalidraw) return
    const { data: q } = await supabase.from('quadros').select('elementos, fundo, revisao').eq('cliente_id', cliente.id).maybeSingle()
    if (!q || minhasRevisoes.current.has(q.revisao)) return

    // imagens novas coladas por outra pessoa
    const locais = excalidraw.getFiles()
    const faltando = [...new Set((q.elementos || []).filter((el) => el.type === 'image' && el.fileId && !locais[el.fileId]).map((el) => el.fileId))]
    if (faltando.length) {
      const { data: arqs } = await supabase.from('quadro_arquivos').select('id, mime, data_url, criado_em')
        .eq('cliente_id', cliente.id).in('id', faltando)
      if (arqs?.length) {
        excalidraw.addFiles(Object.values(arquivosDoBanco(arqs)))
        arqs.forEach((a) => arquivosSalvos.current.add(a.id))
      }
    }

    // junta elemento a elemento: o que cada um editou por último prevalece
    const remotos = restoreElements(q.elementos || [], null)
    const juntos = reconcileElements(excalidraw.getSceneElementsIncludingDeleted(), remotos, excalidraw.getAppState())
    versaoSalva.current = getSceneVersion(remotos)
    excalidraw.updateScene({
      elements: juntos,
      appState: q.fundo ? { viewBackgroundColor: q.fundo } : undefined,
      captureUpdate: CaptureUpdateAction.NEVER, // não entra no desfazer de quem está olhando
    })
  }, [cliente.id])

  useTempoReal(['quadros'], cliente.id, receberMudancas)

  // ---------------------------------------------------------------- tela
  if (inicial === null) return <p className="texto-suave recuo">Carregando o quadro…</p>

  return (
    <div className="quadro-branco">
      <div className="quadro-tela">
        <Excalidraw
          excalidrawAPI={(a) => { api.current = a }}
          initialData={inicial}
          onChange={aoMudar}
          theme={tema === 'escuro' ? 'dark' : 'light'}
          langCode="pt-BR"
          name={`Quadro Branco · ${cliente.nome}`}
          UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, toggleTheme: false, clearCanvas: false } }}
          renderTopRightUI={() => (
            <span className={`quadro-estado ${estado === 'erro' ? 'quadro-estado-erro' : ''}`} title={erro || undefined}>
              {{ salvo: 'Salvo', salvando: 'Salvando…', pendente: 'Editando…', erro: 'Erro ao salvar' }[estado]}
            </span>
          )}
        >
          <MainMenu>
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.DefaultItems.SearchMenu />
            <MainMenu.DefaultItems.Help />
            <MainMenu.Separator />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
          </MainMenu>
          <WelcomeScreen>
            <WelcomeScreen.Hints.MenuHint />
            <WelcomeScreen.Hints.ToolbarHint />
            <WelcomeScreen.Hints.HelpHint />
            <WelcomeScreen.Center>
              <WelcomeScreen.Center.Heading>
                Quadro Branco de {cliente.nome}
              </WelcomeScreen.Center.Heading>
              <p className="quadro-boas-vindas">Monte aqui o todo da estratégia: pilares, funil, jornada, referências. Tudo é salvo sozinho.</p>
            </WelcomeScreen.Center>
          </WelcomeScreen>
        </Excalidraw>
      </div>
      {erro && estado === 'erro' && <p className="alerta alerta-erro quadro-alerta">{erro}</p>}
    </div>
  )
}
