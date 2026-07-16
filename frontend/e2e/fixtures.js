// Mock du document servi par `GET /api/documents/:id`, partagé par les specs
// e2e. Évite de dépendre du backend Nest et d'un `.odt` importé.

export const DOC_ID = 'mock-doc'
export const TARGET_NODE = 'noeud-cible'

const SENTENCE =
    'Ceci est un paragraphe de test suffisamment long pour occuper de la place sur une page imprimée, phrase après phrase, afin de forcer un débordement si la pagination ne répartit pas correctement le texte sur plusieurs pages.'

function longParagraphs(count) {
  return Array.from({ length: count }, (_, i) => `${SENTENCE} (paragraphe ${i + 1})`)
}

// `decoyAxes` gonfle la sidebar : les axes de tête sont les seuls nœuds rendus
// tant qu'aucun n'est déplié, c'est donc le levier pour faire déborder
// StructureView et faire apparaître la scrollbar du rail.
export function buildMockDocument({ paragraphCount = 3, decoyAxes = 0 } = {}) {
  const axes = []
  const data = {}

  for (let i = 0; i < decoyAxes; i++) {
    const id = `axe-decor-${i}`
    axes.push({ id, children: [] })
    data[id] = { titre: `Axe de décor ${i + 1}`, texte: [], stats: { mots: 0 } }
  }

  axes.push({ id: TARGET_NODE, children: [] })
  data[TARGET_NODE] = {
    titre: 'Nœud de test',
    texte: longParagraphs(paragraphCount),
    stats: { mots: paragraphCount * 30 },
  }

  // validations : aucune relecture enregistrée — le bouton de la DocumentBar
  // part donc de son état neutre.
  return { title: 'Document de test', trame: { axes }, data, validations: {} }
}

// Neutralise les appels d'analyse (le pipeline NLP n'est pas dans le périmètre
// e2e) : la vue affiche son encart d'erreur, ce qui suffit à la faire rendre.
async function stubApi(page, options) {
  await page.route(`**/api/documents/${DOC_ID}/analyse**`, (route) =>
      route.fulfill({ status: 503, json: { message: 'analyse hors périmètre e2e' } })
  )
  await page.route(`**/api/documents/${DOC_ID}`, (route) =>
      route.fulfill({ json: buildMockDocument(options) })
  )
}

export async function gotoEditor(page, options = {}) {
  await stubApi(page, options)
  await page.goto(`/documents/${DOC_ID}/noeud/${TARGET_NODE}`)
}

export async function gotoAnalyse(page, options = {}) {
  await stubApi(page, options)
  await page.goto(`/documents/${DOC_ID}`)
}
