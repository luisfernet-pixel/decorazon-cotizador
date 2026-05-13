import { useMemo, useState } from 'react'
import { initialResource } from '@/lib/initial-state'

const CUSTOM_TAXONOMY_KEY = 'decorazon_resource_taxonomy_v1'

const RESOURCE_TREE = {
  Material: {
    categories: {
      Maderas: {
        subcategories: {
          Melaminas: { colors: ['blanca', 'otros colores', 'maderados'], thicknesses: ['15mm', '18mm'], sizes: ['185x244', '185x273'], providers: ['MADCenter', 'Cimal', 'Cynergy'] },
          'Trupan MDF': { colors: ['sin color'], thicknesses: ['3mm', '6mm', '9mm', '12mm', '15mm', '18mm'], sizes: ['185x274', '185x275'], providers: ['Cimal', 'Synergy'] },
          Pino: { colors: ['natural'], thicknesses: ['11mm', '15mm'], sizes: ['122x244'], providers: ['Cynergy'] },
        },
      },
      Acrilicos: {
        subcategories: {
          Transparente: { colors: ['transparente'], thicknesses: ['1mm', '2mm', '3mm', '4mm', '5mm', '8mm', '10mm'], sizes: ['122x244'], providers: ['Acricolor'] },
          Lechozo: { colors: ['lechozo'], thicknesses: ['3mm', '4mm'], sizes: ['122x244'], providers: ['Acricolor'] },
          Negro: { colors: ['negro'], thicknesses: ['3mm'], sizes: ['122x244'], providers: ['Acricolor'] },
        },
      },
      'Policarbonato (Taquirol)': {
        subcategories: {
          Transparente: { colors: ['transparente'], thicknesses: ['1mm', '2mm', '3mm', '4mm', '5mm'], sizes: ['100x150', '100x151', '100x152', '100x153', '100x154'], providers: ['Camion Gato', 'Taxi', 'Decorazon'] },
        },
      },
    },
  },
  'Mano de obra': {
    categories: { General: { subcategories: { General: { colors: [], thicknesses: [], sizes: [], providers: ['Gato', 'Jaime', 'Ramiro', 'Americo'] } } } },
  },
  Servicio: {
    categories: { 'Corte CNC': { subcategories: { General: { colors: [], thicknesses: [], sizes: [], providers: ['Decorazon CNC'] } } } },
  },
  Instalacion: {
    categories: { General: { subcategories: { General: { colors: [], thicknesses: [], sizes: [], providers: ['Gato', 'Jaime', 'Ramiro', 'Americo'] } } } },
  },
  Transporte: {
    categories: { General: { subcategories: { General: { colors: [], thicknesses: [], sizes: [], providers: ['Camion Gato', 'Taxi', 'Decorazon'] } } } },
  },
}

function getNode(type, cat, sub) {
  return RESOURCE_TREE[type]?.categories?.[cat]?.subcategories?.[sub] || null
}

function getCats(tipo, customTaxonomy, resources) {
  const set = new Set()
  Object.keys(RESOURCE_TREE[tipo]?.categories || {}).forEach((v) => set.add(v))
  Object.keys(customTaxonomy?.[tipo] || {}).forEach((v) => set.add(v))
  resources.forEach((r) => {
    if (String(r.tipo || '') === String(tipo || '')) {
      const c = String(r.categoria || '').trim()
      if (c && c !== '-') set.add(c)
    }
  })
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
}

function getSubs(tipo, cat, customTaxonomy, resources) {
  const set = new Set()
  Object.keys(RESOURCE_TREE[tipo]?.categories?.[cat]?.subcategories || {}).forEach((v) => set.add(v))
  ;(customTaxonomy?.[tipo]?.[cat] || []).forEach((v) => set.add(v))
  resources.forEach((r) => {
    if (String(r.tipo || '') === String(tipo || '') && String(r.categoria || '') === String(cat || '')) {
      const s = String(r.subcategoria || '').trim()
      if (s) set.add(s)
    }
  })
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
}

