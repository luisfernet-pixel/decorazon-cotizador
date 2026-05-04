export function resourceMeta(row) {
  try {
    return row.notes ? JSON.parse(row.notes) : {}
  } catch {
    return {}
  }
}
