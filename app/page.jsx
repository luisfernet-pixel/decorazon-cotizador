'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Fragment } from 'react'
import { COMPANY } from '@/lib/company'
import { getCompanyInfoLine } from '@/lib/company-format'
import { TABLES } from '@/lib/db-constants'
import { formatDateDisplay, money, safeText } from '@/lib/formatters'
import {
  createInitialDetail,
  createInitialItem,
  createInitialProject,
  initialClient,
  initialResource,
} from '@/lib/initial-state'
import { formatMoneyPdf, getLogoDataUrl } from '@/lib/pdf-utils'
import { parseProjectNotes, serializeProjectNotes } from '@/lib/project-notes'
import { resourceMeta } from '@/lib/resource-meta'
import { supabase } from '@/lib/supabase'
import { BRAND, COMPANY_RUBRO } from '@/lib/theme'
import { APP_TABS } from '@/lib/ui-constants'
import { uid } from '@/lib/id'
import DashboardHero from '@/components/DashboardHero'
import { HistorySection, HomeSection, ProjectSection, QuoteSection, ResourcesSection } from '@/components/sections'
import TabNav from '@/components/TabNav'
const initialItem = createInitialItem(COMPANY.defaultTaxRate ?? 19)
const initialDetail = createInitialDetail(COMPANY.defaultMarginRate ?? 100)
const QUOTE_EDIT_TABS = ['proyecto', 'items', 'subitems', 'cotizacion']
export default function Page() {
  const [activeTab, setActiveTab] = useState('inicio')
  const [project, setProject] = useState(() => createInitialProject())
  const [resourceForm, setResourceForm] = useState(initialResource)
  const [itemForm, setItemForm] = useState(initialItem)
  const [detailForm, setDetailForm] = useState(initialDetail)
  const [clientForm, setClientForm] = useState(initialClient)
  const [resources, setResources] = useState([])
  const [clients, setClients] = useState([])
  const [history, setHistory] = useState([])
  const [items, setItems] = useState([])
  const [details, setDetails] = useState([])
  const [savingResource, setSavingResource] = useState(false)
  const [savingProject, setSavingProject] = useState(false)
  const [savingClient, setSavingClient] = useState(false)
  const [editingResourceId, setEditingResourceId] = useState(null)
  const [editingClientId, setEditingClientId] = useState(null)
  const [editingItemId, setEditingItemId] = useState(null)
  const [editingDetailId, setEditingDetailId] = useState(null)
  const [editingProjectId, setEditingProjectId] = useState(null)
  const [collapsedDetailGroups, setCollapsedDetailGroups] = useState({})
  const [toastMessage, setToastMessage] = useState('')
  const [backupBusy, setBackupBusy] = useState(false)
  const [restoreBusy, setRestoreBusy] = useState(false)
  const [addBusy, setAddBusy] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState(() => Date.now())
  const [syncTick, setSyncTick] = useState(0)
  const [savedQuoteSnapshot, setSavedQuoteSnapshot] = useState(null)
  const backupInputRef = useRef(null)
  const backupImportModeRef = useRef('restore')
  const toastTimeoutRef = useRef(null)
  const liveRefreshTimeoutRef = useRef(null)
  const syncPulseRef = useRef(null)
  function showToast(message) {
    setToastMessage(message)
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage('')
      toastTimeoutRef.current = null
    }, 2200)
  }
  function markSyncedNow() {
    setLastSyncAt(Date.now())
  }
  function getSyncText() {
    const elapsedSec = Math.max(0, Math.floor((Date.now() - lastSyncAt) / 1000))
    if (elapsedSec < 5) return 'Sincronizado ahora'
    if (elapsedSec < 60) return `Sincronizado hace ${elapsedSec} seg`
    const min = Math.floor(elapsedSec / 60)
    if (min < 60) return `Sincronizado hace ${min} min`
    const h = Math.floor(min / 60)
    return `Sincronizado hace ${h} h`
  }
  function getEditingProjectText() {
    const quoteNumber = String(project.numero || '').trim() || 'S/N'
    const projectName = String(project.nombreProyecto || '').trim() || 'Sin nombre'
    const responsible = String(project.responsable || '').trim() || 'Sin responsable'
    if (!editingProjectId && !projectName && !responsible) return 'Sin proyecto en edición'
    return `${quoteNumber} · ${projectName} · ${responsible}`
  }
  function buildQuoteSnapshot(projectArg, itemsArg, detailsArg, editingProjectIdArg) {
    return JSON.stringify({
      editingProjectId: editingProjectIdArg || null,
      project: {
        numero: projectArg.numero || '',
        nombreProyecto: projectArg.nombreProyecto || '',
        clienteId: projectArg.clienteId || '',
        cliente: projectArg.cliente || '',
        empresa: projectArg.empresa || '',
        responsable: projectArg.responsable || '',
        telefono: projectArg.telefono || '',
        nit: projectArg.nit || '',
        razonSocial: projectArg.razonSocial || '',
        fecha: projectArg.fecha || '',
        validoHasta: projectArg.validoHasta || '',
        moneda: projectArg.moneda || 'BOB',
        condicionesPago: projectArg.condicionesPago || '',
        tiempoEntrega: projectArg.tiempoEntrega || '',
        observaciones: projectArg.observaciones || '',
        modoCotizacion: projectArg.modoCotizacion || 'total',
        descuentoGeneralPct: Number(projectArg.descuentoGeneralPct || 0),
      },
      items: (itemsArg || []).map((item) => ({
        id: item.id,
        codigo: item.codigo || '',
        nombre: item.nombre || '',
        categoria: item.categoria || '',
        descripcion: item.descripcion || '',
        cantidad: Number(item.cantidad || 1),
        aplicaImpuesto: !!item.aplicaImpuesto,
        tasaImpuesto: Number(item.tasaImpuesto || 0),
        descuentoEspecial: Number(item.descuentoEspecial || 0),
      })),
      details: (detailsArg || []).map((row) => ({
        id: row.id,
        itemId: row.itemId,
        tipo: row.tipo || '',
        descripcion: row.descripcion || '',
        proveedor: row.proveedor || '',
        unidad: row.unidad || '',
        cantidad: Number(row.cantidad || 0),
        costoUnitario: Number(row.costoUnitario || 0),
        tasaUtilidad: Number(row.tasaUtilidad || 0),
        especificacion: row.especificacion || '',
      })),
    })
  }
  const currentQuoteSnapshot = useMemo(
    () => buildQuoteSnapshot(project, items, details, editingProjectId),
    [project, items, details, editingProjectId]
  )
  const hasUnsavedQuoteChanges = savedQuoteSnapshot !== null && currentQuoteSnapshot !== savedQuoteSnapshot
  async function loadResources() {
    if (!supabase) return
    const { data, error } = await supabase
      .from(TABLES.resources)
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      alert('Error leyendo recursos: ' + error.message)
      return
    }
    const mapped = (data || []).map((row) => {
      const meta = resourceMeta(row)
      return {
        id: row.id,
        tipo: meta.type || '-',
        categoria: meta.category || '-',
        subcategoria: meta.subcategory || '',
        espesor: meta.thickness || '',
        tamano: meta.size || '',
        nombre: row.name || '-',
        especificacion: row.specification || '',
        unidad: row.unit || '-',
        proveedor: meta.supplier || '-',
        costo: Number(row.base_cost || 0),
        fechaActualizacion: row.last_price_update || '',
      }
    })
    setResources(mapped)
    markSyncedNow()
  }
  async function loadHistory() {
    if (!supabase) return
    const { data, error } = await supabase
      .from(TABLES.projects)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) {
      alert('Error leyendo historial: ' + error.message)
      return
    }
    const mapped = (data || []).map((row) => {
      const parsedNotes = parseProjectNotes(row.notes)
      return {
        id: row.id,
        numero: row.quote_number || '',
        nombreProyecto: row.project_name || '',
        clienteId: parsedNotes.clienteId || '',
        cliente: parsedNotes.cliente || '',
        empresa: row.company_name || parsedNotes.razonSocial || parsedNotes.cliente || '',
        responsable: row.responsible || '',
        telefono: parsedNotes.telefono || '',
        nit: parsedNotes.nit || '',
        razonSocial: parsedNotes.razonSocial || row.company_name || '',
        fecha: row.date || row.created_at || '',
        moneda: row.currency || 'BOB',
        condicionesPago: row.payment_terms || '',
        tiempoEntrega: row.delivery_time || '',
        observaciones: parsedNotes.observaciones,
        modoCotizacion: parsedNotes.modoCotizacion,
        descuentoGeneralPct: Number(parsedNotes.descuentoGeneralPct || 0),
        itemQuantities: parsedNotes.itemQuantities || {},
        validoHasta: row.valid_until || '',
      }
    })
    setHistory(mapped)
    markSyncedNow()
  }
  async function loadClients() {
    if (!supabase) return
    const { data, error } = await supabase
      .from(TABLES.clients)
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      alert('Error leyendo clientes: ' + error.message)
      return
    }
    setClients((data || []).map((row) => ({
      id: row.id,
      cliente: row.client_name || '',
      responsable: row.responsible || '',
      telefono: row.phone || '',
      nit: row.nit || '',
      razonSocial: row.legal_name || '',
    })))
    markSyncedNow()
  }
  function applyClientInProject(client) {
    setProject((prev) => ({
      ...prev,
      clienteId: client?.id || '',
      cliente: client?.cliente || '',
      responsable: client?.responsable || '',
      telefono: client?.telefono || '',
      nit: client?.nit || '',
      razonSocial: client?.razonSocial || '',
      empresa: client?.razonSocial || client?.cliente || '',
    }))
  }
  useEffect(() => {
    loadResources()
    loadClients()
    loadHistory()
  }, [])
  useEffect(() => {
    if (savedQuoteSnapshot === null) {
      setSavedQuoteSnapshot(buildQuoteSnapshot(project, items, details, editingProjectId))
    }
  }, [savedQuoteSnapshot, project, items, details, editingProjectId])
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current)
    }
  }, [])
  useEffect(() => {
    syncPulseRef.current = window.setInterval(() => setSyncTick((v) => v + 1), 1000)
    return () => {
      if (syncPulseRef.current) window.clearInterval(syncPulseRef.current)
    }
  }, [])
  useEffect(() => {
    if (!supabase) return
    const scheduleRefresh = () => {
      if (liveRefreshTimeoutRef.current) window.clearTimeout(liveRefreshTimeoutRef.current)
      liveRefreshTimeoutRef.current = window.setTimeout(() => {
        Promise.all([loadResources(), loadClients(), loadHistory()]).catch(() => {})
        liveRefreshTimeoutRef.current = null
      }, 450)
    }
    const channel = supabase
      .channel('decorazon-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.resources }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.clients }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.projects }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.items }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.details }, scheduleRefresh)
      .subscribe()
    return () => {
      if (liveRefreshTimeoutRef.current) window.clearTimeout(liveRefreshTimeoutRef.current)
      supabase.removeChannel(channel)
    }
  }, [])
  const detailsByItemId = useMemo(() => {
    return details.reduce((acc, detail) => {
      const key = detail.itemId || ''
      if (!key) return acc
      if (!acc[key]) acc[key] = []
      acc[key].push(detail)
      return acc
    }, {})
  }, [details])
  const detailGroups = useMemo(() => {
    const bucket = {}
    items.forEach((item) => {
      bucket[item.id] = {
        item,
        rows: [],
      }
    })
    details.forEach((row) => {
      if (!bucket[row.itemId]) {
        bucket[row.itemId] = {
          item: items.find((x) => x.id === row.itemId) || null,
          rows: [],
        }
      }
      bucket[row.itemId].rows.push(row)
    })
    const ordered = Object.values(bucket).filter((g) => g.rows.length > 0)
    return ordered.map((group) => {
      const sumCantidad = group.rows.reduce((acc, row) => acc + Number(row.cantidad || 0), 0)
      const sumSubtotal = group.rows.reduce((acc, row) => (
        acc + (Number(row.cantidad || 0) * Number(row.costoUnitario || 0))
      ), 0)
      const sumGanancia = group.rows.reduce((acc, row) => {
        const subtotal = Number(row.cantidad || 0) * Number(row.costoUnitario || 0)
        return acc + (subtotal * (Number(row.tasaUtilidad || 0) / 100))
      }, 0)
      return {
        ...group,
        sums: {
          cantidad: sumCantidad,
          subtotal: sumSubtotal,
          ganancia: sumGanancia,
          total: sumSubtotal + sumGanancia,
        },
      }
    })
  }, [items, details])
  function toggleDetailGroup(itemId) {
    setCollapsedDetailGroups((prev) => ({
      ...prev,
      [itemId]: prev[itemId] === undefined ? false : !prev[itemId],
    }))
  }
  const itemRows = useMemo(() => {
    return items.map((item) => {
      const related = detailsByItemId[item.id] || []
      const cantidadItem = Math.max(1, Number(item.cantidad || 1))
      const costoUnitarioItem = related.reduce((acc, row) => {
        const cantidad = Number(row.cantidad || 0)
        const precioUnitario = Number(row.costoUnitario || 0)
        const utilidadPct = Number(row.tasaUtilidad || 0)
        const subtotal = cantidad * precioUnitario
        const ganancia = subtotal * (utilidadPct / 100)
        return acc + (subtotal + ganancia)
      }, 0)
      const descuentoPct = Math.min(100, Math.max(0, Number(item.descuentoEspecial || 0)))
      const descuentoUnitario = costoUnitarioItem * (descuentoPct / 100)
      const totalUnitarioSinFactura = costoUnitarioItem - descuentoUnitario
      const impuestoUnitario = item.aplicaImpuesto
        ? totalUnitarioSinFactura * (Number(item.tasaImpuesto || 0) / 100)
        : 0
      const precioUnitario = totalUnitarioSinFactura + impuestoUnitario
      const subtotal = totalUnitarioSinFactura * cantidadItem
      const impuesto = impuestoUnitario * cantidadItem
      const totalFacturado = subtotal + impuesto
      return {
        ...item,
        cantidad: cantidadItem,
        descuentoPct,
        descuentoMonto: descuentoUnitario * cantidadItem,
        totalSinFactura: subtotal,
        precioUnitario,
        precioUnitarioFacturado: cantidadItem > 0 ? totalFacturado / cantidadItem : 0,
        precioUnitarioSinImpuesto: costoUnitarioItem,
        subtotal,
        impuesto,
        total: totalFacturado,
      }
    })
  }, [items, detailsByItemId])
  const subtotalProyecto = itemRows.reduce((acc, row) => acc + row.total, 0)
  const descuentoGeneralPct = Number(project.descuentoGeneralPct || 0)
  const descuentoGeneralMonto = subtotalProyecto * (descuentoGeneralPct / 100)
  const totalProyecto = subtotalProyecto - descuentoGeneralMonto
  const companyInfoLine = getCompanyInfoLine(COMPANY)
  function resetCotizacionActual() {
    setProject(createInitialProject())
    setItems([])
    setDetails([])
    setEditingProjectId(null)
    setEditingItemId(null)
    setEditingDetailId(null)
    setItemForm(initialItem)
    setDetailForm(initialDetail)
    setSavedQuoteSnapshot(buildQuoteSnapshot(createInitialProject(), [], [], null))
  }

  async function downloadPdf() {
    try {
      if (!itemRows.length) {
        alert('Primero agrega al menos un producto.')
        return
      }

      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])

      const doc = new jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 10
      const usableWidth = pageWidth - margin * 2

      const greenDark = [17, 106, 113]
      const ink = [20, 33, 61]
      const grayHead = [110, 110, 110]
      const line = [60, 60, 60]
      const white = [255, 255, 255]

      const logoDataUrl = await getLogoDataUrl()
      const incluyeImpuestos = itemRows.some((item) => item.aplicaImpuesto && Number(item.impuesto || 0) > 0)
      const showTotalGeneral = (project.modoCotizacion || 'total') !== 'opciones'

      const topY = 10
      const rightW = 78
      const gap = 10
      const leftW = usableWidth - rightW - gap
      const rightX = margin + leftW + gap

      if (logoDataUrl) {
        try {
          const props = doc.getImageProperties(logoDataUrl)
          const maxW = 42
          const maxH = 32
          const ratio = Math.min(maxW / props.width, maxH / props.height)
          const imgW = props.width * ratio
          const imgH = props.height * ratio
          doc.addImage(logoDataUrl, 'PNG', margin + 2, topY + 4, imgW, imgH)
        } catch {}
      }

      const textStartX = margin + 46
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...greenDark)
      doc.setFontSize(31)
      doc.text(COMPANY.name || 'DecoraZon', textStartX, topY + 16)

      doc.setTextColor(...grayHead)
    doc.setFontSize(14)
      doc.text(COMPANY_RUBRO, textStartX, topY + 25)

      doc.setFillColor(...greenDark)
    doc.setDrawColor(...line)
    doc.rect(rightX, topY + 2, rightW, 22, 'FD')
    doc.setTextColor(...white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(23)
      doc.text('COTIZACION', rightX + rightW / 2, topY + 16, { align: 'center' })

      doc.setFillColor(...grayHead)
    doc.rect(rightX, topY + 36, rightW, 14, 'FD')
    doc.setTextColor(...white)
    doc.setFontSize(11)
      doc.text(`No.: ${safeText(project.numero) || '-'}`, rightX + rightW - 8, topY + 45, { align: 'right' })

      doc.setFillColor(...grayHead)
    doc.rect(rightX, topY + 54, rightW, 14, 'FD')
    doc.text(`Fecha:`, rightX + 8, topY + 63)
      doc.text(`${formatDateDisplay(project.fecha)}`, rightX + rightW - 8, topY + 63, { align: 'right' })

      const infoBoxY = topY + 42
      const infoBoxH = 34
      doc.setDrawColor(...line)
      doc.setFillColor(...white)
      doc.rect(margin, infoBoxY, leftW - 34, infoBoxH, 'FD')
      doc.setTextColor(...ink)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10.5)

      const leftLabelX = margin + 5
      const leftValueX = margin + 28
      const rightLabelX = margin + 90
      const rightValueX = margin + 124
      const row1Y = infoBoxY + 8
      const row2Y = infoBoxY + 16
      const row3Y = infoBoxY + 24
      const row4Y = infoBoxY + 32

      doc.text('Proyecto:', leftLabelX, row1Y)
      doc.text('Empresa:', leftLabelX, row2Y)
      doc.text('Cliente:', leftLabelX, row3Y)
      doc.text('NIT:', leftLabelX, row4Y)
      doc.text('Responsable:', rightLabelX, row1Y)
      doc.text('Teléfono:', rightLabelX, row2Y)

      doc.setFont('helvetica', 'normal')
      doc.text(safeText(project.nombreProyecto) || '-', leftValueX, row1Y)
      doc.text(safeText(project.razonSocial || project.empresa || project.cliente) || '-', leftValueX, row2Y)
      doc.text(safeText(project.cliente) || '-', leftValueX, row3Y)
      doc.text(safeText(project.nit) || '-', leftValueX, row4Y)
      doc.text(safeText(project.responsable) || '-', rightValueX, row1Y)
      doc.text(safeText(project.telefono) || '-', rightValueX, row2Y)

      const tableStartY = 88
      const head = [['COD.', 'ITEM', 'DESCRIPCION', 'CANT.', 'P. UNITARIO', 'TOTAL']]

      const body = itemRows.map((item, index) => {
      const row = [
        safeText(item.codigo) || String(index + 1).padStart(3, '0'),
        safeText(item.nombre) || '-',
        safeText(item.descripcion) || '-',
        Number(item.cantidad || 0).toLocaleString('es-BO'),
        formatMoneyPdf(item.precioUnitario || 0, project.moneda),
        formatMoneyPdf(item.total || 0, project.moneda),
      ]
      return row
    })

      const columnStyles = {
      0: { cellWidth: 18, halign: 'center' },
      1: { cellWidth: 38 },
      2: { cellWidth: 132 },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: 32, halign: 'right' },
    }

      autoTable(doc, {
      startY: tableStartY,
      head,
      body,
      theme: 'grid',
      margin: { left: margin, right: margin, top: 10, bottom: 24 },
      styles: {
        font: 'helvetica',
        fontSize: 8.2,
        cellPadding: 2.2,
        textColor: ink,
        lineColor: line,
        lineWidth: 0.25,
        valign: 'middle',
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: grayHead,
        textColor: white,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        lineColor: line,
        lineWidth: 0.25,
        minCellHeight: 10,
      },
      bodyStyles: {
        minCellHeight: 10,
      },
      columnStyles,
    })

      const tableEndY = doc.lastAutoTable?.finalY || tableStartY + 60

      if (showTotalGeneral) {
      const totalLabelY = tableEndY
      const totalX = pageWidth - margin - 84
      doc.setFillColor(...greenDark)
      doc.setDrawColor(...line)
      doc.rect(totalX, totalLabelY, 46, 12, 'FD')
      doc.setTextColor(...white)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('TOTAL GENERAL', totalX + 23, totalLabelY + 8, { align: 'center' })

      doc.setFillColor(...white)
      doc.setTextColor(...ink)
      doc.rect(totalX + 46, totalLabelY, 38, 12, 'FD')
      doc.setFontSize(10)
      doc.text(formatMoneyPdf(totalProyecto, project.moneda), totalX + 80, totalLabelY + 8, { align: 'right' })
    }

      const boxGap = 5
      const thirdW = (usableWidth - boxGap * 2) / 3
      const footerBarH = 10
      let bottomY = tableEndY + (showTotalGeneral ? 14 : 10)

      if (bottomY + 24 + footerBarH + 6 > pageHeight) {
      doc.addPage('a4', 'l')
      bottomY = 14
    }

      doc.setFillColor(...white)
    doc.setDrawColor(...line)
    doc.rect(margin, bottomY, thirdW, 24, 'FD')
    doc.rect(margin + thirdW + boxGap, bottomY, thirdW, 24, 'FD')
    doc.rect(margin + (thirdW + boxGap) * 2, bottomY, thirdW, 24, 'FD')

    doc.setTextColor(...ink)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Condiciones', margin + 6, bottomY + 7)
    doc.text('Observaciones', margin + thirdW + boxGap + 6, bottomY + 7)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.4)
      const condLines = [
      `Forma de pago: ${safeText(project.condicionesPago) || '-'}`,
      `Tiempo de entrega: ${safeText(project.tiempoEntrega) || '-'}`,
      incluyeImpuestos ? 'La cotización incluye impuestos de ley.' : 'La cotización no incluye impuestos de ley.',
    ]
      const condText = doc.splitTextToSize(condLines.join('\n'), thirdW - 12)
      doc.text(condText, margin + 6, bottomY + 13)

      const obsLines = [safeText(project.observaciones) || '-']
    if (safeText(project.validoHasta)) {
      obsLines.push(`Validez de la oferta: ${formatDateDisplay(project.validoHasta)}`)
    }
    if (!showTotalGeneral) {
      obsLines.push('El cliente podrá elegir una alternativa.')
    }
      const obsText = doc.splitTextToSize(obsLines.join('\n'), thirdW - 12)
      doc.text(obsText, margin + thirdW + boxGap + 6, bottomY + 13)

      const sigX = margin + (thirdW + boxGap) * 2
    doc.setFont('helvetica', 'normal')
    doc.line(sigX + 12, bottomY + 17, sigX + thirdW - 12, bottomY + 17)
    doc.setFont('helvetica', 'bold')
    doc.text('Tina Rodriguez', sigX + thirdW / 2, bottomY + 22, { align: 'center' })

      doc.setFillColor(...greenDark)
    doc.rect(0, pageHeight - 10, pageWidth, 10, 'F')
    doc.setTextColor(...white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.4)
      const footerText = [
      safeText(COMPANY.address),
      safeText((COMPANY.phones || []).join(' / ')),
      safeText(COMPANY.email),
      'La Paz - Bolivia',
    ].filter(Boolean).join(' · ')
      doc.text(footerText, pageWidth / 2, pageHeight - 3.4, { align: 'center' })

      const safeNumber = (safeText(project.numero) || 'cotizacion').replace(/[^\w\-]+/g, '_')
      doc.save(`${safeNumber}.pdf`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido al generar PDF.'
      console.error('Error generando PDF:', error)
      alert(`No se pudo generar el PDF: ${message}`)
    }
  }
  async function saveResource(e) {
    e.preventDefault()
    if (!supabase) return
    if (!resourceForm.nombre.trim()) {
      alert('Escribe un nombre para el recurso.')
      return
    }
    setSavingResource(true)
    const payload = {
      name: resourceForm.nombre.trim(),
      specification: resourceForm.especificacion.trim(),
      unit: resourceForm.unidad.trim() || 'unidad',
      size_or_format: '',
      base_cost: Number(resourceForm.costo || 0),
      currency: 'BOB',
      last_price_update: resourceForm.fechaActualizacion || new Date().toISOString().slice(0, 10),
      notes: JSON.stringify({
        type: resourceForm.tipo,
        category: resourceForm.categoria,
        subcategory: resourceForm.subcategoria,
        thickness: resourceForm.espesor,
        size: resourceForm.tamano,
        supplier: resourceForm.proveedor,
      }),
      is_active: true,
    }
    let result
    if (editingResourceId) {
      result = await supabase.from(TABLES.resources).update(payload).eq('id', editingResourceId)
    } else {
      result = await supabase.from(TABLES.resources).insert([payload])
    }
    setSavingResource(false)
    if (result.error) {
      alert('Error al guardar recurso: ' + result.error.message)
      return
    }
    setEditingResourceId(null)
    setResourceForm(initialResource)
    await loadResources()
    showToast(editingResourceId ? 'Recurso actualizado.' : 'Recurso guardado.')
  }
  async function saveClient(e) {
    e.preventDefault()
    if (!supabase) return
    if (!clientForm.cliente.trim()) {
      alert('Escribe el nombre del cliente.')
      return
    }
    setSavingClient(true)
    const payload = {
      client_name: clientForm.cliente.trim(),
      responsible: clientForm.responsable.trim(),
      phone: clientForm.telefono.trim(),
      nit: clientForm.nit.trim(),
      legal_name: clientForm.razonSocial.trim(),
    }
    let result
    if (editingClientId) {
      result = await supabase.from(TABLES.clients).update(payload).eq('id', editingClientId)
    } else {
      result = await supabase.from(TABLES.clients).insert([payload])
    }
    setSavingClient(false)
    if (result.error) {
      alert('Error al guardar cliente: ' + result.error.message)
      return
    }
    setEditingClientId(null)
    setClientForm(initialClient)
    await loadClients()
  }
  function editClient(client) {
    setActiveTab('clientes')
    setEditingClientId(client.id)
    setClientForm({
      cliente: client.cliente || '',
      responsable: client.responsable || '',
      telefono: client.telefono || '',
      nit: client.nit || '',
      razonSocial: client.razonSocial || '',
    })
  }
  async function deleteClient(id) {
    if (!supabase || !confirm('Eliminar este cliente?')) return
    const { error } = await supabase.from(TABLES.clients).delete().eq('id', id)
    if (error) {
      alert('Error eliminando cliente: ' + error.message)
      return
    }
    if (editingClientId === id) {
      setEditingClientId(null)
      setClientForm(initialClient)
    }
    setProject((prev) => (prev.clienteId === id ? {
      ...prev,
      clienteId: '',
      cliente: '',
      responsable: '',
      telefono: '',
      nit: '',
      razonSocial: '',
      empresa: '',
    } : prev))
    await loadClients()
  }
  async function deleteResource(id) {
    if (!supabase || !confirm('¿Eliminar este recurso?')) return
    const { error } = await supabase.from(TABLES.resources).delete().eq('id', id)
    if (error) {
      alert('Error eliminando recurso: ' + error.message)
      return
    }
    if (editingResourceId === id) {
      setEditingResourceId(null)
      setResourceForm(initialResource)
    }
    await loadResources()
  }
  async function updateResourcesMetadata(matcher, updater) {
    if (!supabase) return false
    const { data, error } = await supabase.from(TABLES.resources).select('id, notes')
    if (error) {
      alert('Error leyendo recursos para actualizar: ' + error.message)
      return false
    }
    const targets = (data || []).filter((row) => matcher(resourceMeta(row)))
    if (!targets.length) return true
    const updates = await Promise.all(
      targets.map(async (row) => {
        const currentMeta = resourceMeta(row)
        const nextMeta = updater({ ...currentMeta })
        const { error: updateError } = await supabase
          .from(TABLES.resources)
          .update({ notes: JSON.stringify(nextMeta) })
          .eq('id', row.id)
        return updateError
      })
    )
    const firstError = updates.find(Boolean)
    if (firstError) {
      alert('Error actualizando recursos: ' + firstError.message)
      return false
    }
    return true
  }
  async function renameCategoryEverywhere(type, oldCategory, newCategory) {
    if (!supabase) return
    const ok = await updateResourcesMetadata(
      (meta) => String(meta.type || '') === String(type || '') && String(meta.category || '') === String(oldCategory || ''),
      (meta) => ({ ...meta, category: newCategory })
    )
    if (ok) await loadResources()
  }
  async function deleteCategoryEverywhere(type, category) {
    if (!supabase) return
    const ok = await updateResourcesMetadata(
      (meta) => String(meta.type || '') === String(type || '') && String(meta.category || '') === String(category || ''),
      (meta) => ({ ...meta, category: '', subcategory: '' })
    )
    if (ok) await loadResources()
  }
  async function renameSubcategoryEverywhere(type, category, oldSubcategory, newSubcategory) {
    if (!supabase) return
    const ok = await updateResourcesMetadata(
      (meta) =>
        String(meta.type || '') === String(type || '') &&
        String(meta.category || '') === String(category || '') &&
        String(meta.subcategory || '') === String(oldSubcategory || ''),
      (meta) => ({ ...meta, subcategory: newSubcategory })
    )
    if (ok) await loadResources()
  }
  async function deleteSubcategoryEverywhere(type, category, subcategory) {
    if (!supabase) return
    const ok = await updateResourcesMetadata(
      (meta) =>
        String(meta.type || '') === String(type || '') &&
        String(meta.category || '') === String(category || '') &&
        String(meta.subcategory || '') === String(subcategory || ''),
      (meta) => ({ ...meta, subcategory: '' })
    )
    if (ok) await loadResources()
  }
  function editResource(resource) {
    setActiveTab('recursos')
    setEditingResourceId(resource.id)
    setResourceForm({
      tipo: resource.tipo || 'Material',
      categoria: resource.categoria || '',
      subcategoria: resource.subcategoria || '',
      espesor: resource.espesor || '',
      tamano: resource.tamano || '',
      nombre: resource.nombre || '',
      especificacion: resource.especificacion || '',
      unidad: resource.unidad || 'unidad',
      proveedor: resource.proveedor || '',
      costo: Number(resource.costo || 0),
      fechaActualizacion: resource.fechaActualizacion || new Date().toISOString().slice(0, 10),
    })
  }
  function addResourceToDetail(resource) {
    setActiveTab('subitems')
    setDetailForm((prev) => ({
      ...prev,
      tipo: resource.tipo || 'Material',
      descripcion: resource.nombre || '',
      proveedor: resource.proveedor || '',
      unidad: resource.unidad || 'unidad',
      costoUnitario: Number(resource.costo || 0),
      especificacion: resource.especificacion || '',
    }))
  }
  function saveItemLocal(e) {
    e.preventDefault()
    if (!itemForm.nombre.trim()) {
      alert('Escribe un nombre para el producto.')
      return
    }
    if (editingItemId) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === editingItemId
            ? {
                ...item,
                codigo: itemForm.codigo.trim() || item.codigo,
                nombre: itemForm.nombre.trim(),
                categoria: itemForm.categoria.trim() || 'General',
                descripcion: itemForm.descripcion.trim(),
                cantidad: Math.max(1, Number(itemForm.cantidad || 1)),
                aplicaImpuesto: itemForm.aplicaImpuesto,
                tasaImpuesto: Number(itemForm.tasaImpuesto || 0),
                descuentoEspecial: Number(itemForm.descuentoEspecial || 0),
              }
            : item
        )
      )
      setEditingItemId(null)
    } else {
      setItems((prev) => [
        ...prev,
        {
          id: uid(),
          codigo: itemForm.codigo.trim() || `ITEM ${String(prev.length + 1).padStart(3, '0')}`,
          nombre: itemForm.nombre.trim(),
          categoria: itemForm.categoria.trim() || 'General',
          descripcion: itemForm.descripcion.trim(),
          cantidad: Math.max(1, Number(itemForm.cantidad || 1)),
          aplicaImpuesto: itemForm.aplicaImpuesto,
          tasaImpuesto: Number(itemForm.tasaImpuesto || 0),
          descuentoEspecial: Number(itemForm.descuentoEspecial || 0),
        },
      ])
    }
    setItemForm(initialItem)
  }
  function editItem(item) {
    setActiveTab('items')
    setEditingItemId(item.id)
    setItemForm({
      codigo: item.codigo,
      nombre: item.nombre,
      categoria: item.categoria,
      descripcion: item.descripcion,
      cantidad: Math.max(1, Number(item.cantidad || 1)),
      aplicaImpuesto: item.aplicaImpuesto,
      tasaImpuesto: item.tasaImpuesto,
      descuentoEspecial: Number(item.descuentoEspecial || 0),
    })
  }
  function deleteItem(id) {
    if (!confirm('¿Eliminar este producto y sus detalles?')) return
    setItems((prev) => prev.filter((item) => item.id !== id))
    setDetails((prev) => prev.filter((d) => d.itemId !== id))
    if (editingItemId === id) {
      setEditingItemId(null)
      setItemForm(initialItem)
    }
  }
  function duplicateItem(item) {
    const newId = uid()
    const related = details.filter((d) => d.itemId === item.id)
    setItems((prev) => [...prev, { ...item, id: newId, codigo: `${item.codigo}-COPIA` }])
    setDetails((prev) => [...prev, ...related.map((d) => ({ ...d, id: uid(), itemId: newId }))])
  }
  function saveDetailLocal(e) {
    e.preventDefault()
    if (!detailForm.itemId) {
      alert('Primero selecciona un producto.')
      return
    }
    if (!detailForm.descripcion.trim()) {
      alert('Escribe la descripción del detalle.')
      return
    }
    const payload = {
      itemId: detailForm.itemId,
      tipo: detailForm.tipo,
      descripcion: detailForm.descripcion.trim(),
      proveedor: detailForm.proveedor.trim(),
      unidad: detailForm.unidad.trim() || 'unidad',
      cantidad: Number(detailForm.cantidad || 0),
      costoUnitario: Number(detailForm.costoUnitario || 0),
      tasaUtilidad: Number(detailForm.tasaUtilidad || 0),
      especificacion: detailForm.especificacion.trim(),
    }
    if (editingDetailId) {
      setDetails((prev) => prev.map((d) => (d.id === editingDetailId ? { ...d, ...payload } : d)))
      setEditingDetailId(null)
    } else {
      setDetails((prev) => [...prev, { id: uid(), ...payload }])
    }
    setDetailForm({ ...initialDetail, itemId: detailForm.itemId })
  }
  function editDetail(detail) {
    setActiveTab('subitems')
    setEditingDetailId(detail.id)
    setDetailForm({
      itemId: detail.itemId,
      tipo: detail.tipo,
      descripcion: detail.descripcion,
      proveedor: detail.proveedor,
      unidad: detail.unidad,
      cantidad: detail.cantidad,
      costoUnitario: detail.costoUnitario,
      tasaUtilidad: detail.tasaUtilidad,
      especificacion: detail.especificacion,
    })
  }
  function deleteDetail(id) {
    if (!confirm('¿Eliminar este detalle?')) return
    setDetails((prev) => prev.filter((d) => d.id !== id))
    if (editingDetailId === id) {
      setEditingDetailId(null)
      setDetailForm(initialDetail)
    }
  }
  async function saveProjectCloud(options = {}) {
    const { allowWithoutItems = false, successMessage } = options
    if (!supabase) return
    const hasAnyKeyData = [
      project.nombreProyecto,
      project.cliente,
      project.responsable,
      project.telefono,
      project.nit,
      project.razonSocial,
      project.observaciones,
    ].some((value) => String(value || '').trim().length > 0)
    if (!hasAnyKeyData) {
      alert('Completa al menos un dato del proyecto para guardarlo.')
      return
    }
    if (!allowWithoutItems && !items.length) {
      alert('Agrega al menos un producto.')
      return
    }
    setSavingProject(true)
    let projectId = editingProjectId
    if (editingProjectId) {
      const { error } = await supabase
        .from(TABLES.projects)
        .update({
          quote_number: project.numero.trim() || `COT-${Date.now()}`,
          project_name: project.nombreProyecto.trim() || 'Cotización sin título',
          company_name: project.razonSocial.trim() || project.empresa.trim() || project.cliente.trim(),
          responsible: project.responsable.trim(),
          date: project.fecha,
          valid_until: project.validoHasta || null,
          currency: project.moneda,
          payment_terms: project.condicionesPago,
          delivery_time: project.tiempoEntrega,
          notes: serializeProjectNotes(project, items),
        })
        .eq('id', editingProjectId)
      if (error) {
        setSavingProject(false)
        alert('Error al guardar proyecto: ' + error.message)
        return
      }
      const oldItems = await supabase.from(TABLES.items).select('id').eq('project_id', editingProjectId)
      if (oldItems.data?.length) {
        const oldIds = oldItems.data.map((r) => r.id)
        await supabase.from(TABLES.details).delete().in('project_item_id', oldIds)
      }
      await supabase.from(TABLES.items).delete().eq('project_id', editingProjectId)
    } else {
      const insertedProject = await supabase
        .from(TABLES.projects)
        .insert([{
          quote_number: project.numero.trim() || `COT-${Date.now()}`,
          project_name: project.nombreProyecto.trim() || 'Cotización sin título',
          company_name: project.razonSocial.trim() || project.empresa.trim() || project.cliente.trim(),
          responsible: project.responsable.trim(),
          date: project.fecha,
          valid_until: project.validoHasta || null,
          currency: project.moneda,
          payment_terms: project.condicionesPago,
          delivery_time: project.tiempoEntrega,
          notes: serializeProjectNotes(project, items),
        }])
        .select()
        .single()
      if (insertedProject.error) {
        setSavingProject(false)
        alert('Error al guardar proyecto: ' + insertedProject.error.message)
        return
      }
      projectId = insertedProject.data.id
      setEditingProjectId(projectId)
    }
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const insertedItem = await supabase
        .from(TABLES.items)
        .insert([{
          project_id: projectId,
          code: item.codigo,
          name: item.nombre,
          category: item.categoria,
          description: item.descripcion,
          apply_tax: item.aplicaImpuesto,
          tax_rate: item.tasaImpuesto,
          discount_pct: Number(item.descuentoEspecial || 0),
          position: i + 1,
        }])
        .select()
        .single()
      if (insertedItem.error) {
        setSavingProject(false)
        alert('Error al guardar producto: ' + insertedItem.error.message)
        return
      }
      const dbItemId = insertedItem.data.id
      const related = details.filter((d) => d.itemId === item.id)
      for (let j = 0; j < related.length; j++) {
        const row = related[j]
        const insertedDetail = await supabase.from(TABLES.details).insert([{
          project_item_id: dbItemId,
          type: row.tipo,
          description: row.descripcion,
          supplier_name: row.proveedor,
          unit: row.unidad,
          quantity: row.cantidad,
          unit_cost: row.costoUnitario,
          margin_rate: row.tasaUtilidad,
          specification: row.especificacion,
          position: j + 1,
        }])
        if (insertedDetail.error) {
          setSavingProject(false)
          alert('Error al guardar detalle: ' + insertedDetail.error.message)
          return
        }
      }
    }
    setSavingProject(false)
    await loadHistory()
    setSavedQuoteSnapshot(buildQuoteSnapshot(project, items, details, projectId))
    showToast(successMessage || (editingProjectId ? 'Cotización actualizada.' : 'Cotización guardada.'))
  }
  async function saveProjectDraft() {
    await saveProjectCloud({
      allowWithoutItems: true,
      successMessage: editingProjectId ? 'Borrador actualizado.' : 'Borrador guardado.',
    })
  }
  async function openProjectFromHistory(row) {
    if (!supabase) return
    const [itemsRes, detailsRes] = await Promise.all([
      supabase.from(TABLES.items).select('*').eq('project_id', row.id).order('position', { ascending: true }),
      supabase.from(TABLES.details).select('*, project_items!inner(project_id)').eq('project_items.project_id', row.id).order('position', { ascending: true }),
    ])
    if (itemsRes.error || detailsRes.error) {
      alert('Error abriendo cotización.')
      return
    }
    setEditingProjectId(row.id)
    setProject({
      numero: row.numero || '',
      nombreProyecto: row.nombreProyecto || '',
      clienteId: row.clienteId || '',
      cliente: row.cliente || '',
      empresa: row.empresa || '',
      responsable: row.responsable || '',
      telefono: row.telefono || '',
      nit: row.nit || '',
      razonSocial: row.razonSocial || row.empresa || '',
      fecha: String(row.fecha || '').slice(0, 10),
      validoHasta: row.validoHasta || '',
      moneda: row.moneda || 'BOB',
      condicionesPago: row.condicionesPago || '',
      tiempoEntrega: row.tiempoEntrega || '',
      observaciones: row.observaciones || '',
      modoCotizacion: row.modoCotizacion === 'opciones' ? 'opciones' : 'total',
      descuentoGeneralPct: Number(row.descuentoGeneralPct || 0),
    })
    const itemQuantities = row.itemQuantities && typeof row.itemQuantities === 'object'
      ? row.itemQuantities
      : {}
    setItems((itemsRes.data || []).map((i) => ({
      id: i.id,
      codigo: i.code || '',
      nombre: i.name || '',
      categoria: i.category || '',
      descripcion: i.description || '',
      cantidad: Math.max(1, Number(itemQuantities[`${String(i.code || '').trim()}||${String(i.name || '').trim()}`] || 1)),
      aplicaImpuesto: !!i.apply_tax,
      tasaImpuesto: Number(i.tax_rate || 0),
      descuentoEspecial: Number(i.discount_pct || 0),
    })))
    setDetails((detailsRes.data || []).map((d) => ({
      id: d.id,
      itemId: d.project_item_id,
      tipo: d.type || 'Material',
      descripcion: d.description || '',
      proveedor: d.supplier_name || '',
      unidad: d.unit || 'unidad',
      cantidad: Number(d.quantity || 0),
      costoUnitario: Number(d.unit_cost || 0),
      tasaUtilidad: Number(d.margin_rate || 0),
      especificacion: d.specification || '',
    })))
    setSavedQuoteSnapshot(buildQuoteSnapshot({
      numero: row.numero || '',
      nombreProyecto: row.nombreProyecto || '',
      clienteId: row.clienteId || '',
      cliente: row.cliente || '',
      empresa: row.empresa || '',
      responsable: row.responsable || '',
      telefono: row.telefono || '',
      nit: row.nit || '',
      razonSocial: row.razonSocial || row.empresa || '',
      fecha: String(row.fecha || '').slice(0, 10),
      validoHasta: row.validoHasta || '',
      moneda: row.moneda || 'BOB',
      condicionesPago: row.condicionesPago || '',
      tiempoEntrega: row.tiempoEntrega || '',
      observaciones: row.observaciones || '',
      modoCotizacion: row.modoCotizacion === 'opciones' ? 'opciones' : 'total',
      descuentoGeneralPct: Number(row.descuentoGeneralPct || 0),
    }, itemsRes.data || [], (detailsRes.data || []).map((d) => ({
      id: d.id,
      itemId: d.project_item_id,
      tipo: d.type || 'Material',
      descripcion: d.description || '',
      proveedor: d.supplier_name || '',
      unidad: d.unit || 'unidad',
      cantidad: Number(d.quantity || 0),
      costoUnitario: Number(d.unit_cost || 0),
      tasaUtilidad: Number(d.margin_rate || 0),
      especificacion: d.specification || '',
    })), row.id))
    setActiveTab('cotizacion')
  }
  async function duplicateProjectFromHistory(row) {
    await openProjectFromHistory(row)
    setEditingProjectId(null)
    setProject((prev) => ({ ...prev, numero: prev.numero ? `${prev.numero}-COPIA` : '' }))
    alert('Cotización cargada como copia.')
  }
  async function deleteProjectFromHistory(id) {
    if (!supabase || !confirm('¿Eliminar esta cotización?')) return
    const oldItems = await supabase.from(TABLES.items).select('id').eq('project_id', id)
    if (oldItems.data?.length) {
      const oldIds = oldItems.data.map((r) => r.id)
      await supabase.from(TABLES.details).delete().in('project_item_id', oldIds)
    }
    await supabase.from(TABLES.items).delete().eq('project_id', id)
    const { error } = await supabase.from(TABLES.projects).delete().eq('id', id)
    if (error) {
      alert('Error eliminando cotización: ' + error.message)
      return
    }
    if (editingProjectId === id) resetCotizacionActual()
    await loadHistory()
  }
  async function fetchAllRows(table) {
    if (!supabase) return []
    const batchSize = 1000
    let from = 0
    let rows = []
    while (true) {
      const to = from + batchSize - 1
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .range(from, to)
      if (error) throw new Error(`Error leyendo ${table}: ${error.message}`)
      const chunk = data || []
      rows = rows.concat(chunk)
      if (chunk.length < batchSize) break
      from += batchSize
    }
    return rows
  }
  function sanitizeRows(rows) {
    return (rows || []).map((row) => {
      const clean = {}
      Object.entries(row || {}).forEach(([key, value]) => {
        if (value === null || value === undefined) {
          clean[key] = ''
          return
        }
        if (typeof value === 'object') {
          clean[key] = JSON.stringify(value)
          return
        }
        clean[key] = value
      })
      return clean
    })
  }
  function parseSheetRows(rows) {
    return (rows || []).map((row) => {
      const clean = {}
      Object.entries(row || {}).forEach(([key, value]) => {
        if (value === '') {
          clean[key] = null
          return
        }
        if (typeof value === 'string') {
          const trimmed = value.trim()
          if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try {
              clean[key] = JSON.parse(trimmed)
              return
            } catch {}
          }
        }
        clean[key] = value
      })
      return clean
    })
  }
  async function exportBackupExcel() {
    if (!supabase || backupBusy || restoreBusy) return
    setBackupBusy(true)
    try {
      const [clientsRows, projectsRows, itemsRows, detailsRows, resourcesRows] = await Promise.all([
        fetchAllRows(TABLES.clients),
        fetchAllRows(TABLES.projects),
        fetchAllRows(TABLES.items),
        fetchAllRows(TABLES.details),
        fetchAllRows(TABLES.resources),
      ])
      const { utils, writeFileXLSX } = await import('xlsx')
      const wb = utils.book_new()
      utils.book_append_sheet(wb, utils.json_to_sheet(sanitizeRows(clientsRows)), 'clientes')
      utils.book_append_sheet(wb, utils.json_to_sheet(sanitizeRows(projectsRows)), 'cotizaciones')
      utils.book_append_sheet(wb, utils.json_to_sheet(sanitizeRows(itemsRows)), 'productos')
      utils.book_append_sheet(wb, utils.json_to_sheet(sanitizeRows(detailsRows)), 'detalles')
      utils.book_append_sheet(wb, utils.json_to_sheet(sanitizeRows(resourcesRows)), 'recursos')
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      writeFileXLSX(wb, `backup-decorazon-${stamp}.xlsx`)
      showToast('Copia de seguridad descargada.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido exportando copia.'
      alert(`No se pudo exportar la copia: ${message}`)
    } finally {
      setBackupBusy(false)
    }
  }
  function triggerBackupRestore() {
    if (backupBusy || restoreBusy || addBusy) return
    backupImportModeRef.current = 'restore'
    backupInputRef.current?.click()
  }
  function triggerBackupAdd() {
    if (backupBusy || restoreBusy || addBusy) return
    backupImportModeRef.current = 'add'
    backupInputRef.current?.click()
  }
  async function restoreBackupExcel(file, mode = 'restore') {
    if (!supabase || !file || restoreBusy || backupBusy || addBusy) return
    const isRestore = mode === 'restore'
    const userConfirmed = confirm(
      isRestore
        ? 'Esta acción restaurará clientes, cotizaciones, productos, detalles y recursos desde el archivo y reemplazará los datos actuales. ¿Deseas continuar?'
        : 'Esta acción añadirá datos desde el archivo sin borrar lo actual. Si algún registro tiene el mismo ID, se actualizará. ¿Deseas continuar?'
    )
    if (!userConfirmed) return
    if (isRestore) setRestoreBusy(true)
    else setAddBusy(true)
    try {
      const { read, utils } = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const workbook = read(buffer, { type: 'array' })
      const requiredSheets = ['clientes', 'cotizaciones', 'productos', 'detalles', 'recursos']
      const missing = requiredSheets.filter((name) => !workbook.SheetNames.includes(name))
      if (missing.length) {
        alert(`El archivo no es válido. Faltan hojas: ${missing.join(', ')}`)
        return
      }
      const parsed = {
        clients: parseSheetRows(utils.sheet_to_json(workbook.Sheets.clientes, { defval: '' })),
        projects: parseSheetRows(utils.sheet_to_json(workbook.Sheets.cotizaciones, { defval: '' })),
        items: parseSheetRows(utils.sheet_to_json(workbook.Sheets.productos, { defval: '' })),
        details: parseSheetRows(utils.sheet_to_json(workbook.Sheets.detalles, { defval: '' })),
        resources: parseSheetRows(utils.sheet_to_json(workbook.Sheets.recursos, { defval: '' })),
      }
      const upsertRows = async (table, rows, label) => {
        if (!rows.length) return
        const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' })
        if (error) throw new Error(`Error añadiendo ${label}: ${error.message}`)
      }
      if (isRestore) {
        const clearTable = async (table, label) => {
          const { error } = await supabase.from(table).delete().not('id', 'is', null)
          if (error) throw new Error(`Error limpiando ${label}: ${error.message}`)
        }
        await clearTable(TABLES.details, 'detalles')
        await clearTable(TABLES.items, 'productos')
        await clearTable(TABLES.projects, 'cotizaciones')
        await clearTable(TABLES.clients, 'clientes')
        await clearTable(TABLES.resources, 'recursos')
        if (parsed.clients.length) {
          const { error } = await supabase.from(TABLES.clients).insert(parsed.clients)
          if (error) throw new Error(`Error restaurando clientes: ${error.message}`)
        }
        if (parsed.projects.length) {
          const { error } = await supabase.from(TABLES.projects).insert(parsed.projects)
          if (error) throw new Error(`Error restaurando cotizaciones: ${error.message}`)
        }
        if (parsed.items.length) {
          const { error } = await supabase.from(TABLES.items).insert(parsed.items)
          if (error) throw new Error(`Error restaurando productos: ${error.message}`)
        }
        if (parsed.details.length) {
          const { error } = await supabase.from(TABLES.details).insert(parsed.details)
          if (error) throw new Error(`Error restaurando detalles: ${error.message}`)
        }
        if (parsed.resources.length) {
          const { error } = await supabase.from(TABLES.resources).insert(parsed.resources)
          if (error) throw new Error(`Error restaurando recursos: ${error.message}`)
        }
      } else {
        await upsertRows(TABLES.clients, parsed.clients, 'clientes')
        await upsertRows(TABLES.projects, parsed.projects, 'cotizaciones')
        await upsertRows(TABLES.items, parsed.items, 'productos')
        await upsertRows(TABLES.details, parsed.details, 'detalles')
        await upsertRows(TABLES.resources, parsed.resources, 'recursos')
      }
      resetCotizacionActual()
      await Promise.all([loadResources(), loadClients(), loadHistory()])
      showToast(isRestore ? 'Copia restaurada correctamente.' : 'Backup añadido correctamente.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido restaurando copia.'
      alert(isRestore ? `No se pudo restaurar la copia: ${message}` : `No se pudo añadir el backup: ${message}`)
    } finally {
      if (isRestore) setRestoreBusy(false)
      else setAddBusy(false)
      if (backupInputRef.current) backupInputRef.current.value = ''
    }
  }
  const showDashboardHeader = activeTab !== 'cotizacion'
  function handleTabChange(nextTab) {
    if (nextTab === activeTab) return
    setActiveTab(nextTab)
  }
  return (
    <main className="page grid cotizador-theme" style={{ gap: 20 }}>
      {toastMessage ? <div className="toast-notice">{toastMessage}</div> : null}
      <input
        ref={backupInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) restoreBackupExcel(file, backupImportModeRef.current)
        }}
      />
      {showDashboardHeader && (
        <DashboardHero rubro={COMPANY_RUBRO} infoLine={companyInfoLine} />
      )}
      <TabNav tabs={APP_TABS} activeTab={activeTab} onTabChange={handleTabChange} />
      <div className="sync-indicator" key={syncTick}>
        <span>{getSyncText()}</span>
        <span className="sync-project">{getEditingProjectText()}</span>
      </div>
      {activeTab === 'inicio' && (
        <HomeSection
          resources={resources}
          clients={clients}
          history={history}
          details={details}
          itemRows={itemRows}
          totalProyecto={totalProyecto}
          money={(value) => money(value, project.moneda)}
        />
      )}
      {activeTab === 'proyecto' && (
        <ProjectSection
          project={project}
          setProject={setProject}
          clients={clients}
          applyClientInProject={applyClientInProject}
          resetCotizacionActual={resetCotizacionActual}
          onSaveDraft={saveProjectDraft}
          savingProject={savingProject}
        />
      )}
      {activeTab === 'clientes' && (
        <div className="grid" style={{ gap: 16 }}>
          <section className="card compact-card">
            <h2>{editingClientId ? 'Editar cliente' : 'Registrar cliente'}</h2>
            <form className="grid form-compact" style={{ gap: 10 }} onSubmit={saveClient}>
              <div className="grid grid-3">
                <div className="field">
                  <label>Cliente</label>
                  <input
                    value={clientForm.cliente}
                    onChange={(e) => setClientForm({ ...clientForm, cliente: e.target.value })}
                    placeholder="Nombre comercial"
                  />
                </div>
                <div className="field">
                  <label>Responsable</label>
                  <input
                    value={clientForm.responsable}
                    onChange={(e) => setClientForm({ ...clientForm, responsable: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Teléfono</label>
                  <input
                    value={clientForm.telefono}
                    onChange={(e) => setClientForm({ ...clientForm, telefono: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>NIT</label>
                  <input
                    value={clientForm.nit}
                    onChange={(e) => setClientForm({ ...clientForm, nit: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Razón social</label>
                  <input
                    value={clientForm.razonSocial}
                    onChange={(e) => setClientForm({ ...clientForm, razonSocial: e.target.value })}
                  />
                </div>
              </div>
              <div className="action-row sticky-form-actions">
                <button className="btn" type="submit">
                  {savingClient ? 'Guardando...' : editingClientId ? 'Guardar cambios' : 'Guardar cliente'}
                </button>
                {editingClientId && (
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => {
                      setEditingClientId(null)
                      setClientForm(initialClient)
                    }}
                  >
                    Cancelar edicion
                  </button>
                )}
              </div>
            </form>
          </section>
          <section className="card">
            <h2>Clientes guardados</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Responsable</th>
                    <th>Teléfono</th>
                    <th>NIT</th>
                    <th>Razón social</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.length ? (
                    clients.map((row) => (
                      <tr key={row.id}>
                        <td>{row.cliente || '-'}</td>
                        <td>{row.responsable || '-'}</td>
                        <td>{row.telefono || '-'}</td>
                        <td>{row.nit || '-'}</td>
                        <td>{row.razonSocial || '-'}</td>
                        <td>
                          <div className="action-row">
                            <button
                              type="button"
                              className="mini-btn"
                              onClick={() => {
                                applyClientInProject(row)
                                setActiveTab('proyecto')
                              }}
                            >
                              Usar
                            </button>
                            <button type="button" className="mini-btn success" onClick={() => editClient(row)}>
                              Editar
                            </button>
                            <button type="button" className="mini-btn danger" onClick={() => deleteClient(row.id)}>
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="muted">Aún no hay clientes guardados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
      {activeTab === 'items' && (
        <div className="grid" style={{ gap: 16 }}>
          <section className="card compact-card">
            <h2>{editingItemId ? 'Editar producto' : 'Crear producto'}</h2>
            <form className="grid form-compact" style={{ gap: 10 }} onSubmit={saveItemLocal}>
              <div className="product-compact-grid">
                <div className="field field--item">
                  <label>Ítem</label>
                  <input value={itemForm.codigo} onChange={(e) => setItemForm({ ...itemForm, codigo: e.target.value })} placeholder="1" />
                </div>
                <div className="field field--wide70">
                  <label>Nombre</label>
                  <input value={itemForm.nombre} onChange={(e) => setItemForm({ ...itemForm, nombre: e.target.value })} />
                </div>
                <div className="field field--wide70">
                  <label>Categoría</label>
                  <input value={itemForm.categoria} onChange={(e) => setItemForm({ ...itemForm, categoria: e.target.value })} />
                </div>
                <div className="field field--num">
                  <label>Cantidad</label>
                  <input type="number" min="1" step="1" value={itemForm.cantidad} onChange={(e) => setItemForm({ ...itemForm, cantidad: e.target.value })} />
                </div>
                <div className="field field--num">
                  <label>Impuesto (%)</label>
                  <input type="number" value={itemForm.tasaImpuesto} onChange={(e) => setItemForm({ ...itemForm, tasaImpuesto: e.target.value })} />
                </div>
                <div className="field field--num">
                  <label>Descuento (%)</label>
                  <input type="number" min="0" max="100" value={itemForm.descuentoEspecial} onChange={(e) => setItemForm({ ...itemForm, descuentoEspecial: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label>Descripción</label>
                <textarea rows={3} value={itemForm.descripcion} onChange={(e) => setItemForm({ ...itemForm, descripcion: e.target.value })} />
              </div>
              <div className="action-row sticky-form-actions">
                <label className="check-row compact-check">
                  <input
                    type="checkbox"
                    checked={itemForm.aplicaImpuesto}
                    onChange={(e) => setItemForm({ ...itemForm, aplicaImpuesto: e.target.checked })}
                  />
                  <span>Incluye impuestos de ley</span>
                </label>
                <button className="btn" type="submit">
                  {editingItemId ? 'Guardar cambios' : 'Agregar producto'}
                </button>
                {editingItemId && (
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => {
                      setEditingItemId(null)
                      setItemForm(initialItem)
                    }}
                  >
                    Cancelar edición
                  </button>
                )}
              </div>
            </form>
          </section>
          <section className="card compact-card">
            <h2>Productos actuales</h2>
            <div className="table-wrap">
              <table className="compact-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style={{ textAlign: 'right' }}>Cantidad</th>
                    <th>Descuento</th>
                    <th>Precio unit. s/factura</th>
                    <th>Total s/f</th>
                    <th>Impuesto</th>
                    <th>Precio unit. c/factura</th>
                    <th>Total facturado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {itemRows.length ? (
                    itemRows.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.codigo} · {item.nombre}</strong>
                          <div className="tiny-muted">{item.categoria}</div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {Number(item.cantidad || 1).toLocaleString('es-BO')}
                        </td>
                        <td>{item.descuentoPct ? `${item.descuentoPct}%` : '-'}</td>
                        <td>{money(item.precioUnitarioSinImpuesto, project.moneda)}</td>
                        <td>{money(item.totalSinFactura, project.moneda)}</td>
                        <td>
                          {item.aplicaImpuesto
                            ? `${Number(item.tasaImpuesto || 0).toLocaleString('es-BO')}% · ${money(item.impuesto, project.moneda)}`
                            : 'No incluye'}
                        </td>
                        <td>{money(item.precioUnitarioFacturado, project.moneda)}</td>
                        <td>{money(item.total, project.moneda)}</td>
                        <td>
                          <div className="action-row compact-actions">
                            <button type="button" className="mini-btn success" onClick={() => editItem(item)}>
                              Editar
                            </button>
                            <button type="button" className="mini-btn" onClick={() => duplicateItem(item)}>
                              Duplicar
                            </button>
                            <button type="button" className="mini-btn danger" onClick={() => deleteItem(item.id)}>
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="muted">Aún no agregaste productos.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
      {activeTab === 'subitems' && (
        <div className="grid" style={{ gap: 16 }}>
          <section className="card compact-card">
            <h2>{editingDetailId ? 'Editar detalle' : 'Crear detalle'}</h2>
            <form className="grid form-compact" style={{ gap: 10 }} onSubmit={saveDetailLocal}>
              <div className="detail-compact-grid">
                <div className="field field-d-producto">
                  <label>Producto</label>
                  <select value={detailForm.itemId} onChange={(e) => setDetailForm({ ...detailForm, itemId: e.target.value })}>
                    <option value="">selecciona un producto</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.codigo} · {item.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field field-d-tipo">
                  <label>Tipo</label>
                  <select value={detailForm.tipo} onChange={(e) => setDetailForm({ ...detailForm, tipo: e.target.value })}>
                    <option>Material</option>
                    <option>Mano de obra</option>
                    <option>Servicio</option>
                    <option>Instalación</option>
                    <option>Transporte</option>
                  </select>
                </div>
                <div className="field field-d-descripcion">
                  <label>Descripción</label>
                  <input value={detailForm.descripcion} onChange={(e) => setDetailForm({ ...detailForm, descripcion: e.target.value })} />
                </div>
                <div className="field field-d-proveedor">
                  <label>Proveedor</label>
                  <input value={detailForm.proveedor} onChange={(e) => setDetailForm({ ...detailForm, proveedor: e.target.value })} />
                </div>
                <div className="field field-d-unidad">
                  <label>Unidad</label>
                  <input value={detailForm.unidad} onChange={(e) => setDetailForm({ ...detailForm, unidad: e.target.value })} />
                </div>
                <div className="field field-d-cantidad">
                  <label>Cantidad</label>
                  <input type="number" value={detailForm.cantidad} onChange={(e) => setDetailForm({ ...detailForm, cantidad: e.target.value })} />
                </div>
                <div className="field field-d-costo">
                  <label>Costo unitario</label>
                  <input type="number" value={detailForm.costoUnitario} onChange={(e) => setDetailForm({ ...detailForm, costoUnitario: e.target.value })} />
                </div>
                <div className="field field-d-utilidad">
                  <label>Utilidad (%)</label>
                  <input type="number" value={detailForm.tasaUtilidad} onChange={(e) => setDetailForm({ ...detailForm, tasaUtilidad: e.target.value })} />
                </div>
                <div className="field field-d-observaciones">
                  <label>Observaciones</label>
                  <input value={detailForm.especificacion} onChange={(e) => setDetailForm({ ...detailForm, especificacion: e.target.value })} />
                </div>
              </div>
              <div className="action-row sticky-form-actions">
                <button className="btn" type="submit">
                  {editingDetailId ? 'Guardar cambios' : 'Agregar detalle'}
                </button>
                {editingDetailId && (
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => {
                      setEditingDetailId(null)
                      setDetailForm(initialDetail)
                    }}
                  >
                    Cancelar edición
                  </button>
                )}
              </div>
            </form>
          </section>
          <section className="card compact-card">
            <h2>SubProductos actuales</h2>
            <div className="table-wrap">
              <table className="compact-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Descripción</th>
                    <th>Observaciones</th>
                    <th>Cantidad</th>
                    <th>Precio unitario</th>
                    <th>Subtotal</th>
                    <th>Utilidad</th>
                    <th>Ganancia</th>
                    <th>Total</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {detailGroups.length ? (
                    detailGroups.map((group) => {
                      const itemId = group.item?.id || 'sin-item'
                      const isCollapsed = collapsedDetailGroups[itemId] ?? true
                      return (
                        <Fragment key={`group-${itemId}`}>
                          <tr key={`head-${itemId}`} className="detail-group-head">
                            <td
                              colSpan={10}
                              role="button"
                              tabIndex={0}
                              aria-expanded={!isCollapsed}
                              onClick={() => toggleDetailGroup(itemId)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault()
                                  toggleDetailGroup(itemId)
                                }
                              }}
                            >
                              <button
                                type="button"
                                className={`group-toggle-btn ${isCollapsed ? '' : 'open'}`}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  toggleDetailGroup(itemId)
                                }}
                              >
                                {isCollapsed ? 'Expandir' : 'Contraer'}
                              </button>
                              <span className="group-title">
                                <strong>{group.item?.codigo || '-'}</strong> · {group.item?.nombre || 'Producto sin nombre'}
                              </span>
                              <span className="group-meta-chip">{group.rows.length} subproducto(s)</span>
                              <span className="group-meta-chip strong">Total: {money(group.sums.total, project.moneda)}</span>
                            </td>
                          </tr>
                          {isCollapsed ? null : group.rows.map((row) => {
                            const cantidad = Number(row.cantidad || 0)
                            const precioUnitario = Number(row.costoUnitario || 0)
                            const utilidadPct = Number(row.tasaUtilidad || 0)
                            const subtotal = cantidad * precioUnitario
                            const ganancia = subtotal * (utilidadPct / 100)
                            const total = subtotal + ganancia
                            return (
                              <tr key={row.id} className="detail-row">
                                <td>
                                  <strong>{group.item?.codigo || '-'}</strong>
                                  <div className="tiny-muted">{group.item?.nombre || '-'}</div>
                                </td>
                                <td>
                                  <strong>{row.descripcion}</strong>
                                  <div className="tiny-muted">{row.proveedor || '-'} · {row.tipo}</div>
                                </td>
                                <td>{row.especificacion || '-'}</td>
                                <td>{cantidad} {row.unidad}</td>
                                <td>{money(precioUnitario, project.moneda)}</td>
                                <td>{money(subtotal, project.moneda)}</td>
                                <td>{utilidadPct}%</td>
                                <td>{money(ganancia, project.moneda)}</td>
                                <td>{money(total, project.moneda)}</td>
                                <td>
                                  <div className="action-row compact-actions">
                                    <button type="button" className="mini-btn success" onClick={() => editDetail(row)}>
                                      Editar
                                    </button>
                                    <button type="button" className="mini-btn danger" onClick={() => deleteDetail(row.id)}>
                                      Eliminar
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                          <tr key={`sum-${itemId}`} className="detail-group-total">
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#b8f3ff' }}>Subtotal producto</td>
                            <td />
                            <td />
                            <td />
                            <td />
                            <td style={{ fontWeight: 700, color: '#b8f3ff' }}>{money(group.sums.subtotal, project.moneda)}</td>
                            <td />
                            <td style={{ fontWeight: 700, color: '#b8f3ff' }}>{money(group.sums.ganancia, project.moneda)}</td>
                            <td style={{ fontWeight: 700, color: '#b8f3ff' }}>{money(group.sums.total, project.moneda)}</td>
                            <td />
                          </tr>
                          <tr className="detail-group-gap" aria-hidden="true">
                            <td colSpan={10} />
                          </tr>
                        </Fragment>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="muted">Aún no agregaste detalles.</td>
                    </tr>
                  )}
                </tbody>
                {details.length ? (
                  <tfoot>
                    {(() => {
                      const sumCantidad = details.reduce((acc, row) => acc + Number(row.cantidad || 0), 0)
                      const sumSubtotal = details.reduce((acc, row) => (
                        acc + (Number(row.cantidad || 0) * Number(row.costoUnitario || 0))
                      ), 0)
                      const sumGanancia = details.reduce((acc, row) => {
                        const subtotal = Number(row.cantidad || 0) * Number(row.costoUnitario || 0)
                        return acc + (subtotal * (Number(row.tasaUtilidad || 0) / 100))
                      }, 0)
                      const sumTotal = details.reduce((acc, row) => {
                        const cantidad = Number(row.cantidad || 0)
                        const precioUnitario = Number(row.costoUnitario || 0)
                        const subtotal = cantidad * precioUnitario
                        const ganancia = subtotal * (Number(row.tasaUtilidad || 0) / 100)
                        return acc + (subtotal + ganancia)
                      }, 0)
                      return (
                        <tr>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#b8f3ff' }}>Totales</td>
                          <td />
                          <td />
                          <td />
                          <td />
                          <td style={{ fontWeight: 700, color: '#b8f3ff' }}>{money(sumSubtotal, project.moneda)}</td>
                          <td />
                          <td style={{ fontWeight: 700, color: '#b8f3ff' }}>{money(sumGanancia, project.moneda)}</td>
                          <td style={{ fontWeight: 700, color: '#b8f3ff' }}>{money(sumTotal, project.moneda)}</td>
                          <td />
                        </tr>
                      )
                    })()}
                  </tfoot>
                ) : null}
              </table>
            </div>
          </section>
        </div>
      )}
      {activeTab === 'recursos' && (
        <ResourcesSection
          editingResourceId={editingResourceId}
          resourceForm={resourceForm}
          setResourceForm={setResourceForm}
          saveResource={saveResource}
          savingResource={savingResource}
          setEditingResourceId={setEditingResourceId}
          resources={resources}
          money={money}
          addResourceToDetail={addResourceToDetail}
          editResource={editResource}
          deleteResource={deleteResource}
          renameCategoryEverywhere={renameCategoryEverywhere}
          deleteCategoryEverywhere={deleteCategoryEverywhere}
          renameSubcategoryEverywhere={renameSubcategoryEverywhere}
          deleteSubcategoryEverywhere={deleteSubcategoryEverywhere}
        />
      )}
      {activeTab === 'cotizacion' && (
        <QuoteSection
          project={project}
          itemRows={itemRows}
          subtotalProyecto={subtotalProyecto}
          descuentoGeneralPct={descuentoGeneralPct}
          descuentoGeneralMonto={descuentoGeneralMonto}
          totalProyecto={totalProyecto}
          savingProject={savingProject}
          editingProjectId={editingProjectId}
          onSave={saveProjectCloud}
          onDownloadPdf={downloadPdf}
          money={money}
          formatDateDisplay={formatDateDisplay}
          safeText={safeText}
        />
      )}
      {activeTab === 'historial' && (
        <HistorySection
          history={history}
          onOpen={openProjectFromHistory}
          onDuplicate={duplicateProjectFromHistory}
          onDelete={deleteProjectFromHistory}
          onBackupExport={exportBackupExcel}
          onBackupRestoreClick={triggerBackupRestore}
          onBackupAddClick={triggerBackupAdd}
          backupBusy={backupBusy}
          restoreBusy={restoreBusy}
          addBusy={addBusy}
        />
      )}
      <style jsx global>{`
        :root {
          --dz-green: ${BRAND.green};
          --dz-green-dark: ${BRAND.greenDark};
          --dz-green-deep: ${BRAND.greenDeep};
          --dz-green-soft: ${BRAND.greenSoft};
          --dz-red: ${BRAND.red};
          --dz-ink: ${BRAND.ink};
          --dz-border: ${BRAND.border};
          --dz-bg: #114f68;
          --dz-card: #ffffff;
          --dz-muted: #62748a;
          --dz-shadow: 0 12px 30px rgba(17, 106, 113, 0.08);
        }
        html, body {
          background: linear-gradient(135deg, var(--dz-green-deep) 0%, var(--dz-green-dark) 45%, var(--dz-green) 100%);
          color: var(--dz-ink);
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
        }
        .page {
          max-width: 1600px;
          margin: 0 auto;
          padding: 8px 10px 28px;
          width: 100%;
          overflow-x: hidden;
        }
        .grid {
          display: grid;
        }
        .grid-2 {
          grid-template-columns: minmax(0, 1.85fr) minmax(320px, 0.95fr);
          gap: 18px;
          align-items: start;
        }
        .grid-3 {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }
        .grid-4 {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
        }
        .hero {
          background: linear-gradient(135deg, var(--dz-green-dark) 0%, var(--dz-green) 62%, #22a3b6 100%);
          border-radius: 30px;
          padding: 22px 26px;
          color: white;
          box-shadow: var(--dz-shadow);
        }
        .hero-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .brand-lockup {
          display: flex;
          align-items: center;
          gap: 18px;
          min-width: 0;
        }
        .brand-copy {
          min-width: 0;
        }
        .hero-eyebrow {
          font-size: 12px;
          letter-spacing: 0.22em;
          opacity: 0.9;
          margin-bottom: 10px;
        }
        .hero h1 {
          margin: 0;
          font-size: 3rem;
          line-height: 1.02;
          color: white;
        }
        .hero-rubro {
          margin-top: 8px;
          font-size: 1.02rem;
          font-weight: 600;
          opacity: 0.95;
        }
        .hero-subtitle {
          margin: 12px 0 10px;
          max-width: 920px;
          font-size: 1.05rem;
          line-height: 1.45;
          opacity: 0.97;
        }
        .hero-meta {
          margin: 0;
          font-size: 0.98rem;
          opacity: 0.94;
        }
        .hero-logo-wrap {
          width: 96px;
          height: 96px;
          min-width: 96px;
          background: rgba(255,255,255,0.98);
          border-radius: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(0,0,0,.08);
          overflow: hidden;
        }
        .hero-logo {
          width: 76px;
          height: 76px;
          object-fit: contain;
        }
        .tabs {
          display: grid;
          grid-template-columns: repeat(9, minmax(0, 1fr));
          gap: 12px;
        }
        .sync-indicator {
          justify-self: stretch;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: -8px;
          margin-bottom: 4px;
          font-size: 0.86rem;
          font-weight: 700;
          color: #e9fbff;
          background: rgba(10, 79, 95, 0.62);
          border: 1px solid rgba(171, 231, 240, 0.34);
          border-radius: 999px;
          padding: 7px 12px;
        }
        .sync-project {
          text-align: right;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 62%;
          color: #d4f7ff;
          font-weight: 800;
        }
        .tab-btn {
          appearance: none;
          border: 1px solid var(--dz-border);
          background: white;
          color: var(--dz-ink);
          font-weight: 800;
          font-size: 1rem;
          border-radius: 18px;
          padding: 16px 12px;
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.04);
          transition: .18s ease;
          cursor: pointer;
        }
        .tab-btn-inner {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
        }
        .tab-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
          border-color: rgba(17,106,113,0.28);
        }
        .tab-btn.active {
          background: linear-gradient(135deg, var(--dz-green-deep), var(--dz-green-dark));
          color: white;
          border-color: transparent;
          box-shadow: 0 10px 22px rgba(17,106,113,0.22);
        }
        .tab-btn-items {
          background: linear-gradient(135deg, #ecfbff 0%, #d7f5ff 100%);
          border-color: #8ddff4;
          color: #0f5f80;
        }
        .tab-btn-items:hover {
          border-color: #61cde8;
          box-shadow: 0 10px 20px rgba(97, 205, 232, 0.22);
        }
        .tab-btn-subitems {
          background: linear-gradient(135deg, #e4f4ff 0%, #cce9ff 100%);
          border-color: #7fc2f7;
          color: #155f9c;
        }
        .tab-btn-subitems:hover {
          border-color: #54acef;
          box-shadow: 0 10px 20px rgba(84, 172, 239, 0.22);
        }
        .tab-btn-items.active,
        .tab-btn-subitems.active {
          color: #fff;
        }
        .card {
          background: linear-gradient(135deg, rgba(19, 95, 122, 0.95) 0%, rgba(23, 127, 152, 0.92) 58%, rgba(52, 176, 198, 0.9) 100%);
          border: 1px solid rgba(171, 231, 240, 0.38);
          border-radius: 26px;
          padding: 20px 22px;
          box-shadow: 0 10px 26px rgba(15, 23, 42, 0.035);
        }
        .cotizador-theme h2 {
          margin: 0 0 18px;
          font-size: 2rem;
          line-height: 1.05;
          color: #ffffff;
        }
        .field {
          display: grid;
          gap: 6px;
        }
        .field label {
          color: rgba(255, 255, 255, 0.88);
          font-size: 0.9rem;
          font-weight: 700;
        }
        .form-compact .field label {
          font-size: 0.84rem;
        }
        .cotizador-theme input, .cotizador-theme select, .cotizador-theme textarea {
          width: 100%;
          border: 1px solid rgba(171, 231, 240, 0.34);
          border-radius: 16px;
          padding: 10px 12px;
          background: #ffffff !important;
          color: #0f172a !important;
          -webkit-text-fill-color: #0f172a !important;
          caret-color: #0f172a !important;
          font-size: 1rem;
          outline: none;
          transition: border-color .16s ease, box-shadow .16s ease;
          box-sizing: border-box;
        }
        .cotizador-theme input::placeholder,
        .cotizador-theme textarea::placeholder {
          color: #64748b !important;
          opacity: 1;
        }
        .cotizador-theme select option {
          color: #163545;
          background: #ffffff;
        }
        .cotizador-theme input:-webkit-autofill,
        .cotizador-theme input:-webkit-autofill:hover,
        .cotizador-theme input:-webkit-autofill:focus,
        .cotizador-theme textarea:-webkit-autofill,
        .cotizador-theme textarea:-webkit-autofill:hover,
        .cotizador-theme textarea:-webkit-autofill:focus,
        .cotizador-theme select:-webkit-autofill,
        .cotizador-theme select:-webkit-autofill:hover,
        .cotizador-theme select:-webkit-autofill:focus {
          -webkit-text-fill-color: #0f172a !important;
          caret-color: #0f172a !important;
          box-shadow: 0 0 0px 1000px #ffffff inset !important;
          transition: background-color 9999s ease-out 0s;
        }
        .cotizador-theme input:focus, .cotizador-theme select:focus, .cotizador-theme textarea:focus {
          border-color: rgba(171, 231, 240, 0.56);
          box-shadow: 0 0 0 4px rgba(52,176,198,0.2);
        }
        .cotizador-theme textarea {
          resize: vertical;
          min-height: 86px;
        }
        .btn, .mini-btn {
          appearance: none;
          border: none;
          cursor: pointer;
          transition: .18s ease;
        }
        .btn {
          background: linear-gradient(135deg, var(--dz-green), var(--dz-green-dark));
          color: #fff;
          font-weight: 800;
          border-radius: 16px;
          padding: 14px 20px;
          box-shadow: 0 10px 22px rgba(17,106,113,0.18);
        }
        .btn:hover {
          transform: translateY(-1px);
          filter: brightness(0.98);
        }
        .btn.secondary {
          background: rgba(17, 86, 104, 0.7);
          color: #fff;
          box-shadow: none;
          border: 1px solid rgba(171, 231, 240, 0.34);
        }
        .btn.success {
          background: linear-gradient(135deg, var(--dz-green), var(--dz-green-dark));
          color: #fff;
          border: none;
          box-shadow: 0 10px 22px rgba(17,106,113,0.18);
        }
        .mini-btn {
          background: rgba(17, 86, 104, 0.7);
          color: #fff;
          font-weight: 800;
          border-radius: 13px;
          padding: 8px 10px;
          box-shadow: none;
          border: 1px solid rgba(171, 231, 240, 0.34);
        }
        .mini-btn:hover,
        .btn.secondary:hover {
          border-color: rgba(171, 231, 240, 0.54);
          background: rgba(26, 108, 130, 0.76);
        }
        .mini-btn.success {
          background: linear-gradient(135deg, var(--dz-green), var(--dz-green-dark));
          color: white;
          border-color: transparent;
          box-shadow: 0 10px 20px rgba(17,106,113,0.18);
        }
        .mini-btn.danger {
          background: var(--dz-red);
          color: white;
          border-color: transparent;
          box-shadow: 0 10px 20px rgba(239,23,78,0.18);
        }
        .mini-btn.danger:hover {
          filter: brightness(0.98);
        }
        .action-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
        }
        .sticky-form-actions {
          position: sticky;
          bottom: 6px;
          z-index: 4;
          padding: 8px 10px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(8, 92, 114, 0.92), rgba(17, 118, 144, 0.9));
          border: 1px solid rgba(171, 231, 240, 0.42);
          box-shadow: 0 10px 24px rgba(8, 36, 48, 0.25);
          backdrop-filter: blur(2px);
          justify-content: flex-start;
        }
        .sticky-form-actions .btn {
          width: auto;
          flex: 0 0 auto;
        }
        .compact-card {
          padding-top: 14px;
          padding-bottom: 14px;
        }
        .compact-card h2 {
          margin-bottom: 12px;
          font-size: 1.66rem;
        }
        .compact-table th {
          padding: 10px 10px;
          font-size: .84rem;
        }
        .compact-table td {
          padding: 9px 10px;
          font-size: 0.95rem;
          line-height: 1.2;
        }
        .compact-actions {
          flex-wrap: nowrap;
          gap: 6px;
        }
        .compact-actions .mini-btn {
          white-space: nowrap;
          padding: 7px 9px;
          font-size: .82rem;
          border-radius: 10px;
        }
        .product-compact-grid {
          display: grid;
          grid-template-columns: 78px minmax(220px, 1.35fr) minmax(170px, 1fr) 98px 98px 98px;
          gap: 10px;
          align-items: end;
        }
        .field--num input {
          max-width: 98px;
        }
        .field--item input {
          max-width: 78px;
          text-align: center;
        }
        .field--wide70 input {
          width: 100%;
        }
        .form-compact input[type='number'] {
          max-width: 112px;
        }
        .form-compact input[type='date'] {
          max-width: 170px;
        }
        .compact-check {
          margin-right: 10px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(171, 231, 240, 0.34);
          border-radius: 12px;
          padding: 8px 10px;
        }
        .resources-compact-grid {
          display: grid;
          gap: 10px;
          align-items: end;
        }
        .resources-row-1 {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .resources-row-2 {
          grid-template-columns: minmax(220px, 1.6fr) 120px 130px 170px;
        }
        .resources-row-3 {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .resources-filter-row {
          display: flex;
          justify-content: flex-start;
          margin-bottom: 10px;
        }
        .resources-unit input,
        .resources-cost input,
        .resources-date input {
          max-width: 100%;
        }
        .detail-compact-grid {
          display: grid;
          grid-template-columns: repeat(16, minmax(0, 1fr));
          gap: 10px;
          align-items: end;
        }
        .field-d-producto {
          grid-column: span 4;
        }
        .field-d-tipo {
          grid-column: span 4;
        }
        .field-d-descripcion {
          grid-column: span 4;
        }
        .field-d-proveedor {
          grid-column: span 4;
        }
        .field-d-unidad {
          grid-column: span 2;
        }
        .field-d-unidad input {
          max-width: 100%;
        }
        .field-d-observaciones {
          grid-column: span 8;
          justify-self: stretch;
        }
        .field-d-cantidad {
          grid-column: span 2;
        }
        .field-d-costo {
          grid-column: span 2;
        }
        .field-d-utilidad {
          grid-column: span 2;
        }
        .field-d-cantidad input,
        .field-d-costo input,
        .field-d-utilidad input {
          max-width: 100%;
        }
        .detail-compact-grid input[type='number'] {
          max-width: 100% !important;
          width: 100%;
        }
        .muted,
        .tiny-muted {
          color: rgba(232, 245, 248, 0.86);
        }
        .tiny-muted {
          font-size: .88rem;
        }
        .table-wrap {
          overflow-x: auto;
          max-width: 100%;
          -webkit-overflow-scrolling: touch;
          border: 1px solid rgba(171, 231, 240, 0.34);
          border-radius: 22px;
          background: rgba(10, 79, 95, 0.72);
        }
        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 720px;
          background: transparent;
        }
        .cotizador-theme th {
          text-align: left;
          color: #e9fbff;
          font-size: .92rem;
          letter-spacing: .02em;
          text-transform: uppercase;
          background: rgba(255, 255, 255, 0.12);
          padding: 14px 14px;
          border-bottom: 1px solid rgba(171, 231, 240, 0.3);
        }
        .cotizador-theme td {
          padding: 14px 14px;
          border-bottom: 1px solid rgba(171, 231, 240, 0.24);
          color: #ffffff;
          vertical-align: top;
        }
        tbody tr:hover {
          background: rgba(255, 255, 255, 0.08);
        }
        .detail-group-head td {
          background: linear-gradient(135deg, rgba(18, 108, 129, 0.62), rgba(32, 132, 156, 0.6));
          border-top: 1px solid rgba(171, 231, 240, 0.42);
          border-bottom: 1px solid rgba(171, 231, 240, 0.34);
          padding-top: 16px;
          padding-bottom: 16px;
        }
        .group-toggle-btn {
          background: rgba(255, 255, 255, 0.16);
          color: #ffffff;
          font-weight: 900;
          border-radius: 999px;
          padding: 9px 16px;
          border: 1px solid rgba(171, 231, 240, 0.55);
          margin-right: 10px;
        }
        .group-toggle-btn.open {
          background: rgba(13, 169, 206, 0.26);
          border-color: rgba(156, 236, 255, 0.82);
        }
        .group-title {
          font-size: 1.06rem;
          color: #ffffff;
          margin-right: 10px;
        }
        .group-meta-chip {
          display: inline-flex;
          align-items: center;
          margin-top: 6px;
          margin-right: 8px;
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 0.88rem;
          font-weight: 800;
          color: #d9f7ff;
          background: rgba(0, 0, 0, 0.15);
          border: 1px solid rgba(171, 231, 240, 0.35);
        }
        .group-meta-chip.strong {
          color: #ffffff;
          background: rgba(6, 81, 102, 0.56);
          border-color: rgba(171, 231, 240, 0.62);
        }
        .detail-row td {
          background: rgba(7, 85, 104, 0.18);
        }
        .detail-group-total td {
          background: rgba(8, 101, 125, 0.5);
          border-top: 1px solid rgba(171, 231, 240, 0.28);
          border-bottom: 1px solid rgba(171, 231, 240, 0.36);
          font-size: 1.02rem;
        }
        .detail-group-gap td {
          padding: 0;
          height: 10px;
          border: 0;
          background: transparent;
        }
        .quote-head,
        .quote-foot {
          display: grid;
          gap: 16px;
        }
        .quote-head {
          grid-template-columns: minmax(0, 1.25fr) minmax(320px, .95fr);
          align-items: start;
        }
        .quote-box {
          background: rgba(10, 79, 95, 0.68);
          border: 1px solid rgba(171, 231, 240, 0.32);
          border-radius: 22px;
          padding: 18px 20px;
        }
        .quote-logo {
          width: 68px;
          height: 68px;
          object-fit: contain;
          background: white;
          border-radius: 16px;
          padding: 5px;
          border: 1px solid var(--dz-border);
        }
        .check-row {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #ffffff;
          font-weight: 600;
        }
        .check-row input {
          width: 18px;
          height: 18px;
          padding: 0;
        }
        .kpi {
          font-size: 2rem;
          font-weight: 900;
          color: #ffffff;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(171, 231, 240, 0.2);
          color: #e9fbff;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: .82rem;
          font-weight: 800;
        }
        @media (max-width: 1200px) {
          .tabs {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          .grid-2,
          .quote-head {
            grid-template-columns: 1fr;
          }
          .product-compact-grid {
            grid-template-columns: 78px minmax(180px, 1fr) minmax(150px, 1fr) 90px 90px 90px;
          }
          .resources-row-1 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .resources-row-2 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .resources-row-3 {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .detail-compact-grid {
            grid-template-columns: repeat(8, minmax(0, 1fr));
          }
          .field-d-producto,
          .field-d-tipo,
          .field-d-descripcion,
          .field-d-proveedor {
            grid-column: span 4;
          }
          .field-d-unidad,
          .field-d-cantidad,
          .field-d-costo,
          .field-d-utilidad {
            grid-column: span 2;
          }
          .field-d-observaciones {
            grid-column: span 8;
          }
        }
        @media (max-width: 860px) {
          .page {
            padding: 6px 6px 22px;
          }
          .grid-3 {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .grid-4 {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .hero {
            padding: 18px 18px 20px;
            border-radius: 24px;
          }
          .brand-lockup {
            align-items: flex-start;
          }
          .hero h1 {
            font-size: 2.15rem;
          }
          .hero-eyebrow {
            letter-spacing: 0.12em;
          }
          .hero-subtitle,
          .hero-meta {
            overflow-wrap: anywhere;
          }
          .hero-head {
            flex-direction: column;
            align-items: flex-start;
          }
          .tabs {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }
          .sync-indicator {
            margin-top: -2px;
            margin-bottom: 2px;
            font-size: 0.8rem;
          }
          .sync-project {
            max-width: 52%;
          }
          .tab-btn {
            font-size: 0.95rem;
            padding: 12px 10px;
            border-radius: 14px;
          }
          .card {
            padding: 18px;
            border-radius: 22px;
          }
          table {
            min-width: 0;
          }
          .cotizador-theme th, .cotizador-theme td {
            padding: 10px 10px;
            font-size: 0.9rem;
            white-space: normal;
            overflow-wrap: anywhere;
            word-break: break-word;
          }
          .mini-btn {
            padding: 8px 10px;
            font-size: 0.86rem;
          }
          .product-compact-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }
          .resources-row-1,
          .resources-row-2,
          .resources-row-3 {
            grid-template-columns: 1fr;
            gap: 8px;
          }
          .detail-compact-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }
          .field-d-producto,
          .field-d-tipo,
          .field-d-descripcion,
          .field-d-proveedor,
          .field-d-unidad,
          .field-d-observaciones,
          .field-d-cantidad,
          .field-d-costo,
          .field-d-utilidad {
            grid-column: span 1;
          }
          .field--num input,
          .field--item input,
          .form-compact input[type='number'],
          .form-compact input[type='date'] {
            max-width: 100%;
          }
          .cotizador-theme h2 {
            font-size: 1.7rem;
          }
          .hero-logo-wrap {
            width: 82px;
            height: 82px;
            min-width: 82px;
          }
          .hero-logo {
            width: 64px;
            height: 64px;
          }
        }
        @media (max-width: 520px) {
          .tabs {
            grid-template-columns: 1fr;
          }
          .sync-indicator {
            width: 100%;
            text-align: left;
            border-radius: 14px;
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }
          .sync-project {
            max-width: 100%;
            text-align: left;
          }
          table {
            min-width: 0;
          }
          .cotizador-theme h2 {
            font-size: 1.45rem;
          }
          .cotizador-theme input, .cotizador-theme select, .cotizador-theme textarea {
            padding: 12px 12px;
          }
          .action-row {
            gap: 8px;
          }
          .sticky-form-actions {
            bottom: 2px;
            padding: 7px 8px;
          }
        }
      `}</style>
    </main>
  )
}








