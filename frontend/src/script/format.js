// Formateurs partagés par les cards du dashboard d'analyse.

export function formatDate(iso) {
  return new Date(iso).toLocaleString('fr')
}

export function formatInt(n) {
  return n.toLocaleString('fr')
}

export function formatPercent(ratio) {
  return `${(ratio * 100).toFixed(1).replace('.', ',')} %`
}
