import { computed, inject } from 'vue'
import { bookNodes } from '../script/trame'
import { annotatedPassages, nodeCharCounts } from '../script/annotations'

// Les annotations du livre, telles que la scène « Annotations » de la maquette
// les coule dans ses lambeaux. Rien à demander au backend : le surlignage voyage
// avec le texte (`entry.highlight` et `<mark data-hl>`, cf. script/annotations),
// et c'est la typologie EN COURS D'ÉDITION qui dit lesquels sont des annotations
// — d'où le calcul ici et pas en base : cocher « annotation » sur une couleur
// doit repeupler la colonne dans le même tick.
//
// `highlights` est la map réactive couleur → rôle détenue par useTypologyConfig
// (mutée en place), passée par l'hôte plutôt qu'injectée : la maquette la tient
// déjà.
export function useAnnotations(highlights) {
  const trame = inject('documentTrame', null)
  const data = inject('documentData', null)

  const nodes = computed(() => bookNodes(trame?.value?.axes, data?.value))

  const passages = computed(() =>
    annotatedPassages(nodes.value, data?.value, typeof highlights === 'function' ? highlights() : highlights),
  )

  // Les nœuds et leur poids en caractères, pour la contrainte `minChars` : le
  // panneau y lit combien de chapitres elle disqualifie.
  const charCounts = computed(() => nodeCharCounts(nodes.value, data?.value))

  return { passages, charCounts }
}
