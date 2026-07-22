import { LIMINAIRE_PAGES, LIMINAIRE_BY_KEY } from './liminaire-vocab'

// L'éligibilité du liminaire, dérivée du tagging (pas une saisie à part) —
//  - `obligatoires` : les trois pages minimales, avec leur présence.
//  - `presentTypes` : tous les types assignés (pour cocher les optionnels).
//  - `conflicts` : une page dont le côté CHOISI contredit le côté conventionnel
//    de son type (mentions légales en recto, p. ex.). 'auto' ne contredit rien.
//  - `duplicates` : un type conventionnel assigné à plusieurs pages (une page de
//    titre en double n'est pas une page de titre plus sûre).
// Les pages blanches sont hors jeu (elles ne portent pas de type).
export function deriveEligibility(pages, config) {
  const assigned = (pages ?? []).filter((p) => !p.isBlank).map((page) => ({
    page,
    type: config?.[page.key]?.type ?? null,
    side: config?.[page.key]?.side ?? 'auto',
  }))
  const presentTypes = new Set(assigned.map((a) => a.type).filter(Boolean))

  const byType = new Map()
  for (const a of assigned) {
    if (!a.type) continue
    byType.set(a.type, (byType.get(a.type) ?? 0) + 1)
  }

  const obligatoires = LIMINAIRE_PAGES.filter((t) => t.obligatoire).map((t) => ({
    key: t.key,
    label: t.label,
    present: presentTypes.has(t.key),
  }))

  const conflicts = []
  for (const a of assigned) {
    const def = a.type && LIMINAIRE_BY_KEY.get(a.type)
    if (def && def.side && a.side !== 'auto' && a.side !== def.side) {
      conflicts.push({ key: a.page.key, type: a.type, label: def.label, chosen: a.side, expected: def.side })
    }
  }

  const duplicates = [...byType.entries()]
    .filter(([, n]) => n > 1)
    .map(([type, n]) => ({ type, label: LIMINAIRE_BY_KEY.get(type)?.label ?? type, count: n }))

  return { assigned, presentTypes, obligatoires, conflicts, duplicates }
}
