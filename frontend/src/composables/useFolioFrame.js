import { ref } from 'vue'
import { buildFragmentRegistry, createFragmentApi } from '../script/fragment.js'
import { createRegistry } from '../script/registry.js'
import { buildVisualsCss, buildHyphenationCss, buildPageCss, buildPagePinCss } from '../script/folioStyles.js'

// URLs ABSOLUES : l'iframe sans `src` a une base `about:blank`. Le build UMD de
// Paged.js est servi par un middleware dev (cf. vite.config.js).
const PAGED_SRC = new URL('/vendor/paged.js', window.location.href).href
const CSS_HREF = new URL('/paged.css', window.location.href).href

// Déconnecte les ResizeObserver que Paged.js pose sur chaque page (re-fragmentation
// réactive au débordement). Ils survivent à preview() et planifient un rAF ; si on
// jette le tampon avant qu'il ne s'exécute, il tombe sur un nœud détaché et lève un
// `TypeError` (findEndToken → getAttribute sur null). `Page.destroy()` appelle
// `removeListeners()` (déconnexion + `listening=false` → le callback baille). On passe
// par les internes du previewer (`chunker.pages`), faute d'API publique de teardown ;
// couplé à la version de pagedjs (dans node_modules), d'où les try/catch défensifs.
function disconnectPagedObservers(previewer) {
  try {
    previewer?.chunker?.pages?.forEach((p) => { try { p.destroy() } catch { /* déjà démonté */ } })
  } catch { /* API interne absente : au pire, le TypeError bénin réapparaît */ }
}

