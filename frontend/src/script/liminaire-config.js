import { LIMINAIRE_BY_KEY } from './liminaire-vocab'

// Accès à la config de tagging, keyée par ENTRÉE et mutée en place par les composants.
// Ici et non dans un composant : le composer, l'accordéon et le découpage lisent tous le
// même objet.

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

// Toggle : re-cliquer une frontière la retire (retour au signal du .odt), en nettoyant
// l'entrée devenue vide.
export function toggleBreak(config, key, value) {
  const entry = entryFor(config, key)
  if (entry.break === value) {
    delete entry.break
    if (!entry.type && !entry.side) delete config[key]
  } else {
    entry.break = value
  }
}

export function expectedSideOf(config, page) {
  const type = typeOfPage(config, page)
  return type ? (LIMINAIRE_BY_KEY.get(type)?.side ?? null) : null
}

export function isConflicting(config, page) {
  const expected = expectedSideOf(config, page)
  const side = sideOfPage(config, page)
  return !!expected && side !== 'auto' && side !== expected
}
