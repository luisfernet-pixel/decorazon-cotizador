'use client'

import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import StatusBanner from '@/components/StatusBanner'
import { COMPANY } from '@/lib/company'
import { hasSupabaseEnv, supabase } from '@/lib/supabase'

const TABLES = {
  resources: 'resource_catalog',
  projects: 'projects',
  items: 'project_items',
  details: 'project_details',
}

const initialProject = {
  numero: '',
  nombreProyecto: '',
  empresa: '',
  responsable: '',
  fecha: new Date().toISOString().slice(0, 10),
  validoHasta: '',
  moneda: 'BOB',
  condicionesPago: '50% anticipo / 50% contra entrega',
  tiempoEntrega: 'A coordinar según alcance',
  observaciones: '',
}

const initialResource = {
  tipo: 'Material',
  categoria: 'Acrílicos',
  nombre: '',
  especificacion: '',
  unidad: 'unidad',
  proveedor: '',
  costo: 0,
}

const initialItem = {
  codigo: '',
  nombre: '',
  categoria: 'General',
  descripcion: '',
  aplicaImpuesto: true,
  tasaImpuesto: COMPANY.defaultTaxRate ?? 19,
  descuentoEspecial: 0,
}

const initialDetail = {
  itemId: '',
  tipo: 'Material',
  descripcion: '',
  proveedor: '',
  unidad: 'unidad',
  cantidad: 1,
  costoUnitario: 0,
  tasaUtilidad: COMPANY.defaultMarginRate ?? 100,
  especificacion: '',
}

function money(value, currency = 'BOB') {
  return new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Number(value || 0))
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function resourceMeta(row) {
  try {
    return row.notes ? JSON.parse(row.notes) : {}
  } catch {
    return {}
  }
}

function formatMoneyPdf(value, currency = 'BOB') {
  const num = Number(value || 0)
  const fixed = num.toFixed(2)
  const [intPart, decPart] = fixed.split('.')
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const prefix = currency === 'USD' ? '$us ' : 'Bs '
  return `${prefix}${withThousands},${decPart}`
}

function safeText(value) {
  return String(value || '').trim()
}

function normalizeQuoteNumber(value) {
  return String(value || '').replace(/-?\s*COPIA/gi, '').trim()
}

function formatDateDisplay(value) {
  const raw = String(value || '').trim()
  if (!raw) return '-'
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) return `${match[3]}-${match[2]}-${match[1]}`
  return raw
}


function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function getLogoDataUrl() {
  try {
    const response = await fetch('/logo.png')
    if (!response.ok) return null
    const blob = await response.blob()
    const dataUrl = await blobToDataUrl(blob)
    return typeof dataUrl === 'string' ? dataUrl : null
  } catch {
    return null
  }
}

