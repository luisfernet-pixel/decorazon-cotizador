export default function HomeSection({
  resources,
  clients,
  history,
  details,
  itemRows,
  totalProyecto,
  money,
}) {
  const materialUsage = (details || []).reduce((acc, row) => {
    const desc = String(row.descripcion || '').trim() || 'Sin descripción'
    const spec = String(row.especificacion || '').trim() || '-'
    const supplier = String(row.proveedor || '').trim() || '-'
    const unit = String(row.unidad || '').trim() || 'unidad'
    const key = `${desc}__${spec}__${supplier}__${unit}`
    const qty = Number(row.cantidad || 0)
    const subtotal = qty * Number(row.costoUnitario || 0)
    if (!acc[key]) {
      acc[key] = {
        descripcion: desc,
        especificacion: spec,
        proveedor: supplier,
        unidad: unit,
        apariciones: 0,
        cantidadTotal: 0,
        subtotal: 0,
      }
    }
    acc[key].apariciones += 1
    acc[key].cantidadTotal += qty
    acc[key].subtotal += subtotal
    return acc
  }, {})

  const topMaterials = Object.values(materialUsage)
    .sort((a, b) => (b.apariciones - a.apariciones) || (b.cantidadTotal - a.cantidadTotal))
    .slice(0, 8)

  const resourceHighlights = (resources || [])
    .slice()
    .sort((a, b) => Number(b.costo || 0) - Number(a.costo || 0))
    .slice(0, 8)

  const latestClients = (clients || []).slice(0, 8)
  const latestQuotes = (history || []).slice(0, 8)

  return (
    <div className="home-shell">
      <div className="home-dash">
        <section className="dash-block">
          <h2 className="dash-title">Dashboard</h2>
          <p className="dash-subtitle">Resumen operativo del cotizador en tiempo real.</p>
          <div className="grid grid-4">
            <div className="stat-card">
              <div className="stat-label">Recursos</div>
              <div className="stat-value">{resources.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Clientes</div>
              <div className="stat-value">{clients.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Cotizaciones</div>
              <div className="stat-value">{history.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total actual</div>
              <div className="stat-money">{money(totalProyecto || 0)}</div>
              <div className="stat-meta">{itemRows.length} ítems</div>
            </div>
          </div>
        </section>

        <section className="dash-block">
          <h2 className="dash-title">Materiales Más Usados</h2>
          {topMaterials.length ? (
            <div className="table-wrap dash-table">
              <table>
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Medida / Especificación</th>
                    <th>Proveedor</th>
                    <th>Usos</th>
                    <th>Cantidad total</th>
                    <th>Subtotal base</th>
                  </tr>
                </thead>
                <tbody>
                  {topMaterials.map((row, index) => (
                    <tr key={`${row.descripcion}-${index}`}>
                      <td><strong>{row.descripcion}</strong></td>
                      <td>{row.especificacion}</td>
                      <td>{row.proveedor}</td>
                      <td>{row.apariciones}</td>
                      <td>{row.cantidadTotal.toLocaleString('es-BO')} {row.unidad}</td>
                      <td>{money(row.subtotal || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-note">Aún no hay subítems para calcular uso. Te muestro recursos destacados por costo.</div>
          )}
          {!topMaterials.length && (
            <div className="table-wrap dash-table" style={{ marginTop: 10 }}>
              <table>
                <thead>
                  <tr>
                    <th>Recurso</th>
                    <th>Categoría</th>
                    <th>Proveedor</th>
                    <th>Costo unitario</th>
                  </tr>
                </thead>
                <tbody>
                  {resourceHighlights.map((row) => (
                    <tr key={row.id}>
                      <td><strong>{row.nombre || '-'}</strong></td>
                      <td>{row.categoria || '-'}</td>
                      <td>{row.proveedor || '-'}</td>
                      <td>{money(row.costo || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="grid grid-2 dash-bottom-grid">
          <section className="dash-block dash-bottom-card">
            <h2 className="dash-title">Últimos Clientes</h2>
            <div className="table-wrap dash-table">
              <table className="clients-table">
                <colgroup>
                  <col style={{ width: '34%' }} />
                  <col style={{ width: '33%' }} />
                  <col style={{ width: '33%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Responsable</th>
                    <th>Teléfono</th>
                  </tr>
                </thead>
                <tbody>
                  {latestClients.length ? (
                    latestClients.map((row) => (
                      <tr key={row.id}>
                        <td><strong>{row.cliente || '-'}</strong></td>
                        <td>{row.responsable || '-'}</td>
                        <td>{row.telefono || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="empty-note">Aún no hay clientes registrados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="dash-block dash-bottom-card">
            <h2 className="dash-title">Últimas Cotizaciones</h2>
            <div className="table-wrap dash-table">
              <table className="quotes-table">
                <colgroup>
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '40%' }} />
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '20%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Proyecto</th>
                    <th>Cliente</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {latestQuotes.length ? (
                    latestQuotes.map((row) => (
                      <tr key={row.id}>
                        <td>{row.numero || '-'}</td>
                        <td><strong>{row.nombreProyecto || '-'}</strong></td>
                        <td>{row.cliente || '-'}</td>
                        <td>{String(row.fecha || '').slice(0, 10) || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="empty-note">Aún no hay cotizaciones guardadas.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <style jsx>{`
        .home-shell {
          background: linear-gradient(160deg, var(--dz-green-deep), var(--dz-green-dark));
          border-radius: 28px;
          padding: 18px;
          box-shadow: 0 18px 32px rgba(9, 69, 74, 0.28);
        }
        .home-dash {
          display: grid;
          gap: 16px;
        }
        .dash-block {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.26);
          border-radius: 24px;
          padding: 18px 20px;
          backdrop-filter: blur(1px);
        }
        .dash-title {
          color: #fff;
          margin: 0 0 8px;
        }
        .dash-subtitle {
          color: rgba(255, 255, 255, 0.86);
          margin: 0 0 14px;
          font-size: 0.98rem;
        }
        .stat-card {
          background: rgba(255, 255, 255, 0.14);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 16px;
          padding: 12px 14px;
        }
        .stat-label {
          color: rgba(255, 255, 255, 0.88);
          font-size: 0.82rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          font-weight: 700;
        }
        .stat-value {
          color: #fff;
          font-size: 2rem;
          font-weight: 900;
          line-height: 1.06;
          margin-top: 6px;
        }
        .stat-money {
          color: #fff;
          font-size: 1.55rem;
          font-weight: 900;
          line-height: 1.1;
          margin-top: 6px;
        }
        .stat-meta {
          margin-top: 4px;
          color: rgba(255, 255, 255, 0.86);
          font-size: 0.88rem;
        }
        .dash-table {
          border: 1px solid rgba(255, 255, 255, 0.34);
          background: rgba(11, 70, 76, 0.72);
        }
        .dash-table :global(table) {
          background: transparent !important;
        }
        .dash-table :global(th) {
          background: rgba(255, 255, 255, 0.14) !important;
          color: #fff;
          border-bottom-color: rgba(255, 255, 255, 0.28);
        }
        .dash-table :global(td) {
          color: rgba(255, 255, 255, 0.96);
          background: transparent !important;
          border-bottom-color: rgba(255, 255, 255, 0.2);
        }
        .dash-table :global(tbody tr:hover) {
          background: rgba(255, 255, 255, 0.12);
        }
        .dash-table :global(strong) {
          color: #fff;
        }
        .dash-bottom-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          align-items: stretch;
        }
        .dash-bottom-card {
          display: flex;
          flex-direction: column;
        }
        .dash-bottom-card .dash-table {
          flex: 1;
          min-height: 0;
        }
        .dash-bottom-card .dash-table :global(table) {
          table-layout: fixed;
          min-width: 0;
        }
        .dash-bottom-card .dash-table :global(th),
        .dash-bottom-card .dash-table :global(td) {
          white-space: normal;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        @media (max-width: 1200px) {
          .dash-bottom-grid {
            grid-template-columns: 1fr;
          }
        }
        .empty-note {
          color: rgba(255, 255, 255, 0.88);
        }
      `}</style>
    </div>
  )
}
