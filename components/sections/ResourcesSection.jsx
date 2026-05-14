import { Fragment, useEffect, useMemo, useState } from 'react'
import { INITIAL_SUPPLIERS } from '@/lib/resource-master'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value) {
  return value ? String(value).slice(0, 10) : '-'
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

function readAttribute(row, key) {
  if (row?.attributes && typeof row.attributes === 'object' && row.attributes[key]) {
    return String(row.attributes[key])
  }
  const spec = String(row?.especificacion || '')
  const part = spec.split('|').map((item) => item.trim()).find((item) => item.toLowerCase().startsWith(`${key.toLowerCase()}:`))
  return part ? part.split(':').slice(1).join(':').trim() : ''
}

function normalizeThickness(value) {
  const clean = String(value || '').trim()
  if (!clean) return ''
  return clean.toLowerCase().endsWith('mm') ? clean : `${clean}mm`
}

function materialKey(row) {
  return row?.resourceTemplateId || row?.nombre || 'sin-material'
}
const ORDER_STORAGE_KEYS = {
  materials: 'decorazon_resources_material_order_v1',
  rows: 'decorazon_resources_row_order_v1',
  suppliers: 'decorazon_resources_supplier_order_v1',
}

function readOrderMap(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function persistOrderMap(storageKey, map) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(map))
  } catch {}
}

function emptyRowDraft(base = {}) {
  return {
    variante: base.variante || '',
    proveedor: base.proveedor && base.proveedor !== '-' ? base.proveedor : '',
    medida: base.medida || '122x244',
    espesor: normalizeThickness(base.espesor || ''),
    unidad: base.unidad || 'unidad',
    costo: Number(base.costo || 0),
    includesTax: !!base.includesTax,
    fechaActualizacion: base.fechaActualizacion || today(),
    notes: base.notes || '',
  }
}

