import { test, expect } from '@playwright/test'
import { gotoEditor } from './fixtures.js'

// Régression constatée le 2026-07-10, causée par l'introduction de
// vue-router : `paginate.js` passait 'paged.css' (chemin RELATIF) à
// `previewer.preview()`. Tant que l'app ne vivait qu'à `/`, ça résolvait
// bien vers `/paged.css`. Une fois des routes profondes possibles, la même
// référence relative résolvait vers `/documents/:id/noeud/paged.css` —
// inexistant, mais servi avec un 200 par le fallback SPA de Vite (qui renvoie
// index.html). Paged.js parsait alors du HTML comme du CSS, ne trouvait
// aucune règle `@page`, et retombait sur son format Letter par défaut
// (8.5x11in) au lieu de 148x210mm — d'où une pagination qui sous-estime la
// hauteur réelle du texte et déborde une fois affiché à la vraie largeur
// (.folio-content, `overflow: visible`, ne clippe rien). Corrigé en passant
// '/paged.css' (chemin absolu).
// Vérifié par bissection (git stash) avant correctif : à contenu strictement
// identique, l'ancien code (sans router, toujours à `/`) produisait 8 pages
// correctement remplies ; le nouveau code n'en produisait que 4, chacune
// hébergeant ~2x plus de texte que ce qu'elle peut réellement afficher. Ce
// test fixe un plancher de pages, PAS un chiffre exact (le découpage précis
// peut varier), pour détecter un retour en arrière — y compris si un futur
// chemin relatif similaire réapparaît.

test('un nœud court tient sur une seule page', async ({ page }) => {
  await gotoEditor(page, { paragraphCount: 3 })

  const folios = page.locator('.folio')
  await expect(folios).toHaveCount(1, { timeout: 15000 })
})

test("un nœud long se répartit sur assez de pages, sans débordement grossier", async ({ page }) => {
  await gotoEditor(page, { paragraphCount: 40 })

  const folios = page.locator('.folio')
  await expect(folios).not.toHaveCount(0, { timeout: 15000 })
  await page.waitForTimeout(500) // laisse la pagination asynchrone se stabiliser

  const count = await folios.count()
  // Avec ce gabarit (41 blocs : titre + 40 paragraphes), le flux d'origine
  // (avant le routing) produit 8 pages. 4 pages ou moins signale la
  // régression observée (sous-pagination).
  expect(count, 'nombre de pages produites pour 40 paragraphes').toBeGreaterThanOrEqual(6)

  // Garde-fou grossier : le contenu d'une page ne doit pas dépasser largement
  // la hauteur de son folio (signe que la pagination a sous-estimé la place
  // que prend le texte réellement affiché).
  // Les deux mesures se prennent en px de layout NON scalés (`offsetHeight`) :
  // Folia applique un `transform: scale()`, donc un boundingBox() serait à
  // l'échelle du zoom alors que scrollHeight ne l'est jamais — les comparer
  // ferait dépendre le test du zoom courant.
  for (let i = 0; i < count; i++) {
    const folio = folios.nth(i)
    const { folioHeight, contentHeight } = await folio.evaluate((el) => ({
      folioHeight: el.offsetHeight,
      contentHeight: el.querySelector('.folio-content').scrollHeight,
    }))
    expect(
        contentHeight,
        `page ${i + 1} : contenu ${contentHeight}px pour un folio de ${folioHeight}px`
    ).toBeLessThanOrEqual(folioHeight * 1.15)
  }
})
