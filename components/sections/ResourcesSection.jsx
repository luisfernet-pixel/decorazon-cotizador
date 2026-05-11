import { useMemo, useState } from 'react'
import { initialResource } from '@/lib/initial-state'

const CUSTOM_TAXONOMY_KEY = 'decorazon_resource_taxonomy_v1'

const RESOURCE_TREE = {
  Material: {
    categories: {
      Maderas: {
        subcategories: {
          Melaminas: {
            colors: ['blanca', 'otros colores', 'maderados'],
            thicknesses: ['15mm', '18mm'],
            sizes: ['185x244', '185x273'],
            providers: ['MADCenter', 'Cimal', 'Cynergy'],
          },
          'Trupan MDF': {
            colors: ['sin color'],
            thicknesses: ['3mm', '6mm', '9mm', '12mm', '15mm', '18mm'],
            sizes: ['185x274', '185x275'],
            providers: ['Cimal', 'Synergy'],
          },
          Pino: {
            colors: ['natural'],
            thicknesses: ['11mm', '15mm'],
            sizes: ['122x244'],
            providers: ['Cynergy'],
          },
        },
      },
      Acrilicos: {
        subcategories: {
          Transparente: {
            colors: ['transparente'],
            thicknesses: ['1mm', '2mm', '3mm', '4mm', '5mm', '8mm', '10mm'],
            sizes: ['122x244'],
            providers: ['Acricolor'],
          },
          Lechozo: {
            colors: ['lechozo'],
            thicknesses: ['3mm', '4mm'],
            sizes: ['122x244'],
            providers: ['Acricolor'],
          },
          Negro: {
            colors: ['negro'],
            thicknesses: ['3mm'],
            sizes: ['122x244'],
            providers: ['Acricolor'],
          },
        },
      },
      'Policarbonato (Taquirol)': {
        subcategories: {
          Transparente: {
            colors: ['transparente'],
            thicknesses: ['1mm', '2mm', '3mm', '4mm', '5mm'],
            sizes: ['100x150', '100x151', '100x152', '100x153', '100x154'],
            providers: ['Camion Gato', 'Taxi', 'Decorazon'],
          },
        },
      },
    },
  },
  'Mano de obra': {
    categories: {
      General: {
        subcategories: {
          General: {
            colors: [],
            thicknesses: [],
            sizes: [],
            providers: ['Gato', 'Jaime', 'Ramiro', 'Americo'],
          },
        },
      },
    },
  },
  Servicio: {
    categories: {
      'Corte CNC': {
        subcategories: {
          General: {
            colors: [],
            thicknesses: [],
            sizes: [],
            providers: ['Decorazon CNC'],
          },
        },
      },
    },
  },
  Instalacion: {
    categories: {
      General: {
        subcategories: {
          General: {
            colors: [],
            thicknesses: [],
            sizes: [],
            providers: ['Gato', 'Jaime', 'Ramiro', 'Americo'],
          },
        },
      },
    },
  },
  Transporte: {
    categories: {
      General: {
        subcategories: {
          General: {
            colors: [],
            thicknesses: [],
            sizes: [],
            providers: ['Camion Gato', 'Taxi', 'Decorazon'],
          },
        },
      },
    },
  },
}

