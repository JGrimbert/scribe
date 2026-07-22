// Adaptateur minimal Pretext -> shim qui expose une API proche de Paged.js
// Objectif : preview(source, cssPaths, measureEl) -> Promise<flow>
// Le flow retourné ici contient flow.pages, chaque page ayant area.innerHTML
// (forme utilisée ailleurs dans le code). C'est un POC : améliorer selon l'API
// exacte de @chenglou/pretext et selon les besoins de performance / styles.

import Pretext from '@chenglou/pretext'

export class Previewer {
  constructor(opts = {}) {
    this.opts = opts
    // TODO : initialisation Pretext si nécessaire
  }

  async preview(sourceEl, cssPaths = [], measureEl = null) {
    // POC minimal :
    // - Si Pretext expose une API de pagination, l'appeler ici et transformer
    //   le résultat pour produire flow.pages[].area.innerHTML.
    // - Pour l'instant, si l'API n'est pas utilisée, on renvoie la source
    //   en une seule "page" pour valider le wiring. Remplacer par vraie
    //   pagination après verification de l'API Pretext.
    try {
      if (Pretext && typeof Pretext.paginate === 'function') {
        // Exemple hypothétique : Pretext.paginate(element, options) -> pages
        const pages = await Pretext.paginate(sourceEl, { css: cssPaths })
        // pages -> tableau d'HTML ou d'éléments : normaliser
        const flow = { pages: pages.map((html) => ({ area: { innerHTML: html } })) }
        return flow
      }
    } catch (e) {
      // continue vers fallback
      console.warn('pretext-adapter: erreur pendant paginate, fallback to simple', e)
    }

    // fallback (POC) : renvoyer 1 page contenant tout le contenu
    const flow = { pages: [{ area: { innerHTML: sourceEl.innerHTML } }] }
    return flow
  }
}

export function createPreviewer() {
  return new Previewer()
}
