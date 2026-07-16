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

test.describe('boucle de rétroaction Folia', () => {
  // `.spread-scaler` (Folia) fait height:100%. Si un ancêtre a une hauteur
  // indéfinie (parent bloc au lieu de flex), ce 100% se résout en `auto` :
  // Folia mesure alors sa PROPRE hauteur scalée et la multiplie par 0.92 à
  // chaque passage du ResizeObserver — décroissance géométrique jusqu'à
  // disparition des folios.
  test("l'échelle se stabilise au lieu de décroître indéfiniment", async ({ page }) => {
    await gotoEditor(page, { paragraphCount: 3 })
    await expect(page.locator('.folio')).toHaveCount(1, { timeout: 15000 })

    const indicator = page.locator('.scale-indicator')
    await page.waitForTimeout(600)
    const first = await indicator.textContent()
    await page.waitForTimeout(1500)
    const second = await indicator.textContent()

    expect(second, 'échelle instable entre deux relevés (boucle de rétroaction)').toBe(first)
    expect(parseInt(first, 10), 'échelle effondrée').toBeGreaterThan(20)
  })

  test('le folio garde une hauteur exploitable', async ({ page }) => {
    await gotoEditor(page, { paragraphCount: 3 })
    await expect(page.locator('.folio')).toHaveCount(1, { timeout: 15000 })
    await page.waitForTimeout(1500)

    const folio = await box(page.locator('.folio').first())
    expect(folio.height, 'folio écrasé par la boucle de rétroaction').toBeGreaterThan(150)
  })
})

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
    await expect(page.locator('.folio')).toHaveCount(1, { timeout: 15000 })
    await page.waitForTimeout(1500)

    await expect(page.locator(`${CONTENT} .custom-scrollbar__track--y`)).toBeHidden()
    await expect(page.locator(`${CONTENT} .custom-scrollbar__track--x`)).toBeHidden()
    await expect(page.locator(`${SIDEBAR} .custom-scrollbar__track--y`)).toBeHidden()
  })

  test('track horizontale quand la rangée de folios déborde', async ({ page }) => {
    await gotoEditor(page, { paragraphCount: 40 })
    await expect(page.locator('.folio').first()).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1500)

    await expect(page.locator(`${CONTENT} .custom-scrollbar__track--x`)).toBeVisible()
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

  test('les flèches horizontales défilent la rangée de folios', async ({ page }) => {
    await gotoEditor(page, { paragraphCount: 40 })
    const content = page.locator(`${CONTENT} .custom-scrollbar__content`)
    await expect(page.locator('.folio').first()).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1500)

    await page.locator(`${CONTENT} .custom-scrollbar__arrow--right`).click()
    await page.waitForTimeout(200)
    const afterRight = await content.evaluate((el) => el.scrollLeft)
    expect(afterRight, 'la flèche droite ne défile pas').toBeGreaterThan(0)

    await page.locator(`${CONTENT} .custom-scrollbar__arrow--left`).click()
    await page.waitForTimeout(200)
    const afterLeft = await content.evaluate((el) => el.scrollLeft)
    expect(afterLeft, 'la flèche gauche ne revient pas').toBeLessThan(afterRight)
  })
})
