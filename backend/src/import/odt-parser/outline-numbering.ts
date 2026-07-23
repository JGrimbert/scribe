import { FlatNode, OutlineFormat } from './types'

// Numérotation AUTO des titres (chapitrage ODT), reconstruite à l'import et
// portée par le nœud — un simple compteur CSS repartirait à I. dès qu'un article
// est affiché seul (cf. FolioView, une vue = un nœud).

const ROMAN = [
  ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400], ['C', 100], ['XC', 90],
  ['L', 50], ['XL', 40], ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1],
] as const

function toRoman(n: number): string {
  let out = ''
  for (const [sym, val] of ROMAN) {
    while (n >= val) {
      out += sym
      n -= val
    }
  }
  return out
}

// Base 26 BIJECTIVE (a..z, aa, ab…) : 1 = a, 26 = z, 27 = aa. Comme la
// numérotation par lettres de LibreOffice.
function toAlpha(n: number): string {
  let out = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(97 + rem) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

// Un compteur formaté selon `numFormat`, ou `null` si le niveau ne numérote pas
// (format vide/inconnu) ou si le compteur est nul (niveau jamais rencontré).
export function formatOutlineNumber(n: number, numFormat: string): string | null {
  if (n < 1) return null
  switch (numFormat) {
    case '1':
      return String(n)
    case 'i':
      return toRoman(n).toLowerCase()
    case 'I':
      return toRoman(n)
    case 'a':
      return toAlpha(n)
    case 'A':
      return toAlpha(n).toUpperCase()
    default:
      return null
  }
}

// Numéro de chaque titre, par index de FlatNode. Réplique la sémantique
// LibreOffice : un passage linéaire sur les titres DANS L'ORDRE DU DOCUMENT, par
// NIVEAU BRUT (`FlatNode.level`, pas la profondeur d'arbre ni les corrections de
// calibration — LibreOffice les ignore) ; `counter[L]++` puis remise à zéro des
// niveaux inférieurs. `displayLevels` > 1 concatène les niveaux parents (« 1.2 »).
export function computeOutlineNumbers(flatNodes: FlatNode[], format: OutlineFormat | null): Map<number, string> {
  const numbers = new Map<number, string>()
  if (!format) return numbers

  const counters: number[] = []
  for (const node of flatNodes) {
    if (node.kind !== 'heading') continue
    const level = node.level
    counters[level] = (counters[level] ?? 0) + 1
    for (let k = level + 1; k < counters.length; k++) counters[k] = 0

    const fmt = format[level]
    if (!fmt) continue
    const display = Math.max(1, fmt.displayLevels || 1)

    const parts: string[] = []
    let complete = true
    for (let k = Math.max(1, level - display + 1); k <= level; k++) {
      const one = format[k] ? formatOutlineNumber(counters[k] ?? 0, format[k].numFormat) : null
      if (one == null) {
        complete = false
        break
      }
      parts.push(one)
    }
    if (!complete || !parts.length) continue

    numbers.set(node.index, fmt.prefix + parts.join('.') + fmt.suffix)
  }
  return numbers
}
