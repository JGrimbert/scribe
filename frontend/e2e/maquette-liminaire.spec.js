import { test, expect } from '@playwright/test'
import { gotoMaquetteLiminaire } from './fixtures.js'

// La maquette liminaire pose des cartouches de style sur la planche ; chacune porte le
// select de DISPOSITION (continu / saut de page / belle page). Ces specs vérifient que
// le liminaire rend, et surtout qu'AUCUN élément ne RECOUVRE le select (bug « clic non
// détecté » signalé par l'utilisateur — un recouvrement avale le clic).

test.describe('Maquette liminaire — Disposition', () => {
  test('le liminaire rend ses cartouches de style', async ({ page }) => {
    await gotoMaquetteLiminaire(page)
    await expect(page.locator('.fc-srow').first()).toBeVisible({ timeout: 20000 })
  })

  // Le bug « clic non détecté » (recouvrement) est signalé sur la DÉDICACE et par
  // intermittence : on vérifie CHAQUE vis-à-vis, dont la dédicace (n=3).
  for (const n of [1, 2, 3, 4, 5]) {
    test(`vis-à-vis n°${n} : aucun select de Disposition recouvert`, async ({ page }) => {
      await gotoMaquetteLiminaire(page, n)
      const rows = page.locator('.fc-srow')
      await expect(rows.first()).toBeVisible({ timeout: 20000 })
      // Attendre que le slide soit STABILISÉ : une seule planche montée (pas de slot
      // figé sortant dont l'overlay inerte recouvrirait les selects vivants).
      await expect.poll(() => page.locator('.folio-frame').count(), { timeout: 15000 }).toBe(1)
      const count = await rows.count()
      expect(count).toBeGreaterThan(0)

      for (let i = 0; i < count; i++) {
        const select = rows.nth(i).locator('select').first()
        if (!(await select.count())) continue
        // Au CENTRE du select, l'élément le plus haut doit appartenir à SA cartouche ;
        // sinon un élément étranger (iframe d'un slot, overlay figé…) le recouvre.
        const diag = await select.evaluate((el) => {
          const r = el.getBoundingClientRect()
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
          const cartouche = el.closest('.fc-srow')
          return {
            ok: !!(top && cartouche && cartouche.contains(top)),
            topTag: top ? top.tagName : 'null',
            topClass: top ? String(top.className).slice(0, 90) : '',
          }
        })
        expect(diag.ok, `n°${n} select #${i} recouvert par <${diag.topTag} class="${diag.topClass}">`).toBe(true)
      }
    })
  }

  test('le slot NON-vivant est inerte au pointeur (garde-fou anti-recouvrement)', async ({ page }) => {
    // Cœur du bug « clic avalé » : le slot sortant (son iframe de folio) recouvrait les
    // selects vivants. Le non-vivant doit rester `pointer-events:none` (cf. .folio-slot--frozen).
    await gotoMaquetteLiminaire(page, 3)
    await expect(page.locator('.fc-srow').first()).toBeVisible({ timeout: 20000 })
    const pe = await page.locator('.folio-slot--frozen').first().evaluate((el) => getComputedStyle(el).pointerEvents)
    expect(pe).toBe('none')
  })

  test('changer une Disposition recompose la planche (nombre de folios évolue)', async ({ page }) => {
    await gotoMaquetteLiminaire(page)
    const frame = page.frameLocator('.folio-frame').first()
    await expect(page.locator('.fc-srow').first()).toBeVisible({ timeout: 20000 })
    // Compte de pages rendues avant, puis on force une belle page sur le 1er style
    // taggable et on vérifie que la pagination bouge (au moins une blanche de plus).
    const before = await frame.locator('.pagedjs_page').count()
    const select = page.locator('.fc-srow select').first()
    await select.selectOption('blank')
    // La repagination est asynchrone : on attend un changement du compte de pages.
    await expect
      .poll(async () => frame.locator('.pagedjs_page').count(), { timeout: 15000 })
      .not.toBe(before)
  })
})
