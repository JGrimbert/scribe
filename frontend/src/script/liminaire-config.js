import { LIMINAIRE_BY_KEY } from './liminaire-vocab'

// ─── Accès à la config de tagging ────────────────────────────────────────────
// La config est keyée par ENTRÉE et MUTÉE EN PLACE par les composants (même
// convention que RuleSetForm). Ces helpers vivent ici, et non dans un
// composant, parce que le composer, l'accordéon et le découpage lisent tous les
// trois le même objet : trois copies des mêmes accès divergeraient.

export function typeOfPage(config, page) {
  return config?.[page?.key]?.type ?? ''
}

export function sideOfPage(config, page) {
  return config?.[page?.key]?.side ?? 'auto'
}

export function breakOfKey(config, key) {
  return config?.[key]?.break
}

function entryFor(config, key) {
  return (config[key] ??= {})
}

export function setPageType(config, page, value) {
  entryFor(config, page.key).type = value || undefined
}

export function setPageSide(config, page, value) {
  entryFor(config, page.key).side = value === 'auto' ? undefined : value
}

// Toggle : re-cliquer une frontière posée la retire (retour au signal du .odt).
// On nettoie l'entrée devenue vide pour ne pas laisser d'objet mort.
export function toggleBreak(config, key, value) {
  const entry = entryFor(config, key)
  if (entry.break === value) {
    delete entry.break
    if (!entry.type && !entry.side) delete config[key]
  } else {
    entry.break = value
  }
}

// Le côté qu'IMPOSE le type tagué, s'il en impose un.
export function expectedSideOf(config, page) {
  const type = typeOfPage(config, page)
  return type ? (LIMINAIRE_BY_KEY.get(type)?.side ?? null) : null
}

export function isConflicting(config, page) {
  const expected = expectedSideOf(config, page)
  const side = sideOfPage(config, page)
  return !!expected && side !== 'auto' && side !== expected
}
