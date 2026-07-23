import { test, expect } from '@playwright/test'
import { gotoAnalyse, gotoEditor } from './fixtures.js'

// Géométrie de CustomScrollbar + non-régression de la boucle de rétroaction
// Folia. Ces tests portent sur du layout réel (hauteurs, débordements) :
// jsdom ne sait pas les rendre, d'où le passage par Playwright.

const SIDEBAR = '.document-layout__sidebar'
const CONTENT = '.document-layout__content'

const box = (locator) => locator.boundingBox()

async function viewportHeight(page) {
  return page.evaluate(() => window.innerHeight)
}

// NOTE : le bloc « boucle de rétroaction Folia » a été retiré avec la suppression
// de l'ancien éditeur (Folia.vue). FolioView met à l'échelle via fitScale, sur un
// clientHeight de parent flex indépendant du contenu (pas de boucle par
// construction) — une couverture dédiée pourra être réécrite si besoin.

test.describe('track dans les limites du viewport', () => {
  // La marge négative de `.document-layout` faisait grandir la boîte de
  // --bar-size au lieu de la remonter : la track dépassait sous la fenêtre et
  // le bas du contenu était coupé d'autant.
  test('la track ne descend pas sous la fenêtre', async ({ page }) => {
    await gotoAnalyse(page, { decoyAxes: 60 })
    await expect(page.locator(SIDEBAR)).toBeVisible()
    await page.waitForTimeout(500)

    const track = await box(page.locator(`${SIDEBAR} .custom-scrollbar__track--y`))
    const height = await viewportHeight(page)

    expect(track.y + track.height, 'la track dépasse le bas du viewport').toBeLessThanOrEqual(height + 1)
  })

  test('le contenu est intégralement atteignable en fin de scroll', async ({ page }) => {
    await gotoAnalyse(page, { decoyAxes: 60 })
    const content = page.locator(`${SIDEBAR} .custom-scrollbar__content`)
    await expect(page.locator(SIDEBAR)).toBeVisible()
    await page.waitForTimeout(500)

    await content.evaluate((el) => { el.scrollTop = el.scrollHeight })
    await page.waitForTimeout(200)

    const viewport = await viewportHeight(page)
    const lastNodeBottom = await page
        .locator(`${SIDEBAR} .structure-panel > *, ${SIDEBAR} .panel-content > *`)
        .last()
        .evaluate((el) => el.getBoundingClientRect().bottom)

    expect(lastNodeBottom, 'le bas du contenu reste hors de la fenêtre').toBeLessThanOrEqual(viewport + 1)
  })

  test('le thumb reste dans sa track en fin de course', async ({ page }) => {
    await gotoAnalyse(page, { decoyAxes: 60 })
    const content = page.locator(`${SIDEBAR} .custom-scrollbar__content`)
    await expect(page.locator(SIDEBAR)).toBeVisible()
    await page.waitForTimeout(500)

    await content.evaluate((el) => { el.scrollTop = el.scrollHeight })
    await page.waitForTimeout(200)

    const track = await box(page.locator(`${SIDEBAR} .custom-scrollbar__track--y`))
    const thumb = await box(page.locator(`${SIDEBAR} .custom-scrollbar__thumb--y`))

    expect(thumb.y, 'le thumb sort par le haut de sa track').toBeGreaterThanOrEqual(track.y - 1)
    expect(thumb.y + thumb.height, 'le thumb déborde sous sa track').toBeLessThanOrEqual(
        track.y + track.height + 1
    )
  })
})

test.describe('affichage conditionnel', () => {
  // `ratio !== 1` comparait deux flottants issus de sources différentes
  // (getBoundingClientRect fractionnaire vs scrollHeight arrondi) : le ratio
  // ne valait jamais exactement 1 et la track restait affichée.
  test('aucune track quand le contenu ne déborde pas', async ({ page }) => {
    await gotoEditor(page, { paragraphCount: 3 })
    // FolioView pagine dans une iframe : on attend la page rendue
    // (`.pagedjs_page`) avant de vérifier qu'aucune track n'apparaît. Le
    // débordement horizontal éventuel de la rangée de folios est porté par la
    // CustomScrollbar interne à FolioView (elle enveloppe `.folio-scroll`), pas
    // par la scrollbar de l'app. Ici, un seul folio → aucune track (ni x ni y).
    await expect(page.frameLocator('.folio-frame').locator('.pagedjs_page')).toHaveCount(1, { timeout: 15000 })
    await page.waitForTimeout(1500)

    await expect(page.locator(`${CONTENT} .custom-scrollbar__track--y`)).toBeHidden()
    await expect(page.locator(`${CONTENT} .custom-scrollbar__track--x`)).toBeHidden()
    await expect(page.locator(`${SIDEBAR} .custom-scrollbar__track--y`)).toBeHidden()
  })
})

test.describe('molette → horizontal (FolioView édition)', () => {
  // Les pages vivent dans une iframe qui capte la molette : FolioView relaie le
  // wheel du document de l'iframe vers la CustomScrollbar (handleWheel), qui
  // convertit deltaY en scroll horizontal de la rangée. On dispatche le WheelEvent
  // DANS le document de l'iframe (ce qu'un vrai navigateur fait au survol des
  // pages) : `page.mouse.wheel` de Playwright ne route pas la molette dans une
  // iframe, alors que ce relais est justement le cœur du correctif à couvrir.
  test('la molette au-dessus des pages défile la rangée horizontalement', async ({ page }) => {
    await gotoEditor(page, { paragraphCount: 120 })
    const content = page.locator('.folio-scroll .custom-scrollbar__content')
    await expect(page.frameLocator('.folio-frame').locator('.pagedjs_page').first())
        .toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1500)

    // Pré-condition : la rangée déborde bien horizontalement (sinon rien à tester).
    const overflow = await content.evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(overflow, 'pas de débordement horizontal — augmenter paragraphCount').toBeGreaterThan(1)

    const before = await content.evaluate((el) => el.scrollLeft)
    const frame = await (await page.locator('.folio-frame').elementHandle()).contentFrame()
    await frame.evaluate(() => {
      document.dispatchEvent(new WheelEvent('wheel', { deltaY: 400, bubbles: true, cancelable: true }))
    })
    await page.waitForTimeout(200)
    const after = await content.evaluate((el) => el.scrollLeft)

    expect(after, 'la molette verticale ne défile pas la rangée horizontalement').toBeGreaterThan(before)
  })
})

test.describe('flèches', () => {
  test('les flèches verticales défilent le contenu', async ({ page }) => {
    await gotoAnalyse(page, { decoyAxes: 60 })
    const content = page.locator(`${SIDEBAR} .custom-scrollbar__content`)
    await expect(page.locator(SIDEBAR)).toBeVisible()
    await page.waitForTimeout(500)

    await page.locator(`${SIDEBAR} .custom-scrollbar__arrow--down`).click()
    await page.waitForTimeout(200)
    const afterDown = await content.evaluate((el) => el.scrollTop)
    expect(afterDown, 'la flèche bas ne défile pas').toBeGreaterThan(0)

    await page.locator(`${SIDEBAR} .custom-scrollbar__arrow--up`).click()
    await page.waitForTimeout(200)
    const afterUp = await content.evaluate((el) => el.scrollTop)
    expect(afterUp, 'la flèche haut ne remonte pas').toBeLessThan(afterDown)
  })
})
