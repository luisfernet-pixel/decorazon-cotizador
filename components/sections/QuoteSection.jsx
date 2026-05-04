import Image from 'next/image'
import { COMPANY } from '@/lib/company'

export default function QuoteSection({
  project,
  itemRows,
  subtotalProyecto,
  descuentoGeneralPct,
  descuentoGeneralMonto,
  totalProyecto,
  savingProject,
  editingProjectId,
  onSave,
  onDownloadPdf,
  money,
  formatDateDisplay,
  safeText,
}) {
  return (
    <section className="card">
      <div className="quote-head">
        <div>
          <Image src="/logo.png" alt="DecoraZon" width={68} height={68} className="quote-logo" />
          <h2 style={{ marginTop: 10 }}>{COMPANY.name}</h2>
          <div className="muted">{COMPANY.address}</div>
          <div className="muted">{COMPANY.phones.join(' / ')}</div>
          <div className="muted">{COMPANY.email}</div>
        </div>
        <div className="quote-box">
          <div><strong>Cotización:</strong> {project.numero || 'Sin número'}</div>
          <div><strong>Proyecto:</strong> {project.nombreProyecto || '-'}</div>
          <div><strong>Cliente:</strong> {project.cliente || '-'}</div>
          <div><strong>Razón social:</strong> {project.razonSocial || project.empresa || '-'}</div>
          <div><strong>Responsable:</strong> {project.responsable || '-'}</div>
          <div><strong>Teléfono:</strong> {project.telefono || '-'}</div>
          <div><strong>NIT:</strong> {project.nit || '-'}</div>
          <div><strong>Fecha:</strong> {formatDateDisplay(project.fecha)}</div>
        </div>
      </div>
      <div className="table-wrap" style={{ marginTop: 18 }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: '10%' }}>Código</th>
              <th style={{ width: '16%' }}>Ítem</th>
              <th style={{ width: '34%' }}>Descripción</th>
              <th style={{ width: '10%', textAlign: 'right' }}>Cantidad</th>
              <th style={{ width: '14%', textAlign: 'right' }}>Precio unitario</th>
              <th style={{ width: '16%', textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {itemRows.length ? (
              itemRows.map((item) => (
                <tr key={item.id}>
                  <td>{item.codigo}</td>
                  <td><strong>{item.nombre}</strong></td>
                  <td>
                    <div style={{ whiteSpace: 'pre-line' }}>{safeText(item.descripcion) || '-'}</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>{Number(item.cantidad || 0).toLocaleString('es-BO')}</td>
                  <td style={{ textAlign: 'right' }}>{money(item.precioUnitario, project.moneda)}</td>
                  <td style={{ textAlign: 'right' }}><strong>{money(item.total, project.moneda)}</strong></td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="muted">Aún no hay cotización armada.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="quote-foot">
        <div className="quote-box">
          <strong>Condiciones</strong>
          <div className="muted">Pago: {project.condicionesPago || '-'}</div>
          <div className="muted">Entrega: {project.tiempoEntrega || '-'}</div>
          <div className="muted">Observaciones: {project.observaciones || '-'}</div>
          <div className="muted">
            {itemRows.some((item) => item.aplicaImpuesto) ? 'La cotización incluye impuestos de ley.' : 'La cotización no incluye impuestos de ley.'}
          </div>
          {project.modoCotizacion === 'opciones' && (
            <div className="muted">Los valores mostrados corresponden a opciones independientes. El cliente podra elegir una alternativa.</div>
          )}
        </div>
        {project.modoCotizacion !== 'opciones' && (
          <div className="quote-box">
            <strong>Total general</strong>
            <div className="muted">Total: {money(subtotalProyecto, project.moneda)}</div>
            <div className="muted">Descuento ({Number(descuentoGeneralPct || 0)}%): {money(descuentoGeneralMonto, project.moneda)}</div>
            <div className="kpi" style={{ fontSize: 28 }}>{money(totalProyecto, project.moneda)}</div>
          </div>
        )}
      </div>
      <div className="action-row">
        <button type="button" className="btn" onClick={onSave} disabled={savingProject}>
          {savingProject ? 'Guardando...' : editingProjectId ? 'Guardar cambios' : 'Guardar'}
        </button>
        <button type="button" className="btn secondary" onClick={onDownloadPdf}>
          Imprimir / PDF
        </button>
      </div>
    </section>
  )
}
