// Ícones de traço simples, herdam a cor do texto
const caminhos = {
  inicio: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  clientes: 'M4 5h16v14H4zM4 9h16M9 9v10',
  prospeccao: 'M3 4h18l-7 8v6l-4 2v-8z',
  financeiro: 'M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 2.6 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3',
  equipe: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6',
  cadeado: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
  cadeadoAberto: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 6.8-1.2',
  sol: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  lua: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  sair: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3',
  menu: 'M3 6h18M3 12h18M3 18h18',
  fechar: 'M6 6l12 12M18 6 6 18',
  mais: 'M12 5v14M5 12h14',
  tarefas: 'M4 4h5v16H4zM10.5 4h5v10h-5zM17 4h3v7h-3z',
  calendario: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  notas: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h5',
  quadro: 'M3 4h18v12H3zM12 16v4M8 20h8M7 12l3-3 2 2 4-4',
  config: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
  voltar: 'M15 18l-6-6 6-6',
  avancar: 'M9 18l6-6-6-6',
  alfinete: 'M9 4h6l-1 6 3 3H7l3-3zM12 13v8',
  lixeira: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  seta: 'M5 12h14M13 6l6 6-6 6',
  busca: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
}

export default function Icone({ nome, tamanho = 20 }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={caminhos[nome]} />
    </svg>
  )
}
