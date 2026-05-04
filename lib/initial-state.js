export function createInitialProject() {
  return {
    numero: '',
    nombreProyecto: '',
    clienteId: '',
    cliente: '',
    empresa: '',
    responsable: '',
    telefono: '',
    nit: '',
    razonSocial: '',
    fecha: new Date().toISOString().slice(0, 10),
    validoHasta: '',
    moneda: 'BOB',
    condicionesPago: '50% anticipo / 50% contra entrega',
    tiempoEntrega: 'A coordinar según alcance',
    observaciones: '',
    modoCotizacion: 'total',
    descuentoGeneralPct: 0,
  }
}

export const initialResource = {
  tipo: 'Material',
  categoria: 'Acrílicos',
  nombre: '',
  especificacion: '',
  unidad: 'unidad',
  proveedor: '',
  costo: 0,
}

export function createInitialItem(defaultTaxRate = 19) {
  return {
    codigo: '',
    nombre: '',
    categoria: 'General',
    descripcion: '',
    aplicaImpuesto: true,
    tasaImpuesto: defaultTaxRate,
    descuentoEspecial: 0,
  }
}

export function createInitialDetail(defaultMarginRate = 100) {
  return {
    itemId: '',
    tipo: 'Material',
    descripcion: '',
    proveedor: '',
    unidad: 'unidad',
    cantidad: 1,
    costoUnitario: 0,
    tasaUtilidad: defaultMarginRate,
    especificacion: '',
  }
}

export const initialClient = {
  cliente: '',
  responsable: '',
  telefono: '',
  nit: '',
  razonSocial: '',
}
