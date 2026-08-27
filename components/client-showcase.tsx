import { ArrowUpRight } from "lucide-react";

const clients = [
  {
    name: "Gentleman Art",
    subtitle: "Barber Shop",
    url: "https://www.gentleman-art.shop/",
    description: "Barbería premium en Zapopan. Cortes de precisión, barba y ritual de afeitado.",
    palette: "from-amber-400 to-amber-600",
    bg: "#0b0a08",
    accent: "#c9a24e",
    logo: (
      <svg viewBox="0 0 120 40" fill="none" className="client-logo-svg">
        <text x="0" y="28" fill="#c9a24e" fontFamily="serif" fontSize="22" fontWeight="bold" letterSpacing="0.04em">GENTLEMAN</text>
        <text x="0" y="38" fill="#8a7a5a" fontFamily="serif" fontSize="9" letterSpacing="0.35em">ART BARBER SHOP</text>
        <line x1="0" y1="12" x2="38" y2="12" stroke="#c9a24e" strokeWidth="0.8" />
      </svg>
    ),
  },
  {
    name: "XS ABOGADOS",
    subtitle: "Firma Legal",
    url: "https://xsabogados.vercel.app/",
    description: "Despacho jurídico en Puerta de Hierro. Consultoría legal empresarial.",
    palette: "from-slate-300 to-white",
    bg: "#0b1220",
    accent: "#c9b068",
    logo: (
      <svg viewBox="0 0 120 40" fill="none" className="client-logo-svg">
        <text x="0" y="30" fill="white" fontFamily="sans-serif" fontSize="32" fontWeight="800" letterSpacing="-0.04em">XS</text>
        <text x="52" y="24" fill="#c9b068" fontFamily="sans-serif" fontSize="8" fontWeight="600" letterSpacing="0.35em">ABOGADOS</text>
        <line x1="52" y1="29" x2="110" y2="29" stroke="#c9b068" strokeWidth="0.8" />
        <text x="52" y="38" fill="#8899aa" fontFamily="sans-serif" fontSize="6" letterSpacing="0.15em">FIRMA LEGAL</text>
      </svg>
    ),
  },
  {
    name: "VIGILEX",
    subtitle: "Legal Tech",
    url: "https://vigilex.mx/",
    description: "Sistema de gestión integral para abogados. Control de expedientes en la nube.",
    palette: "from-blue-500 to-indigo-600",
    bg: "#0a1628",
    accent: "#3b82f6",
    logo: (
      <svg viewBox="0 0 120 40" fill="none" className="client-logo-svg">
        <rect x="0" y="8" width="26" height="26" rx="5" fill="#3b82f6" />
        <text x="5" y="29" fill="white" fontFamily="sans-serif" fontSize="18" fontWeight="800">V</text>
        <text x="32" y="30" fill="white" fontFamily="sans-serif" fontSize="20" fontWeight="700" letterSpacing="-0.02em">VIGILEX</text>
        <text x="32" y="38" fill="#60a5fa" fontFamily="sans-serif" fontSize="6" letterSpacing="0.2em">LEGAL TECH</text>
      </svg>
    ),
  },
  {
    name: "VITAMATE",
    subtitle: "Fitness & Nutrición",
    url: "https://www.vitamate.mx/",
    description: "Entrenamiento, nutrición y acompañamiento con IA en una sola experiencia.",
    palette: "from-emerald-500 to-green-700",
    bg: "#0d1a0f",
    accent: "#5a7d5e",
    logo: (
      <svg viewBox="0 0 140 40" fill="none" className="client-logo-svg">
        <path d="M8 8C14 10 18 16 20 28C22 18 26 12 32 9" stroke="#5a7d5e" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M10 8C11 4 15 3.5 17 5C16 8.5 13 9.5 10 8Z" fill="#5a7d5e" />
        <path d="M22 6.5C24 3.5 28 4 30 6C28 8.5 25 9 22 6.5Z" fill="#5a7d5e" />
        <circle cx="20" cy="30" r="3" fill="#e6c7b2" stroke="#5a7d5e" strokeWidth="1" />
        <text x="38" y="28" fill="white" fontFamily="sans-serif" fontSize="18" fontWeight="800" letterSpacing="-0.03em">VITAMATE</text>
        <text x="38" y="38" fill="#5a7d5e" fontFamily="sans-serif" fontSize="7" letterSpacing="0.15em">VIDA FIT INTELIGENTE</text>
      </svg>
    ),
  },
];

export function ClientShowcase() {
  return (
    <section className="section client-section">
      <div className="section-intro split-intro">
        <div>
          <div className="eyebrow"><span /> Proyectos entregados</div>
          <h2>Páginas que <em>hablan</em> por nuestro trabajo.</h2>
        </div>
        <p>Cada proyecto es una historia de transformación digital. Conoce algunos de los sitios que hemos construido para negocios reales.</p>
      </div>

      <div className="client-grid">
        {clients.map((client) => (
          <a
            key={client.name}
            href={client.url}
            target="_blank"
            rel="noopener noreferrer"
            className="client-card"
            style={{ "--client-bg": client.bg, "--client-accent": client.accent } as React.CSSProperties}
          >
            <div className="client-card-bg" style={{ background: client.bg }} />
            <div className="client-card-body">
              <div className="client-logo-wrap">
                {client.logo}
              </div>
              <div className="client-meta">
                <span className="client-category" style={{ color: client.accent }}>{client.subtitle}</span>
                <p>{client.description}</p>
              </div>
              <div className="client-visit">
                <span>Visitar sitio</span>
                <ArrowUpRight size={14} />
              </div>
            </div>
            <div className="client-card-shine" />
          </a>
        ))}
      </div>

      <div className="client-cta">
        <p>¿Quieres ser el siguiente?</p>
        <a href="/cotizador" className="button">Cotizar mi proyecto <ArrowUpRight size={16} /></a>
      </div>
    </section>
  );
}
