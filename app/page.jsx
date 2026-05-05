'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [toastMessage, setToastMessage] = useState('')
  const toastTimeoutRef = useRef(null)
  function showToast(message) {
    setToastMessage(message)
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage('')
      toastTimeoutRef.current = null
    }, 2200)
  }
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
        nombre: row.name || '-',
        especificacion: row.specification || '',
        unidad: row.unit || '-',
        proveedor: meta.supplier || '-',
        costo: Number(row.base_cost || 0),
      }
    })
    setResources(mapped)
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
        validoHasta: row.valid_until || '',
      }
    })
    setHistory(mapped)
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
    return () => {
      if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current)
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
  const itemRows = useMemo(() => {
    return items.map((item) => {
      const related = detailsByItemId[item.id] || []
      const cantidad = related.reduce((acc, row) => acc + Number(row.cantidad || 0), 0)
      const subtotal = related.reduce((acc, row) => {
        const base = Number(row.cantidad || 0) * Number(row.costoUnitario || 0)
        const total = base * (1 + Number(row.tasaUtilidad || 0) / 100)
        return acc + total
      }, 0)
      const precioUnitario = cantidad > 0 ? subtotal / cantidad : 0
      const impuesto = item.aplicaImpuesto ? subtotal * (Number(item.tasaImpuesto || 0) / 100) : 0
      return { ...item, cantidad, precioUnitario, subtotal, impuesto, total: subtotal + impuesto }
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
  }

  async function downloadPdf() {
    try {
      if (!itemRows.length) {
        alert('Primero agrega al menos un ítem.')
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
    const infoBoxH = 24
    doc.setDrawColor(...line)
    doc.setFillColor(...white)
    doc.rect(margin, infoBoxY, leftW - 34, infoBoxH, 'FD')
    doc.setTextColor(...ink)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.text('Proyecto:', margin + 5, infoBoxY + 8)
    doc.text('Empresa:', margin + 5, infoBoxY + 18)
    doc.text('Responsable:', margin + 90, infoBoxY + 8)
    doc.setFont('helvetica', 'normal')
    doc.text(safeText(project.nombreProyecto) || '-', margin + 28, infoBoxY + 8)
    doc.text(safeText(project.razonSocial || project.empresa || project.cliente) || '-', margin + 28, infoBoxY + 18)
    doc.text(safeText(project.responsable) || '-', margin + 124, infoBoxY + 8)

      const tableStartY = 80
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
        fontSize: 8.6,
        cellPadding: 3.2,
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
        minCellHeight: 13,
      },
      bodyStyles: {
        minCellHeight: 13,
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

      const boxGap = 6
      const thirdW = (usableWidth - boxGap * 2) / 3
      const footerBarH = 12
      let bottomY = tableEndY + (showTotalGeneral ? 28 : 16)

      if (bottomY + 28 + footerBarH + 8 > pageHeight) {
      doc.addPage('a4', 'l')
      bottomY = 18
    }

      doc.setFillColor(...white)
    doc.setDrawColor(...line)
    doc.rect(margin, bottomY, thirdW, 28, 'FD')
    doc.rect(margin + thirdW + boxGap, bottomY, thirdW, 28, 'FD')
    doc.rect(margin + (thirdW + boxGap) * 2, bottomY, thirdW, 28, 'FD')

    doc.setTextColor(...ink)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Condiciones', margin + 6, bottomY + 8)
    doc.text('Observaciones', margin + thirdW + boxGap + 6, bottomY + 8)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
      const condLines = [
      `Forma de pago: ${safeText(project.condicionesPago) || '-'}`,
      `Tiempo de entrega: ${safeText(project.tiempoEntrega) || '-'}`,
      incluyeImpuestos ? 'La cotización incluye impuestos de ley.' : 'La cotización no incluye impuestos de ley.',
    ]
      const condText = doc.splitTextToSize(condLines.join('\n'), thirdW - 12)
      doc.text(condText, margin + 6, bottomY + 15)

      const obsLines = [safeText(project.observaciones) || '-']
    if (safeText(project.validoHasta)) {
      obsLines.push(`Validez de la oferta: ${formatDateDisplay(project.validoHasta)}`)
    }
    if (!showTotalGeneral) {
      obsLines.push('El cliente podrá elegir una alternativa.')
    }
      const obsText = doc.splitTextToSize(obsLines.join('\n'), thirdW - 12)
      doc.text(obsText, margin + thirdW + boxGap + 6, bottomY + 15)

      const sigX = margin + (thirdW + boxGap) * 2
    doc.setFont('helvetica', 'normal')
    doc.line(sigX + 12, bottomY + 20, sigX + thirdW - 12, bottomY + 20)
    doc.setFont('helvetica', 'bold')
    doc.text('Tina Rodriguez', sigX + thirdW / 2, bottomY + 26, { align: 'center' })

      doc.setFillColor(...greenDark)
    doc.rect(0, pageHeight - 12, pageWidth, 12, 'F')
    doc.setTextColor(...white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.8)
      const footerText = [
      safeText(COMPANY.address),
      safeText((COMPANY.phones || []).join(' / ')),
      safeText(COMPANY.email),
      'La Paz - Bolivia',
    ].filter(Boolean).join(' · ')
      doc.text(footerText, pageWidth / 2, pageHeight - 4.2, { align: 'center' })

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
      last_price_update: new Date().toISOString().slice(0, 10),
      notes: JSON.stringify({
        type: resourceForm.tipo,
        category: resourceForm.categoria,
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
  function editResource(resource) {
    setActiveTab('recursos')
    setEditingResourceId(resource.id)
    setResourceForm({
      tipo: resource.tipo || 'Material',
      categoria: resource.categoria || '',
      nombre: resource.nombre || '',
      especificacion: resource.especificacion || '',
      unidad: resource.unidad || 'unidad',
      proveedor: resource.proveedor || '',
      costo: Number(resource.costo || 0),
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
      alert('Escribe un nombre para el ítem.')
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
      aplicaImpuesto: item.aplicaImpuesto,
      tasaImpuesto: item.tasaImpuesto,
      descuentoEspecial: Number(item.descuentoEspecial || 0),
    })
  }
  function deleteItem(id) {
    if (!confirm('¿Eliminar este ítem y sus subítems?')) return
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
      alert('Primero selecciona un ítem.')
      return
    }
    if (!detailForm.descripcion.trim()) {
      alert('Escribe la descripción del subítem.')
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
    if (!confirm('¿Eliminar este subítem?')) return
    setDetails((prev) => prev.filter((d) => d.id !== id))
    if (editingDetailId === id) {
      setEditingDetailId(null)
      setDetailForm(initialDetail)
    }
  }
  async function saveProjectCloud() {
    if (!supabase) return
    if (!project.nombreProyecto.trim()) {
      alert('Escribe el nombre del proyecto.')
      return
    }
    if (!items.length) {
      alert('Agrega al menos un ítem.')
      return
    }
    setSavingProject(true)
    let projectId = editingProjectId
    if (editingProjectId) {
      const { error } = await supabase
        .from(TABLES.projects)
        .update({
          quote_number: project.numero.trim() || `COT-${Date.now()}`,
          project_name: project.nombreProyecto.trim(),
          company_name: project.razonSocial.trim() || project.empresa.trim() || project.cliente.trim(),
          responsible: project.responsable.trim(),
          date: project.fecha,
          valid_until: project.validoHasta || null,
          currency: project.moneda,
          payment_terms: project.condicionesPago,
          delivery_time: project.tiempoEntrega,
          notes: serializeProjectNotes(project),
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
          project_name: project.nombreProyecto.trim(),
          company_name: project.razonSocial.trim() || project.empresa.trim() || project.cliente.trim(),
          responsible: project.responsable.trim(),
          date: project.fecha,
          valid_until: project.validoHasta || null,
          currency: project.moneda,
          payment_terms: project.condicionesPago,
          delivery_time: project.tiempoEntrega,
          notes: serializeProjectNotes(project),
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
        alert('Error al guardar ítem: ' + insertedItem.error.message)
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
          alert('Error al guardar subítem: ' + insertedDetail.error.message)
          return
        }
      }
    }
    setSavingProject(false)
    await loadHistory()
    showToast(editingProjectId ? 'Cotización actualizada.' : 'Cotización guardada.')
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
    setItems((itemsRes.data || []).map((i) => ({
      id: i.id,
      codigo: i.code || '',
      nombre: i.name || '',
      categoria: i.category || '',
      descripcion: i.description || '',
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
  const showDashboardHeader = activeTab !== 'cotizacion'
  return (
    <main className="page grid cotizador-theme" style={{ gap: 20 }}>
      {toastMessage ? <div className="toast-notice">{toastMessage}</div> : null}
      {showDashboardHeader && (
        <DashboardHero rubro={COMPANY_RUBRO} infoLine={companyInfoLine} />
      )}
      <TabNav tabs={APP_TABS} activeTab={activeTab} onTabChange={setActiveTab} />
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
        />
      )}
      {activeTab === 'clientes' && (
        <div className="grid" style={{ gap: 16 }}>
          <section className="card">
            <h2>{editingClientId ? 'Editar cliente' : 'Registrar cliente'}</h2>
            <form className="grid" style={{ gap: 12 }} onSubmit={saveClient}>
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
              <div className="action-row">
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
          <section className="card">
            <h2>{editingItemId ? 'Editar ítem' : 'Crear ítem'}</h2>
            <form className="grid" style={{ gap: 12 }} onSubmit={saveItemLocal}>
              <div className="grid grid-2">
                <div className="field">
                  <label>Código</label>
                  <input value={itemForm.codigo} onChange={(e) => setItemForm({ ...itemForm, codigo: e.target.value })} placeholder="ITEM 001" />
                </div>
                <div className="field">
                  <label>Nombre</label>
                  <input value={itemForm.nombre} onChange={(e) => setItemForm({ ...itemForm, nombre: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-3">
                <div className="field">
                  <label>Categoría</label>
                  <input value={itemForm.categoria} onChange={(e) => setItemForm({ ...itemForm, categoria: e.target.value })} />
                </div>
                <div className="field">
                  <label>Impuesto del ítem (%)</label>
                  <input type="number" value={itemForm.tasaImpuesto} onChange={(e) => setItemForm({ ...itemForm, tasaImpuesto: e.target.value })} />
                </div>
                <div className="field">
                  <label>Descuento especial (%)</label>
                  <input type="number" min="0" max="100" value={itemForm.descuentoEspecial} onChange={(e) => setItemForm({ ...itemForm, descuentoEspecial: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label>Descripción</label>
                <textarea rows={3} value={itemForm.descripcion} onChange={(e) => setItemForm({ ...itemForm, descripcion: e.target.value })} />
              </div>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={itemForm.aplicaImpuesto}
                  onChange={(e) => setItemForm({ ...itemForm, aplicaImpuesto: e.target.checked })}
                />
                <span>Este ítem incluye impuestos de ley</span>
              </label>
              <div className="action-row">
                <button className="btn" type="submit">
                  {editingItemId ? 'Guardar cambios' : 'Agregar ítem'}
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
          <section className="card">
            <h2>Ítems actuales</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Ítem</th>
                    <th>Desc.</th>
                    <th>Impuesto</th>
                    <th>Total</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {itemRows.length ? (
                    itemRows.map((item) => (
                      <tr key={item.id}>
                        <td>{item.codigo}</td>
                        <td>
                          <strong>{item.nombre}</strong>
                          <div className="tiny-muted">{item.categoria}</div>
                        </td>
                        <td>{item.descuentoPct ? `${item.descuentoPct}%` : '-'}</td>
                        <td>{item.aplicaImpuesto ? `${item.tasaImpuesto}%` : 'No incluye'}</td>
                        <td>{money(item.total, project.moneda)}</td>
                        <td>
                          <div className="action-row">
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
                      <td colSpan={6} className="muted">Aún no agregaste ítems.</td>
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
          <section className="card">
            <h2>{editingDetailId ? 'Editar subítem' : 'Crear subítem'}</h2>
            <form className="grid" style={{ gap: 12 }} onSubmit={saveDetailLocal}>
              <div className="grid grid-2">
                <div className="field">
                  <label>Ítem</label>
                  <select value={detailForm.itemId} onChange={(e) => setDetailForm({ ...detailForm, itemId: e.target.value })}>
                    <option value="">Selecciona un ítem</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.codigo} · {item.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Tipo</label>
                  <select value={detailForm.tipo} onChange={(e) => setDetailForm({ ...detailForm, tipo: e.target.value })}>
                    <option>Material</option>
                    <option>Mano de obra</option>
                    <option>Servicio</option>
                    <option>Instalación</option>
                    <option>Transporte</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Descripción</label>
                <input value={detailForm.descripcion} onChange={(e) => setDetailForm({ ...detailForm, descripcion: e.target.value })} />
              </div>
              <div className="grid grid-3">
                <div className="field">
                  <label>Proveedor</label>
                  <input value={detailForm.proveedor} onChange={(e) => setDetailForm({ ...detailForm, proveedor: e.target.value })} />
                </div>
                <div className="field">
                  <label>Unidad</label>
                  <input value={detailForm.unidad} onChange={(e) => setDetailForm({ ...detailForm, unidad: e.target.value })} />
                </div>
                <div className="field">
                  <label>Cantidad</label>
                  <input type="number" value={detailForm.cantidad} onChange={(e) => setDetailForm({ ...detailForm, cantidad: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-3">
                <div className="field">
                  <label>Costo unitario</label>
                  <input type="number" value={detailForm.costoUnitario} onChange={(e) => setDetailForm({ ...detailForm, costoUnitario: e.target.value })} />
                </div>
                <div className="field">
                  <label>Utilidad (%)</label>
                  <input type="number" value={detailForm.tasaUtilidad} onChange={(e) => setDetailForm({ ...detailForm, tasaUtilidad: e.target.value })} />
                </div>
                <div className="field">
                  <label>Especificación</label>
                  <input value={detailForm.especificacion} onChange={(e) => setDetailForm({ ...detailForm, especificacion: e.target.value })} />
                </div>
              </div>
              <div className="action-row">
                <button className="btn" type="submit">
                  {editingDetailId ? 'Guardar cambios' : 'Agregar subítem'}
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
          <section className="card">
            <h2>Subítems actuales</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ítem</th>
                    <th>Descripción</th>
                    <th>Cantidad</th>
                    <th>Total</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {details.length ? (
                    details.map((row) => {
                      const item = items.find((x) => x.id === row.itemId)
                      const base = Number(row.cantidad || 0) * Number(row.costoUnitario || 0)
                      const total = base * (1 + Number(row.tasaUtilidad || 0) / 100)
                      return (
                        <tr key={row.id}>
                          <td>{item?.codigo || '-'}</td>
                          <td>
                            <strong>{row.descripcion}</strong>
                            <div className="tiny-muted">{row.proveedor || '-'} · {row.tipo}</div>
                          </td>
                          <td>{row.cantidad} {row.unidad}</td>
                          <td>{money(total, project.moneda)}</td>
                          <td>
                            <div className="action-row">
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
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="muted">Aún no agregaste subítems.</td>
                    </tr>
                  )}
                </tbody>
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
          gap: 8px;
        }
        .field label {
          color: rgba(255, 255, 255, 0.88);
          font-size: 0.96rem;
          font-weight: 700;
        }
        .cotizador-theme input, .cotizador-theme select, .cotizador-theme textarea {
          width: 100%;
          border: 1px solid rgba(171, 231, 240, 0.34);
          border-radius: 16px;
          padding: 14px 16px;
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
          min-height: 110px;
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
          padding: 9px 14px;
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
        }
      `}</style>
    </main>
  )
}







