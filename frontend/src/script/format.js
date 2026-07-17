// Formateurs partagés par les cards du dashboard d'analyse et le registre.

export function formatDate(iso) {
  return new Date(iso).toLocaleString('fr')
}

// Le jour seul, en toutes lettres. Distinct de `formatDate` (qui porte l'heure)
// : dans le registre, l'heure d'import est du bruit sous un titre de manuscrit.
export function formatDay(iso) {
  return new Date(iso).toLocaleDateString('fr', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatInt(n) {
  return n.toLocaleString('fr')
}

// Ko/Mo base 1024, comme les tailles citées dans les CLAUDE.md (le .odt témoin
// y fait « 376 Ko » pour 384 653 octets).
export function formatBytes(n) {
  if (n == null) return '—'
  const ko = n / 1024
  return ko >= 1024 ? `${(ko / 1024).toFixed(1).replace('.', ',')} Mo` : `${Math.round(ko)} Ko`
}

export function formatPercent(ratio) {
  return `${(ratio * 100).toFixed(1).replace('.', ',')} %`
}
