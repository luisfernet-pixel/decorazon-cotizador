import { safeText } from '@/lib/formatters'

export function getCompanyInfoLine(company) {
  const phones = Array.isArray(company?.phones) ? company.phones.join(' / ') : ''
  const address = safeText(company?.address)
  const email = safeText(company?.email)
  return [address, phones, email].filter(Boolean).join(' · ')
}