export default function ResourcesSection({
  editingResourceId, resourceForm, setResourceForm, saveResource, savingResource,
  setEditingResourceId, resources, money, addResourceToDetail, editResource, deleteResource,
  renameCategoryEverywhere, deleteCategoryEverywhere, renameSubcategoryEverywhere, deleteSubcategoryEverywhere,
}) {
  const [customTaxonomy, setCustomTaxonomy] = useState(() => {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(window.localStorage.getItem(CUSTOM_TAXONOMY_KEY) || '{}') || {} } catch { return {} }
  })

  // Explorer state
  const [exTipo, setExTipo] = useState('Material')
  const [exCat, setExCat] = useState('')
  const [exSub, setExSub] = useState('')
  const [exProv, setExProv] = useState('')

  // Taxonomy panel
  const [taxOpen, setTaxOpen] = useState(false)
  const [mgCat, setMgCat] = useState('')

  const typeOptions = useMemo(() => Object.keys(RESOURCE_TREE), [])

  function persistTaxonomy(next) {
    setCustomTaxonomy(next)
    if (typeof window !== 'undefined') window.localStorage.setItem(CUSTOM_TAXONOMY_KEY, JSON.stringify(next))
  }

  function ensureTC(type, cat) {
    const next = { ...customTaxonomy }
    next[type] = { ...(next[type] || {}) }
    next[type][cat] = [...(next[type][cat] || [])]
    return next
  }

  // ── Explorer computed ────────────────────────────────────────────
  const exCats = useMemo(() => getCats(exTipo, customTaxonomy, resources), [exTipo, customTaxonomy, resources])
  const exSubs = useMemo(() => getSubs(exTipo, exCat, customTaxonomy, resources), [exTipo, exCat, customTaxonomy, resources])

  const exProviderChips = useMemo(() => {
    const set = new Set(getNode(exTipo, exCat, exSub)?.providers || [])
    resources.forEach((r) => {
      const ok = (!exTipo || r.tipo === exTipo) && (!exCat || r.categoria === exCat) && (!exSub || r.subcategoria === exSub)
      if (ok && r.proveedor && r.proveedor !== '-') set.add(r.proveedor)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [exTipo, exCat, exSub, resources])

  const exResources = useMemo(() => resources.filter((r) => {
    if (exTipo && r.tipo !== exTipo) return false
    if (exCat && r.categoria !== exCat) return false
    if (exSub && r.subcategoria !== exSub) return false
    if (exProv && r.proveedor !== exProv) return false
    return true
  }), [resources, exTipo, exCat, exSub, exProv])

  // ── Form computed ────────────────────────────────────────────────
  const formCats = useMemo(() => getCats(resourceForm.tipo, customTaxonomy, resources), [resourceForm.tipo, customTaxonomy, resources])
  const formSubs = useMemo(() => getSubs(resourceForm.tipo, resourceForm.categoria, customTaxonomy, resources), [resourceForm.tipo, resourceForm.categoria, customTaxonomy, resources])
  const selNode = useMemo(() => getNode(resourceForm.tipo, resourceForm.categoria, resourceForm.subcategoria), [resourceForm.tipo, resourceForm.categoria, resourceForm.subcategoria])

  // ── Taxonomy manager computed ────────────────────────────────────
  const mgCats = useMemo(() => getCats(resourceForm.tipo, customTaxonomy, resources), [resourceForm.tipo, customTaxonomy, resources])
  const activeMgCat = mgCat || mgCats[0] || ''
  const mgSubs = useMemo(() => getSubs(resourceForm.tipo, activeMgCat, customTaxonomy, resources), [resourceForm.tipo, activeMgCat, customTaxonomy, resources])

  // ── Taxonomy CRUD ────────────────────────────────────────────────
  async function createCategory() {
    const name = String(prompt('Nueva categoria') || '').trim()
    if (!name) return
    const next = ensureTC(resourceForm.tipo, name)
    persistTaxonomy(next)
    setMgCat(name)
    setResourceForm((p) => ({ ...p, categoria: name, subcategoria: '' }))
  }

  async function renameCategory(cat) {
    const nextName = String(prompt('Nuevo nombre', cat) || '').trim()
    if (!nextName || nextName === cat) return
    await renameCategoryEverywhere(resourceForm.tipo, cat, nextName)
    const next = ensureTC(resourceForm.tipo, nextName)
    const oldSub = next[resourceForm.tipo]?.[cat] || []
    next[resourceForm.tipo][nextName] = Array.from(new Set([...(next[resourceForm.tipo][nextName] || []), ...oldSub]))
    delete next[resourceForm.tipo][cat]
    persistTaxonomy(next)
    setMgCat(nextName)
  }

  async function removeCategory(cat) {
    if (!confirm(`Eliminar categoria "${cat}"?`)) return
    await deleteCategoryEverywhere(resourceForm.tipo, cat)
    const next = { ...customTaxonomy }
    next[resourceForm.tipo] = { ...(next[resourceForm.tipo] || {}) }
    delete next[resourceForm.tipo][cat]
    persistTaxonomy(next)
    if (activeMgCat === cat) setMgCat('')
  }

  function createSubcategory() {
    if (!activeMgCat) { alert('Selecciona una categoria primero.'); return }
    const name = String(prompt('Nueva subcategoria') || '').trim()
    if (!name) return
    const next = ensureTC(resourceForm.tipo, activeMgCat)
    next[resourceForm.tipo][activeMgCat] = Array.from(new Set([...(next[resourceForm.tipo][activeMgCat] || []), name]))
    persistTaxonomy(next)
    setResourceForm((p) => ({ ...p, categoria: activeMgCat, subcategoria: name }))
  }

  async function renameSubcategory(sub) {
    const nextName = String(prompt('Nuevo nombre', sub) || '').trim()
    if (!nextName || nextName === sub) return
    await renameSubcategoryEverywhere(resourceForm.tipo, activeMgCat, sub, nextName)
    const next = ensureTC(resourceForm.tipo, activeMgCat)
    next[resourceForm.tipo][activeMgCat] = Array.from(new Set((next[resourceForm.tipo][activeMgCat] || []).map((s) => s === sub ? nextName : s)))
    persistTaxonomy(next)
  }

  async function removeSubcategory(sub) {
    if (!confirm(`Eliminar subcategoria "${sub}"?`)) return
    await deleteSubcategoryEverywhere(resourceForm.tipo, activeMgCat, sub)
    const next = ensureTC(resourceForm.tipo, activeMgCat)
    next[resourceForm.tipo][activeMgCat] = (next[resourceForm.tipo][activeMgCat] || []).filter((s) => s !== sub)
    persistTaxonomy(next)
  }

  return (
    <div className="grid" style={{ gap: 16 }}>

      {/* ══════════════════════════════════════════════════
          SECCIÓN 1 — EXPLORADOR
      ══════════════════════════════════════════════════ */}
      <section className="card compact-card">
        <h2 className="section-title">🔍 Explorar recursos</h2>

        {/* Cascade selects */}
        <div className="cascade-row">
          <div className="field">
            <label>Tipo</label>
            <select value={exTipo} onChange={(e) => { setExTipo(e.target.value); setExCat(''); setExSub(''); setExProv('') }}>
              <option value="">— Todos —</option>
              {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="cascade-arrow">›</div>

          <div className="field">
            <label>Categoría</label>
            <select value={exCat} onChange={(e) => { setExCat(e.target.value); setExSub(''); setExProv('') }} disabled={!exTipo}>
              <option value="">— Todas —</option>
              {exCats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="cascade-arrow">›</div>

          <div className="field">
            <label>Subcategoría</label>
            <select value={exSub} onChange={(e) => { setExSub(e.target.value); setExProv('') }} disabled={!exCat}>
              <option value="">— Todas —</option>
              {exSubs.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {(exTipo || exCat || exSub || exProv) && (
            <button type="button" className="mini-btn" style={{ alignSelf: 'flex-end', marginBottom: 1 }}
              onClick={() => { setExTipo('Material'); setExCat(''); setExSub(''); setExProv('') }}>
              ✕ Limpiar
            </button>
          )}
        </div>

        {/* Provider chips */}
        {exProviderChips.length > 0 && (
          <div className="provider-chips-row">
            <span className="provider-chips-label">Proveedor:</span>
            <div className="provider-chips">
              {exProviderChips.map((p) => (
                <button key={p} type="button"
                  className={`provider-chip${exProv === p ? ' active' : ''}`}
                  onClick={() => setExProv(exProv === p ? '' : p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results counter */}
        <div style={{ fontSize: 12, color: 'var(--muted)', margin: '10px 0 4px' }}>
          {exResources.length} recurso{exResources.length !== 1 ? 's' : ''} encontrado{exResources.length !== 1 ? 's' : ''}
        </div>

        {/* Resource table */}
        <div className="table-wrap">
          <table className="compact-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Cat / Subcat</th>
                <th>Proveedor</th>
                <th>Espesor</th>
                <th>Tamaño</th>
                <th>Costo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {exResources.length ? exResources.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.nombre}</strong>
                    {row.especificacion && <div className="tiny-muted">{row.especificacion}</div>}
                  </td>
                  <td>
                    <span className="badge-mini">{row.categoria || '-'}</span>
                    {row.subcategoria && <span className="badge-mini" style={{ marginLeft: 4, background: '#e0f2fe', color: '#0369a1' }}>{row.subcategoria}</span>}
                  </td>
                  <td>{row.proveedor || '-'}</td>
                  <td>{row.espesor || '-'}</td>
                  <td>{row.tamano || '-'}</td>
                  <td><strong>{money(row.costo, 'BOB')}</strong></td>
                  <td>
                    <div className="compact-actions">
                      <button type="button" className="btn-cargar" onClick={() => addResourceToDetail(row)}>↗ Cargar</button>
                      <button type="button" className="mini-btn success" onClick={() => editResource(row)}>Editar</button>
                      <button type="button" className="mini-btn danger" onClick={() => deleteResource(row.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: '28px 0' }}>
                    {resources.length === 0 ? 'Aún no hay recursos. Crea uno abajo.' : 'Sin resultados para los filtros seleccionados.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECCIÓN 2 — FORMULARIO ALTA / EDICIÓN
      ══════════════════════════════════════════════════ */}
      <section className="card compact-card">
        <h2 className="section-title">{editingResourceId ? '✏️ Editar recurso' : '➕ Nuevo recurso'}</h2>
        <form className="grid form-compact" style={{ gap: 10 }} onSubmit={saveResource}>

          {/* Row 1: clasificación */}
          <div className="resources-compact-grid resources-row-1">
            <div className="field">
              <label>Tipo</label>
              <select value={resourceForm.tipo} onChange={(e) => {
                const t = e.target.value
                const cats = getCats(t, customTaxonomy, resources)
                const nextCat = cats[0] || ''
                const subs = getSubs(t, nextCat, customTaxonomy, resources)
                setResourceForm((p) => ({ ...p, tipo: t, categoria: nextCat, subcategoria: subs[0] || '', proveedor: '', espesor: '', tamano: '' }))
              }}>
                {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Categoría</label>
              <select value={resourceForm.categoria || ''} onChange={(e) => {
                const cat = e.target.value
                const subs = getSubs(resourceForm.tipo, cat, customTaxonomy, resources)
                setResourceForm((p) => ({ ...p, categoria: cat, subcategoria: subs[0] || '', proveedor: '', espesor: '', tamano: '' }))
              }}>
                <option value="">— Seleccionar —</option>
                {formCats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Subcategoría</label>
              <select value={resourceForm.subcategoria || ''} onChange={(e) =>
                setResourceForm((p) => ({ ...p, subcategoria: e.target.value, proveedor: '', espesor: '', tamano: '' }))
              }>
                <option value="">— Seleccionar —</option>
                {formSubs.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Proveedor</label>
              {selNode?.providers?.length ? (
                <select value={resourceForm.proveedor || ''} onChange={(e) => setResourceForm({ ...resourceForm, proveedor: e.target.value })}>
                  <option value="">— Seleccionar —</option>
                  {selNode.providers.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (
                <input value={resourceForm.proveedor || ''} onChange={(e) => setResourceForm({ ...resourceForm, proveedor: e.target.value })} placeholder="Proveedor" />
              )}
            </div>
          </div>

          {/* Row 2: especificaciones */}
          <div className="resources-compact-grid resources-row-2">
            <div className="field resources-spec">
              <label>Especificación / Color</label>
              <input list="r-color-opts" value={resourceForm.especificacion}
                onChange={(e) => setResourceForm({ ...resourceForm, especificacion: e.target.value })} />
              <datalist id="r-color-opts">
                {(selNode?.colors || []).map((c) => <option key={c} value={c} />)}
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
              <label>Fecha actualización</label>
              <input type="date" value={resourceForm.fechaActualizacion || ''} onChange={(e) => setResourceForm({ ...resourceForm, fechaActualizacion: e.target.value })} />
            </div>
          </div>

          {/* Row 3: nombre, espesor, tamaño */}
          <div className="resources-compact-grid resources-row-3">
            <div className="field">
              <label>Nombre</label>
              <input value={resourceForm.nombre} onChange={(e) => setResourceForm({ ...resourceForm, nombre: e.target.value })} placeholder="Nombre del recurso" />
            </div>
            <div className="field">
              <label>Espesor</label>
              <input list="r-thick-opts" value={resourceForm.espesor || ''}
                onChange={(e) => setResourceForm({ ...resourceForm, espesor: e.target.value })} placeholder="Ej: 18mm" />
              <datalist id="r-thick-opts">
                {(selNode?.thicknesses || []).map((v) => <option key={v} value={v} />)}
              </datalist>
            </div>
            <div className="field">
              <label>Tamaño</label>
              <input list="r-size-opts" value={resourceForm.tamano || ''}
                onChange={(e) => setResourceForm({ ...resourceForm, tamano: e.target.value })} placeholder="Ej: 185x244" />
              <datalist id="r-size-opts">
                {(selNode?.sizes || []).map((v) => <option key={v} value={v} />)}
              </datalist>
            </div>
          </div>

          <div className="action-row sticky-form-actions">
            <button className="btn" type="submit" disabled={savingResource}>
              {savingResource ? 'Guardando...' : editingResourceId ? 'Guardar cambios' : 'Guardar recurso'}
            </button>
            {editingResourceId && (
              <button type="button" className="btn secondary" onClick={() => { setEditingResourceId(null); setResourceForm(initialResource) }}>
                Cancelar edición
              </button>
            )}
          </div>
        </form>
      </section>

      {/* ══════════════════════════════════════════════════
          SECCIÓN 3 — GESTIÓN TAXONOMÍA (colapsable)
      ══════════════════════════════════════════════════ */}
      <section className="card compact-card">
        <button type="button" className="taxonomy-toggle" onClick={() => setTaxOpen((v) => !v)}>
          <span>⚙️ Gestión de categorías y subcategorías</span>
          <span className="toggle-arrow">{taxOpen ? '▲' : '▼'}</span>
        </button>

        {taxOpen && (
          <div style={{ marginTop: 14 }}>
            <div className="action-row" style={{ marginBottom: 12 }}>
              <button type="button" className="mini-btn" onClick={createCategory}>+ Categoría</button>
              <button type="button" className="mini-btn" onClick={createSubcategory}>+ Subcategoría</button>
            </div>

            <div className="field" style={{ maxWidth: 280, marginBottom: 12 }}>
              <label>Categoría activa</label>
              <select value={activeMgCat} onChange={(e) => setMgCat(e.target.value)}>
                {(mgCats.length ? mgCats : ['']).map((c) => (
                  <option key={c || 'empty'} value={c}>{c || 'Sin categoría'}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="table-wrap">
                <table className="compact-table">
                  <thead><tr><th>Categorías</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {mgCats.length ? mgCats.map((cat) => (
                      <tr key={cat}>
                        <td>{cat}</td>
                        <td>
                          <div className="compact-actions">
                            <button type="button" className="mini-btn success" onClick={() => renameCategory(cat)}>Renombrar</button>
                            <button type="button" className="mini-btn danger" onClick={() => removeCategory(cat)}>Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    )) : <tr><td colSpan={2} className="muted">No hay categorías.</td></tr>}
                  </tbody>
                </table>
              </div>

              <div className="table-wrap">
                <table className="compact-table">
                  <thead><tr><th>Subcategorías de {activeMgCat || '—'}</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {mgSubs.length ? mgSubs.map((sub) => (
                      <tr key={sub}>
                        <td>{sub}</td>
                        <td>
                          <div className="compact-actions">
                            <button type="button" className="mini-btn success" onClick={() => renameSubcategory(sub)}>Renombrar</button>
                            <button type="button" className="mini-btn danger" onClick={() => removeSubcategory(sub)}>Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    )) : <tr><td colSpan={2} className="muted">No hay subcategorías.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
