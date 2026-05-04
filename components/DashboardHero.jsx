import Image from 'next/image'

export default function DashboardHero({ rubro, infoLine }) {
  return (
    <section className="hero">
      <div className="hero-head">
        <div className="brand-lockup">
          <div className="hero-logo-wrap">
            <Image src="/logo.png" alt="DecoraZon" width={76} height={76} className="hero-logo" />
          </div>
          <div className="brand-copy">
            <div className="hero-eyebrow">COTIZADOR DECORAZON · APP WEB</div>
            <h1>Cotizador DecoraZon</h1>
            <div className="hero-rubro">{rubro}</div>
            <p className="hero-subtitle">
              Recursos, cotizaciones, historial, edición y PDF listos para uso real.
            </p>
            <p className="hero-meta">{infoLine}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
