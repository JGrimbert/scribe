<template>
  <div ref="rootRef" class="folio-view" :class="`folio-view--${mode}`">
    <iframe ref="frameRef" class="folio-frame" :title="mode === 'edit' ? 'Pages du chapitre' : 'Aperçu de page'" />
    <p v-if="!hasContent" class="folio-empty">Aucun aperçu disponible.</p>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { buildBlocks } from '../script/paginate.js'

const props = defineProps({
  // 'read' : aperçu compact (une page, sans Quill).
  // 'edit' : la rangée de pages du chapitre (Quill/overlays viendront ensuite).
  mode: { type: String, default: 'read' },
  // Le modèle de données du document (keyé par nodeId).
  data: { type: Object, default: null },
  // Le nœud à rendre (aperçu : le témoin ; édition : le chapitre courant).
  nodeId: { type: String, default: null },
  // Profondeur → tag de titre (h1..h6), pour porter le bon niveau.
  depth: { type: Number, default: 0 },
  // Édition seulement : combien de pages viser dans la largeur visible (le reste
  // défile horizontalement), comme le `visiblePages` de Folia.
  visiblePages: { type: Number, default: 2.2 },
})

const rootRef = ref(null)
const frameRef = ref(null)

// URLs ABSOLUES : l'iframe sans `src` a une base `about:blank`, où un chemin
// racine résout mal. On fige donc tout contre l'origine du parent. Le build UMD
// de Paged.js est servi par un middleware dev (cf. vite.config.js).
const PAGED_SRC = new URL('/vendor/paged.js', window.location.href).href
const CSS_HREF = new URL('/paged.css', window.location.href).href

// HTML source du nœud : mêmes blocs que l'éditeur (titre, paragraphes, listes,
// tableaux) via buildBlocks — l'aperçu et l'édition partagent le rendu.
const item = computed(() => (props.nodeId ? props.data?.[props.nodeId] : null))
const hasContent = computed(() => !!item.value)

const sourceHtml = computed(() => {
  if (!item.value) return ''
  const blocks = buildBlocks([{ ...item.value, id: props.nodeId, depth: props.depth }])
  return `<article>${blocks.map((b) => b.html).join('')}</article>`
})

let frameReady = false
let resizeObserver = null

function buildFrame() {
  const doc = frameRef.value?.contentDocument
  if (!doc) return
  doc.open()
  doc.write('<!doctype html><html><head><meta charset="utf-8"></head><body><div id="render"></div></body></html>')
  doc.close()

  const boot = doc.createElement('style')
  boot.id = '__boot'
  // Read : les pages s'empilent, centrées (aperçu d'UNE page).
  // Edit : on garde la rangée native de paged.css (`.pagedjs_pages` en flex-row)
  //        et on aligne la mise à l'échelle en haut-gauche.
  const layout = props.mode === 'edit'
    ? '#render{transform-origin:top left;} .pagedjs_page{background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.15);}'
    : '#render{transform-origin:top center;} .pagedjs_pages{display:block;} .pagedjs_page{margin:0 auto;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.15);}'
  boot.textContent = 'html,body{margin:0;padding:0;background:transparent;overflow:hidden;}' + layout
  doc.head.appendChild(boot)

  const script = doc.createElement('script')
  script.src = PAGED_SRC
  script.onload = () => { frameReady = true; render() }
  doc.head.appendChild(script)
}

// Pousse le HTML courant dans l'iframe et repagine. Réinstancie un Previewer à
// chaque fois (l'ancien a injecté ses styles) après avoir purgé les <style> de la
// passe précédente — sans quoi ils s'empileraient, fût-ce dans l'iframe.
function render() {
  const frame = frameRef.value
  const doc = frame?.contentDocument
  const win = frame?.contentWindow
  if (!frameReady || !doc || !win?.Paged) return

  const boot = doc.getElementById('__boot')
  doc.head.querySelectorAll('style').forEach((el) => { if (el !== boot) el.remove() })

  const target = doc.getElementById('render')
  if (!target) return
  target.style.transform = ''
  target.innerHTML = ''

  if (!sourceHtml.value) return

  const source = doc.createElement('div')
  source.innerHTML = sourceHtml.value
  const previewer = new win.Paged.Previewer()
  previewer.preview(source, [CSS_HREF], target).then(fitScale).catch((e) => {
    // Ne pas masquer un échec de pagination : il ne casse pas l'écran (le rendu
    // reste vide) mais doit se diagnostiquer.
    console.warn('[FolioView] pagination échouée', e)
  })
}

// Met le rendu à l'échelle. La base est la LARGEUR DU CONTENEUR (indépendante du
// contenu), pas celle de l'iframe — sinon le ResizeObserver entrerait en boucle
// de rétroaction (cf. « Pièges connus » racine).
function fitScale() {
  const doc = frameRef.value?.contentDocument
  const pageEl = doc?.querySelector('.pagedjs_page')
  const render = doc?.getElementById('render')
  const frame = frameRef.value
  const root = rootRef.value
  if (!pageEl || !render || !frame || !root) return

  if (props.mode === 'edit') {
    // Viser `visiblePages` dans la largeur ; la rangée entière peut déborder et
    // défile horizontalement (le conteneur porte l'overflow-x).
    const pagesArea = doc.querySelector('.pagedjs_pages')
    const rowW = pagesArea ? pagesArea.scrollWidth : pageEl.offsetWidth
    const scale = Math.min(root.clientWidth / (pageEl.offsetWidth * props.visiblePages), 1)
    render.style.transform = `scale(${scale})`
    frame.style.width = `${rowW * scale}px`
    frame.style.height = `${pageEl.offsetHeight * scale}px`
    return
  }

  // Read : une page à la largeur de la colonne, hauteur clampée à une page.
  const scale = Math.min(root.clientWidth / pageEl.offsetWidth, 1)
  render.style.transform = `scale(${scale})`
  frame.style.height = `${pageEl.offsetHeight * scale}px`
}

onMounted(() => {
  buildFrame()
  resizeObserver = new ResizeObserver(fitScale)
  resizeObserver.observe(rootRef.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

// Changement de nœud : repagine. Le contenu (blocs) est recalculé, le Previewer
// relancé.
watch(sourceHtml, render)
</script>

<style scoped>
.folio-view {
  position: relative;
  width: 100%;
  /* Taille définie indépendante du contenu : ancre la mise à l'échelle. */
  min-height: 4em;
}

/* Édition : la rangée de pages peut être plus large que le conteneur — un seul
   défilement horizontal, ici (pas dans l'iframe). */
.folio-view--edit {
  overflow-x: auto;
  overflow-y: hidden;
}

.folio-frame {
  display: block;
  width: 100%;
  border: 0;
  /* La hauteur (et, en édition, la largeur) est posée par fitScale. */
}

.folio-view--edit .folio-frame {
  width: auto;
}

.folio-empty {
  margin: 0;
  padding: var(--sp-4);
  color: var(--c-ink2);
  font-size: var(--fs-sm);
  text-align: center;
}
</style>
