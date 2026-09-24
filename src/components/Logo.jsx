export default function Logo({ tamanho = 28, comNome = true }) {
  return (
    <span className="logo">
      <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" className="logo-fundo" />
        <circle cx="16" cy="16" r="9" fill="none" className="logo-traco" strokeWidth="2" />
        <path d="M19.5 12.5 17.2 17.2 12.5 19.5 14.8 14.8Z" className="logo-agulha" />
      </svg>
      {comNome && (
        <span className="logo-texto">
          Compasso<small>B Mídia</small>
        </span>
      )}
    </span>
  )
}
