import { computed, inject } from 'vue'
import FuzzySearch from 'fuzzy-search'

// Recherche du document, partagée par le volet de la doc-bar et le module de
// résultats de la maquette. DEUX portées, volontairement différentes :
//  · `hits` — recherche FLOUE sur les seuls TITRES (fuzzy-search). C'est la liste
//    de navigation : on veut « éveil » quand on tape « evei ».
//  · `phrases`/`fragments` — recherche EXACTE dans le corps, sur un index replié
//    construit une fois. Le flou n'aurait pas de sens à cette échelle (des
//    milliers de phrases, et un à-peu-près y ramène tout).
// `fuzzy-search` compare caractère à caractère sans replier les accents — on
// indexe donc une forme normalisée (« éveil » → « eveil ») et on cherche dessus.
export const fold = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const MAX_HITS = 60
// Borne du SEUL repli titre-seul (phrases témoins quand le mot est absent du corps).
// Les vrais passages ne sont plus capés : ils coulent tous, la maquette pagine.
const MAX_FRAGMENTS = 4
const MIN_PHRASE = 40 // en deçà : intertitre ou numéro, pas un passage
// Certaines phrases dépassent 700 signes — plus haut qu'une page de l'aperçu.
// On en garde une fenêtre CENTRÉE SUR L'OCCURRENCE (sans quoi tronquer ferait
// disparaître le mot cherché), ce que les […] du lambeau annoncent déjà.
const WINDOW = 150

// Les paragraphes portent le balisage inline du .odt (`<strong>`, `<em>`…) : on
// le dépouille, le lambeau étant du TEXTE (l'afficher tel quel montrerait les
// balises, et les compter fausserait la fenêtre ci-dessus).
const stripTags = (s) => s.replace(/<[^>]+>/g, '')

function windowAround(phrase, needle) {
  if (phrase.length <= WINDOW) return phrase
  const at = Math.max(0, fold(phrase).indexOf(needle))
  const start = Math.max(0, Math.min(at - (WINDOW - needle.length) / 2, phrase.length - WINDOW))
  let out = phrase.slice(start, start + WINDOW)
  // Recale sur des frontières de mots, sauf aux extrémités réelles de la phrase.
  if (start > 0 && out.includes(' ')) out = out.slice(out.indexOf(' ') + 1)
  if (start + WINDOW < phrase.length && out.includes(' ')) out = out.slice(0, out.lastIndexOf(' '))
  return out
}

// Découpe naïve en phrases : suffisant pour rendre un fragment lisible (on ne
// fait pas de segmentation linguistique ici, spaCy est côté service NLP).
const SENTENCE_SPLIT = /(?<=[.!?…])\s+/

export function useDocSearch(query) {
  const trame = inject('documentTrame', null)
  const data = inject('documentData', null)

  const trimmed = computed(() => (typeof query === 'function' ? query() : query?.value ?? '').trim())

  const index = computed(() => {
    const axes = trame?.value?.axes
    const d = data?.value
    if (!axes || !d) return []
    const out = []
    const walk = (node, ancestors) => {
      const titre = d[node.id]?.titre || '(sans titre)'
      out.push({ id: node.id, titre, norm: fold(titre), path: ancestors.join(' › ') })
      node.children?.forEach((child) => walk(child, [...ancestors, titre]))
    }
    axes.forEach((axe) => walk(axe, []))
    return out
  })

  // `sort: true` = les meilleurs scores d'abord (sinon ordre du livre).
  const searcher = computed(() => new FuzzySearch(index.value, ['norm'], { sort: true }))

  const hits = computed(() =>
    trimmed.value ? searcher.value.search(fold(trimmed.value)).slice(0, MAX_HITS) : [],
  )

  // Fragment = la phrase du chapitre trouvé qui porte la saisie, à défaut sa
  // première phrase de corps. On ne lit QUE les chapitres retenus : pas d'index
  // du texte intégral (cf. plus haut), le coût reste borné par le nombre de hits.
  function fragmentOf(hit) {
    const needle = fold(trimmed.value)
    const paragraphes = (data?.value?.[hit.id]?.texte ?? [])
      .filter((p) => p?.text?.trim())
      .map((p) => ({ ...p, text: stripTags(p.text) }))
    // Repli quand la saisie n'apparaît pas dans le corps (le fuzzy porte sur les
    // TITRES) : la première phrase substantielle. Le seuil écarte les numéros et
    // mentions d'ouverture (« I. », « Chapitre premier ») qui ne montrent rien.
    let premiere = null
    let courte = null
    for (const p of paragraphes) {
      for (const phrase of p.text.split(SENTENCE_SPLIT)) {
        const s = phrase.trim()
        if (!s) continue
        if (needle && fold(s).includes(needle)) return { ...hit, phrase: s, exact: true }
        if (s.length >= MIN_PHRASE) premiere ??= s
        else courte ??= s
      }
    }
    const phrase = premiere ?? courte
    return phrase ? { ...hit, phrase, exact: false } : null
  }

  // Index PLEIN TEXTE des phrases, construit une fois (mémorisé par le computed)
  // et déjà replié : chercher devient un `indexOf` sur des chaînes prêtes, au lieu
  // de normaliser tout le livre à chaque frappe. C'est ce qui permet de chercher
  // un mot du CORPS — le fuzzy ci-dessus ne connaît que les titres.
  const phrases = computed(() => {
    const d = data?.value
    if (!d || !index.value.length) return []
    const out = []
    for (const node of index.value) {
      for (const p of d[node.id]?.texte ?? []) {
        if (!p?.text?.trim()) continue
        for (const brut of stripTags(p.text).split(SENTENCE_SPLIT)) {
          const phrase = brut.trim()
          if (phrase.length < MIN_PHRASE) continue
          out.push({ id: node.id, titre: node.titre, path: node.path, phrase, norm: fold(phrase) })
        }
      }
    }
    return out
  })

  // Passages : d'abord les phrases qui portent la saisie ; à défaut (mot absent du
  // corps mais présent dans un titre), une phrase témoin des chapitres trouvés.
  // Le scan complet coûte ~5 ms sur un livre entier : on le mène jusqu'au bout
  // plutôt que de s'arrêter au quota, pour annoncer le VRAI nombre de passages
  // (n'en montrer que douze sans le dire ferait mentir l'en-tête).
  const matches = computed(() => {
    if (!trimmed.value) return []
    const needle = fold(trimmed.value)
    const found = phrases.value
      .filter((p) => p.norm.includes(needle))
      .map((p) => ({ ...p, phrase: windowAround(p.phrase, needle), exact: true }))
    return found.length ? found : hits.value.slice(0, MAX_FRAGMENTS).map(fragmentOf).filter(Boolean)
  })

  const fragments = computed(() => matches.value)
  const fragmentTotal = computed(() => matches.value.length)

  return { trimmed, hits, fragments, fragmentTotal }
}
