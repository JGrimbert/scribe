// Formateurs partagés par les cards du dashboard et le registre.

export function formatDate(iso) {
  return new Date(iso).toLocaleString('fr')
}

// Le jour seul (l'heure d'import est du bruit sous un titre de manuscrit).
export function formatDay(iso) {
  return new Date(iso).toLocaleDateString('fr', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatInt(n) {
  return n.toLocaleString('fr')
}

// Base 1024, comme les tailles citées dans les CLAUDE.md.
export function formatBytes(n) {
  if (n == null) return '—'
  const ko = n / 1024
  return ko >= 1024 ? `${(ko / 1024).toFixed(1).replace('.', ',')} Mo` : `${Math.round(ko)} Ko`
}

export function formatPercent(ratio) {
  return `${(ratio * 100).toFixed(1).replace('.', ',')} %`
}
