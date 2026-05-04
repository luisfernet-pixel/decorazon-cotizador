import { initialResource } from '@/lib/initial-state'

export default function ResourcesSection({
  editingResourceId,
  resourceForm,
  setResourceForm,
  saveResource,
  savingResource,
  setEditingResourceId,
  resources,
  money,
  addResourceToDetail,
  editResource,
  deleteResource,
}) {
  return (
    <div className="grid" style={{ gap: 16 }}>
      <section className="card">
        <h2>{editingResourceId ? 'Editar recurso' : 'Alta rápida de recurso'}</h2>
        <form className="grid" style={{ gap: 12 }} onSubmit={saveResource}>
          <div className="grid grid-2">
            <div className="field">
              <label>Tipo</label>
              <select value={resourceForm.tipo} onChange={(e) => setResourceForm({ ...resourceForm, tipo: e.target.value })}>
                <option>Material</option>
                <option>Mano de obra</option>
                <option>Servicio</option>
                <option>Instalación</option>
                <option>Transporte</option>
              </select>
            </div>
            <div className="field">
              <label>Categoría</label>
              <input value={resourceForm.categoria} onChange={(e) => setResourceForm({ ...resourceForm, categoria: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Nombre</label>
            <input value={resourceForm.nombre} onChange={(e) => setResourceForm({ ...resourceForm, nombre: e.target.value })} />
          </div>
          <div className="field">
            <label>Especificación</label>
            <input value={resourceForm.especificacion} onChange={(e) => setResourceForm({ ...resourceForm, especificacion: e.target.value })} />
          </div>
          <div className="grid grid-3">
            <div className="field">
              <label>Unidad</label>
              <input value={resourceForm.unidad} onChange={(e) => setResourceForm({ ...resourceForm, unidad: e.target.value })} />
            </div>
            <div className="field">
              <label>Proveedor</label>
              <input value={resourceForm.proveedor} onChange={(e) => setResourceForm({ ...resourceForm, proveedor: e.target.value })} />
            </div>
            <div className="field">
              <label>Costo base</label>
              <input type="number" value={resourceForm.costo} onChange={(e) => setResourceForm({ ...resourceForm, costo: e.target.value })} />
            </div>
          </div>
          <div className="action-row">
            <button className="btn" type="submit" disabled={savingResource}>
              {savingResource ? 'Guardando...' : editingResourceId ? 'Guardar cambios' : 'Guardar'}
            </button>
            {editingResourceId && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setEditingResourceId(null)
                  setResourceForm(initialResource)
                }}
              >
                Cancelar edición
              </button>
            )}
          </div>
        </form>
      </section>
      <section className="card">
        <h2>Recursos guardados</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Nombre</th>
                <th>Proveedor</th>
                <th>Unidad</th>
                <th>Costo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {resources.length ? (
                resources.map((row) => (
                  <tr key={row.id}>
                    <td>{row.tipo}</td>
                    <td>
                      <strong>{row.nombre}</strong>
                      <div className="tiny-muted">{row.categoria} · {row.especificacion || '-'}</div>
                    </td>
                    <td>{row.proveedor || '-'}</td>
                    <td>{row.unidad}</td>
                    <td>{money(row.costo, 'BOB')}</td>
                    <td>
                      <div className="action-row">
                        <button type="button" className="mini-btn" onClick={() => addResourceToDetail(row)}>
                          Cargar
                        </button>
                        <button type="button" className="mini-btn success" onClick={() => editResource(row)}>
                          Editar
                        </button>
                        <button type="button" className="mini-btn danger" onClick={() => deleteResource(row.id)}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="muted">Aún no hay recursos guardados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
