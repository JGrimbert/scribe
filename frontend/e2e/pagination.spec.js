import { test, expect } from '@playwright/test'

// Régression constatée le 2026-07-10, causée par l'introduction de
// vue-router : `paginate.js` passait 'paged.css' (chemin RELATIF) à
// `previewer.preview()`. Tant que l'app ne vivait qu'à `/`, ça résolvait
// bien vers `/paged.css`. Une fois des routes profondes possibles
// (`/documents/:id/axe/:axeId`), la même référence relative résolvait vers
// `/documents/:id/axe/paged.css` — inexistant, mais servi avec un 200 par
// le fallback SPA de Vite (qui renvoie index.html). Paged.js parsait alors
// du HTML comme du CSS, ne trouvait aucune règle `@page`, et retombait sur
// son format Letter par défaut (8.5x11in) au lieu de 148x210mm — d'où une
// pagination qui sous-estime la hauteur réelle du texte et déborde une fois
// affiché à la vraie largeur (.folio-content, `overflow: visible`, ne
// clippe rien). Corrigé en passant '/paged.css' (chemin absolu).
// Vérifié par bissection (git stash) avant correctif : à contenu
// strictement identique, l'ancien code (sans router, toujours à `/`)
// produisait 8 pages correctement remplies ; le nouveau code n'en
// produisait que 4, chacune hébergeant ~2x plus de texte que ce qu'elle
// peut réellement afficher. Ce test fixe un plancher de pages, PAS un
// chiffre exact (le découpage précis peut varier), pour détecter un retour
// en arrière — y compris si un futur chemin relatif similaire réapparaît.
//
// paginate.js (src/script/paginate.js) ne pagine actuellement QUE la
// section à l'index 2 de la liste aplatie axe→bloc→article (hardcode
// `sections.value[2]`, pas encore généralisé à tout l'axe). Pour reproduire
// fidèlement le cas réel (JohananMarvarid a 2 axes sans bloc avant le
// premier axe substantiel), on construit 2 axes-décor avant l'axe cible :
// sections[2] tombe alors bien sur l'axe cible, qui porte le texte
// directement (pas de bloc).
const DOC_ID = 'mock-doc'
const DECOY_AXE_1 = 'axe-decoy-1'
const DECOY_AXE_2 = 'axe-decoy-2'
const TARGET_AXE = 'axe-cible'

function longParagraphs(count) {
  const sentence = 'Ceci est un paragraphe de test suffisamment long pour occuper de la place sur une page imprimée, phrase après phrase, afin de forcer un débordement si la pagination ne répartit pas correctement le texte sur plusieurs pages.'
  return Array.from({ length: count }, (_, i) => `${sentence} (paragraphe ${i + 1})`)
}

function buildMockDocument(paragraphCount) {
  return {
    trame: {
      axes: [
        { id: DECOY_AXE_1, blocs: [] },
        { id: DECOY_AXE_2, blocs: [] },
        { id: TARGET_AXE, blocs: [] },
      ],
    },
    data: {
      [DECOY_AXE_1]: { titre: 'Décor 1', texte: [] },
      [DECOY_AXE_2]: { titre: 'Décor 2', texte: [] },
      [TARGET_AXE]: { titre: 'Axe de test', texte: longParagraphs(paragraphCount) },
    },
  }
}

async function gotoMockDocument(page, paragraphCount) {
  await page.route(`**/api/documents/${DOC_ID}`, (route) =>
      route.fulfill({ json: buildMockDocument(paragraphCount) })
  )
  await page.goto(`/documents/${DOC_ID}/axe/${TARGET_AXE}`)
}

test('un axe court tient sur une seule page', async ({ page }) => {
  await gotoMockDocument(page, 3)

  const folios = page.locator('.folio')
  await expect(folios).toHaveCount(1, { timeout: 15000 })
})

test("un axe long se répartit sur assez de pages, sans débordement grossier", async ({ page }) => {
  await gotoMockDocument(page, 40)

  const folios = page.locator('.folio')
  await expect(folios).not.toHaveCount(0, { timeout: 15000 })
  await page.waitForTimeout(500) // laisse la pagination asynchrone se stabiliser

  const count = await folios.count()
  // Avec ce gabarit (41 blocs : titre + 40 paragraphes), le flux d'origine
  // (avant le routing) produit 8 pages. 4 pages ou moins signale la
  // régression observée (sous-pagination).
  expect(count, 'nombre de pages produites pour 40 paragraphes').toBeGreaterThanOrEqual(6)

  // Garde-fou grossier : le contenu d'une page ne doit pas dépasser
  // largement la hauteur de son folio (signe que la pagination a
  // sous-estimé la place que prend le texte réellement affiché).
  for (let i = 0; i < count; i++) {
    const folio = folios.nth(i)
    const folioBox = await folio.boundingBox()
    const contentHeight = await folio.locator('.folio-content').evaluate((el) => el.scrollHeight)
    expect(
        contentHeight,
        `page ${i + 1} : contenu ${contentHeight}px pour un folio de ${folioBox.height.toFixed(0)}px`
    ).toBeLessThanOrEqual(folioBox.height * 1.15)
  }
})
