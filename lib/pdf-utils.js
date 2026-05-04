export function formatMoneyPdf(value, currency = 'BOB') {
  const num = Number(value || 0)
  const fixed = num.toFixed(2)
  const [intPart, decPart] = fixed.split('.')
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const prefix = currency === 'USD' ? '$us ' : 'Bs '
  return `${prefix}${withThousands},${decPart}`
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function getLogoDataUrl() {
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
