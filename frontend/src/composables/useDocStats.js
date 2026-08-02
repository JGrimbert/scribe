import { computed, inject, onMounted } from 'vue'
import { formatInt, formatPercent } from '../script/format'
import { useAnalyse } from './useAnalyse'

// Stats d'un document, prêtes à afficher : structure (caractères/paragraphes/
// chapitres) dérivée de trame/data, global lexical du NLP. Deux hôtes s'en
// servent — le volet de recherche de la doc-bar et le dock de la maquette —
// d'où l'extraction. Trame/data sont INJECTÉES (les deux hôtes sont sous
// DocumentLayout), comme dans les composants qui l'utilisent.
const HINTS = {
  lemmes: 'Formes de base distinctes — un lemme regroupe les flexions d’un mot (chante, chantait → chanter).',
  diversite: 'TTR : mots distincts / mots totaux. Plus c’est élevé, plus le vocabulaire est varié.',
  densite: 'Part des mots porteurs de sens (noms, verbes, adjectifs, adverbes) sur le total.',
}

export function useDocStats() {
  const trame = inject('documentTrame', null)
  const data = inject('documentData', null)
  const { analysis, running, runStep, ensureLoaded } = useAnalyse()

  const structure = computed(() => {
    const axes = trame?.value?.axes
    const d = data?.value
    if (!axes || !d) return null
    let caracteres = 0
    let paragraphes = 0
    let titres = 0
    const walk = (node) => {
      titres++
      paragraphes += d[node.id]?.texte?.length ?? 0
      node.children.forEach(walk)
    }
    for (const axe of axes) {
      caracteres += d[axe.id]?.stats?.caracteres ?? 0
      walk(axe)
    }
    return { caracteres, paragraphes, titres }
  })

  const statItems = computed(() => {
    const g = analysis.value?.lexical?.global
    const s = structure.value
    const tile = (label, value, hint = null) => ({ label, value, hint, empty: value == null })
    return [
      tile('caractères', s ? formatInt(s.caracteres) : null),
      tile('mots', g ? formatInt(g.words) : null),
      tile('phrases', g ? formatInt(g.sentences) : null),
      tile('paragraphes', s ? formatInt(s.paragraphes) : null),
      tile('chapitres', s ? formatInt(s.titres) : null),
      tile('lemmes', g ? formatInt(g.uniqueLemmas) : null, HINTS.lemmes),
      tile('diversité', g ? formatPercent(g.ttr) : null, HINTS.diversite),
      tile('densité', g ? formatPercent(g.lexicalDensity) : null, HINTS.densite),
    ]
  })

  // Les chiffres lexicaux (et le nuage) viennent du NLP. On LIT d'abord l'analyse
  // enregistrée — hors dashboard personne ne l'a chargée, et relancer le calcul
  // sur un livre entier au seul focus du champ de recherche serait absurde — puis
  // on ne calcule que si l'étape manque vraiment.
  onMounted(async () => {
    await ensureLoaded()
    if (!analysis.value?.lexical && !running.value) runStep('lexical')
  })

  return { structure, statItems }
}
