export default function ProjectSection({
  project,
  setProject,
  clients,
  applyClientInProject,
  resetCotizacionActual,
}) {
  return (
    <section className="card">
      <h2>Datos del proyecto</h2>
      <div className="action-row" style={{ marginBottom: 12 }}>
        <button type="button" className="btn success" onClick={resetCotizacionActual}>
          Nueva cotización
        </button>
      </div>
      <div className="grid grid-3">
        <div className="field">
          <label>Nro. cotización</label>
          <input value={project.numero} onChange={(e) => setProject({ ...project, numero: e.target.value })} />
        </div>
        <div className="field">
          <label>Nombre del proyecto</label>
          <input value={project.nombreProyecto} onChange={(e) => setProject({ ...project, nombreProyecto: e.target.value })} />
        </div>
        <div className="field">
          <label>Cliente</label>
          <select
            value={project.clienteId || ''}
            onChange={(e) => {
              const selectedId = e.target.value
              const selectedClient = clients.find((client) => client.id === selectedId)
              if (selectedClient) {
                applyClientInProject(selectedClient)
                return
              }
              setProject((prev) => ({
                ...prev,
                clienteId: '',
                cliente: '',
                responsable: '',
                telefono: '',
                nit: '',
                razonSocial: '',
                empresa: '',
              }))
            }}
          >
            <option value="">Seleccionar cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.cliente}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Cliente (nombre)</label>
          <input value={project.cliente} onChange={(e) => setProject({ ...project, cliente: e.target.value })} />
        </div>
        <div className="field">
          <label>Responsable</label>
          <input value={project.responsable} onChange={(e) => setProject({ ...project, responsable: e.target.value })} />
        </div>
        <div className="field">
          <label>Teléfono</label>
          <input value={project.telefono} onChange={(e) => setProject({ ...project, telefono: e.target.value })} />
        </div>
        <div className="field">
          <label>NIT</label>
          <input value={project.nit} onChange={(e) => setProject({ ...project, nit: e.target.value })} />
        </div>
        <div className="field">
          <label>Razón social</label>
          <input
            value={project.razonSocial}
            onChange={(e) => setProject({ ...project, razonSocial: e.target.value, empresa: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Fecha</label>
          <input type="date" value={project.fecha} onChange={(e) => setProject({ ...project, fecha: e.target.value })} />
        </div>
        <div className="field">
          <label>Válida hasta</label>
          <input type="date" value={project.validoHasta} onChange={(e) => setProject({ ...project, validoHasta: e.target.value })} />
        </div>
        <div className="field">
          <label>Moneda</label>
          <select value={project.moneda} onChange={(e) => setProject({ ...project, moneda: e.target.value })}>
            <option>BOB</option>
            <option>USD</option>
          </select>
        </div>
        <div className="field">
          <label>Condiciones de pago</label>
          <input value={project.condicionesPago} onChange={(e) => setProject({ ...project, condicionesPago: e.target.value })} />
        </div>
        <div className="field">
          <label>Tiempo de entrega</label>
          <input value={project.tiempoEntrega} onChange={(e) => setProject({ ...project, tiempoEntrega: e.target.value })} />
        </div>
        <div className="field">
          <label>Modo de cotización</label>
          <select value={project.modoCotizacion || 'total'} onChange={(e) => setProject({ ...project, modoCotizacion: e.target.value })}>
            <option value="total">Suma total</option>
            <option value="opciones">Opciones para elegir</option>
          </select>
        </div>
        <div className="field">
          <label>Descuento general (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            value={project.descuentoGeneralPct ?? 0}
            onChange={(e) => setProject({ ...project, descuentoGeneralPct: e.target.value })}
          />
        </div>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Observaciones</label>
        <textarea rows={4} value={project.observaciones} onChange={(e) => setProject({ ...project, observaciones: e.target.value })} />
      </div>
    </section>
  )
}