// Construit l'iframe Paged.js et la (re)pagine. En édition, (re)construit le
// registre de blocs/fragments depuis le flow paginé (`registry`/`fragments`,
// partagés avec useFragmentEditor). Les helpers DOM (frameDoc/findFragEl…) restent
// chez FolioView (propres au composant racine, cf. composables/CLAUDE.md) ; ici, le
// cycle iframe.
//
// Callbacks : `onReset` (vider le curseur avant chaque repagination), `onPaginated`
// (recalage d'échelle après), `getEditListeners` (les listeners du doc iframe en
// mode édition — résolus au (dé)montage, ils n'existent que chez FolioView).
export function useFolioFrame(props, { frameRef, frameDoc, blocks, section, onReset, onPaginated, getEditListeners }) {
  const registry = ref(null)
  const fragments = ref(null)
  let frameReady = false

  function buildFrame() {
    const doc = frameDoc()
    if (!doc) return
    doc.open()
    // `lang="fr"` : sans langue déclarée, `hyphens:auto` est inerte (le navigateur
    // ne choisit pas de dictionnaire de césure). Le corpus est francophone.
    doc.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"></head><body><div id="render"></div></body></html>')
    doc.close()

    const boot = doc.createElement('style')
    boot.id = '__boot'
    // Origine top-left : la mise à l'échelle et la largeur de l'iframe s'accordent
    // au pixel (pas de marge parasite ni de coupe). Bordure de page + filet
    // pointillé sur la zone de contenu = repère des marges du livre.
    const common = [
      // Épingle la géométrie de page (:root, !important) : neutralise le polyfill
      // *letter* que Paged ré-injecte dans ce head partagé à chaque pagination, qui
      // sinon ferait basculer la taille du contenu VISIBLE (cf. buildPagePinCss).
      buildPagePinCss(props.page),
      'html,body{margin:0;padding:0;background:transparent;overflow:hidden;}',
      '#render{transform-origin:top left;}',
      '.pagedjs_page{background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.15);border:1px solid #e2e2e2;}',
      // Justification garantie de la zone de texte (le livre est justifié) : c'est
      // aussi ce que syncQuill recopiera sur Quill (via getComputedStyle du
      // fragment). Les titres restent courts, l'effet ne s'y voit pas.
      '.pagedjs_page_content{outline:1px dotted #d6d6d6;text-align:justify;}',
    ].join('')
    const layout = props.mode === 'edit' ? '' : '.pagedjs_pages{display:block;} .pagedjs_page{margin:0;}'
    boot.textContent = common + layout
    doc.head.appendChild(boot)

    if (props.mode === 'edit') {
      const listeners = getEditListeners?.()
      if (listeners) {
        doc.addEventListener('click', listeners.click)
        doc.addEventListener('mousedown', listeners.mousedown)
        doc.addEventListener('mouseup', listeners.mouseup)
        // passive:false : un listener wheel sur `document` est passif par défaut,
        // preventDefault y serait ignoré (on veut couper le scroll-chaining natif).
        if (listeners.wheel) doc.addEventListener('wheel', listeners.wheel, { passive: false })
      }
    }

    const script = doc.createElement('script')
    script.src = PAGED_SRC
    script.onload = () => { frameReady = true; refresh() }
    doc.head.appendChild(script)
  }

  // (Re)pagine dans l'iframe et, en édition, (re)construit le registre depuis le
  // flow. Renvoie une promesse : useFragmentEditor l'attend après chaque édition.
  function refresh() {
    const frame = frameRef.value
    const doc = frame?.contentDocument
    const win = frame?.contentWindow
    if (!frameReady || !doc || !win?.Paged) return Promise.resolve()

    const render = doc.getElementById('render')
    if (!render) return Promise.resolve()

    // Vide le curseur : le DOM du fragment courant va être remplacé.
    onReset?.()

    if (!blocks.value.length) {
      doc.head.querySelectorAll('style').forEach((el) => { if (el.id !== '__boot') el.remove() })
      render.innerHTML = ''
      registry.value = null
      fragments.value = null
      return Promise.resolve()
    }

    // Double-buffer : on ne touche NI à #render (l'ancien rendu reste affiché et
    // stylé) NI aux styles de la génération précédente tant que le nouveau rendu
    // n'est pas prêt. On pagine dans un conteneur caché, puis on swappe le contenu
    // dans #render en un seul tick (fitScale posé dans la foulée par onPaginated).
    // Résultat : jamais de page blanche ni de flash à 100 % entre deux
    // repaginations (changement de chapitre, split/merge d'un paragraphe). Les
    // styles de l'ancienne génération sont retirés APRÈS le swap (snapshot ici).
    const staleStyles = [...doc.head.querySelectorAll('style')].filter((el) => el.id !== '__boot')

    // Feuille d'apparence des styles (fidélité .odt), régénérée à chaque
    // repagination, avant le preview pour que Paged.js la reprenne. Sans id :
    // l'ancienne est dans staleStyles (retirée après le swap), la neuve lui survit.
    const visualsCss = buildVisualsCss(props.visuals)
    if (visualsCss) {
      const styleEl = doc.createElement('style')
      styleEl.textContent = visualsCss
      doc.head.appendChild(styleEl)
    }

    // Césure : cascade valeur .odt du style > défaut global (props.hyphenation).
    // Même cycle de vie que la feuille d'apparence (régénérée, sans id → l'ancienne
    // part avec staleStyles après le swap).
    const hyphenationCss = buildHyphenationCss(props.visuals, { global: props.hyphenation?.global })
    if (hyphenationCss) {
      const styleEl = doc.createElement('style')
      styleEl.textContent = hyphenationCss
      doc.head.appendChild(styleEl)
    }

    // Article + `data-block-id` sur chaque bloc : l'`<article>` porte la typo du
    // livre (paged.css), l'attribut permet à buildFragmentRegistry de repérer les
    // blocs dans le flow paginé et d'y stamper les `data-frag-id`.
    const article = doc.createElement('article')
    for (const b of blocks.value) {
      const tmp = doc.createElement('div')
      tmp.innerHTML = b.html
      const root = tmp.firstElementChild
      if (!root) continue
      root.setAttribute('data-block-id', b.id)
      // Clé d'apparence : la feuille d'apparence cible `[data-style="…"]`. Préservé
      // par Paged.js sur chaque fragment issu d'une coupure de page.
      if (b.styleName) root.setAttribute('data-style', b.styleName)
      article.appendChild(root)
    }
    const source = doc.createElement('div')
    source.appendChild(article)

    // Conteneur tampon caché : Paged.js y pagine à taille naturelle (100 %),
    // invisible, PENDANT que #render garde l'ancien rendu affiché (pas de page
    // blanche). opacity:0 (pas display:none) préserve la mise en page dont Paged.js
    // a besoin pour découper les pages. Ce tampon est jeté après clonage (ci-dessous).
    const buffer = doc.createElement('div')
    buffer.style.cssText = 'position:absolute;top:0;left:0;opacity:0;pointer-events:none;'
    doc.body.appendChild(buffer)

    const previewer = new win.Paged.Previewer()
    // Format de page du document (A5, marges du .odt) passé APRÈS paged.css pour
    // que son @page l'emporte ; objet `{ nom: cssText }` = CSS inline (non fetché,
    // cf. Polisher.add). Absent → paged.css garde son A5 par défaut.
    const pageCss = buildPageCss(props.page)
    const sheets = pageCss ? [CSS_HREF, { 'doc-page.css': pageCss }] : [CSS_HREF]
    return previewer.preview(source, sheets, buffer).then((flow) => {
      // Registre AVANT le clonage : buildFragmentRegistry stampe les data-frag-id
      // sur les nœuds rendus (le clone en hérite) et ne capture que des chaînes HTML
      // — aucune référence DOM vivante, donc le clone ne le casse pas.
      if (props.mode === 'edit' && flow) {
        const owners = new Map([[props.nodeId, section.value]])
        const blockRegistry = createRegistry(owners, blocks.value, flow)
        const { fragmentMap, blockFragments } = buildFragmentRegistry(flow)
        registry.value = blockRegistry
        fragments.value = createFragmentApi(blockRegistry, fragmentMap, blockFragments)
      }

      // Paged.js laisse un ResizeObserver VIVANT sur chaque page (re-fragmentation
      // réactive au débordement) qui survit à preview(). On injecte donc un CLONE INERTE
      // (cloneNode ne recopie ni observers ni listeners) et on déconnecte les observers
      // du tampon avant de le jeter. Swap + recalage d'échelle dans le même tick → un
      // seul paint.
      const clones = [...buffer.children].map((c) => c.cloneNode(true))
      disconnectPagedObservers(previewer)
      buffer.remove()
      render.replaceChildren(...clones)
      staleStyles.forEach((el) => el.remove())
      onPaginated?.()
    }).catch((e) => {
      console.warn('[FolioView] pagination échouée', e)
      disconnectPagedObservers(previewer)
      // Échec : on jette le tampon et on garde l'ancien rendu (+ ses styles) intact.
      // onPaginated réconcilie l'échelle sur le contenu resté en place.
      buffer.remove()
      onPaginated?.()
    })
  }

  function teardown() {
    const doc = frameDoc()
    if (doc && props.mode === 'edit') {
      const listeners = getEditListeners?.()
      if (listeners) {
        doc.removeEventListener('click', listeners.click)
        doc.removeEventListener('mousedown', listeners.mousedown)
        doc.removeEventListener('mouseup', listeners.mouseup)
        if (listeners.wheel) doc.removeEventListener('wheel', listeners.wheel, { passive: false })
      }
    }
  }

  return { registry, fragments, buildFrame, refresh, teardown }
}
