import { ref } from 'vue'
import { buildFragmentRegistry, createFragmentApi } from '../script/fragment.js'
import { createRegistry } from '../script/registry.js'

// URLs ABSOLUES : l'iframe sans `src` a une base `about:blank`. Le build UMD de
// Paged.js est servi par un middleware dev (cf. vite.config.js).
const PAGED_SRC = new URL('/vendor/paged.js', window.location.href).href
const CSS_HREF = new URL('/paged.css', window.location.href).href

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
    doc.write('<!doctype html><html><head><meta charset="utf-8"></head><body><div id="render"></div></body></html>')
    doc.close()

    const boot = doc.createElement('style')
    boot.id = '__boot'
    // Origine top-left : la mise à l'échelle et la largeur de l'iframe s'accordent
    // au pixel (pas de marge parasite ni de coupe). Bordure de page + filet
    // pointillé sur la zone de contenu = repère des marges du livre.
    const common = [
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

    const boot = doc.getElementById('__boot')
    doc.head.querySelectorAll('style').forEach((el) => { if (el !== boot) el.remove() })

    const target = doc.getElementById('render')
    if (!target) return Promise.resolve()
    target.style.transform = ''
    target.innerHTML = ''
    onReset?.()

    if (!blocks.value.length) {
      registry.value = null
      fragments.value = null
      return Promise.resolve()
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
      article.appendChild(root)
    }
    const source = doc.createElement('div')
    source.appendChild(article)

    const previewer = new win.Paged.Previewer()
    return previewer.preview(source, [CSS_HREF], target).then((flow) => {
      if (props.mode === 'edit' && flow) {
        const owners = new Map([[props.nodeId, section.value]])
        const blockRegistry = createRegistry(owners, blocks.value, flow)
        const { fragmentMap, blockFragments } = buildFragmentRegistry(flow)
        registry.value = blockRegistry
        fragments.value = createFragmentApi(blockRegistry, fragmentMap, blockFragments)
      }
      onPaginated?.()
    }).catch((e) => {
      console.warn('[FolioView] pagination échouée', e)
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
      }
    }
  }

  return { registry, fragments, buildFrame, refresh, teardown }
}
