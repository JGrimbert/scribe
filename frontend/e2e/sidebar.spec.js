import { test, expect } from '@playwright/test'
import { gotoAnalyse } from './fixtures.js'

// Le repli de la sidebar est une affaire de largeur réelle : jsdom ne résout
// pas les colonnes flex, d'où le passage par Playwright.

const SIDEBAR = '.document-layout__sidebar'
const CONTENT = '.document-layout__content'
const CHEVRON = '.doc-bar__chevron'

async function widths(page) {
  const sidebar = await page.locator(SIDEBAR).boundingBox()
  const content = await page.locator(CONTENT).boundingBox()
  return { sidebar: sidebar.width, content: content.width }
}

test.describe('repli de la sidebar', () => {
  // Régression : la largeur avait migré sur `.document-layout__sidebar` en dur
  // (250px) alors que StructureView gardait les classes `--rail`/`--liste`
  // devenues muettes — le rail se vidait de son contenu sans jamais rendre sa
  // place au dashboard.
  test('replier la sidebar élargit la zone de contenu', async ({ page }) => {
    await gotoAnalyse(page)
    await expect(page.locator(CHEVRON)).toBeVisible()

    const open = await widths(page)
    expect(open.sidebar, 'sidebar dépliée trop étroite').toBeGreaterThan(200)

    await page.locator(CHEVRON).click()
    await expect(page.locator('.panel-content')).toHaveCount(0)

    const rail = await widths(page)
    expect(rail.sidebar, 'le rail garde la largeur de la sidebar dépliée').toBeLessThan(
        open.sidebar / 2,
    )
    expect(
        rail.content - open.content,
        'le contenu ne récupère pas la place libérée par le rail',
    ).toBeCloseTo(open.sidebar - rail.sidebar, 0)
  })

  test('déplier la sidebar rend sa place au rail', async ({ page }) => {
    await gotoAnalyse(page)
    const open = await widths(page)

    await page.locator(CHEVRON).click()
    await expect(page.locator('.panel-content')).toHaveCount(0)
    await page.locator(CHEVRON).click()
    await expect(page.locator('.panel-content')).toBeVisible()

    expect((await widths(page)).sidebar).toBeCloseTo(open.sidebar, 0)
  })
})
