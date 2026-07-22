import { test, expect } from '@playwright/test'
import { gotoEditor } from './fixtures.js'

// FolioView pagine via Paged.js DANS une iframe (`.folio-frame`) : les pages
// sont des `.pagedjs_page`, leur zone de texte `.pagedjs_page_content`. On cible
// donc l'iframe (frameLocator), pas le document principal.
//
// Ce test fixe un PLANCHER de pages (pas un chiffre exact — le découpage précis
// peut varier) et vérifie qu'aucune page ne déborde grossièrement : deux gardes
// contre une régression de pagination (sous-estimation de la hauteur du texte).
const frame = (page) => page.frameLocator('.folio-frame')

test('un nœud court tient sur une seule page', async ({ page }) => {
  await gotoEditor(page, { paragraphCount: 3 })

  const pages = frame(page).locator('.pagedjs_page')
  await expect(pages).toHaveCount(1, { timeout: 15000 })
})

test("un nœud long se répartit sur assez de pages, sans débordement grossier", async ({ page }) => {
  await gotoEditor(page, { paragraphCount: 40 })

  const pages = frame(page).locator('.pagedjs_page')
  await expect(pages.first()).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(500) // laisse la pagination asynchrone se stabiliser

  const count = await pages.count()
  // Avec ce gabarit (41 blocs : titre + 40 paragraphes) et une page 148x210mm,
  // le flux produit ~8 pages. 4 ou moins signalerait une sous-pagination.
  expect(count, 'nombre de pages produites pour 40 paragraphes').toBeGreaterThanOrEqual(6)

  // Garde-fou grossier : le contenu d'une page ne doit pas dépasser largement la
  // hauteur de la page (signe que la pagination a sous-estimé la place du texte).
  // `offsetHeight`/`scrollHeight` sont en px de layout NON scalés (le rendu
  // porte un `transform: scale()` que ces mesures ignorent).
  for (let i = 0; i < count; i++) {
    const pageEl = pages.nth(i)
    const { pageHeight, contentHeight } = await pageEl.evaluate((el) => ({
      pageHeight: el.offsetHeight,
      contentHeight: el.querySelector('.pagedjs_page_content').scrollHeight,
    }))
    expect(
        contentHeight,
        `page ${i + 1} : contenu ${contentHeight}px pour une page de ${pageHeight}px`
    ).toBeLessThanOrEqual(pageHeight * 1.15)
  }
})
