// Cache localStorage des layouts coûteux (nuage, réseau) par (kind, docId), invalidé par
// une signature du contenu d'entrée. Une seule entrée par clé, écrasée à chaque changement.

const PREFIX = 'scribe:layout:'

// Hash djb2 → base36.
export function signature(input) {
  const s = String(input)
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export function loadLayout(kind, docId, sig) {
  try {
    const raw = localStorage.getItem(`${PREFIX}${kind}:${docId}`)
    if (!raw) return null
    const obj = JSON.parse(raw)
    return obj.sig === sig ? obj.data : null
  } catch {
    return null
  }
}

export function saveLayout(kind, docId, sig, data) {
  try {
    localStorage.setItem(`${PREFIX}${kind}:${docId}`, JSON.stringify({ sig, data }))
  } catch {
    // quota dépassé ou storage indisponible : on recalculera, pas bloquant.
  }
}