function getCategoryNode(type, category, subcategory) {
  const typeNode = RESOURCE_TREE[type]
  if (!typeNode) return null
  const catNode = typeNode.categories?.[category]
  if (!catNode) return null
  return catNode.subcategories?.[subcategory] || null
}

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
  renameCategoryEverywhere,
  deleteCategoryEverywhere,
  renameSubcategoryEverywhere,
  deleteSubcategoryEverywhere,
}) {
  const [subcategoryFilter, setSubcategoryFilter] = useState('')
  const [customTaxonomy, setCustomTaxonomy] = useState(() => {
    if (typeof window === 'undefined') return {}
    try {
      return JSON.parse(window.localStorage.getItem(CUSTOM_TAXONOMY_KEY) || '{}') || {}
    } catch {
      return {}
    }
  })
  const [selectedManagerCategory, setSelectedManagerCategory] = useState('')

  function persistTaxonomy(next) {
    setCustomTaxonomy(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CUSTOM_TAXONOMY_KEY, JSON.stringify(next))
    }
  }

  function ensureTypeCategory(type, category) {
    const next = { ...customTaxonomy }
    next[type] = { ...(next[type] || {}) }
    next[type][category] = [...(next[type][category] || [])]
    return next
  }

  const typeOptions = useMemo(() => Object.keys(RESOURCE_TREE), [])

  const categoryOptions = useMemo(() => {
    const set = new Set()
    Object.keys(RESOURCE_TREE[resourceForm.tipo]?.categories || {}).forEach((v) => set.add(v))
    Object.keys(customTaxonomy?.[resourceForm.tipo] || {}).forEach((v) => set.add(v))
    resources.forEach((r) => {
      if (String(r.tipo || '') === String(resourceForm.tipo || '')) {
        const category = String(r.categoria || '').trim()
        if (category) set.add(category)
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [resourceForm.tipo, customTaxonomy, resources])

  const subcategoryOptions = useMemo(() => {
    const set = new Set()
    const categoryNode = RESOURCE_TREE[resourceForm.tipo]?.categories?.[resourceForm.categoria]
    Object.keys(categoryNode?.subcategories || {}).forEach((v) => set.add(v))
    ;(customTaxonomy?.[resourceForm.tipo]?.[resourceForm.categoria] || []).forEach((v) => set.add(v))
    resources.forEach((r) => {
      if (
        String(r.tipo || '') === String(resourceForm.tipo || '') &&
        String(r.categoria || '') === String(resourceForm.categoria || '')
      ) {
        const sub = String(r.subcategoria || '').trim()
        if (sub) set.add(sub)
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [resourceForm.tipo, resourceForm.categoria, customTaxonomy, resources])

  const selectedNode = useMemo(
    () => getCategoryNode(resourceForm.tipo, resourceForm.categoria, resourceForm.subcategoria),
    [resourceForm.tipo, resourceForm.categoria, resourceForm.subcategoria]
  )

  const providerOptions = selectedNode?.providers || []
  const espesorOptions = selectedNode?.thicknesses || []
  const tamanoOptions = selectedNode?.sizes || []
  const colorOptions = selectedNode?.colors || []

  const managerCategories = useMemo(() => categoryOptions, [categoryOptions])
  const managerCategory = selectedManagerCategory || managerCategories[0] || ''

  const managerSubcategories = useMemo(() => {
    if (!managerCategory) return []
    const set = new Set()
    Object.keys(RESOURCE_TREE[resourceForm.tipo]?.categories?.[managerCategory]?.subcategories || {}).forEach((v) => set.add(v))
    ;(customTaxonomy?.[resourceForm.tipo]?.[managerCategory] || []).forEach((v) => set.add(v))
    resources.forEach((r) => {
      if (String(r.tipo || '') === String(resourceForm.tipo || '') && String(r.categoria || '') === managerCategory) {
        const sub = String(r.subcategoria || '').trim()
        if (sub) set.add(sub)
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [resourceForm.tipo, managerCategory, customTaxonomy, resources])

  const subcategories = useMemo(() => {
    const set = new Set()
    resources.forEach((r) => {
      const value = String(r.subcategoria || '').trim()
      if (value) set.add(value)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [resources])

  const visibleResources = useMemo(() => {
    const filter = String(subcategoryFilter || '').trim().toLowerCase()
    if (!filter) return resources
    return resources.filter((r) => String(r.subcategoria || '').trim().toLowerCase() === filter)
  }, [resources, subcategoryFilter])

  async function createCategory() {
    const raw = prompt('Nueva categoria')
    const name = String(raw || '').trim()
    if (!name) return
    const next = ensureTypeCategory(resourceForm.tipo, name)
    persistTaxonomy(next)
    setSelectedManagerCategory(name)
    setResourceForm((prev) => ({ ...prev, categoria: name, subcategoria: '' }))
  }

  async function renameCategory(category) {
    const raw = prompt('Nuevo nombre de categoria', category)
    const nextName = String(raw || '').trim()
    if (!nextName || nextName === category) return
    await renameCategoryEverywhere(resourceForm.tipo, category, nextName)
    const next = ensureTypeCategory(resourceForm.tipo, nextName)
    const oldSub = next[resourceForm.tipo]?.[category] || []
    const currentSub = next[resourceForm.tipo]?.[nextName] || []
    next[resourceForm.tipo][nextName] = Array.from(new Set([...currentSub, ...oldSub]))
    delete next[resourceForm.tipo][category]
    persistTaxonomy(next)
    setSelectedManagerCategory(nextName)
  }

  async function removeCategory(category) {
    if (!confirm(`Eliminar categoria "${category}" y limpiar ese valor en recursos relacionados?`)) return
    await deleteCategoryEverywhere(resourceForm.tipo, category)
    const next = { ...customTaxonomy }
    next[resourceForm.tipo] = { ...(next[resourceForm.tipo] || {}) }
    delete next[resourceForm.tipo][category]
    persistTaxonomy(next)
    if (selectedManagerCategory === category) setSelectedManagerCategory('')
  }

  function createSubcategory() {
    if (!managerCategory) {
      alert('Primero selecciona una categoria.')
      return
    }
    const raw = prompt('Nueva subcategoria')
    const name = String(raw || '').trim()
    if (!name) return
    const next = ensureTypeCategory(resourceForm.tipo, managerCategory)
    next[resourceForm.tipo][managerCategory] = Array.from(new Set([...(next[resourceForm.tipo][managerCategory] || []), name]))
    persistTaxonomy(next)
    setResourceForm((prev) => ({ ...prev, categoria: managerCategory, subcategoria: name }))
  }

  async function renameSubcategory(subcategory) {
    if (!managerCategory) return
    const raw = prompt('Nuevo nombre de subcategoria', subcategory)
    const nextName = String(raw || '').trim()
    if (!nextName || nextName === subcategory) return
    await renameSubcategoryEverywhere(resourceForm.tipo, managerCategory, subcategory, nextName)
    const next = ensureTypeCategory(resourceForm.tipo, managerCategory)
    next[resourceForm.tipo][managerCategory] = Array.from(
      new Set((next[resourceForm.tipo][managerCategory] || []).map((s) => (s === subcategory ? nextName : s)))
    )
    persistTaxonomy(next)
  }

  async function removeSubcategory(subcategory) {
    if (!managerCategory) return
    if (!confirm(`Eliminar subcategoria "${subcategory}" y limpiar ese valor en recursos relacionados?`)) return
    await deleteSubcategoryEverywhere(resourceForm.tipo, managerCategory, subcategory)
    const next = ensureTypeCategory(resourceForm.tipo, managerCategory)
    next[resourceForm.tipo][managerCategory] = (next[resourceForm.tipo][managerCategory] || []).filter((s) => s !== subcategory)
    persistTaxonomy(next)
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <section className="card compact-card">
        <h2>{editingResourceId ? 'Editar recurso' : 'Alta rapida de recurso'}</h2>
        <form className="grid form-compact" style={{ gap: 10 }} onSubmit={saveResource}>
          <div className="resources-compact-grid resources-row-1">
            <div className="field">
              <label>Tipo</label>
              <select
                value={resourceForm.tipo}
                onChange={(e) => {
                  const nextType = e.target.value
                  const nextCategory = Object.keys(RESOURCE_TREE[nextType]?.categories || {})[0] || ''
                  const nextSubcategory = Object.keys(RESOURCE_TREE[nextType]?.categories?.[nextCategory]?.subcategories || {})[0] || ''
                  setResourceForm((prev) => ({
                    ...prev,
                    tipo: nextType,
                    categoria: nextCategory,
                    subcategoria: nextSubcategory,
                    proveedor: '',
                    espesor: '',
                    tamano: '',
                  }))
                }}
              >
                {typeOptions.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Categoria</label>
              <input
                list="resource-category-options"
                value={resourceForm.categoria || ''}
                onChange={(e) => {
                  const nextCategory = e.target.value
                  const nextSubcategory = Object.keys(RESOURCE_TREE[resourceForm.tipo]?.categories?.[nextCategory]?.subcategories || {})[0] || ''
                  setResourceForm((prev) => ({
                    ...prev,
                    categoria: nextCategory,
                    subcategoria: nextSubcategory || prev.subcategoria || '',
                    proveedor: '',
                    espesor: '',
                    tamano: '',
                  }))
                }}
                placeholder="Ej: Maderas"
              />
              <datalist id="resource-category-options">
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            <div className="field">
              <label>Subcategoria</label>
              <input
                list="resource-subcategory-options"
                value={resourceForm.subcategoria || ''}
                onChange={(e) => {
                  const nextSub = e.target.value
                  setResourceForm((prev) => ({
                    ...prev,
                    subcategoria: nextSub,
                    proveedor: '',
                    espesor: '',
                    tamano: '',
                  }))
                }}
                placeholder="Ej: Trupan MDF"
              />
              <datalist id="resource-subcategory-options">
                {subcategoryOptions.map((sub) => (
                  <option key={sub} value={sub} />
                ))}
              </datalist>
            </div>

            <div className="field">
              <label>Proveedor</label>
              {providerOptions.length ? (
                <select
                  value={resourceForm.proveedor || ''}
                  onChange={(e) => setResourceForm({ ...resourceForm, proveedor: e.target.value })}
                >
                  <option value="">Seleccionar</option>
                  {providerOptions.map((provider) => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={resourceForm.proveedor || ''}
                  onChange={(e) => setResourceForm({ ...resourceForm, proveedor: e.target.value })}
                  placeholder="Proveedor libre"
                />
              )}
            </div>
          </div>

          <div className="resources-compact-grid resources-row-2">
            <div className="field resources-spec">
              <label>Especificacion / Color</label>
              <input
                list="resource-color-options"
                value={resourceForm.especificacion}
                onChange={(e) => setResourceForm({ ...resourceForm, especificacion: e.target.value })}
              />
              <datalist id="resource-color-options">
                {colorOptions.map((color) => (
                  <option key={color} value={color} />
                ))}
              </datalist>
            </div>
            <div className="field resources-unit">
              <label>Unidad</label>
              <input value={resourceForm.unidad} onChange={(e) => setResourceForm({ ...resourceForm, unidad: e.target.value })} />
            </div>
            <div className="field resources-cost">
              <label>Costo base</label>
              <input type="number" value={resourceForm.costo} onChange={(e) => setResourceForm({ ...resourceForm, costo: e.target.value })} />
            </div>
            <div className="field resources-date">
              <label>Fecha de actualizacion</label>
              <input
                type="date"
                value={resourceForm.fechaActualizacion || ''}
                onChange={(e) => setResourceForm({ ...resourceForm, fechaActualizacion: e.target.value })}
              />
            </div>
          </div>

          <div className="resources-compact-grid resources-row-3">
            <div className="field">
              <label>Nombre</label>
              <input value={resourceForm.nombre} onChange={(e) => setResourceForm({ ...resourceForm, nombre: e.target.value })} />
            </div>
            <div className="field">
              <label>Espesor</label>
              <input
                list="resource-thickness-options"
                value={resourceForm.espesor || ''}
                onChange={(e) => setResourceForm({ ...resourceForm, espesor: e.target.value })}
                placeholder="Ej: 18mm"
              />
              <datalist id="resource-thickness-options">
                {espesorOptions.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
            <div className="field">
              <label>Tamano</label>
              <input
                list="resource-size-options"
                value={resourceForm.tamano || ''}
                onChange={(e) => setResourceForm({ ...resourceForm, tamano: e.target.value })}
                placeholder="Ej: 122x244"
              />
              <datalist id="resource-size-options">
                {tamanoOptions.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="action-row sticky-form-actions">
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
                Cancelar edicion
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card compact-card">
        <h2>Categorias y subcategorias (CRUD)</h2>
        <div className="action-row" style={{ marginBottom: 12 }}>
          <button type="button" className="mini-btn" onClick={createCategory}>+ Categoria</button>
          <button type="button" className="mini-btn" onClick={createSubcategory}>+ Subcategoria</button>
        </div>
        <div className="resources-filter-row">
          <div className="field" style={{ maxWidth: 280 }}>
            <label>Categoria activa</label>
            <select value={managerCategory} onChange={(e) => setSelectedManagerCategory(e.target.value)}>
              {(managerCategories.length ? managerCategories : ['']).map((cat) => (
                <option key={cat || 'empty'} value={cat}>{cat || 'Sin categoria'}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-wrap" style={{ marginBottom: 12 }}>
          <table className="compact-table">
            <thead>
              <tr><th>Categorias</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {managerCategories.length ? managerCategories.map((cat) => (
                <tr key={cat}>
                  <td>{cat}</td>
                  <td>
                    <div className="action-row compact-actions">
                      <button type="button" className="mini-btn success" onClick={() => renameCategory(cat)}>Renombrar</button>
                      <button type="button" className="mini-btn danger" onClick={() => removeCategory(cat)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              )) : <tr><td colSpan={2} className="muted">No hay categorias.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="table-wrap" style={{ marginBottom: 6 }}>
          <table className="compact-table">
            <thead>
              <tr><th>Subcategorias de {managerCategory || '-'}</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {managerSubcategories.length ? managerSubcategories.map((sub) => (
                <tr key={sub}>
                  <td>{sub}</td>
                  <td>
                    <div className="action-row compact-actions">
                      <button type="button" className="mini-btn success" onClick={() => renameSubcategory(sub)}>Renombrar</button>
                      <button type="button" className="mini-btn danger" onClick={() => removeSubcategory(sub)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              )) : <tr><td colSpan={2} className="muted">No hay subcategorias.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card compact-card">
        <h2>Recursos guardados</h2>

        <div className="resources-filter-row">
          <div className="field" style={{ maxWidth: 280 }}>
            <label>Filtrar por subcategoria</label>
            <select value={subcategoryFilter} onChange={(e) => setSubcategoryFilter(e.target.value)}>
              <option value="">Todas</option>
              {subcategories.map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table className="compact-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Nombre</th>
                <th>Categoria</th>
                <th>Subcategoria</th>
                <th>Espesor</th>
                <th>Tamano</th>
                <th>Proveedor</th>
                <th>Fecha actualizacion</th>
                <th>Costo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleResources.length ? (
                visibleResources.map((row) => (
                  <tr key={row.id}>
                    <td>{row.tipo}</td>
                    <td>
                      <strong>{row.nombre}</strong>
                      <div className="tiny-muted">{row.especificacion || '-'}</div>
                    </td>
                    <td>{row.categoria || '-'}</td>
                    <td>{row.subcategoria || '-'}</td>
                    <td>{row.espesor || '-'}</td>
                    <td>{row.tamano || '-'}</td>
                    <td>{row.proveedor || '-'}</td>
                    <td>{String(row.fechaActualizacion || '-').slice(0, 10)}</td>
                    <td>{money(row.costo, 'BOB')}</td>
                    <td>
                      <div className="action-row compact-actions">
                        <button type="button" className="mini-btn" onClick={() => addResourceToDetail(row)}>Cargar</button>
                        <button type="button" className="mini-btn success" onClick={() => editResource(row)}>Editar</button>
                        <button type="button" className="mini-btn danger" onClick={() => deleteResource(row.id)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="muted">Aun no hay recursos guardados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
