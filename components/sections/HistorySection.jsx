export default function HistorySection({
  history,
  onOpen,
  onDuplicate,
  onDelete,
  onBackupExport,
  onBackupRestoreClick,
  onBackupAddClick,
  backupBusy,
  restoreBusy,
  addBusy,
}) {
  return (
    <>
      <section className="card">
        <h2>Historial compartido</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nro.</th>
                <th>Proyecto</th>
                <th>Cliente</th>
                <th>Responsable</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {history.length ? (
                history.map((row) => (
                  <tr key={row.id}>
                    <td>{row.numero}</td>
                    <td>{row.nombreProyecto}</td>
                    <td>{row.cliente || row.razonSocial || row.empresa || '-'}</td>
                    <td>{row.responsable || '-'}</td>
                    <td>{String(row.fecha || '-').slice(0, 10)}</td>
                    <td>
                      <div className="action-row">
                        <button type="button" className="mini-btn" onClick={() => onOpen(row)}>
                          Abrir
                        </button>
                        <button type="button" className="mini-btn success" onClick={() => onDuplicate(row)}>
                          Duplicar
                        </button>
                        <button type="button" className="mini-btn danger" onClick={() => onDelete(row.id)}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="muted">Aún no hay cotizaciones guardadas en la nube.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Backup</h2>
        <div className="action-row">
          <button
            type="button"
            className="mini-btn"
            onClick={onBackupExport}
            disabled={backupBusy || restoreBusy || addBusy}
            title="Descargar copia de seguridad en Excel"
          >
            {backupBusy ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            type="button"
            className="mini-btn success"
            onClick={onBackupRestoreClick}
            disabled={backupBusy || restoreBusy || addBusy}
            title="Restaurar datos desde una copia de seguridad"
          >
            {restoreBusy ? 'Restaurando...' : 'Restaurar'}
          </button>
          <button
            type="button"
            className="mini-btn"
            onClick={onBackupAddClick}
            disabled={backupBusy || restoreBusy || addBusy}
            title="Añadir datos desde una copia de seguridad sin borrar lo actual"
          >
            {addBusy ? 'Añadiendo...' : 'Añadir'}
          </button>
        </div>
      </section>
    </>
  )
}
