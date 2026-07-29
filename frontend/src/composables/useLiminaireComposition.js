import { computed } from 'vue'
import { LIMINAIRE_BY_KEY } from '../script/liminaire-vocab'
import { computeImposition, toSpreads, pagesOfSpread } from '../script/liminaire-imposition'
import { deriveEligibility } from '../script/liminaire-eligibilite'
import {
  expectedSideOf,
  isConflicting,
  setPageSide,
  setPageType,
  sideOfPage,
  typeOfPage,
} from '../script/liminaire-config'
import { suggestAll } from '../script/liminaire-suggest'

// État de composition du liminaire, extrait de LiminaireComposer pour être PARTAGÉ
// entre l'écran de config (accordéon dédié) et l'écran Maquette (accordéon unifié).
// Refactor NON comportemental : LiminaireComposer garde exactement le même rendu.
//
// Args = getters (pages/config/title/focused sont réactifs chez l'appelant). Le
// FOCUS reste chez l'appelant (il vit hors du liminaire dans la Maquette) ; on n'en
// dérive ici que ce qui en dépend. `config` est muté EN PLACE (comme RuleSetForm).
export function useLiminaireComposition({ pages, config, title, focused }) {
  const P = () => pages() ?? []
  const C = () => config()

  const elig = computed(() => deriveEligibility(P(), C()))

  // Folios physiques (blanches implicites de parité comprises) regroupés en
  // planches ; chaque page reçoit son côté choisi ET la convention de son type.
  const spreads = computed(() =>
    toSpreads(
      computeImposition(
        P().map((p) => ({
          ...p,
          side: sideOfPage(C(), p),
          typeSide: LIMINAIRE_BY_KEY.get(typeOfPage(C(), p))?.side ?? 'auto',
        })),
      ),
    ),
  )

  // Suggestions DÉTERMINISTES (style-name + mots-clés + titre) — une proposition,
  // pas une décision (rien n'est persisté tant qu'on ne l'applique pas).
  const deterministic = computed(() => suggestAll(P(), { title: title() }))

  const types = computed(() =>
    Object.fromEntries(P().map((p) => [p.key, typeOfPage(C(), p)])),
  )
  const suggestions = computed(() =>
    Object.fromEntries(
      P()
        .filter((p) => deterministic.value[p.key])
        .map((p) => [p.key, { key: deterministic.value[p.key].key, why: deterministic.value[p.key].why }]),
    ),
  )
  const sides = computed(() =>
    Object.fromEntries(P().map((p) => [p.key, sideOfPage(C(), p)])),
  )
  const expectedSides = computed(() =>
    Object.fromEntries(P().map((p) => [p.key, expectedSideOf(C(), p)])),
  )
  const conflicts = computed(() =>
    Object.fromEntries(P().map((p) => [p.key, isConflicting(C(), p)])),
  )

  function onSetType(page, value) {
    setPageType(C(), page, value)
  }
  function onSetSide(page, value) {
    setPageSide(C(), page, value)
  }

  // Le cran terminal (étendre le liminaire) occupe la position `spreads.length`.
  const slideCount = computed(() => spreads.value.length + 1)
  const onExtendSlide = computed(() => focused() === spreads.value.length)
  const focusedPages = computed(() => pagesOfSpread(spreads.value[focused()]))

  const scopeLabel = computed(() => {
    if (onExtendSlide.value) return 'Fin du liminaire'
    const nums = focusedPages.value.map((p) => p.ordinal + 1)
    if (!nums.length) return `Vis-à-vis ${focused() + 1}`
    return nums.length > 1 ? `Pages ${nums[0]} et ${nums[nums.length - 1]}` : `Page ${nums[0]}`
  })

  const emptyLabel = computed(() =>
    onExtendSlide.value
      ? "Ce cran n'est pas une page : il étend le liminaire."
      : 'Ce vis-à-vis ne porte que des blanches de parité — rien à découper.',
  )

  return {
    elig, spreads, types, suggestions, sides, expectedSides, conflicts,
    onSetType, onSetSide, slideCount, onExtendSlide, focusedPages, scopeLabel, emptyLabel,
  }
}