export default function ResourcesSection({
  resources = [],
  resourceCategories = [],
  suppliers = [],
  resourceMasterReady = false,
  money,
  addResourceToDetail,
  deleteResource,
  saveSupplierFromResources,
  deleteSupplierFromResources,
  saveCategoryFromResources,
  moveCategoryFromResources,
  deleteCategoryFromResources,
  updateMasterResourceRow,
  updateResourceTemplateFromResources,
  saveVariationFromResources,
  deleteResourceTemplateFromResources,
  saveAdvancedResource,
}) {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState({})
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [providersOpen, setProvidersOpen] = useState(false)
  const [libraryTab, setLibraryTab] = useState('productos')
  const [editMaterial, setEditMaterial] = useState(null)
  const [editRow, setEditRow] = useState(null)
  const [addRowMaterial, setAddRowMaterial] = useState(null)
  const [materialDraft, setMaterialDraft] = useState({ nombre: '', espesores: '3, 6, 9, 12, 15, 18', proveedor: '', medida: '122x244', unidad: 'unidad' })
  const [rowDraft, setRowDraft] = useState(emptyRowDraft())
  const [materialNewSupplier, setMaterialNewSupplier] = useState('')
  const [rowNewSupplier, setRowNewSupplier] = useState('')
  const [supplierDraft, setSupplierDraft] = useState({ id: '', name: '', phone: '', notes: '', active: true })
  const [categoryDraft, setCategoryDraft] = useState({ id: '', name: '', kind: 'Material', parent_id: '', active: true })
  const [materialOrderMap, setMaterialOrderMap] = useState({})
  const [rowOrderMap, setRowOrderMap] = useState({})
  const [supplierOrderMap, setSupplierOrderMap] = useState({})

  useEffect(() => {
    setMaterialOrderMap(readOrderMap(ORDER_STORAGE_KEYS.materials))
    setRowOrderMap(readOrderMap(ORDER_STORAGE_KEYS.rows))
    setSupplierOrderMap(readOrderMap(ORDER_STORAGE_KEYS.suppliers))
  }, [])

  const suppliersList = useMemo(
    () => unique([...suppliers.map((supplier) => supplier.name), ...INITIAL_SUPPLIERS, ...resources.map((row) => row.proveedor).filter((name) => name && name !== '-')]),
    [resources, suppliers]
  )
  const defaultSupplier = suppliersList[0] || 'DecoraZon CNC'

  const rows = useMemo(() => {
    return resources.map((row) => ({
      ...row,
      medida: readAttribute(row, 'Tamano') || row.tamano || '',
      espesor: normalizeThickness(readAttribute(row, 'Espesor') || row.espesor || ''),
    }))
  }, [resources])

  const orderedSuppliers = useMemo(() => {
    const fallbackCompare = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es')
    return [...suppliers].sort((a, b) => {
      const av = Number(supplierOrderMap[a.id] || 0)
      const bv = Number(supplierOrderMap[b.id] || 0)
      if (av !== bv) return av - bv
      return fallbackCompare(a, b)
    })
  }, [suppliers, supplierOrderMap])

  const materials = useMemo(() => {
    const term = query.trim().toLowerCase()
    const map = new Map()
    rows.forEach((row) => {
      const haystack = [row.nombre, row.proveedor, row.medida, row.espesor, row.unidad, row.costo].join(' ').toLowerCase()
      if (term && !haystack.includes(term)) return
      const key = materialKey(row)
      if (!map.has(key)) {
        map.set(key, {
          key,
          nombre: row.nombre || 'Sin nombre',
          sample: row,
          rows: [],
        })
      }
      map.get(key).rows.push(row)
    })
    return Array.from(map.values())
      .map((material) => ({
        ...material,
        rows: [...material.rows].sort((a, b) => {
          const aKey = `${material.key}::${a.resourceVariantId || a.id}`
          const bKey = `${material.key}::${b.resourceVariantId || b.id}`
          const ao = Number(rowOrderMap[aKey] || 0)
          const bo = Number(rowOrderMap[bKey] || 0)
          if (ao !== bo) return ao - bo
          return Number.parseFloat(a.espesor) - Number.parseFloat(b.espesor)
        }),
      }))
      .sort((a, b) => {
        const ao = Number(materialOrderMap[a.key] || 0)
        const bo = Number(materialOrderMap[b.key] || 0)
        if (ao !== bo) return ao - bo
        return a.nombre.localeCompare(b.nombre, 'es')
      })
  }, [query, rows, materialOrderMap, rowOrderMap])
  const parentCategories = useMemo(
    () => resourceCategories
      .filter((category) => !category.parent_id)
      .sort((a, b) => {
        const bySort = Number(a.sort_order || 0) - Number(b.sort_order || 0)
        if (bySort !== 0) return bySort
        return String(a.name || '').localeCompare(String(b.name || ''), 'es')
      }),
    [resourceCategories]
  )
  const categoriesById = useMemo(
    () => new Map(resourceCategories.map((category) => [category.id, category])),
    [resourceCategories]
  )
  const sortedCategories = useMemo(() => {
    const bySortThenName = (a, b) => {
      const bySort = Number(a.sort_order || 0) - Number(b.sort_order || 0)
      if (bySort !== 0) return bySort
      return String(a.name || '').localeCompare(String(b.name || ''), 'es')
    }
    const orderedParents = resourceCategories.filter((row) => !row.parent_id).sort(bySortThenName)
    const rows = []
    orderedParents.forEach((parent) => {
      rows.push(parent)
      const children = resourceCategories.filter((row) => row.parent_id === parent.id).sort(bySortThenName)
      rows.push(...children)
    })
    return rows
  }, [resourceCategories])
  const categoryMoveState = useMemo(() => {
    const groups = resourceCategories.reduce((acc, row) => {
      const key = row.parent_id || '__root__'
      if (!acc[key]) acc[key] = []
      acc[key].push(row)
      return acc
    }, {})
    const bySortThenName = (a, b) => {
      const bySort = Number(a.sort_order || 0) - Number(b.sort_order || 0)
      if (bySort !== 0) return bySort
      return String(a.name || '').localeCompare(String(b.name || ''), 'es')
    }
    const state = new Map()
    Object.values(groups).forEach((group) => {
      const sorted = group.sort(bySortThenName)
      sorted.forEach((row, index) => {
        state.set(row.id, {
          canUp: index > 0,
          canDown: index < sorted.length - 1,
        })
      })
    })
    return state
  }, [resourceCategories])

  function showFeedback(message) {
    setFeedback(message)
    window.setTimeout(() => setFeedback(''), 2200)
  }

  function openCreateMaterial() {
    setMaterialDraft({ nombre: '', espesores: '3, 6, 9, 12, 15, 18', proveedor: defaultSupplier, medida: '122x244', unidad: 'unidad' })
    setMaterialNewSupplier('')
    setCreateOpen(true)
  }

  async function submitCreateMaterial(event) {
    event.preventDefault()
    const nombre = materialDraft.nombre.trim()
    if (!nombre) {
      alert('Escribe el nombre del material.')
      return
    }
    const espesores = materialDraft.espesores
      .split(',')
      .map((item) => normalizeThickness(item))
      .filter(Boolean)
    if (!espesores.length) {
      alert('Agrega al menos un espesor.')
      return
    }
    const proveedor = materialDraft.proveedor === '__new__'
      ? String(materialNewSupplier || '').trim()
      : (materialDraft.proveedor || defaultSupplier)
    if (!proveedor) {
      alert('Selecciona o escribe un proveedor.')
      return
    }
    const variants = espesores.map((espesor, index) => ({
      key: `v${index + 1}`,
      name: `${nombre} ${espesor}`,
      sku: '',
      unit: materialDraft.unidad || 'unidad',
      attributes: { Tamano: materialDraft.medida || '', Espesor: espesor },
      active: true,
    }))
    const prices = variants.map((variant, index) => ({
      key: `p${index + 1}`,
      variantKey: variant.key,
      supplierName: proveedor,
      cost: 0,
      includesTax: false,
      effectiveFrom: today(),
      lastCheckedAt: today(),
      notes: '',
    }))

    setSaving(true)
    await saveAdvancedResource({
      kind: 'Material',
      parentCategory: 'Materiales',
      categoryName: nombre,
      templateName: nombre,
      description: '',
      baseUnit: materialDraft.unidad || 'unidad',
      active: true,
      attributes: [],
      variants,
      prices,
    })
    setSaving(false)
    setCreateOpen(false)
  }

  function openEditMaterial(material) {
    setEditMaterial(material.sample)
    setMaterialDraft({ nombre: material.nombre, espesores: '', proveedor: defaultSupplier, medida: '', unidad: material.sample.unidad || 'unidad' })
  }

  async function submitEditMaterial(event) {
    event.preventDefault()
    if (!editMaterial) return
    const nombre = materialDraft.nombre.trim()
    if (!nombre) {
      alert('El material necesita nombre.')
      return
    }
    setSaving(true)
    const ok = await updateResourceTemplateFromResources(editMaterial, {
      tipo: 'Material',
      parentCategory: 'Materiales',
      categoria: nombre,
      subcategoria: '',
      nombre,
      unidad: materialDraft.unidad || editMaterial.unidad || 'unidad',
      active: true,
      notes: '',
    })
    setSaving(false)
    if (ok) {
      setEditMaterial(null)
      showFeedback('Material actualizado.')
    }
  }

  function openAddRow(material) {
    setAddRowMaterial(material.sample)
    setRowDraft(emptyRowDraft({ proveedor: defaultSupplier, unidad: material.sample.unidad || 'unidad' }))
    setRowNewSupplier('')
  }

  function openEditRow(row) {
    setEditRow(row)
    setRowDraft(emptyRowDraft(row))
    setRowNewSupplier('')
  }

  async function submitAddRow(event) {
    event.preventDefault()
    if (!addRowMaterial) return
    const nextDraft = { ...rowDraft, espesor: normalizeThickness(rowDraft.espesor) }
    const variante = String(nextDraft.variante || '').trim() || `${addRowMaterial.nombre} ${nextDraft.espesor || 'General'}`
    setSaving(true)
    const proveedor = nextDraft.proveedor === '__new__'
      ? String(rowNewSupplier || '').trim()
      : (nextDraft.proveedor || defaultSupplier)
    if (!proveedor) {
      alert('Selecciona o escribe un proveedor.')
      setSaving(false)
      return
    }
    const ok = await saveVariationFromResources(addRowMaterial, {
      ...nextDraft,
      variante,
      proveedor,
    })
    setSaving(false)
    if (ok) {
      setAddRowMaterial(null)
      showFeedback('Subcategoria agregada.')
    }
  }

  async function submitEditRow(event) {
    event.preventDefault()
    if (!editRow) return
    const nextDraft = { ...rowDraft, espesor: normalizeThickness(rowDraft.espesor) }
    const spec = []
    if (nextDraft.medida) spec.push(`Tamano: ${nextDraft.medida}`)
    if (nextDraft.espesor) spec.push(`Espesor: ${nextDraft.espesor}`)
    const variante = String(nextDraft.variante || '').trim() || `${editRow.nombre} ${nextDraft.espesor || 'General'}`
    setSaving(true)
    const proveedor = nextDraft.proveedor === '__new__'
      ? String(rowNewSupplier || '').trim()
      : (nextDraft.proveedor || defaultSupplier)
    if (!proveedor) {
      alert('Selecciona o escribe un proveedor.')
      setSaving(false)
      return
    }
    const ok = await updateMasterResourceRow(editRow, {
      ...editRow,
      proveedor,
      medida: nextDraft.medida,
      espesor: nextDraft.espesor,
      unidad: nextDraft.unidad || 'unidad',
      costo: Number(nextDraft.costo || 0),
      includesTax: !!nextDraft.includesTax,
      fechaActualizacion: nextDraft.fechaActualizacion || today(),
      variante,
      especificacion: spec.join(' | '),
      notes: nextDraft.notes || '',
    })
    setSaving(false)
    if (ok) {
      setEditRow(null)
      showFeedback('Registro actualizado.')
    }
  }

  async function duplicateRow(row) {
    setSaving(true)
    const ok = await saveVariationFromResources(row, {
      ...emptyRowDraft(row),
      variante: `${row.variante || `${row.nombre} ${row.espesor || 'General'}`} copia`,
      proveedor: row.proveedor || defaultSupplier,
    })
    setSaving(false)
    if (ok) showFeedback('Registro duplicado.')
  }

  async function submitSupplier(event) {
    event.preventDefault()
    if (!supplierDraft.name.trim()) {
      alert('Escribe el nombre del proveedor.')
      return
    }
    setSaving(true)
    await saveSupplierFromResources(supplierDraft)
    setSaving(false)
    setSupplierDraft({ id: '', name: '', phone: '', notes: '', active: true })
  }
  function reorderMapFromKeys(keys) {
    return keys.reduce((acc, key, index) => {
      acc[key] = (index + 1) * 10
      return acc
    }, {})
  }
  function moveMaterial(materialId, direction) {
    const ids = materials.map((m) => m.key)
    const index = ids.findIndex((id) => id === materialId)
    if (index < 0) return
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= ids.length) return
    const next = [...ids]
    ;[next[index], next[target]] = [next[target], next[index]]
    const nextMap = reorderMapFromKeys(next)
    const merged = { ...materialOrderMap, ...nextMap }
    setMaterialOrderMap(merged)
    persistOrderMap(ORDER_STORAGE_KEYS.materials, merged)
    showFeedback('Orden de productos actualizado.')
  }
  function moveRow(materialId, rowId, direction) {
    const material = materials.find((m) => m.key === materialId)
    if (!material) return
    const ids = material.rows.map((row) => `${materialId}::${row.resourceVariantId || row.id}`)
    const key = `${materialId}::${rowId}`
    const index = ids.findIndex((id) => id === key)
    if (index < 0) return
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= ids.length) return
    const next = [...ids]
    ;[next[index], next[target]] = [next[target], next[index]]
    const nextMap = reorderMapFromKeys(next)
    const merged = { ...rowOrderMap, ...nextMap }
    setRowOrderMap(merged)
    persistOrderMap(ORDER_STORAGE_KEYS.rows, merged)
    showFeedback('Orden de subcategorias actualizado.')
  }
  function moveSupplier(supplierId, direction) {
    const ids = orderedSuppliers.map((supplier) => supplier.id)
    const index = ids.findIndex((id) => id === supplierId)
    if (index < 0) return
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= ids.length) return
    const next = [...ids]
    ;[next[index], next[target]] = [next[target], next[index]]
    const nextMap = reorderMapFromKeys(next)
    const merged = { ...supplierOrderMap, ...nextMap }
    setSupplierOrderMap(merged)
    persistOrderMap(ORDER_STORAGE_KEYS.suppliers, merged)
    showFeedback('Orden de proveedores actualizado.')
  }

  async function submitCategory(event) {
    event.preventDefault()
    if (!categoryDraft.name.trim()) {
      alert('Escribe el nombre de la categoria.')
      return
    }
    setSaving(true)
    await saveCategoryFromResources({
      ...categoryDraft,
      parent_id: categoryDraft.parent_id || null,
    })
    setSaving(false)
    setCategoryDraft({ id: '', name: '', kind: 'Material', parent_id: '', active: true })
  }

  return (
    <div className="resources-master">
      <section className="card resources-main">
        <div className="library-head">
          <div>
            <span className="eyebrow">Biblioteca</span>
            <h2>Catalogo maestro y base de costos</h2>
            <p className="muted">Consulta productos reutilizables, categorias y proveedores sin salir del flujo de cotizacion.</p>
          </div>
        </div>
        <div className="library-tabs" role="tablist" aria-label="Biblioteca">
          <button type="button" className={libraryTab === 'productos' ? 'active' : ''} onClick={() => setLibraryTab('productos')}>Productos</button>
          <button type="button" className={libraryTab === 'categorias' ? 'active' : ''} onClick={() => setLibraryTab('categorias')}>Categorias</button>
          <button type="button" className={libraryTab === 'proveedores' ? 'active' : ''} onClick={() => setLibraryTab('proveedores')}>Proveedores</button>
        </div>
        {libraryTab === 'productos' && (
          <>
        <div className="resources-toolbar">
          <div className="field search-field">
            <label>Buscar material</label>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Acrilico, trupan, MDF..." />
          </div>
          <button className="btn" type="button" onClick={openCreateMaterial}>Crear material</button>
        </div>

        {!resourceMasterReady ? <div className="status-pill warning">Modo compatible activo</div> : null}
        {feedback ? <div className="tiny-muted" style={{ margin: '8px 0' }}>{feedback}</div> : null}

        <div className="table-wrap tabla-container resources-table-wrap">
          <table className="resources-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Proveedor</th>
                <th>Tamano</th>
                <th>Espesor</th>
                <th>Unidad</th>
                <th>Precio</th>
                <th>Impuesto</th>
                <th>Fecha actualizacion</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!materials.length ? (
                <tr>
                  <td colSpan={9} className="muted" style={{ textAlign: 'center', padding: 28 }}>Sin materiales creados.</td>
                </tr>
              ) : materials.map((material) => (
                <Fragment key={material.key}>
                  <tr className="group-row">
                    <td colSpan={9}>
                      <div className="resource-group-head">
                        <button type="button" className="group-toggle" onClick={() => setCollapsed((prev) => ({ ...prev, [material.key]: !(prev[material.key] ?? true) }))}>
                          <span>{(collapsed[material.key] ?? true) ? '>' : 'v'}</span>
                          <strong>{material.nombre}</strong>
                          <span className="tiny-muted">{material.rows.length} subcategoria(s)</span>
                        </button>
                        <div className="compact-actions">
                          <button type="button" className="mini-btn" onClick={() => moveMaterial(material.key, 'up')} title="Subir producto">↑</button>
                          <button type="button" className="mini-btn" onClick={() => moveMaterial(material.key, 'down')} title="Bajar producto">↓</button>
                          <button type="button" className="mini-btn" onClick={() => openAddRow(material)}>Agregar subcategoria</button>
                          <button type="button" className="mini-btn success" onClick={() => openEditMaterial(material)}>Editar material</button>
                          <button type="button" className="mini-btn danger" onClick={() => deleteResourceTemplateFromResources(material.sample)}>Eliminar material</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                  {(collapsed[material.key] ?? true) ? null : material.rows.map((row) => (
                    <tr key={`${material.key}-${row.id}-${row.supplierPriceId || row.proveedor}`}>
                      <td>
                        <strong>{material.nombre}</strong>
                        <div className="tiny-muted">{row.variante || '-'}</div>
                      </td>
                      <td>{row.proveedor || '-'}</td>
                      <td>{row.medida || '-'}</td>
                      <td>{row.espesor || '-'}</td>
                      <td>{row.unidad || '-'}</td>
                      <td><strong>{money(row.costo, 'BOB')}</strong></td>
                      <td>{row.includesTax ? 'Si' : 'No'}</td>
                      <td>{formatDate(row.fechaActualizacion)}</td>
                      <td>
                        <div className="compact-actions">
                          <button className="mini-btn" type="button" onClick={() => moveRow(material.key, row.resourceVariantId || row.id, 'up')} title="Subir subcategoria">↑</button>
                          <button className="mini-btn" type="button" onClick={() => moveRow(material.key, row.resourceVariantId || row.id, 'down')} title="Bajar subcategoria">↓</button>
                          <button className="btn-cargar" type="button" onClick={() => addResourceToDetail(row)}>Cargar</button>
                          <button className="mini-btn" type="button" onClick={() => duplicateRow(row)} disabled={saving}>Duplicar</button>
                          <button className="mini-btn success" type="button" onClick={() => openEditRow(row)}>Editar</button>
                          <button className="mini-btn danger" type="button" onClick={() => deleteResource(row)}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="resources-mobile-list">
          {!materials.length ? (
            <div className="muted">Sin materiales creados.</div>
          ) : materials.map((material) => (
            <article key={`mcard-${material.key}`} className="resources-mobile-card">
              <h3>{material.nombre}</h3>
              <div className="resources-mobile-actions">
                <button type="button" className="mini-btn" onClick={() => moveMaterial(material.key, 'up')}>↑</button>
                <button type="button" className="mini-btn" onClick={() => moveMaterial(material.key, 'down')}>↓</button>
                <button type="button" className="mini-btn" onClick={() => openAddRow(material)}>Agregar subcategoria</button>
              </div>
              <div className="resources-mobile-sublist">
                {material.rows.map((row) => (
                  <div key={`mrow-${material.key}-${row.id}-${row.supplierPriceId || row.proveedor}`} className="resources-mobile-subcard">
                    <strong>{row.variante || '-'}</strong>
                    <div className="tiny-muted">{row.proveedor || '-'} · {row.medida || '-'} · {row.espesor || '-'}</div>
                    <div className="tiny-muted">{money(row.costo, 'BOB')} · {formatDate(row.fechaActualizacion)}</div>
                    <div className="resources-mobile-actions">
                      <button type="button" className="mini-btn" onClick={() => moveRow(material.key, row.resourceVariantId || row.id, 'up')}>↑</button>
                      <button type="button" className="mini-btn" onClick={() => moveRow(material.key, row.resourceVariantId || row.id, 'down')}>↓</button>
                      <button className="mini-btn" type="button" onClick={() => addResourceToDetail(row)}>Cargar</button>
                      <button className="mini-btn success" type="button" onClick={() => openEditRow(row)}>Editar</button>
                      <button className="mini-btn danger" type="button" onClick={() => deleteResource(row)}>Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
          </>
        )}
        {libraryTab === 'categorias' && (
          <div className="library-panel">
            <form className="grid grid-3 form-compact" onSubmit={submitCategory}>
              <div className="field">
                <label>Categoria / subcategoria</label>
                <input value={categoryDraft.name} onChange={(event) => setCategoryDraft({ ...categoryDraft, name: event.target.value })} placeholder="Materiales, Maderas, Servicios..." />
              </div>
              <div className="field">
                <label>Tipo</label>
                <select value={categoryDraft.kind} onChange={(event) => setCategoryDraft({ ...categoryDraft, kind: event.target.value })}>
                  <option>Material</option>
                  <option>Mano de obra</option>
                  <option>Servicio</option>
                  <option>Instalacion</option>
                  <option>Transporte</option>
                </select>
              </div>
              <div className="field">
                <label>Depende de</label>
                <select value={categoryDraft.parent_id} onChange={(event) => setCategoryDraft({ ...categoryDraft, parent_id: event.target.value })}>
                  <option value="">Categoria principal</option>
                  {parentCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
              <div className="compact-actions" style={{ gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
                {categoryDraft.id ? <button className="btn secondary" type="button" onClick={() => setCategoryDraft({ id: '', name: '', kind: 'Material', parent_id: '', active: true })}>Cancelar</button> : null}
                <button className="btn" type="submit" disabled={saving}>{saving ? 'Guardando...' : categoryDraft.id ? 'Guardar cambios' : 'Crear categoria'}</button>
              </div>
            </form>
            <div className="table-wrap tabla-container categories-table-wrap">
              <table className="library-compact-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Nivel</th>
                    <th>Categoria madre</th>
                    <th>Tipo</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {!resourceCategories.length ? (
                    <tr><td colSpan={5} className="muted">Sin categorias creadas.</td></tr>
                  ) : sortedCategories.map((category) => (
                    <tr key={category.id}>
                      <td><strong>{category.name}</strong></td>
                      <td>{category.parent_id ? 'Subcategoria' : 'Categoria'}</td>
                      <td>{category.parent_id ? categoriesById.get(category.parent_id)?.name || '-' : '-'}</td>
                      <td>{category.kind || 'Material'}</td>
                      <td>
                        <div className="compact-actions">
                          <button
                            className="mini-btn"
                            type="button"
                            onClick={() => moveCategoryFromResources(category.id, 'up')}
                            disabled={!categoryMoveState.get(category.id)?.canUp || saving}
                            title="Subir"
                          >
                            ↑
                          </button>
                          <button
                            className="mini-btn"
                            type="button"
                            onClick={() => moveCategoryFromResources(category.id, 'down')}
                            disabled={!categoryMoveState.get(category.id)?.canDown || saving}
                            title="Bajar"
                          >
                            ↓
                          </button>
                          <button className="mini-btn success" type="button" onClick={() => setCategoryDraft({ id: category.id, name: category.name || '', kind: category.kind || 'Material', parent_id: category.parent_id || '', active: category.active !== false })}>Editar</button>
                          <button className="mini-btn danger" type="button" onClick={() => deleteCategoryFromResources(category.id)}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="resources-mobile-list">
              {!resourceCategories.length ? (
                <div className="muted">Sin categorias creadas.</div>
              ) : sortedCategories.map((category) => (
                <article key={`ccard-${category.id}`} className="resources-mobile-card">
                  <h3>{category.name}</h3>
                  <div className="tiny-muted">{category.parent_id ? `Subcategoria de ${categoriesById.get(category.parent_id)?.name || '-'}` : 'Categoria principal'}</div>
                  <div className="tiny-muted">Tipo: {category.kind || 'Material'}</div>
                  <div className="resources-mobile-actions">
                    <button className="mini-btn" type="button" onClick={() => moveCategoryFromResources(category.id, 'up')} disabled={!categoryMoveState.get(category.id)?.canUp || saving}>↑</button>
                    <button className="mini-btn" type="button" onClick={() => moveCategoryFromResources(category.id, 'down')} disabled={!categoryMoveState.get(category.id)?.canDown || saving}>↓</button>
                    <button className="mini-btn success" type="button" onClick={() => setCategoryDraft({ id: category.id, name: category.name || '', kind: category.kind || 'Material', parent_id: category.parent_id || '', active: category.active !== false })}>Editar</button>
                    <button className="mini-btn danger" type="button" onClick={() => deleteCategoryFromResources(category.id)}>Eliminar</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
        {libraryTab === 'proveedores' && (
          <div className="library-panel">
            <form className="grid grid-3 form-compact" onSubmit={submitSupplier}>
              <div className="field"><label>Proveedor</label><input value={supplierDraft.name} onChange={(event) => setSupplierDraft({ ...supplierDraft, name: event.target.value })} required /></div>
              <div className="field"><label>Telefono</label><input value={supplierDraft.phone} onChange={(event) => setSupplierDraft({ ...supplierDraft, phone: event.target.value })} /></div>
              <div className="field"><label>Rubro</label><input value={supplierDraft.notes} onChange={(event) => setSupplierDraft({ ...supplierDraft, notes: event.target.value })} /></div>
              <div className="compact-actions" style={{ gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
                {supplierDraft.id ? <button className="btn secondary" type="button" onClick={() => setSupplierDraft({ id: '', name: '', phone: '', notes: '', active: true })}>Cancelar</button> : null}
                <button className="btn" type="submit" disabled={saving}>{saving ? 'Guardando...' : supplierDraft.id ? 'Guardar cambios' : 'Crear proveedor'}</button>
              </div>
            </form>
            <div className="table-wrap tabla-container categories-table-wrap">
              <table className="library-compact-table">
                <thead>
                  <tr>
                    <th>Proveedor</th>
                    <th>Telefono</th>
                    <th>Rubro</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {!orderedSuppliers.length ? (
                    <tr><td colSpan={4} className="muted">Sin proveedores creados.</td></tr>
                  ) : orderedSuppliers.map((supplier) => (
                    <tr key={supplier.id}>
                      <td><strong>{supplier.name}</strong></td>
                      <td>{supplier.phone || '-'}</td>
                      <td>{supplier.notes || '-'}</td>
                      <td>
                        <div className="compact-actions">
                          <button type="button" className="mini-btn" onClick={() => moveSupplier(supplier.id, 'up')} title="Subir proveedor">↑</button>
                          <button type="button" className="mini-btn" onClick={() => moveSupplier(supplier.id, 'down')} title="Bajar proveedor">↓</button>
                          <button type="button" className="mini-btn success" onClick={() => setSupplierDraft({ id: supplier.id, name: supplier.name || '', phone: supplier.phone || '', notes: supplier.notes || '', active: supplier.active !== false })}>Editar</button>
                          <button type="button" className="mini-btn danger" onClick={() => deleteSupplierFromResources(supplier.id)}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="resources-mobile-list">
              {!orderedSuppliers.length ? (
                <div className="muted">Sin proveedores creados.</div>
              ) : orderedSuppliers.map((supplier) => (
                <article key={`scard-${supplier.id}`} className="resources-mobile-card">
                  <h3>{supplier.name}</h3>
                  <div className="tiny-muted">Telefono: {supplier.phone || '-'}</div>
                  <div className="tiny-muted">Rubro: {supplier.notes || '-'}</div>
                  <div className="resources-mobile-actions">
                    <button type="button" className="mini-btn" onClick={() => moveSupplier(supplier.id, 'up')}>↑</button>
                    <button type="button" className="mini-btn" onClick={() => moveSupplier(supplier.id, 'down')}>↓</button>
                    <button type="button" className="mini-btn success" onClick={() => setSupplierDraft({ id: supplier.id, name: supplier.name || '', phone: supplier.phone || '', notes: supplier.notes || '', active: supplier.active !== false })}>Editar</button>
                    <button type="button" className="mini-btn danger" onClick={() => deleteSupplierFromResources(supplier.id)}>Eliminar</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      {createOpen && (
        <div className="wizard-modal-backdrop">
          <div className="wizard-modal card">
            <div className="section-head">
              <h3>Crear material</h3>
              <button className="mini-btn" type="button" onClick={() => setCreateOpen(false)}>Cerrar</button>
            </div>
            <form className="grid grid-2" onSubmit={submitCreateMaterial}>
              <div className="field"><label>Material</label><input value={materialDraft.nombre} onChange={(event) => setMaterialDraft({ ...materialDraft, nombre: event.target.value })} placeholder="Trupan" required /></div>
              <div className="field"><label>Espesores</label><input value={materialDraft.espesores} onChange={(event) => setMaterialDraft({ ...materialDraft, espesores: event.target.value })} placeholder="3, 6, 9, 12, 15, 18" /></div>
              <div className="field">
                <label>Proveedor inicial</label>
                <select value={materialDraft.proveedor} onChange={(event) => setMaterialDraft({ ...materialDraft, proveedor: event.target.value })}>
                  {suppliersList.map((supplier) => <option key={supplier} value={supplier}>{supplier}</option>)}
                  <option value="__new__">+ Nuevo proveedor...</option>
                </select>
              </div>
              {materialDraft.proveedor === '__new__' ? (
                <div className="field"><label>Nombre nuevo proveedor</label><input value={materialNewSupplier} onChange={(event) => setMaterialNewSupplier(event.target.value)} /></div>
              ) : null}
              <div className="field"><label>Tamano inicial</label><input value={materialDraft.medida} onChange={(event) => setMaterialDraft({ ...materialDraft, medida: event.target.value })} placeholder="183x244" /></div>
              <div className="field"><label>Unidad</label><input value={materialDraft.unidad} onChange={(event) => setMaterialDraft({ ...materialDraft, unidad: event.target.value })} /></div>
              <div className="compact-actions" style={{ gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
                <button type="button" className="btn secondary" onClick={() => setCreateOpen(false)}>Cancelar</button>
                <button type="submit" className="btn" disabled={saving}>{saving ? 'Guardando...' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editMaterial && (
        <div className="wizard-modal-backdrop">
          <div className="wizard-modal card">
            <div className="section-head">
              <h3>Editar material</h3>
              <button className="mini-btn" type="button" onClick={() => setEditMaterial(null)}>Cerrar</button>
            </div>
            <form className="grid grid-2" onSubmit={submitEditMaterial}>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Material</label><input value={materialDraft.nombre} onChange={(event) => setMaterialDraft({ ...materialDraft, nombre: event.target.value })} required /></div>
              <div className="compact-actions" style={{ gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
                <button type="button" className="btn secondary" onClick={() => setEditMaterial(null)}>Cancelar</button>
                <button type="submit" className="btn" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {providersOpen && (
        <div className="wizard-modal-backdrop">
          <div className="wizard-modal card">
            <div className="section-head">
              <h3>Proveedores</h3>
              <button className="mini-btn" type="button" onClick={() => setProvidersOpen(false)}>Cerrar</button>
            </div>
            <div className="grid" style={{ gap: 12 }}>
              <form className="grid" onSubmit={submitSupplier} style={{ gap: 10 }}>
                <h3>{supplierDraft.id ? 'Editar proveedor' : 'Crear proveedor'}</h3>
                <div className="field"><label>Nombre</label><input value={supplierDraft.name} onChange={(event) => setSupplierDraft({ ...supplierDraft, name: event.target.value })} required /></div>
                <div className="field"><label>Telefono</label><input value={supplierDraft.phone} onChange={(event) => setSupplierDraft({ ...supplierDraft, phone: event.target.value })} /></div>
                <div className="field"><label>Rubro</label><textarea rows={3} value={supplierDraft.notes} onChange={(event) => setSupplierDraft({ ...supplierDraft, notes: event.target.value })} /></div>
                <div className="compact-actions" style={{ justifyContent: 'flex-end' }}>
                  {supplierDraft.id ? <button className="btn secondary" type="button" onClick={() => setSupplierDraft({ id: '', name: '', phone: '', notes: '', active: true })}>Cancelar</button> : null}
                  <button className="btn" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar proveedor'}</button>
                </div>
              </form>
              <div className="table-wrap tabla-container" style={{ maxHeight: 280, overflow: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Proveedor</th>
                      <th>Telefono</th>
                      <th>Rubro</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!suppliers.length ? (
                      <tr>
                        <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 14 }}>Sin proveedores creados.</td>
                      </tr>
                    ) : suppliers.map((supplier) => (
                      <tr key={supplier.id}>
                        <td><strong>{supplier.name}</strong></td>
                        <td>{supplier.phone || '-'}</td>
                        <td>{supplier.notes || '-'}</td>
                        <td>
                          <div className="compact-actions">
                            <button type="button" className="mini-btn success" onClick={() => setSupplierDraft({ id: supplier.id, name: supplier.name || '', phone: supplier.phone || '', notes: supplier.notes || '', active: supplier.active !== false })}>Editar</button>
                            <button type="button" className="mini-btn danger" onClick={() => deleteSupplierFromResources(supplier.id)}>Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {(addRowMaterial || editRow) && (
        <div className="wizard-modal-backdrop">
          <div className="wizard-modal card">
            <div className="section-head">
              <h3>{editRow ? 'Editar subcategoria' : 'Agregar subcategoria'}</h3>
              <button className="mini-btn" type="button" onClick={() => { setAddRowMaterial(null); setEditRow(null) }}>Cerrar</button>
            </div>
            <form className="grid grid-2" onSubmit={editRow ? submitEditRow : submitAddRow}>
              <div className="field"><label>Subcategoria</label><input value={rowDraft.variante} onChange={(event) => setRowDraft({ ...rowDraft, variante: event.target.value })} placeholder="Aluminio maderado" /></div>
              <div className="field">
                <label>Proveedor</label>
                <select value={rowDraft.proveedor} onChange={(event) => setRowDraft({ ...rowDraft, proveedor: event.target.value })}>
                  {suppliersList.map((supplier) => <option key={supplier} value={supplier}>{supplier}</option>)}
                  <option value="__new__">+ Nuevo proveedor...</option>
                </select>
              </div>
              {rowDraft.proveedor === '__new__' ? (
                <div className="field"><label>Nombre nuevo proveedor</label><input value={rowNewSupplier} onChange={(event) => setRowNewSupplier(event.target.value)} /></div>
              ) : null}
              <div className="field"><label>Tamano</label><input value={rowDraft.medida} onChange={(event) => setRowDraft({ ...rowDraft, medida: event.target.value })} placeholder="122x244" /></div>
              <div className="field"><label>Espesor</label><input value={rowDraft.espesor} onChange={(event) => setRowDraft({ ...rowDraft, espesor: event.target.value })} onBlur={() => setRowDraft((current) => ({ ...current, espesor: normalizeThickness(current.espesor) }))} placeholder="3mm" /></div>
              <div className="field"><label>Unidad</label><input value={rowDraft.unidad} onChange={(event) => setRowDraft({ ...rowDraft, unidad: event.target.value })} /></div>
              <div className="field"><label>Precio</label><input type="number" min="0" step="0.01" value={rowDraft.costo} onChange={(event) => setRowDraft({ ...rowDraft, costo: Number(event.target.value || 0) })} /></div>
              <div className="field"><label>Fecha actualizacion</label><input type="date" value={rowDraft.fechaActualizacion} onChange={(event) => setRowDraft({ ...rowDraft, fechaActualizacion: event.target.value })} /></div>
              <label className="check-row light" style={{ gridColumn: '1 / -1' }}><input type="checkbox" checked={rowDraft.includesTax} onChange={(event) => setRowDraft({ ...rowDraft, includesTax: event.target.checked })} /> Incluye impuesto</label>
              <div className="compact-actions" style={{ gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
                <button type="button" className="btn secondary" onClick={() => { setAddRowMaterial(null); setEditRow(null) }}>Cancelar</button>
                <button type="submit" className="btn" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
