export const RESOURCE_KINDS = ['Material', 'Servicio', 'Mano de obra', 'Instalacion', 'Transporte']

export const MATERIAL_UNITS = ['plancha', 'pieza', 'm2', 'ml', 'kg', 'unidad']
export const SERVICE_UNITS = ['servicio', 'minuto', 'hora', 'dia', 'viaje', 'm2', 'ml', 'unidad']

export const INITIAL_RESOURCE_CATEGORIES = [
  { kind: 'Material', parent: 'Materiales', name: 'Maderas' },
  { kind: 'Material', parent: 'Materiales', name: 'Acrilicos' },
  { kind: 'Material', parent: 'Materiales', name: 'Policarbonato' },
  { kind: 'Servicio', parent: 'Servicios', name: 'Corte CNC' },
  { kind: 'Mano de obra', parent: 'Servicios', name: 'Mano de obra' },
  { kind: 'Instalacion', parent: 'Servicios', name: 'Instalacion' },
  { kind: 'Transporte', parent: 'Servicios', name: 'Transporte' },
]

export const INITIAL_SUPPLIERS = [
  'MADCenter',
  'Cimal',
  'Synergy',
  'Acricolor',
  'Gato',
  'Jaime',
  'Ramiro',
  'Americo',
  'DecoraZon CNC',
  'Taxi',
  'Camion Gato',
]

export function normalizeResourceKind(kind) {
  const value = String(kind || '').trim()
  if (value === 'Instalación') return 'Instalacion'
  if (value === 'Transporte') return 'Transporte'
  if (value === 'Mano de obra') return 'Mano de obra'
  if (value === 'Servicio') return 'Servicio'
  return value || 'Material'
}

export function getUnitsForKind(kind) {
  return normalizeResourceKind(kind) === 'Material' ? MATERIAL_UNITS : SERVICE_UNITS
}

export function parseJsonObject(value, fallback = {}) {
  if (!value) return fallback
  if (typeof value === 'object') return value
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch {
    return fallback
  }
}

export function createResourceWizardState() {
  return {
    step: 1,
    kind: 'Material',
    parentCategory: 'Materiales',
    categoryName: 'Maderas',
    templateName: '',
    description: '',
    baseUnit: 'unidad',
    active: true,
    attributes: [
      { id: 'attr-color', name: 'Color', values: ['Blanca', 'Maderado'] },
      { id: 'attr-espesor', name: 'Espesor', values: ['15mm', '18mm'] },
      { id: 'attr-tamano', name: 'Tamano', values: ['185x244', '185x273'] },
    ],
    variants: [],
    prices: [],
  }
}

export function buildAttributeCombinations(attributes) {
  const validAttrs = (attributes || [])
    .map((attr) => ({
      name: String(attr.name || '').trim(),
      values: (attr.values || []).map((v) => String(v || '').trim()).filter(Boolean),
    }))
    .filter((attr) => attr.name && attr.values.length)

  if (!validAttrs.length) return [{ label: 'General', attributes: {} }]

  return validAttrs.reduce((rows, attr) => {
    const nextRows = []
    rows.forEach((row) => {
      attr.values.forEach((value) => {
        nextRows.push({
          label: [row.label, value].filter(Boolean).join(' '),
          attributes: { ...row.attributes, [attr.name]: value },
        })
      })
    })
    return nextRows
  }, [{ label: '', attributes: {} }])
}

export function buildVariantName(templateName, combo) {
  const base = String(templateName || 'Recurso').trim()
  const suffix = String(combo?.label || '').trim()
  return suffix && suffix !== 'General' ? `${base} ${suffix}` : `${base} General`
}

export function makeResourceSnapshot(resource) {
  const copiedAt = new Date().toISOString()
  return {
    copiedAt,
    resource_template_id: resource.resourceTemplateId || null,
    resource_variant_id: resource.resourceVariantId || null,
    supplier_price_id: resource.supplierPriceId || null,
    resource_name: resource.nombre || '',
    variant_name: resource.variante || resource.nombre || '',
    supplier_name: resource.proveedor || '',
    unit: resource.unidad || 'unidad',
    unit_cost: Number(resource.costo || 0),
    includes_tax: !!resource.includesTax,
  }
}
