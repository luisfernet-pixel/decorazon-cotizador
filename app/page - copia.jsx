'use client';

import { useEffect, useMemo, useState } from 'react';
import StatusBanner from '@/components/StatusBanner';
import { COMPANY } from '@/lib/company';
import { hasSupabaseEnv, supabase } from '@/lib/supabase';

const TABLES = {
  resources: 'resource_catalog',
  projects: 'projects',
  items: 'project_items',
  details: 'project_details',
};

const initialProject = {
  id: null,
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
};

const initialResource = {
  id: null,
  tipo: 'Material',
  categoria: 'Acrílicos',
  nombre: '',
  especificacion: '',
  unidad: 'unidad',
  proveedor: '',
  costo: 0,
};

const initialItem = {
  id: null,
  codigo: '',
  nombre: '',
  categoria: 'General',
  descripcion: '',
  aplicaImpuesto: true,
  tasaImpuesto: COMPANY.defaultTaxRate,
};

const initialDetail = {
  id: null,
  itemId: '',
  tipo: 'Material',
  descripcion: '',
  proveedor: '',
  unidad: 'unidad',
  cantidad: 1,
  costoUnitario: 0,
  tasaUtilidad: COMPANY.defaultMarginRate,
  especificacion: '',
};

function money(value, currency = 'BOB') {
  return new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function resourceMeta(row) {
  try {
    return row.notes ? JSON.parse(row.notes) : {};
  } catch {
    return {};
  }
}

function normalizeResource(row) {
  const meta = resourceMeta(row);
  return {
    id: row.id,
    tipo: meta.type || '-',
    categoria: meta.category || '-',
    nombre: row.name || '-',
    especificacion: row.specification || '',
    unidad: row.unit || '-',
    proveedor: meta.supplier || '-',
    costo: Number(row.base_cost || 0),
  };
}

function normalizeProject(row) {
  return {
    id: row.id,
    numero: row.quote_number || '',
    nombreProyecto: row.project_name || '',
    empresa: row.company_name || '',
    responsable: row.responsible || '',
    fecha: row.date || row.created_at || '',
    validoHasta: row.valid_until || '',
    moneda: row.currency || 'BOB',
    condicionesPago: row.payment_terms || '',
    tiempoEntrega: row.delivery_time || '',
    observaciones: row.notes || '',
  };
}

function normalizeItem(row) {
  return {
    id: row.id,
    codigo: row.code || '',
    nombre: row.name || '',
    categoria: row.category || 'General',
    descripcion: row.description || '',
    aplicaImpuesto: !!row.apply_tax,
    tasaImpuesto: Number(row.tax_rate || 0),
  };
}

function normalizeDetail(row) {
  return {
    id: row.id,
    itemId: row.project_item_id,
    tipo: row.type || 'Material',
    descripcion: row.description || '',
    proveedor: row.supplier_name || '',
    unidad: row.unit || 'unidad',
    cantidad: Number(row.quantity || 0),
    costoUnitario: Number(row.unit_cost || 0),
    tasaUtilidad: Number(row.margin_rate || 0),
    especificacion: row.specification || '',
  };
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('inicio');
  const [project, setProject] = useState(initialProject);
  const [resourceForm, setResourceForm] = useState(initialResource);
  const [itemForm, setItemForm] = useState(initialItem);
  const [detailForm, setDetailForm] = useState(initialDetail);

  const [resources, setResources] = useState([]);
  const [history, setHistory] = useState([]);
  const [items, setItems] = useState([]);
  const [details, setDetails] = useState([]);
  const [savingResource, setSavingResource] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [busyRowId, setBusyRowId] = useState(null);

  async function loadResources() {
    if (!supabase) return;
    const { data, error } = await supabase.from(TABLES.resources).select('*').order('created_at', { ascending: false });
    if (error) {
      alert('Error leyendo recursos: ' + error.message);
      return;
    }
    setResources((data || []).map(normalizeResource));
  }

  async function loadHistory() {
    if (!supabase) return;
    const { data, error } = await supabase.from(TABLES.projects).select('*').order('created_at', { ascending: false }).limit(20);
    if (error) {
      alert('Error leyendo historial: ' + error.message);
      return;
    }
    setHistory((data || []).map(normalizeProject));
  }

  useEffect(() => {
    loadResources();
    loadHistory();
  }, []);

  const itemRows = useMemo(() => {
    return items.map((item) => {
      const related = details.filter((d) => d.itemId === item.id);
      const subtotal = related.reduce((acc, row) => {
        const base = Number(row.cantidad || 0) * Number(row.costoUnitario || 0);
        const total = base * (1 + Number(row.tasaUtilidad || 0) / 100);
        return acc + total;
      }, 0);
      const impuesto = item.aplicaImpuesto ? subtotal * (Number(item.tasaImpuesto || 0) / 100) : 0;
      return { ...item, subtotal, impuesto, total: subtotal + impuesto };
    });
  }, [items, details]);

  const totalProyecto = itemRows.reduce((acc, row) => acc + row.total, 0);
  const promedioRecursos = resources.length
    ? resources.reduce((acc, row) => acc + Number(row.costo || 0), 0) / resources.length
    : 0;

  function resetProjectState(goTo = 'proyecto') {
    setProject(initialProject);
    setItems([]);
    setDetails([]);
    setItemForm(initialItem);
    setDetailForm(initialDetail);
    setActiveTab(goTo);
  }

  function saveItemLocal(e) {
    e.preventDefault();
    if (!itemForm.nombre.trim()) {
      alert('Escribe un nombre para el ítem.');
      return;
    }

    if (itemForm.id) {
      setItems((prev) => prev.map((row) => row.id === itemForm.id ? {
        ...row,
        codigo: itemForm.codigo.trim() || row.codigo,
        nombre: itemForm.nombre.trim(),
        categoria: itemForm.categoria.trim() || 'General',
        descripcion: itemForm.descripcion.trim(),
        aplicaImpuesto: itemForm.aplicaImpuesto,
        tasaImpuesto: Number(itemForm.tasaImpuesto || 0),
      } : row));
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
        },
      ]);
    }

    setItemForm(initialItem);
  }

  function editItemLocal(row) {
    setItemForm({
      id: row.id,
      codigo: row.codigo,
      nombre: row.nombre,
      categoria: row.categoria,
      descripcion: row.descripcion,
      aplicaImpuesto: row.aplicaImpuesto,
      tasaImpuesto: row.tasaImpuesto,
    });
    setActiveTab('items');
  }

  function deleteItemLocal(id) {
    if (!confirm('¿Eliminar este ítem y sus subítems?')) return;
    setItems((prev) => prev.filter((row) => row.id !== id));
    setDetails((prev) => prev.filter((row) => row.itemId !== id));
    if (itemForm.id === id) setItemForm(initialItem);
  }

  function saveDetailLocal(e) {
    e.preventDefault();
    if (!detailForm.itemId) {
      alert('Primero selecciona un ítem.');
      return;
    }
    if (!detailForm.descripcion.trim()) {
      alert('Escribe la descripción del subítem.');
      return;
    }

    const payload = {
      id: detailForm.id || uid(),
      itemId: detailForm.itemId,
      tipo: detailForm.tipo,
      descripcion: detailForm.descripcion.trim(),
      proveedor: detailForm.proveedor.trim(),
      unidad: detailForm.unidad.trim() || 'unidad',
      cantidad: Number(detailForm.cantidad || 0),
      costoUnitario: Number(detailForm.costoUnitario || 0),
      tasaUtilidad: Number(detailForm.tasaUtilidad || 0),
      especificacion: detailForm.especificacion.trim(),
    };

    if (detailForm.id) {
      setDetails((prev) => prev.map((row) => row.id === detailForm.id ? payload : row));
    } else {
      setDetails((prev) => [...prev, payload]);
    }

    setDetailForm({ ...initialDetail, itemId: detailForm.itemId });
  }

  function editDetailLocal(row) {
    setDetailForm({ ...row });
    setActiveTab('subitems');
  }

  function deleteDetailLocal(id) {
    if (!confirm('¿Eliminar este subítem?')) return;
    setDetails((prev) => prev.filter((row) => row.id !== id));
    if (detailForm.id === id) setDetailForm(initialDetail);
  }

  function addResourceToDetail(resource) {
    setActiveTab('subitems');
    setDetailForm((prev) => ({
      ...prev,
      tipo: resource.tipo || 'Material',
      descripcion: resource.nombre || '',
      proveedor: resource.proveedor || '',
      unidad: resource.unidad || 'unidad',
      costoUnitario: Number(resource.costo || 0),
      especificacion: resource.especificacion || '',
    }));
  }

  async function saveResource(e) {
    e.preventDefault();
    if (!supabase) {
      alert('Supabase no está configurado.');
      return;
    }
    if (!resourceForm.nombre.trim()) {
      alert('Escribe un nombre para el recurso.');
      return;
    }

    setSavingResource(true);

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
    };

    let error = null;
    if (resourceForm.id) {
      const result = await supabase.from(TABLES.resources).update(payload).eq('id', resourceForm.id);
      error = result.error;
    } else {
      const result = await supabase.from(TABLES.resources).insert([payload]);
      error = result.error;
    }

    setSavingResource(false);

    if (error) {
      alert('Error real al guardar recurso: ' + error.message);
      return;
    }

    alert(resourceForm.id ? 'Recurso actualizado.' : 'Recurso guardado en Supabase.');
    setResourceForm(initialResource);
    loadResources();
  }

  function editResource(row) {
    setResourceForm({ ...row });
    setActiveTab('recursos');
  }

  async function deleteResource(id) {
    if (!supabase) return;
    if (!confirm('¿Eliminar este recurso?')) return;
    setBusyRowId(id);
    const { error } = await supabase.from(TABLES.resources).delete().eq('id', id);
    setBusyRowId(null);
    if (error) {
      alert('Error eliminando recurso: ' + error.message);
      return;
    }
    if (resourceForm.id === id) setResourceForm(initialResource);
    loadResources();
  }

  async function persistChildren(projectId) {
    const { error: deleteItemsError } = await supabase.from(TABLES.items).delete().eq('project_id', projectId);
    if (deleteItemsError) return deleteItemsError;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const insertedItem = await supabase
        .from(TABLES.items)
        .insert([
          {
            project_id: projectId,
            code: item.codigo,
            name: item.nombre,
            category: item.categoria,
            description: item.descripcion,
            apply_tax: item.aplicaImpuesto,
            tax_rate: item.tasaImpuesto,
            position: i + 1,
          },
        ])
        .select()
        .single();

      if (insertedItem.error) return insertedItem.error;
      const itemId = insertedItem.data.id;
      const related = details.filter((d) => d.itemId === item.id);

      if (related.length) {
        const detailPayload = related.map((row, j) => ({
          project_item_id: itemId,
          type: row.tipo,
          description: row.descripcion,
          supplier_name: row.proveedor,
          unit: row.unidad,
          quantity: row.cantidad,
          unit_cost: row.costoUnitario,
          margin_rate: row.tasaUtilidad,
          specification: row.especificacion,
          position: j + 1,
        }));
        const { error: detailError } = await supabase.from(TABLES.details).insert(detailPayload);
        if (detailError) return detailError;
      }
    }
    return null;
  }

  async function saveProjectCloud() {
    if (!supabase) {
      alert('Supabase no está configurado.');
      return;
    }
    if (!project.nombreProyecto.trim()) {
      alert('Escribe el nombre del proyecto.');
      return;
    }
    if (!items.length) {
      alert('Agrega al menos un ítem.');
      return;
    }

    setSavingProject(true);

    const payload = {
      quote_number: project.numero.trim() || `COT-${Date.now()}`,
      project_name: project.nombreProyecto.trim(),
      company_name: project.empresa.trim(),
      responsible: project.responsable.trim(),
      date: project.fecha,
      valid_until: project.validoHasta || null,
      currency: project.moneda,
      payment_terms: project.condicionesPago,
      delivery_time: project.tiempoEntrega,
      notes: project.observaciones,
    };

    let projectId = project.id;

    if (project.id) {
      const { error } = await supabase.from(TABLES.projects).update(payload).eq('id', project.id);
      if (error) {
        setSavingProject(false);
        alert('Error real al guardar proyecto: ' + error.message);
        return;
      }
    } else {
      const insertedProject = await supabase.from(TABLES.projects).insert([payload]).select().single();
      if (insertedProject.error) {
        setSavingProject(false);
        alert('Error real al guardar proyecto: ' + insertedProject.error.message);
        return;
      }
      projectId = insertedProject.data.id;
      setProject((prev) => ({ ...prev, id: projectId }));
    }

    const childrenError = await persistChildren(projectId);
    setSavingProject(false);

    if (childrenError) {
      alert('Error real al guardar detalle: ' + childrenError.message);
      return;
    }

    alert(project.id ? 'Cotización actualizada.' : 'Cotización guardada en Supabase.');
    loadHistory();
    setActiveTab('historial');
  }

  async function openQuote(projectId) {
    if (!supabase) return;
    setBusyRowId(projectId);
    const proj = await supabase.from(TABLES.projects).select('*').eq('id', projectId).single();
    if (proj.error) {
      setBusyRowId(null);
      alert('Error abriendo cotización: ' + proj.error.message);
      return;
    }
    const itemRes = await supabase.from(TABLES.items).select('*').eq('project_id', projectId).order('position', { ascending: true });
    if (itemRes.error) {
      setBusyRowId(null);
      alert('Error leyendo ítems: ' + itemRes.error.message);
      return;
    }
    const dbItems = (itemRes.data || []).map(normalizeItem);
    const itemIds = dbItems.map((row) => row.id);
    let dbDetails = [];
    if (itemIds.length) {
      const detRes = await supabase.from(TABLES.details).select('*').in('project_item_id', itemIds).order('position', { ascending: true });
      if (detRes.error) {
        setBusyRowId(null);
        alert('Error leyendo subítems: ' + detRes.error.message);
        return;
      }
      dbDetails = (detRes.data || []).map(normalizeDetail);
    }

    setProject(normalizeProject(proj.data));
    setItems(dbItems);
    setDetails(dbDetails);
    setItemForm(initialItem);
    setDetailForm(initialDetail);
    setBusyRowId(null);
    setActiveTab('cotizacion');
  }

  async function deleteQuote(projectId) {
    if (!supabase) return;
    if (!confirm('¿Eliminar esta cotización del historial?')) return;
    setBusyRowId(projectId);
    const { error } = await supabase.from(TABLES.projects).delete().eq('id', projectId);
    setBusyRowId(null);
    if (error) {
      alert('Error eliminando cotización: ' + error.message);
      return;
    }
    if (project.id === projectId) resetProjectState('historial');
    loadHistory();
  }

  async function duplicateQuote(projectId) {
    await openQuote(projectId);
    setTimeout(() => {
      setProject((prev) => ({
        ...prev,
        id: null,
        numero: prev.numero ? `${prev.numero}-COPIA` : '',
      }));
      setActiveTab('proyecto');
    }, 100);
  }

  async function deleteCurrentQuote() {
    if (!project.id) {
      resetProjectState();
      return;
    }
    await deleteQuote(project.id);
  }

  const tabs = [
    ['inicio', 'Inicio'],
    ['proyecto', 'Proyecto'],
    ['items', 'Ítems'],
    ['subitems', 'Subítems'],
    ['recursos', 'Recursos'],
    ['cotizacion', 'Cotización'],
    ['historial', 'Historial'],
  ];

  return (
    <main className="page grid" style={{ gap: 20 }}>
      <section className="hero no-print">
        <div className="hero-head">
          <div>
            <div className="badge" style={{ background: 'rgba(255,255,255,.14)', color: 'white' }}>
              DecoraZon · Versión 3
            </div>
            <h1 style={{ marginBottom: 8 }}>Cotizador DecoraZon</h1>
            <p style={{ maxWidth: 860, lineHeight: 1.5 }}>
              PDF limpio, edición y borrado de recursos, edición y borrado de ítems y subítems, apertura y gestión de cotizaciones desde historial.
            </p>
            <p style={{ opacity: 0.9, marginBottom: 0 }}>
              {COMPANY.name} · {COMPANY.phones.join(' / ')} · {COMPANY.email}
            </p>
          </div>
          <div className="hero-logo-wrap" style={{ background: 'white' }}>
            <img src="/logo.png" alt="DecoraZon" className="hero-logo" />
          </div>
        </div>
      </section>

      <div className="tabs no-print">
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

      <div className="grid grid-3 no-print">
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

      <div className="no-print">
        <StatusBanner connected={hasSupabaseEnv} />
      </div>

      {activeTab === 'inicio' && (
        <section className="card no-print">
          <h2>Versión 3 lista para prueba real</h2>
          <ul className="clean-list">
            <li>Recursos: crear, editar y eliminar.</li>
            <li>Cotizaciones: crear, abrir, editar, duplicar y eliminar.</li>
            <li>Ítems y subítems: crear, editar y eliminar.</li>
            <li>PDF: imprime solo la cotización, sin portada ni pestañas.</li>
          </ul>
        </section>
      )}

      {activeTab === 'proyecto' && (
        <section className="card no-print">
          <div className="section-head">
            <h2>Datos del proyecto</h2>
            <div className="action-row compact">
              <button type="button" className="btn secondary" onClick={() => resetProjectState()}>
                Nueva cotización
              </button>
              <button type="button" className="btn danger" onClick={deleteCurrentQuote}>
                {project.id ? 'Eliminar cotización actual' : 'Limpiar formulario'}
              </button>
            </div>
          </div>
          <div className="grid grid-3">
            <div className="field"><label>Nro. cotización</label><input value={project.numero} onChange={(e) => setProject({ ...project, numero: e.target.value })} /></div>
            <div className="field"><label>Nombre del proyecto</label><input value={project.nombreProyecto} onChange={(e) => setProject({ ...project, nombreProyecto: e.target.value })} /></div>
            <div className="field"><label>Empresa</label><input value={project.empresa} onChange={(e) => setProject({ ...project, empresa: e.target.value })} /></div>
            <div className="field"><label>Responsable</label><input value={project.responsable} onChange={(e) => setProject({ ...project, responsable: e.target.value })} /></div>
            <div className="field"><label>Fecha</label><input type="date" value={project.fecha} onChange={(e) => setProject({ ...project, fecha: e.target.value })} /></div>
            <div className="field"><label>Válida hasta</label><input type="date" value={project.validoHasta} onChange={(e) => setProject({ ...project, validoHasta: e.target.value })} /></div>
            <div className="field"><label>Moneda</label><select value={project.moneda} onChange={(e) => setProject({ ...project, moneda: e.target.value })}><option>BOB</option><option>USD</option></select></div>
            <div className="field"><label>Condiciones de pago</label><input value={project.condicionesPago} onChange={(e) => setProject({ ...project, condicionesPago: e.target.value })} /></div>
            <div className="field"><label>Tiempo de entrega</label><input value={project.tiempoEntrega} onChange={(e) => setProject({ ...project, tiempoEntrega: e.target.value })} /></div>
          </div>
          <div className="field" style={{ marginTop: 12 }}><label>Observaciones</label><textarea rows={4} value={project.observaciones} onChange={(e) => setProject({ ...project, observaciones: e.target.value })} /></div>
        </section>
      )}

      {activeTab === 'items' && (
        <div className="grid grid-2 no-print">
          <section className="card">
            <h2>{itemForm.id ? 'Editar ítem' : 'Crear ítem'}</h2>
            <form className="grid" style={{ gap: 12 }} onSubmit={saveItemLocal}>
              <div className="grid grid-2">
                <div className="field"><label>Código</label><input value={itemForm.codigo} onChange={(e) => setItemForm({ ...itemForm, codigo: e.target.value })} /></div>
                <div className="field"><label>Nombre</label><input value={itemForm.nombre} onChange={(e) => setItemForm({ ...itemForm, nombre: e.target.value })} /></div>
              </div>
              <div className="grid grid-2">
                <div className="field"><label>Categoría</label><input value={itemForm.categoria} onChange={(e) => setItemForm({ ...itemForm, categoria: e.target.value })} /></div>
                <div className="field"><label>Impuesto del ítem (%)</label><input type="number" value={itemForm.tasaImpuesto} onChange={(e) => setItemForm({ ...itemForm, tasaImpuesto: e.target.value })} /></div>
              </div>
              <div className="field"><label>Descripción</label><textarea rows={3} value={itemForm.descripcion} onChange={(e) => setItemForm({ ...itemForm, descripcion: e.target.value })} /></div>
              <label className="check-row"><input type="checkbox" checked={itemForm.aplicaImpuesto} onChange={(e) => setItemForm({ ...itemForm, aplicaImpuesto: e.target.checked })} /><span>Este ítem incluye impuestos de ley</span></label>
              <div className="action-row compact">
                <button className="btn" type="submit">{itemForm.id ? 'Actualizar ítem' : 'Agregar ítem'}</button>
                {itemForm.id && <button type="button" className="btn secondary" onClick={() => setItemForm(initialItem)}>Cancelar edición</button>}
              </div>
            </form>
          </section>
          <section className="card">
            <h2>Ítems actuales</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Código</th><th>Ítem</th><th>Total</th><th>Acciones</th></tr></thead>
                <tbody>
                  {itemRows.length ? itemRows.map((item) => (
                    <tr key={item.id}>
                      <td>{item.codigo}</td>
                      <td><strong>{item.nombre}</strong><div className="tiny-muted">{item.categoria}</div></td>
                      <td>{money(item.total, project.moneda)}</td>
                      <td>
                        <div className="table-actions">
                          <button type="button" className="mini-btn" onClick={() => editItemLocal(item)}>Editar</button>
                          <button type="button" className="mini-btn danger" onClick={() => deleteItemLocal(item.id)}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={4} className="muted">Aún no agregaste ítems.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'subitems' && (
        <div className="grid grid-2 no-print">
          <section className="card">
            <h2>{detailForm.id ? 'Editar subítem' : 'Crear subítem'}</h2>
            <form className="grid" style={{ gap: 12 }} onSubmit={saveDetailLocal}>
              <div className="grid grid-2">
                <div className="field"><label>Ítem</label><select value={detailForm.itemId} onChange={(e) => setDetailForm({ ...detailForm, itemId: e.target.value })}><option value="">Selecciona un ítem</option>{items.map((item) => <option key={item.id} value={item.id}>{item.codigo} · {item.nombre}</option>)}</select></div>
                <div className="field"><label>Tipo</label><select value={detailForm.tipo} onChange={(e) => setDetailForm({ ...detailForm, tipo: e.target.value })}><option>Material</option><option>Mano de obra</option><option>Servicio</option><option>Instalación</option><option>Transporte</option></select></div>
              </div>
              <div className="field"><label>Descripción</label><input value={detailForm.descripcion} onChange={(e) => setDetailForm({ ...detailForm, descripcion: e.target.value })} /></div>
              <div className="grid grid-3">
                <div className="field"><label>Proveedor</label><input value={detailForm.proveedor} onChange={(e) => setDetailForm({ ...detailForm, proveedor: e.target.value })} /></div>
                <div className="field"><label>Unidad</label><input value={detailForm.unidad} onChange={(e) => setDetailForm({ ...detailForm, unidad: e.target.value })} /></div>
                <div className="field"><label>Cantidad</label><input type="number" value={detailForm.cantidad} onChange={(e) => setDetailForm({ ...detailForm, cantidad: e.target.value })} /></div>
              </div>
              <div className="grid grid-3">
                <div className="field"><label>Costo unitario</label><input type="number" value={detailForm.costoUnitario} onChange={(e) => setDetailForm({ ...detailForm, costoUnitario: e.target.value })} /></div>
                <div className="field"><label>Utilidad (%)</label><input type="number" value={detailForm.tasaUtilidad} onChange={(e) => setDetailForm({ ...detailForm, tasaUtilidad: e.target.value })} /></div>
                <div className="field"><label>Especificación</label><input value={detailForm.especificacion} onChange={(e) => setDetailForm({ ...detailForm, especificacion: e.target.value })} /></div>
              </div>
              <div className="action-row compact">
                <button className="btn" type="submit">{detailForm.id ? 'Actualizar subítem' : 'Agregar subítem'}</button>
                {detailForm.id && <button type="button" className="btn secondary" onClick={() => setDetailForm(initialDetail)}>Cancelar edición</button>}
              </div>
            </form>
          </section>
          <section className="card">
            <h2>Subítems actuales</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Ítem</th><th>Descripción</th><th>Total</th><th>Acciones</th></tr></thead>
                <tbody>
                  {details.length ? details.map((row) => {
                    const item = items.find((x) => x.id === row.itemId);
                    const base = Number(row.cantidad || 0) * Number(row.costoUnitario || 0);
                    const total = base * (1 + Number(row.tasaUtilidad || 0) / 100);
                    return (
                      <tr key={row.id}>
                        <td>{item?.codigo || '-'}</td>
                        <td><strong>{row.descripcion}</strong><div className="tiny-muted">{row.proveedor || '-'} · {row.tipo}</div></td>
                        <td>{money(total, project.moneda)}</td>
                        <td>
                          <div className="table-actions">
                            <button type="button" className="mini-btn" onClick={() => editDetailLocal(row)}>Editar</button>
                            <button type="button" className="mini-btn danger" onClick={() => deleteDetailLocal(row.id)}>Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    );
                  }) : <tr><td colSpan={4} className="muted">Aún no agregaste subítems.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'recursos' && (
        <div className="grid grid-2 no-print">
          <section className="card">
            <h2>{resourceForm.id ? 'Editar recurso' : 'Alta rápida de recurso'}</h2>
            <form className="grid" style={{ gap: 12 }} onSubmit={saveResource}>
              <div className="grid grid-2">
                <div className="field"><label>Tipo</label><select value={resourceForm.tipo} onChange={(e) => setResourceForm({ ...resourceForm, tipo: e.target.value })}><option>Material</option><option>Mano de obra</option><option>Servicio</option><option>Instalación</option><option>Transporte</option></select></div>
                <div className="field"><label>Categoría</label><input value={resourceForm.categoria} onChange={(e) => setResourceForm({ ...resourceForm, categoria: e.target.value })} /></div>
              </div>
              <div className="field"><label>Nombre</label><input value={resourceForm.nombre} onChange={(e) => setResourceForm({ ...resourceForm, nombre: e.target.value })} /></div>
              <div className="field"><label>Especificación</label><input value={resourceForm.especificacion} onChange={(e) => setResourceForm({ ...resourceForm, especificacion: e.target.value })} /></div>
              <div className="grid grid-3">
                <div className="field"><label>Unidad</label><input value={resourceForm.unidad} onChange={(e) => setResourceForm({ ...resourceForm, unidad: e.target.value })} /></div>
                <div className="field"><label>Proveedor</label><input value={resourceForm.proveedor} onChange={(e) => setResourceForm({ ...resourceForm, proveedor: e.target.value })} /></div>
                <div className="field"><label>Costo base</label><input type="number" value={resourceForm.costo} onChange={(e) => setResourceForm({ ...resourceForm, costo: e.target.value })} /></div>
              </div>
              <div className="action-row compact">
                <button className="btn" type="submit" disabled={savingResource}>{savingResource ? 'Guardando...' : (resourceForm.id ? 'Actualizar recurso' : 'Guardar recurso')}</button>
                {resourceForm.id && <button type="button" className="btn secondary" onClick={() => setResourceForm(initialResource)}>Cancelar edición</button>}
              </div>
            </form>
          </section>
          <section className="card">
            <h2>Recursos guardados</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Tipo</th><th>Nombre</th><th>Proveedor</th><th>Costo</th><th>Acciones</th></tr></thead>
                <tbody>
                  {resources.length ? resources.map((row) => (
                    <tr key={row.id}>
                      <td>{row.tipo}</td>
                      <td><strong>{row.nombre}</strong><div className="tiny-muted">{row.categoria} · {row.especificacion || '-'}</div></td>
                      <td>{row.proveedor || '-'}</td>
                      <td>{money(row.costo, 'BOB')}</td>
                      <td>
                        <div className="table-actions wrap">
                          <button type="button" className="mini-btn" onClick={() => addResourceToDetail(row)}>Cargar</button>
                          <button type="button" className="mini-btn" onClick={() => editResource(row)}>Editar</button>
                          <button type="button" className="mini-btn danger" disabled={busyRowId === row.id} onClick={() => deleteResource(row.id)}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={5} className="muted">Aún no hay recursos guardados.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      <section className={`card print-area ${activeTab === 'cotizacion' ? '' : 'hidden-print-only'}`}>
        {activeTab === 'cotizacion' && <div className="no-print section-head"><h2>Cotización</h2></div>}
        <div className="quote-head">
          <div>
            <img src="/logo.png" alt="DecoraZon" className="quote-logo" />
            <h2 style={{ marginTop: 10 }}>{COMPANY.name}</h2>
            <div className="muted">{COMPANY.address}</div>
            <div className="muted">{COMPANY.phones.join(' / ')}</div>
            <div className="muted">{COMPANY.email}</div>
          </div>
          <div className="quote-box">
            <div><strong>Cotización:</strong> {project.numero || 'Sin número'}</div>
            <div><strong>Proyecto:</strong> {project.nombreProyecto || '-'}</div>
            <div><strong>Empresa:</strong> {project.empresa || '-'}</div>
            <div><strong>Responsable:</strong> {project.responsable || '-'}</div>
            <div><strong>Fecha:</strong> {project.fecha || '-'}</div>
          </div>
        </div>

        <div className="table-wrap" style={{ marginTop: 18 }}>
          <table>
            <thead><tr><th>Código</th><th>Ítem</th><th>Detalle</th><th>Subtotal</th><th>Impuesto</th><th>Total</th></tr></thead>
            <tbody>
              {itemRows.length ? itemRows.map((item) => (
                <tr key={item.id}>
                  <td>{item.codigo}</td>
                  <td><strong>{item.nombre}</strong><div className="tiny-muted">{item.categoria}</div></td>
                  <td>
                    {details.filter((d) => d.itemId === item.id).map((row) => (
                      <div key={row.id} className="line-item">• {row.descripcion} · {row.cantidad} {row.unidad}</div>
                    ))}
                    <div className="tiny-muted" style={{ marginTop: 8 }}>
                      {item.aplicaImpuesto ? `Incluye impuestos de ley (${item.tasaImpuesto}%).` : 'No incluye impuestos de ley.'}
                    </div>
                  </td>
                  <td>{money(item.subtotal, project.moneda)}</td>
                  <td>{money(item.impuesto, project.moneda)}</td>
                  <td><strong>{money(item.total, project.moneda)}</strong></td>
                </tr>
              )) : <tr><td colSpan={6} className="muted">Aún no hay cotización armada.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="quote-foot">
          <div className="quote-box">
            <strong>Condiciones</strong>
            <div className="muted">Pago: {project.condicionesPago || '-'}</div>
            <div className="muted">Entrega: {project.tiempoEntrega || '-'}</div>
            {project.observaciones && <div className="muted">Obs.: {project.observaciones}</div>}
          </div>
          <div className="quote-box">
            <strong>Total general</strong>
            <div className="kpi" style={{ fontSize: 28 }}>{money(totalProyecto, project.moneda)}</div>
          </div>
        </div>

        {activeTab === 'cotizacion' && (
          <div className="action-row no-print">
            <button type="button" className="btn" onClick={saveProjectCloud} disabled={savingProject}>{savingProject ? 'Guardando...' : (project.id ? 'Guardar cambios' : 'Guardar cotización')}</button>
            <button
  onClick={() => {
    const data = {
      proyecto,
      empresa,
      responsable,
      fecha,
      total,
      items
    }

    const url = `/pdf?data=${encodeURIComponent(JSON.stringify(data))}`

    window.open(url, '_blank')
  }}
>
  Imprimir / PDF
</button>
          </div>
        )}
      </section>

      {activeTab === 'historial' && (
        <section className="card no-print">
          <div className="section-head">
            <h2>Historial compartido</h2>
            <button type="button" className="btn secondary" onClick={loadHistory}>Actualizar</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nro.</th><th>Proyecto</th><th>Empresa</th><th>Responsable</th><th>Fecha</th><th>Acciones</th></tr></thead>
              <tbody>
                {history.length ? history.map((row) => (
                  <tr key={row.id}>
                    <td>{row.numero}</td>
                    <td>{row.nombreProyecto}</td>
                    <td>{row.empresa || '-'}</td>
                    <td>{row.responsable || '-'}</td>
                    <td>{String(row.fecha || '-').slice(0, 10)}</td>
                    <td>
                      <div className="table-actions wrap">
                        <button type="button" className="mini-btn" disabled={busyRowId === row.id} onClick={() => openQuote(row.id)}>Abrir</button>
                        <button type="button" className="mini-btn" disabled={busyRowId === row.id} onClick={() => duplicateQuote(row.id)}>Duplicar</button>
                        <button type="button" className="mini-btn danger" disabled={busyRowId === row.id} onClick={() => deleteQuote(row.id)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={6} className="muted">Aún no hay cotizaciones guardadas en la nube.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
