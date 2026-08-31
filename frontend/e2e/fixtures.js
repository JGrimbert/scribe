// Mock du document servi par `GET /api/documents/:id`, partagé par les specs
// e2e. Évite de dépendre du backend Nest et d'un `.odt` importé.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

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
  await page.goto(`/documents/${DOC_ID}/analyse`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Maquette liminaire — fixture RÉELLE (capturée du témoin Johanan puis allégée :
// données des axes vidées, liminaire + styles/visuals conservés). Nécessaire car
// la maquette charge 6 endpoints et le liminaire ne rend qu'avec une vraie
// typologie + un vrai découpage d'entrées.
// ─────────────────────────────────────────────────────────────────────────────
export const LIM_DOC_ID = 'lim-doc'

const fx = (name) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8'))

const LIM_DOCUMENT = fx('liminaireDoc.json')
const LIM_TYPOLOGY = fx('liminaireTypology.json')
const LIM_STYLE_OVERRIDES = fx('liminaireStyleOverrides.json')
const LIM_RULES = { default: { minChars: 500, forbidAnnotations: true, requiresRoles: [], requiresTable: false, requiresStyles: [], requiresAdjacency: [] }, byDepth: {} }
const LIM_STYLE_DEFAULTS = { hyphenation: { global: false }, pageSize: null, pageMargins: null, runningTitles: { header: { enabled: true, recto: 'chapitre', verso: 'titre', heightCm: null, justification: 'centre' }, footer: { enabled: true, recto: 'folio', verso: 'folio', heightCm: null, justification: 'regard' }, folioFormat: 'numerique' }, manchette: { enabled: false, widthCm: null } }

async function stubMaquette(page) {
  const id = LIM_DOC_ID
  const json = (data) => (route) => route.fulfill({ json: data })
  // Analyse hors périmètre e2e.
  await page.route(`**/api/documents/${id}/analyse**`, (route) => route.fulfill({ status: 503, json: { message: 'hors périmètre e2e' } }))
  // Endpoints de config chargés par useTypologyConfig.load.
  await page.route(`**/api/documents/${id}/typology`, json(LIM_TYPOLOGY))
  await page.route(`**/api/documents/${id}/rules`, json(LIM_RULES))
  await page.route(`**/api/documents/${id}/liminaire-config`, json({}))
  await page.route(`**/api/documents/${id}/style-defaults`, json(LIM_STYLE_DEFAULTS))
  await page.route(`**/api/documents/${id}/style-overrides`, json(LIM_STYLE_OVERRIDES))
  // Registre (accueil) + document.
  await page.route('**/api/documents', json([{ id, title: LIM_DOCUMENT.title, sourceFilename: 'johanan.odt', hasSource: true }]))
  await page.route(`**/api/documents/${id}`, json(LIM_DOCUMENT))
}

// `n` (1-indexé) cible le n-ième vis-à-vis liminaire (cf. route `Liminaire/:n`,
// useMaquetteRoute) — omis = le 1er. La dédicace (mentions | dédicace) est en `n=3`.
export async function gotoMaquetteLiminaire(page, n) {
  await stubMaquette(page)
  await page.goto(`/documents/${LIM_DOC_ID}/Liminaire${n ? `/${n}` : ''}`)
}
