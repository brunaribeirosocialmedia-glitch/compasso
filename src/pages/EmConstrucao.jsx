// Página provisória para os módulos das próximas etapas
export default function EmConstrucao({ titulo, etapa, descricao }) {
  return (
    <div className="pagina">
      <header className="pagina-topo">
        <h1>{titulo}</h1>
      </header>
      <div className="cartao vazio">
        <span className="etiqueta">Etapa {etapa}</span>
        <p>{descricao}</p>
      </div>
    </div>
  )
}
