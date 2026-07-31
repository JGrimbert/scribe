import { ref } from 'vue'
import { buildFragmentRegistry, createFragmentApi } from '../script/fragment.js'
import { createRegistry } from '../script/registry.js'
import { buildVisualsCss, buildHyphenationCss, buildPageCss, buildPagePinCss, buildRunningTitlesCss, buildFormatGuidesCss, runningReserves, styleVisualToInlineCss } from '../script/folioStyles.js'

// Force un saut de page AVANT chaque slot d'une planche d'imposition (sauf le 1er) :
// Paged.js n'honore les `break-before` que depuis une FEUILLE traitée par son
// polisher — un `style=""` inline sur l'élément est ignoré. La classe est stampée
// sur le 1er bloc de chaque slot (cf. buildImpositionBlocks / breakBefore).
const IMPOSITION_CSS = '.imp-break{break-before:page;}'

// Hachures bleutées des pages blanche / de garde — mêmes couleurs que le carrousel
// (LiminaireFolio) : fond `aliceblue` (--c-folio-bg) rayé d'un filet tiré de
// `--c-border` (#e0d8cc). Valeurs littérales : l'iframe est isolée (about:blank),
// les tokens CSS de l'app n'y sont pas résolus.
const HATCH_CSS =
  'repeating-linear-gradient(45deg,aliceblue,aliceblue 9px,'
  + 'color-mix(in srgb,#e0d8cc 55%,aliceblue) 9px,color-mix(in srgb,#e0d8cc 55%,aliceblue) 10px)'

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

  // Styles à NE PAS balayer entre deux repaginations : le boot, l'épingle de
  // géométrie et les guides de format (mis à jour en place, pas régénérés).
  const isPersistentStyle = (el) => el.id === '__boot' || el.id === '__pagepin' || el.id === '__formatguides'

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
      'html,body{margin:0;padding:0;background:transparent;overflow:hidden;}',
      '#render{transform-origin:top left;}',
      '.pagedjs_page{background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.15);border:1px solid #e2e2e2;}',
      // Justification garantie de la zone de texte (le livre est justifié) : c'est
      // aussi ce que syncQuill recopiera sur Quill (via getComputedStyle du
      // fragment). Les titres restent courts, l'effet ne s'y voit pas.
      '.pagedjs_page_content{outline:1px dotted #d6d6d6;text-align:justify;}',
      // Pages non-textuelles d'une planche d'imposition (blanc / garde / vide de
      // format). Le slot est un conteneur centré ; les pages blanc/garde le centrent
      // verticalement via la zone de contenu (hauteur définie, cf. ci-dessous).
      '.imp-slot{display:flex;justify-content:center;}',
      // Une page vide de FORMAT doit exister dans le flow même sans contenu.
      '.imp-slot--empty{min-height:2cm;}',
      // Libellé « Page blanche / de garde » : sur son propre fond (comme le
      // carrousel), lisible sur les rayures, et de taille lisible (pas minuscule).
      '.imp-slot-label{background:aliceblue;padding:.25em .7em;border-radius:3px;font-style:italic;color:#5b6572;font-size:1rem;}',
      // Pages blanche / de garde : hachures bleutées sur TOUTE la page (comme le
      // carrousel, cf. LiminaireFolio : aliceblue + filet issu de --c-border), ni
      // bordure, ni ombre, ni empagement, ni titre courant/folio. Les classes sont
      // posées sur les .pagedjs_page concernées après pagination (marquage DOM).
      // Blanche/garde STRICTEMENT ISO à une page pleine : même bordure ET même ombre
      // (on ne surcharge NI border NI box-shadow de `.pagedjs_page`). Retirer la
      // bordure la rendait 2px plus petite (border-box=content-box ici) → bas
      // désalignés au pixel et ombre asymétrique dans un vis-à-vis mixte. Seul le
      // FOND change (la hachure suffit à distinguer une blanche).
      `.pagedjs_page.folio-blank,.pagedjs_page.folio-cover{background:${HATCH_CSS};}`,
      // Centrage du libellé sur la PAGE PHYSIQUE, pas sur la zone de contenu (celle-ci
      // est rétrécie par les marges + les réserves de titres courants, ce qui décalait
      // le libellé). On neutralise le positionnement de area/content (statique) pour que
      // le slot, en absolu inset:0, se cale sur `.pagedjs_page` (position:relative) =
      // toute la page. Robuste au <article>/wrapper que Paged.js insère entre les deux.
      '.folio-blank .pagedjs_area,.folio-cover .pagedjs_area,.folio-blank .pagedjs_page_content,.folio-cover .pagedjs_page_content{position:static;outline:none;}',
      '.pagedjs_page.folio-blank .imp-slot,.pagedjs_page.folio-cover .imp-slot{position:absolute;inset:0;margin:0;display:flex;align-items:center;justify-content:center;}',
      '.folio-blank .pagedjs_margin-content,.folio-cover .pagedjs_margin-content{display:none;}',
    ].join('')
    // `read` empile les pages (aperçu vertical d'UNE page) ; `edit`/`spread`
    // gardent la rangée horizontale de paged.css (pages côte à côte). L'ombre est
    // portée PAR PAGE (cf. `.pagedjs_page` du boot), identique sur les pleines comme
    // sur les blanches/garde (cf. plus haut) → bas continu quel que soit le vis-à-vis.
    const layout = props.mode === 'read' ? '.pagedjs_pages{display:block;} .pagedjs_page{margin:0;}' : ''
    boot.textContent = common + layout
    doc.head.appendChild(boot)

    // Épingle la géométrie de page (:root, !important) : neutralise le polyfill
    // *letter* que Paged ré-injecte dans ce head partagé à chaque pagination, qui
    // sinon ferait basculer la taille du contenu VISIBLE (cf. buildPagePinCss).
    // Feuille À PART de __boot : props.page peut changer (select de format de la
    // config) — refresh() la met à jour, alors que __boot est figé au montage.
    const pin = doc.createElement('style')
    pin.id = '__pagepin'
    pin.textContent = buildPagePinCss(props.page, props.margins, runningReserves(props.runningTitles))
    doc.head.appendChild(pin)

    // Guides de l'aperçu de format : feuille À PART (comme le pin), toujours créée
    // et remplie/vidée par refresh selon `bodyCross`. Persistante → survit au ménage
    // des styles d'une repagination et suit `bodyCross` sur l'instance unifiée
    // (source qui change sans démonter le FolioView).
    const guides = doc.createElement('style')
    guides.id = '__formatguides'
    guides.textContent = props.bodyCross ? buildFormatGuidesCss(props.runningTitles) : ''
    doc.head.appendChild(guides)

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

    // Recale le pin de géométrie sur la page COURANTE (le format a pu changer
    // depuis buildFrame) — avant la pagination, pour que l'ancien rendu affiché
    // bascule tout de suite à la nouvelle taille.
    const pin = doc.getElementById('__pagepin')
    if (pin) pin.textContent = buildPagePinCss(props.page, props.margins, runningReserves(props.runningTitles))

    // Guides de format : présents seulement en `bodyCross` (sinon vidés) ; suivent
    // les titres courants édités en direct (aside).
    const guides = doc.getElementById('__formatguides')
    if (guides) guides.textContent = props.bodyCross ? buildFormatGuidesCss(props.runningTitles) : ''

    if (!blocks.value.length) {
      doc.head.querySelectorAll('style').forEach((el) => { if (!isPersistentStyle(el)) el.remove() })
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
    const staleStyles = [...doc.head.querySelectorAll('style')].filter((el) => !isPersistentStyle(el))

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
      // Apparence COMPLÈTE par paragraphe (imposition liminaire) : mise en forme
      // directe .odt que le styleName seul perd. Inline → l'emporte sur la feuille
      // visuals et sur le justify de repli du boot (cf. TexteEntry.visual backend).
      if (b.visual) {
        const inline = styleVisualToInlineCss(b.visual)
        if (inline) root.setAttribute('style', inline)
      }
      // Planche d'imposition : le 1er bloc d'un slot force sa page (cf.
      // buildImpositionBlocks). Classe (pas style inline) → règle IMPOSITION_CSS
      // passée au polisher, seule voie que Paged.js honore pour un break forcé.
      if (b.breakBefore) root.classList.add('imp-break')
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
    // Format de page du document (A5, marges du .odt) + titres courants (margin
    // boxes @page), passés APRÈS paged.css pour que leurs @page l'emportent ;
    // objet `{ nom: cssText }` = CSS inline (non fetché, cf. Polisher.add).
    // Les margin boxes @top-center/@bottom-center sont un polyfill Paged.js : elles
    // DOIVENT passer par les sheets que le previewer traite, pas un <style> brut
    // (le navigateur ignorerait @top-center). Le nom du chapitre vient du nœud rendu.
    const docPageCss = [
      buildPageCss(props.page, props.margins, runningReserves(props.runningTitles)),
      buildRunningTitlesCss(props.runningTitles, {
        bookTitle: props.bookTitle,
        chapterTitle: section.value?.titre ?? '',
        // Planche (mode spread) : pages en ordre séquentiel → parité inversée d'une
        // vraie planche. On échange @page:left/:right pour que folio/titres tombent
        // au bon coin extérieur (rien d'autre ne change).
        swapParity: props.mode === 'spread',
      }),
    ].filter(Boolean).join('\n')
    const sheets = [CSS_HREF]
    if (docPageCss) sheets.push({ 'doc-page.css': docPageCss })
    // Règle de saut d'imposition dans une feuille traitée par le polisher (cf.
    // IMPOSITION_CSS) — indispensable pour que les slots se répartissent sur des
    // pages distinctes (le style inline est ignoré par le chunker Paged.js).
    if (props.spreadPages) sheets.push({ 'imposition.css': IMPOSITION_CSS })
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

      // Planche d'imposition : marque les .pagedjs_page portant un slot blanc/garde
      // (avant le clonage → les clones héritent la classe) pour leur appliquer les
      // hachures pleine page. Impossible à cibler en CSS (la classe du slot vit
      // DANS la page, pas sur elle) → marquage DOM.
      if (props.spreadPages) {
        buffer.querySelectorAll('.pagedjs_page').forEach((pg) => {
          if (pg.querySelector('.imp-slot--blank')) pg.classList.add('folio-blank')
          else if (pg.querySelector('.imp-slot--cover')) pg.classList.add('folio-cover')
        })
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
