import { useState } from 'react'
import { supabase, traduzirErro } from '../lib/supabase'
import Icone from './Icone'

const LIMITE = 20 * 1024 * 1024

// Abre um arquivo de um bucket privado com um link temporário (devolve a mensagem de erro, ou '')
export async function abrirArquivo(bucket, caminho) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(caminho, 120)
  if (error) return traduzirErro(error)
  window.open(data.signedUrl, '_blank', 'noopener')
  return ''
}

/*
  Anexo de um registro (contrato, documento…): grava na hora, fora do salvamento automático.
  O arquivo vai para <bucket>/<id>/<data>-<nome> e o registro guarda arquivo_caminho e arquivo_nome.
*/
export default function ArquivoAnexo({ bucket, tabela, id, arquivo, aoMudar, aoErro }) {
  const [enviando, setEnviando] = useState(false)

  async function enviar(e) {
    const escolhido = e.target.files?.[0]
    e.target.value = ''
    if (!escolhido) return
    if (escolhido.size > LIMITE) return aoErro('O arquivo passa de 20 MB. Tente um PDF menor.')
    setEnviando(true)
    aoErro('')
    const nomeSeguro = escolhido.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-')
    const caminho = `${id}/${Date.now()}-${nomeSeguro}`
    const { error: erroEnvio } = await supabase.storage.from(bucket).upload(caminho, escolhido, { contentType: escolhido.type || undefined })
    if (erroEnvio) {
      setEnviando(false)
      return aoErro(traduzirErro(erroEnvio))
    }
    const { data, error } = await supabase.from(tabela)
      .update({ arquivo_caminho: caminho, arquivo_nome: escolhido.name }).eq('id', id).select().single()
    setEnviando(false)
    if (error) {
      await supabase.storage.from(bucket).remove([caminho])
      return aoErro(traduzirErro(error))
    }
    if (arquivo.caminho) await supabase.storage.from(bucket).remove([arquivo.caminho])
    aoMudar(data)
  }

  async function remover() {
    aoErro('')
    const { data, error } = await supabase.from(tabela)
      .update({ arquivo_caminho: null, arquivo_nome: null }).eq('id', id).select().single()
    if (error) return aoErro(traduzirErro(error))
    await supabase.storage.from(bucket).remove([arquivo.caminho])
    aoMudar(data)
  }

  const seletor = (
    <input type="file" hidden onChange={enviar} disabled={enviando} accept=".pdf,image/*,.doc,.docx" />
  )

  return (
    <div className="campo">
      <span>Arquivo</span>
      <div className="contrato-arquivo">
        {arquivo.caminho ? (
          <>
            <button type="button" className="botao-link" onClick={async () => aoErro(await abrirArquivo(bucket, arquivo.caminho))}>
              <Icone nome="anexo" tamanho={15} /> {arquivo.nome}
            </button>
            <span className="espaco" />
            <label className="botao botao-secundario botao-pequeno">{enviando ? 'Enviando…' : 'Trocar'}{seletor}</label>
            <button type="button" className="botao botao-fantasma botao-pequeno" onClick={remover}>Remover</button>
          </>
        ) : (
          <label className="botao botao-secundario botao-pequeno">
            <Icone nome="anexo" tamanho={15} /> {enviando ? 'Enviando…' : 'Anexar arquivo'}{seletor}
          </label>
        )}
      </div>
      <small className="texto-suave">PDF, imagem ou Word, até 20 MB. Só quem tem a Gestão liberada consegue abrir.</small>
    </div>
  )
}
