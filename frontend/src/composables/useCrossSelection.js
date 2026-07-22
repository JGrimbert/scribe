import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { charIndexFromNodeOffset, getRangeRects } from '../script/liveEdit.js'

// La sélection à cheval sur plusieurs fragments : aucun Quill ne peut la
// représenter (un seul fragment monté à la fois), donc pas d'éditeur ouvert tant
// qu'elle est active — juste un overlay + une interception clavier ciblée. Traitée
// directement sur le modèle (`registry.deleteRange`). Extrait de useFragmentEditor
// (le reste y gère l'édition mono-fragment) ; le couplage passe par injection.
//
// Deps DOM/état : `listFragEls`/`fragments`/`registry`/`refresh`/`caret`/`toolbar`/
// `keyboardTarget`/`parseBlockId`. Callbacks vers l'éditeur mono : `flushEditor`
// (persiste + ferme le fragment en cours avant d'activer la sélection cross),
// `openTexteFragment` (rouvre l'éditeur après l'action), `armSuppressClick` (ignore
// le click qui suit un drag).
export function useCrossSelection({
  listFragEls, fragments, registry, refresh, caret, toolbar, keyboardTarget,
  parseBlockId, flushEditor, openTexteFragment, armSuppressClick,
}) {
  const crossSelection = ref(null)

  // Après un split/merge, rouvrir peut retomber sur exactement le même fragId
  // qu'avant fermeture. Enchaîner fermeture puis réouverture dans le même tick ne
  // déclenche PAS de remount Vue réel (le <QuillBlock> keyé par editingId garde son
  // contenu périmé) : ce nextTick force le démontage avant la réouverture. Ne pas
  // supprimer cet await en pensant que c'est un no-op.
  function settleClose() {
    return nextTick()
  }

  // Sélection dont l'ancre et le focus tombent dans deux fragments différents —
  // soit une vraie frontière de paragraphe, soit une simple coupure de page interne
  // à un même paragraphe. Dans les deux cas, aucun Quill ne peut la représenter : on
  // résout les deux bords en position globale (blockId + offset dans le paragraphe
  // complet, via fragments.globalIndex) plutôt qu'en local, ce qui unifie les deux
  // cas — même blockId aux deux bords = simple édition mono-paragraphe, blockId
  // différents = fusion multi-paragraphe.
  function activateCrossSelection(sel, anchorEl, focusEl) {
    const allFrags = listFragEls()
    const anchorPos = allFrags.indexOf(anchorEl)
    const focusPos = allFrags.indexOf(focusEl)
    if (anchorPos === -1 || focusPos === -1) return

    // Ordre réel dans le document (l'utilisateur peut glisser dans les deux sens) :
    // détermine qui est le bord "début" vs "fin".
    const reversed = anchorPos > focusPos
    const startEl = reversed ? focusEl : anchorEl
    const endEl = reversed ? anchorEl : focusEl
    const startNode = reversed ? sel.focusNode : sel.anchorNode
    const startNodeOffset = reversed ? sel.focusOffset : sel.anchorOffset
    const endNode = reversed ? sel.anchorNode : sel.focusNode
    const endNodeOffset = reversed ? sel.anchorOffset : sel.focusOffset

    const startLocal = charIndexFromNodeOffset(startEl, startNode, startNodeOffset)
    const endLocal = charIndexFromNodeOffset(endEl, endNode, endNodeOffset)

    // Dernière lecture utile de `sel` : on la vide avant toute mutation DOM
    // (flushEditor()/applyMirrorHtml) — sinon le navigateur "reheal" parfois la
    // sélection en l'étendant à tout le parent le temps d'un repaint.
    sel.removeAllRanges()

    const startResolved = fragments.value?.globalIndex(startEl.dataset.fragId, startLocal)
    const endResolved = fragments.value?.globalIndex(endEl.dataset.fragId, endLocal)
    if (!startResolved || !endResolved) return

    const startBlock = parseBlockId(startResolved.blockId)
    const endBlock = parseBlockId(endResolved.blockId)
    if (startBlock.kind !== 'texte' || endBlock.kind !== 'texte') return
    if (startBlock.articleId !== endBlock.articleId) return // pas de fusion inter-article

    // Un fragment était en cours d'édition : on persiste son contenu avant de le
    // fermer, sinon les modifs en cours dans Quill sont perdues.
    flushEditor()

    const coveredEls = allFrags.slice(Math.min(anchorPos, focusPos), Math.max(anchorPos, focusPos) + 1)
    const rects = coveredEls.flatMap((el, i) => {
      const from = i === 0 ? startLocal : 0
      const to = i === coveredEls.length - 1 ? endLocal : Infinity
      return getRangeRects(el, from, to)
    })

    armSuppressClick()
    caret.setSelectionRects(rects)
    toolbar.updateVisibility(rects)

    crossSelection.value = {
      articleId: startBlock.articleId,
      startIndex: startBlock.index,
      startOffset: startResolved.index,
      endIndex: endBlock.index,
      endOffset: endResolved.index,
    }
  }

  // Touche tapée pendant qu'une sélection cross-fragment est affichée : Entrée garde
  // les deux restes comme deux paragraphes séparés, tout le reste
  // (Backspace/Delete/caractère imprimable) les fusionne en un seul — un caractère
  // tapé est inséré au point de jonction dans le même geste.
  async function handleCrossSelectionKeydown(e) {
    const sel = crossSelection.value
    if (!sel) return

    const isEnter = e.key === 'Enter'
    const isDelete = e.key === 'Backspace' || e.key === 'Delete'
    const insertChar = (!isEnter && !isDelete && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1)
      ? e.key
      : null

    if (!isEnter && !isDelete && insertChar == null) return // touche non gérée : on laisse passer

    e.preventDefault()

    const blockId = `${sel.articleId}__texte__${sel.startIndex}`
    const entry = registry.value?.get(blockId)
    const result = entry?.deleteRange?.(sel.startOffset, sel.endIndex, sel.endOffset, {
      keepSplit: isEnter,
      insertText: insertChar ?? '',
    })

    crossSelection.value = null
    caret.clear()
    toolbar.hide()
    if (!result) return

    await refresh()
    await settleClose()

    openTexteFragment(sel.articleId, result.index, result.cursor)
  }

  // Cible retenue à l'ajout pour que removeEventListener matche (même si le document
  // de l'iframe changeait entre-temps).
  let boundKbd = null
  watch(crossSelection, (val, oldVal) => {
    if (val && !oldVal) {
      boundKbd = keyboardTarget() ?? document
      boundKbd.addEventListener('keydown', handleCrossSelectionKeydown)
    } else if (!val && oldVal) {
      boundKbd?.removeEventListener('keydown', handleCrossSelectionKeydown)
      boundKbd = null
    }
  })

  onBeforeUnmount(() => {
    boundKbd?.removeEventListener('keydown', handleCrossSelectionKeydown)
  })

  return { crossSelection, activateCrossSelection }
}