export default function Page() {
  const [activeTab, setActiveTab] = useState('inicio')
  const [project, setProject] = useState(initialProject)
  const [resourceForm, setResourceForm] = useState(initialResource)
  const [itemForm, setItemForm] = useState(initialItem)
  const [detailForm, setDetailForm] = useState(initialDetail)

  const [resources, setResources] = useState([])
  const [history, setHistory] = useState([])
  const [items, setItems] = useState([])
  const [details, setDetails] = useState([])

  const [savingResource, setSavingResource] = useState(false)
  const [savingProject, setSavingProject] = useState(false)

  const [editingResourceId, setEditingResourceId] = useState(null)
  const [editingItemId, setEditingItemId] = useState(null)
  const [editingDetailId, setEditingDetailId] = useState(null)
  const [editingProjectId, setEditingProjectId] = useState(null)

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

    const mapped = (data || []).map((row) => ({
      id: row.id,
      numero: row.quote_number || '',
      nombreProyecto: row.project_name || '',
      empresa: row.company_name || '',
      responsable: row.responsible || '',
      fecha: row.date || row.created_at || '',
      moneda: row.currency || 'BOB',
      condicionesPago: row.payment_terms || '',
      tiempoEntrega: row.delivery_time || '',
      observaciones: row.notes || '',
      validoHasta: row.valid_until || '',
    }))

    setHistory(mapped)
  }

  useEffect(() => {
    loadResources()
    loadHistory()
  }, [])

  const itemRows = useMemo(() => {
    return items.map((item) => {
      const related = details.filter((d) => d.itemId === item.id)
      const subtotal = related.reduce((acc, row) => {
        const base = Number(row.cantidad || 0) * Number(row.costoUnitario || 0)
        const total = base * (1 + Number(row.tasaUtilidad || 0) / 100)
        return acc + total
      }, 0)
      const descuentoPct = Number(item.descuentoEspecial || 0)
      const descuento = subtotal * (descuentoPct / 100)
      const baseConDescuento = subtotal - descuento
      const impuesto = item.aplicaImpuesto ? baseConDescuento * (Number(item.tasaImpuesto || 0) / 100) : 0
      return {
        ...item,
        subtotal,
        descuentoPct,
        descuento,
        baseConDescuento,
        impuesto,
        total: baseConDescuento + impuesto,
      }
    })
  }, [items, details])

  const totalProyecto = itemRows.reduce((acc, row) => acc + row.total, 0)

  function resetCotizacionActual() {
    setProject(initialProject)
    setItems([])
    setDetails([])
    setEditingProjectId(null)
    setEditingItemId(null)
    setEditingDetailId(null)
    setItemForm(initialItem)
    setDetailForm(initialDetail)
  }

  async function downloadPdf() {
    if (!itemRows.length) {
      alert('Primero agrega al menos un ítem.')
      return
    }

    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 14

    const green = [20, 128, 110]
    const greenDark = [0, 92, 84]
    const dark = [31, 41, 55]
    const soft = [248, 250, 252]
    const line = [226, 232, 240]

    const logoDataUrl = await getLogoDataUrl()

    doc.setFillColor(...greenDark)
    doc.rect(0, 0, pageWidth, 18, 'F')

    doc.setFillColor(255, 255, 255)
    doc.roundedRect(margin, 20, 64, 34, 2.5, 2.5, 'F')

    if (logoDataUrl) {
      try {
        const props = doc.getImageProperties(logoDataUrl)
        const maxW = 40
        const maxH = 20
        const ratio = Math.min(maxW / props.width, maxH / props.height)
        const imgW = props.width * ratio
        const imgH = props.height * ratio
        const imgX = margin + 8
        const imgY = 27 + (20 - imgH) / 2
        doc.addImage(logoDataUrl, 'PNG', imgX, imgY, imgW, imgH)
      } catch {}
    } else {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...greenDark)
      doc.setFontSize(18)
      doc.text(COMPANY.name || 'DecoraZon', margin, 34)
    }

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...dark)
    doc.setFontSize(22)
    doc.text('COTIZACIÓN', pageWidth - margin, 31, { align: 'right' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(90, 90, 90)
    doc.text(`Nro: ${normalizeQuoteNumber(project.numero) || '-'}`, pageWidth - margin, 39, { align: 'right' })
    doc.text(`Fecha: ${formatDateDisplay(project.fecha)}`, pageWidth - margin, 44, { align: 'right' })

    let y = 55

    doc.setFillColor(...soft)
    doc.setDrawColor(...line)
    doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 3, 3, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...greenDark)
    doc.text('DATOS DEL CLIENTE / PROYECTO', margin + 4, y + 6)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(35, 35, 35)
    doc.text(`Proyecto: ${safeText(project.nombreProyecto) || '-'}`, margin + 4, y + 13)
    doc.text(`Empresa: ${safeText(project.empresa) || '-'}`, margin + 4, y + 19)
    doc.text(`Responsable: ${safeText(project.responsable) || '-'}`, margin + 4, y + 25)

    const showDiscountColumn = itemRows.some((item) => Number(item.descuento || 0) > 0)
    const showTaxColumn = itemRows.some((item) => item.aplicaImpuesto && Number(item.impuesto || 0) > 0)

    const tableHead = [['CÓDIGO', 'ÍTEM', 'DETALLE', 'SUBTOTAL']]
    if (showDiscountColumn) tableHead[0].push('DESC.')
    if (showTaxColumn) tableHead[0].push('IMPUESTO')
    tableHead[0].push('TOTAL')

    const tableBody = itemRows.map((item) => {
      const row = [
        safeText(item.codigo) || '-',
        safeText(item.nombre) || '-',
        safeText(item.descripcion) || '-',
        formatMoneyPdf(item.subtotal || 0, project.moneda),
      ]
      if (showDiscountColumn) row.push(Number(item.descuento || 0) > 0 ? formatMoneyPdf(item.descuento || 0, project.moneda) : '-')
      if (showTaxColumn) row.push(item.aplicaImpuesto ? formatMoneyPdf(item.impuesto || 0, project.moneda) : 'No incluye')
      row.push(formatMoneyPdf(item.total || 0, project.moneda))
      return row
    })

    autoTable(doc, {
      startY: y + 36,
      head: tableHead,
      body: tableBody,
      theme: 'grid',
      margin: { left: margin, right: margin, top: 24, bottom: 18 },
      styles: {
        font: 'helvetica',
        fontSize: 8.7,
        cellPadding: 3.2,
        textColor: [30, 30, 30],
        lineColor: line,
        lineWidth: 0.2,
        valign: 'top',
      },
      headStyles: {
        fillColor: greenDark,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        lineColor: greenDark,
        lineWidth: 0.2,
      },
      alternateRowStyles: {
        fillColor: [252, 252, 252],
      },
      columnStyles: showDiscountColumn && showTaxColumn
        ? {
            0: { cellWidth: 18 },
            1: { cellWidth: 30 },
            2: { cellWidth: 54 },
            3: { cellWidth: 22, halign: 'right' },
            4: { cellWidth: 20, halign: 'right' },
            5: { cellWidth: 22, halign: 'right' },
            6: { cellWidth: 24, halign: 'right' },
          }
        : showDiscountColumn || showTaxColumn
          ? {
              0: { cellWidth: 18 },
              1: { cellWidth: 32 },
              2: { cellWidth: 60 },
              3: { cellWidth: 24, halign: 'right' },
              4: { cellWidth: 22, halign: 'right' },
              5: { cellWidth: 26, halign: 'right' },
            }
          : {
              0: { cellWidth: 18 },
              1: { cellWidth: 38 },
              2: { cellWidth: 68 },
              3: { cellWidth: 28, halign: 'right' },
              4: { cellWidth: 28, halign: 'right' },
            },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          doc.setFillColor(...greenDark)
          doc.rect(0, 0, pageWidth, 18, 'F')

          doc.setFont('helvetica', 'bold')
          doc.setTextColor(255, 255, 255)
          doc.setFontSize(14)
          doc.text(COMPANY.name || 'DecoraZon', margin, 11)

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.text(`Página ${data.pageNumber}`, pageWidth - margin, 11, { align: 'right' })
        }

        doc.setDrawColor(210, 214, 220)
        doc.setLineWidth(0.2)
        doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(100, 100, 100)
        doc.text(
          `${safeText(COMPANY.address)}${COMPANY.phones?.length ? ` · ${COMPANY.phones.join(' / ')}` : ''}${COMPANY.email ? ` · ${COMPANY.email}` : ''} · La Paz - Bolivia`,
          margin,
          pageHeight - 7
        )
      },
    })

    const tableEndY = doc.lastAutoTable?.finalY || 120
    let footerY = tableEndY + 8

    if (footerY > pageHeight - 50) {
      doc.addPage()

      for (let i = 0; i < pageWidth; i += 2) {
        const ratio = i / pageWidth
        const r = green[0] + (greenDark[0] - green[0]) * ratio
        const g = green[1] + (greenDark[1] - green[1]) * ratio
        const b = green[2] + (greenDark[2] - green[2]) * ratio
        doc.setFillColor(r, g, b)
        doc.rect(i, 0, 2, 18, 'F')
      }

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(14)
      doc.text(COMPANY.name || 'DecoraZon', margin, 11)

      doc.setDrawColor(210, 214, 220)
      doc.setLineWidth(0.2)
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      doc.text(
        `${safeText(COMPANY.address)}${COMPANY.phones?.length ? ` · ${COMPANY.phones.join(' / ')}` : ''}${COMPANY.email ? ` · ${COMPANY.email}` : ''} · La Paz - Bolivia`,
        margin,
        pageHeight - 7
      )

      footerY = 30
    }

    const leftW = 122
    const rightW = pageWidth - margin * 2 - leftW - 6

    doc.setFillColor(...soft)
    doc.setDrawColor(...line)
    doc.roundedRect(margin, footerY, leftW, 32, 3, 3, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...greenDark)
    doc.text('CONDICIONES COMERCIALES', margin + 4, footerY + 7)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(40, 40, 40)
    doc.text(`Pago: ${safeText(project.condicionesPago) || '-'}`, margin + 4, footerY + 14)
    doc.text(`Entrega: ${safeText(project.tiempoEntrega) || '-'}`, margin + 4, footerY + 20)

    const obsText = `Observaciones: ${safeText(project.observaciones) || '-'}`
    const obsLines = doc.splitTextToSize(obsText, leftW - 8)
    doc.text(obsLines, margin + 4, footerY + 26)

    const totalX = margin + leftW + 6

    doc.setFillColor(...greenDark)
    doc.setDrawColor(...greenDark)
    doc.roundedRect(totalX, footerY, rightW, 32, 3, 3, 'FD')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(230, 230, 230)
    doc.text('TOTAL GENERAL', totalX + rightW - 4, footerY + 11, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(255, 255, 255)
    doc.text(formatMoneyPdf(totalProyecto, project.moneda), totalX + rightW - 4, footerY + 22, { align: 'right' })

    const thanksY = footerY + 42
    if (thanksY < pageHeight - 16) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      doc.setTextColor(110, 110, 110)
      doc.text('Gracias por la oportunidad de presentar esta propuesta.', margin, thanksY)
    }

    const safeNumber = (normalizeQuoteNumber(project.numero) || 'cotizacion').replace(/[^\w\-]+/g, '_')
    doc.save(`${safeNumber}.pdf`)
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
    alert(editingResourceId ? 'Recurso actualizado.' : 'Recurso guardado.')
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
      descuentoEspecial: item.descuentoEspecial || 0,
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
          quote_number: normalizeQuoteNumber(project.numero) || `COT-${Date.now()}`,
          project_name: project.nombreProyecto.trim(),
          company_name: project.empresa.trim(),
          responsible: project.responsable.trim(),
          date: project.fecha,
          valid_until: project.validoHasta || null,
          currency: project.moneda,
          payment_terms: project.condicionesPago,
          delivery_time: project.tiempoEntrega,
          notes: project.observaciones,
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
          quote_number: normalizeQuoteNumber(project.numero) || `COT-${Date.now()}`,
          project_name: project.nombreProyecto.trim(),
          company_name: project.empresa.trim(),
          responsible: project.responsable.trim(),
          date: project.fecha,
          valid_until: project.validoHasta || null,
          currency: project.moneda,
          payment_terms: project.condicionesPago,
          delivery_time: project.tiempoEntrega,
          notes: project.observaciones,
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
    alert(editingProjectId ? 'Cotización actualizada.' : 'Cotización guardada.')
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
      empresa: row.empresa || '',
      responsable: row.responsable || '',
      fecha: String(row.fecha || '').slice(0, 10),
      validoHasta: row.validoHasta || '',
      moneda: row.moneda || 'BOB',
      condicionesPago: row.condicionesPago || '',
      tiempoEntrega: row.tiempoEntrega || '',
      observaciones: row.observaciones || '',
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
    setProject((prev) => ({ ...prev, numero: normalizeQuoteNumber(prev.numero) }))
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

  const tabs = [
    ['inicio', 'Inicio'],
    ['proyecto', 'Proyecto'],
    ['items', 'Ítems'],
    ['subitems', 'Subítems'],
    ['recursos', 'Recursos'],
    ['cotizacion', 'Cotización'],
    ['historial', 'Historial'],
  ]

  const showDashboardHeader = false

  return (
    <main className="page grid" style={{ gap: 20 }}>
      {showDashboardHeader && (
        <>
          <section className="hero">
            <div className="hero-head">
              <div>
                <div className="badge" style={{ background: 'rgba(255,255,255,.14)', color: 'white' }}>
                  DecoraZon · App completa
                </div>
                <h1 style={{ marginBottom: 8 }}>Cotizador DecoraZon</h1>
                <p style={{ maxWidth: 860, lineHeight: 1.5 }}>
                  Recursos, cotizaciones, historial, edición y PDF listos para uso real.
                </p>
                <p style={{ opacity: 0.9, marginBottom: 0 }}>
                  {COMPANY.name} · {COMPANY.phones.join(' / ')} · {COMPANY.email}
                </p>
              </div>
              <div className="hero-logo-wrap" style={{ background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src="/logo.png"
                  alt="DecoraZon"
                  className="hero-logo"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            </div>
          </section>

          <div className="grid grid-3">
            <div className="card">
              <div className="badge">Recursos</div>
              <div className="kpi">{resources.length}</div>
              <div className="muted">Catálogo compartido</div>
            </div>
            <div className="card">
              <div className="badge">Promedio costo base</div>
              <div className="kpi">{money(promedioRecursos)}</div>
              <div className="muted">Leído desde Supabase</div>
            </div>
            <div className="card">
              <div className="badge">Total cotización actual</div>
              <div className="kpi">{money(totalProyecto, project.moneda)}</div>
              <div className="muted">Impuesto por ítem</div>
            </div>
          </div>

          <StatusBanner connected={hasSupabaseEnv} />
        </>
      )}

      <div className="tabs">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className={`tab-btn ${activeTab === id ? 'active' : ''}`}
            onClick={() => setActiveTab(id)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'inicio' && (
        <section className="card">
          <h2>Inicio</h2>
          <p className="muted">Flujo sugerido: Proyecto → Ítems → Subítems → Cotización → Guardar en Supabase.</p>
        </section>
      )}

      {activeTab === 'proyecto' && (
        <section className="card">
          <h2>Datos del proyecto</h2>

          <div className="action-row" style={{ marginBottom: 12 }}>
            <button type="button" className="btn secondary" onClick={resetCotizacionActual}>
              Nueva cotización
            </button>
          </div>

          <div className="grid grid-3">
            <div className="field">
              <label>Nro. cotización</label>
              <input value={normalizeQuoteNumber(project.numero)} onChange={(e) => setProject({ ...project, numero: normalizeQuoteNumber(e.target.value) })} />
            </div>
            <div className="field">
              <label>Nombre del proyecto</label>
              <input value={project.nombreProyecto} onChange={(e) => setProject({ ...project, nombreProyecto: e.target.value })} />
            </div>
            <div className="field">
              <label>Empresa</label>
              <input value={project.empresa} onChange={(e) => setProject({ ...project, empresa: e.target.value })} />
            </div>
            <div className="field">
              <label>Responsable</label>
              <input value={project.responsable} onChange={(e) => setProject({ ...project, responsable: e.target.value })} />
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
              <label>Condiciones de pago</label>
              <input value={project.condicionesPago} onChange={(e) => setProject({ ...project, condicionesPago: e.target.value })} />
            </div>
            <div className="field">
              <label>Tiempo de entrega</label>
              <input value={project.tiempoEntrega} onChange={(e) => setProject({ ...project, tiempoEntrega: e.target.value })} />
            </div>
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <label>Observaciones</label>
            <textarea rows={4} value={project.observaciones} onChange={(e) => setProject({ ...project, observaciones: e.target.value })} />
          </div>
        </section>
      )}

      {activeTab === 'items' && (
        <div className="grid grid-2">
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
                    <th>Descuento</th>
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
                            <button type="button" className="mini-btn" onClick={() => editItem(item)}>
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
        <div className="grid grid-2">
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
                              <button type="button" className="mini-btn" onClick={() => editDetail(row)}>
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
        <div className="grid grid-2">
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
                  {savingResource ? 'Guardando...' : editingResourceId ? 'Guardar cambios' : 'Guardar recurso en Supabase'}
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
                            <button type="button" className="mini-btn" onClick={() => editResource(row)}>
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
      )}

      {activeTab === 'cotizacion' && (
        <section className="card">
          <div className="quote-head">
            <div>
              <img
                src="/logo.png"
                alt="DecoraZon"
                className="quote-logo"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
              <h2 style={{ marginTop: 10 }}>{COMPANY.name}</h2>
              <div className="muted">{COMPANY.address}</div>
              <div className="muted">{COMPANY.phones.join(' / ')}</div>
              <div className="muted">{COMPANY.email}</div>
            </div>

            <div className="quote-box">
              <div><strong>Cotización:</strong> {normalizeQuoteNumber(project.numero) || 'Sin número'}</div>
              <div><strong>Proyecto:</strong> {project.nombreProyecto || '-'}</div>
              <div><strong>Empresa:</strong> {project.empresa || '-'}</div>
              <div><strong>Responsable:</strong> {project.responsable || '-'}</div>
              <div><strong>Fecha:</strong> {formatDateDisplay(project.fecha)}</div>
            </div>
          </div>

          <div className="table-wrap" style={{ marginTop: 18 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '11%' }}>Código</th>
                  <th style={{ width: '18%' }}>Ítem</th>
                  <th style={{ width: '29%' }}>Detalle</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>Subtotal</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Desc.</th>
                  <th style={{ width: '8%', textAlign: 'right' }}>Imp.</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {itemRows.length ? (
                  itemRows.map((item) => (
                    <tr key={item.id}>
                      <td>{item.codigo}</td>
                      <td>
                        <strong>{item.nombre}</strong>
                      </td>
                      <td>
                        <div>{item.descripcion || '-'}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>{money(item.subtotal, project.moneda)}</td>
                      <td style={{ textAlign: 'right' }}>{item.descuento ? money(item.descuento, project.moneda) : '-'}</td>
                      <td style={{ textAlign: 'right' }}>{item.aplicaImpuesto ? money(item.impuesto, project.moneda) : 'No'}</td>
                      <td style={{ textAlign: 'right' }}><strong>{money(item.total, project.moneda)}</strong></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="muted">Aún no hay cotización armada.</td>
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
              <div className="muted">Impuestos: {itemRows.some((item) => item.aplicaImpuesto) ? 'Según ítem' : 'No incluye'}</div>
            </div>
            <div className="quote-box">
              <strong>Total general</strong>
              <div className="muted">Descuento total: {money(itemRows.reduce((acc, item) => acc + Number(item.descuento || 0), 0), project.moneda)}</div>
              <div className="kpi" style={{ fontSize: 28 }}>{money(totalProyecto, project.moneda)}</div>
            </div>
          </div>

          <div className="action-row">
            <button type="button" className="btn" onClick={saveProjectCloud} disabled={savingProject}>
              {savingProject ? 'Guardando...' : editingProjectId ? 'Guardar cambios' : 'Guardar cotización en Supabase'}
            </button>

            <button type="button" className="btn secondary" onClick={downloadPdf}>
              Imprimir / PDF
            </button>
          </div>
        </section>
      )}

      {activeTab === 'historial' && (
        <section className="card">
          <h2>Historial compartido</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nro.</th>
                  <th>Proyecto</th>
                  <th>Empresa</th>
                  <th>Responsable</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {history.length ? (
                  history.map((row) => (
                    <tr key={row.id}>
                      <td>{normalizeQuoteNumber(row.numero)}</td>
                      <td>{row.nombreProyecto}</td>
                      <td>{row.empresa || '-'}</td>
                      <td>{row.responsable || '-'}</td>
                      <td>{String(row.fecha || '-').slice(0, 10)}</td>
                      <td>
                        <div className="action-row">
                          <button type="button" className="mini-btn" onClick={() => openProjectFromHistory(row)}>
                            Abrir
                          </button>
                          <button type="button" className="mini-btn" onClick={() => duplicateProjectFromHistory(row)}>
                            Duplicar
                          </button>
                          <button type="button" className="mini-btn danger" onClick={() => deleteProjectFromHistory(row.id)}>
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
      )}
    </main>
  )
}