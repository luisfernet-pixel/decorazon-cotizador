export function parseProjectNotes(notes) {
  const raw = String(notes || '').trim()
  if (!raw) {
    return {
      observaciones: '',
      modoCotizacion: 'total',
      descuentoGeneralPct: 0,
      clienteId: '',
      cliente: '',
      telefono: '',
      nit: '',
      razonSocial: '',
    }
  }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {
        observaciones: String(parsed.observaciones || ''),
        modoCotizacion: parsed.modoCotizacion === 'opciones' ? 'opciones' : 'total',
        descuentoGeneralPct: Number(parsed.descuentoGeneralPct || 0),
        clienteId: String(parsed.clienteId || ''),
        cliente: String(parsed.cliente || ''),
        telefono: String(parsed.telefono || ''),
        nit: String(parsed.nit || ''),
        razonSocial: String(parsed.razonSocial || ''),
        itemQuantities: parsed.itemQuantities && typeof parsed.itemQuantities === 'object' ? parsed.itemQuantities : {},
      }
    }
  } catch {}
  return {
    observaciones: raw,
    modoCotizacion: 'total',
    descuentoGeneralPct: 0,
    clienteId: '',
    cliente: '',
    telefono: '',
    nit: '',
    razonSocial: '',
    itemQuantities: {},
  }
}

export function serializeProjectNotes(project, items = []) {
  const itemQuantities = items.reduce((acc, item) => {
    const key = `${String(item.codigo || '').trim()}||${String(item.nombre || '').trim()}`
    if (!key.trim()) return acc
    acc[key] = Math.max(1, Number(item.cantidad || 1))
    return acc
  }, {})

  return JSON.stringify({
    observaciones: String(project.observaciones || ''),
    modoCotizacion: project.modoCotizacion === 'opciones' ? 'opciones' : 'total',
    descuentoGeneralPct: Number(project.descuentoGeneralPct || 0),
    clienteId: String(project.clienteId || ''),
    cliente: String(project.cliente || ''),
    telefono: String(project.telefono || ''),
    nit: String(project.nit || ''),
    razonSocial: String(project.razonSocial || ''),
    itemQuantities,
  })
}
