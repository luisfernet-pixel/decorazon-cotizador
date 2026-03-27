'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { COMPANY } from '@/lib/company'

function money(value, currency = 'BOB') {
  return new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Number(value || 0))
}

function getEmptyQuote() {
  return {
    numero: '',
    nombreProyecto: '',
    empresa: '',
    responsable: '',
    fecha: '',
    validoHasta: '',
    moneda: 'BOB',
    condicionesPago: '',
    tiempoEntrega: '',
    observaciones: '',
    totalProyecto: 0,
    items: [],
  }
}

function parseQuote(raw) {
  if (!raw) return getEmptyQuote()

  try {
    const parsed = JSON.parse(raw)
    return {
      ...getEmptyQuote(),
      ...parsed,
      items: Array.isArray(parsed?.items) ? parsed.items : [],
    }
  } catch {
    try {
      const parsed = JSON.parse(decodeURIComponent(raw))
      return {
        ...getEmptyQuote(),
        ...parsed,
        items: Array.isArray(parsed?.items) ? parsed.items : [],
      }
    } catch (error) {
      console.error('Error leyendo datos del PDF:', error)
      return getEmptyQuote()
    }
  }
}

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

export default function PDFPage() {
  const params = useSearchParams()
  const raw = params.get('data')
  const quote = useMemo(() => parseQuote(raw), [raw])

  return (
    <>
      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          background: #ffffff;
          color: #111111;
          font-family: Arial, Helvetica, sans-serif;
        }

        * {
          box-sizing: border-box;
        }

        @page {
          size: A4;
          margin: 12mm;
        }

        .toolbar {
          max-width: 980px;
          margin: 20px auto 0;
          display: flex;
          justify-content: flex-end;
        }

        .print-btn {
          background: #111111;
          color: #ffffff;
          border: none;
          border-radius: 10px;
          padding: 12px 18px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .sheet {
          width: 100%;
          max-width: 980px;
          margin: 16px auto 24px;
          background: #ffffff;
          padding: 12px;
        }

        .header {
          width: 100%;
          margin-bottom: 22px;
          border-collapse: collapse;
        }

        .header-left {
          width: 62%;
          vertical-align: top;
          padding-right: 20px;
        }

        .header-right {
          width: 38%;
          vertical-align: top;
        }

        .logo {
          width: 110px;
          height: auto;
          display: block;
          margin-bottom: 14px;
        }

        .company-name {
          font-size: 28px;
          font-weight: 800;
          margin: 0 0 10px;
        }

        .company-line {
          margin: 6px 0;
          font-size: 14px;
          color: #333333;
        }

        .quote-box {
          border: 1px solid #cfcfcf;
          border-radius: 12px;
          padding: 16px 18px;
        }

        .quote-title {
          margin: 0 0 16px;
          text-align: right;
          font-size: 24px;
          font-weight: 800;
        }

        .quote-line {
          margin: 8px 0;
          text-align: right;
          font-size: 14px;
        }

        .info-box {
          border: 1px solid #cfcfcf;
          border-radius: 12px;
          padding: 16px 18px;
          margin-bottom: 20px;
        }

        .info-line {
          margin: 8px 0;
          font-size: 14px;
        }

        .quote-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 22px;
        }

        .quote-table th {
          text-align: left;
          font-size: 13px;
          color: #4d6b8d;
          padding: 10px 8px;
          border-bottom: 2px solid #111111;
        }

        .quote-table td {
          vertical-align: top;
          font-size: 14px;
          padding: 10px 8px;
          border-bottom: 1px solid #dddddd;
        }

        .item-name {
          font-weight: 700;
          margin-bottom: 4px;
        }

        .tiny {
          font-size: 12px;
          color: #666666;
          line-height: 1.4;
        }

        .footer {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }

        .footer-left {
          width: 68%;
          vertical-align: top;
          padding-right: 16px;
        }

        .footer-right {
          width: 32%;
          vertical-align: top;
        }

        .conditions-box {
          border: 1px solid #cfcfcf;
          border-radius: 12px;
          padding: 16px 18px;
        }

        .conditions-title {
          margin: 0 0 12px;
          font-size: 18px;
          font-weight: 800;
        }

        .conditions-line {
          margin: 8px 0;
          font-size: 14px;
          line-height: 1.45;
        }

        .total-box {
          border: 2px solid #111111;
          border-radius: 12px;
          padding: 22px 18px;
          text-align: right;
        }

        .total-label {
          font-size: 16px;
          margin-bottom: 10px;
        }

        .total-value {
          font-size: 34px;
          font-weight: 800;
          line-height: 1.1;
        }

        @media print {
          .toolbar {
            display: none !important;
          }

          html, body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .sheet {
            max-width: none;
            width: 100%;
            margin: 0;
            padding: 0;
          }

          table, tr, td, th, .quote-box, .info-box, .conditions-box, .total-box {
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="toolbar">
        <button type="button" className="print-btn" onClick={() => window.print()}>
          Imprimir / Guardar PDF
        </button>
      </div>

      <div className="sheet">
        <table className="header">
          <tbody>
            <tr>
              <td className="header-left">
                <img src="/logo.png" alt={COMPANY.name} className="logo" />
                <div className="company-name">{COMPANY.name}</div>
                <div className="company-line">{COMPANY.address}</div>
                <div className="company-line">{safeArray(COMPANY.phones).join(' / ')}</div>
                <div className="company-line">{COMPANY.email}</div>
              </td>

              <td className="header-right">
                <div className="quote-box">
                  <div className="quote-title">COTIZACIÓN</div>
                  <div className="quote-line"><strong>Nro:</strong> {quote.numero || 'Sin número'}</div>
                  <div className="quote-line"><strong>Fecha:</strong> {quote.fecha || '-'}</div>
                  <div className="quote-line"><strong>Válida hasta:</strong> {quote.validoHasta || '-'}</div>
                  <div className="quote-line"><strong>Moneda:</strong> {quote.moneda || 'BOB'}</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="info-box">
          <div className="info-line"><strong>Proyecto:</strong> {quote.nombreProyecto || '-'}</div>
          <div className="info-line"><strong>Empresa:</strong> {quote.empresa || '-'}</div>
          <div className="info-line"><strong>Responsable:</strong> {quote.responsable || '-'}</div>
        </div>

        <table className="quote-table">
          <thead>
            <tr>
              <th>CÓDIGO</th>
              <th>ÍTEM</th>
              <th>DETALLE</th>
              <th>SUBTOTAL</th>
              <th>IMPUESTO</th>
              <th>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.length ? (
              quote.items.map((item, itemIndex) => (
                <tr key={item.id || itemIndex}>
                  <td>{item.codigo || '-'}</td>

                  <td>
                    <div className="item-name">{item.nombre || '-'}</div>
                    <div className="tiny">{item.categoria || '-'}</div>
                  </td>

                  <td>
                    <div>{item.descripcion || '-'}</div>
                    <div className="tiny" style={{ marginTop: 8 }}>
                      {item.aplicaImpuesto
                        ? `Incluye impuestos de ley (${Number(item.tasaImpuesto || 0)}%).`
                        : 'No incluye impuestos de ley.'}
                    </div>
                  </td>

                  <td>{money(item.subtotal || 0, quote.moneda)}</td>
                  <td>{money(item.impuesto || 0, quote.moneda)}</td>
                  <td><strong>{money(item.total || 0, quote.moneda)}</strong></td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>No hay ítems para imprimir.</td>
              </tr>
            )}
          </tbody>
        </table>

        <table className="footer">
          <tbody>
            <tr>
              <td className="footer-left">
                <div className="conditions-box">
                  <div className="conditions-title">Condiciones</div>
                  <div className="conditions-line"><strong>Pago:</strong> {quote.condicionesPago || '-'}</div>
                  <div className="conditions-line"><strong>Entrega:</strong> {quote.tiempoEntrega || '-'}</div>
                  <div className="conditions-line"><strong>Observaciones:</strong> {quote.observaciones || '-'}</div>
                </div>
              </td>

              <td className="footer-right">
                <div className="total-box">
                  <div className="total-label">TOTAL GENERAL</div>
                  <div className="total-value">{money(quote.totalProyecto || 0, quote.moneda)}</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}