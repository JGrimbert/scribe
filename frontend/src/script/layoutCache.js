// Cache localStorage des layouts calculés côté client (nuage d3-cloud, réseau
// lexical) : ce sont des fonctions pures des données, coûteuses, recalculées à
// chaque montage. On les persiste par (kind, docId) et on invalide via une
// signature du contenu d'entrée. Une seule entrée par (kind, docId) : bornée,
// écrasée dès que la signature change.

const PREFIX = 'scribe:layout:'

// Hash djb2 → base36, suffisant pour départager un contenu d'entrée.
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
