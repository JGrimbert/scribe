import { computed, nextTick, ref } from 'vue'
import { applyMirrorHtml, getCharIndexAtPoint, charIndexFromNodeOffset } from '../script/liveEdit.js'
import { syncQuillToFragment } from '../script/syncQuill.js'
import { useCrossSelection } from './useCrossSelection.js'

// L'id d'un bloc "texte" a la forme `${articleId}__texte__${index}` (cf.
// buildBlock() dans paginate.js) ; parseBlockId() en est l'inverse.
function parseBlockId(blockId) {
    const parts = blockId.split('__')
    if (parts.length === 3) {
        const [articleId, kind, indexStr] = parts
        return { articleId, kind, index: Number(indexStr) }
    }
    const [articleId, kind] = parts
    return { articleId, kind, index: null }
}

// Gère le cycle de vie complet de l'édition "par fragment" : ouverture/
// fermeture de l'éditeur Quill flottant, sauvegarde, découpe d'un paragraphe
// (Entrée) et fusion de deux paragraphes (Backspace/Delete).
// `keyboardTarget` : FONCTION rendant la cible du listener clavier de la
// sélection cross-fragment — `document` pour l'éditeur historique, le document
// de l'iframe pour le rendu unifié (le focus y vit après un drag). Résolue au
// moment de (dé)brancher, car l'iframe n'existe pas encore au setup.
export function useFragmentEditor({ findFragEl, listFragEls, registry, fragments, refresh, scalePercent, caret, toolbar, keyboardTarget = () => document }) {
    const quillBlockRef = ref(null)

    const editorVisible = ref(false)
    const editingId = ref(null)
    const editingIdx = ref(null)
    const initialHtml = ref('')
    const liveHtml = ref('')      // lecture courante, pour commit/merge
    const pendingIndex = ref(null)
    const pendingLength = ref(0)
    const switchingFragment = ref(false)

    let suppressNextClick = false

    // Persiste + ferme le fragment mono en cours avant qu'une sélection
    // cross-fragment ne prenne la main (sinon les modifs Quill en cours sont
    // perdues). Passé à useCrossSelection, qui n'a pas accès à l'état mono.
    function flushEditor() {
        if (editingId.value) {
            fragments.value?.setFragment(editingId.value, liveHtml.value)
            closeEditor()
        }
    }
    function armSuppressClick() { suppressNextClick = true }

    // La sélection à cheval sur plusieurs fragments vit dans son composable dédié :
    // aucun Quill ne peut la représenter (un seul monté à la fois), elle se traite
    // directement sur le modèle. Couplage à l'éditeur mono par callbacks.
    const { crossSelection, activateCrossSelection } = useCrossSelection({
        listFragEls, fragments, registry, refresh, caret, toolbar, keyboardTarget,
        parseBlockId, flushEditor, openTexteFragment, armSuppressClick,
    })

    // Un paragraphe peut être réparti sur plusieurs fragments de pagination
    // (coupure de page en plein milieu). Delete/Backspace ne doivent fusionner
    // avec le paragraphe voisin que si on est réellement sur le dernier/premier
    // fragment du bloc — sinon on n'est qu'à une coupure de page interne, et
    // fusionner fusionnerait à tort avec un tout autre paragraphe.
    const fragmentPosition = computed(() => {
        if (!editingId.value) return null
        return fragments.value?.getFragmentPosition(editingId.value) ?? null
    })
    const isFirstFragment = computed(() => (fragmentPosition.value?.ordinal ?? 0) === 0)
    const isLastFragment = computed(() => {
        const pos = fragmentPosition.value
        return pos ? pos.ordinal === pos.total - 1 : true
    })

    function activateFragment(fragId, fragIdx, { index, length = 0 }) {
        switchingFragment.value = true

        if (!fragments.value) return

        const sameFragment = editingId.value === fragId

        if (!sameFragment) {
            // --- Changement de fragment : on sauvegarde l'ancien, on ouvre le nouveau ---
            if (editingId.value) {
                fragments.value.setFragment(editingId.value, liveHtml.value)
                const prevEl = findFragEl(editingId.value)

                syncQuillToFragment({
                    fragmentEl: prevEl,
                    quillWrapperEl: quillBlockRef.value.$el, // wrapper Teleport
                    quillInnerEl: quillBlockRef.value.$el.querySelector('.ql-editor'),
                    scale: scalePercent.value / 100,
                })

                const prevHtml = fragments.value.getFragment(editingId.value)
                if (prevEl && prevHtml != null) applyMirrorHtml(prevEl, prevHtml)
            }

            editingIdx.value = fragIdx
            editingId.value = fragId
            initialHtml.value = fragments.value.getFragment(fragId)
            liveHtml.value = initialHtml.value
            pendingIndex.value = index // consommé par QuillBlock au mount
            pendingLength.value = length
            editorVisible.value = true
        } else {
            // --- Re-interaction dans le fragment déjà ouvert : pas de reset de contenu ---
            // (sinon on écrase les modifs en cours dans Quill avec la version "enregistrée")
            quillBlockRef.value?.restoreFocus(index, length)
        }

        caret.updateCaretOrSelection(fragId, index, length)
        toolbar.updateVisibility(caret.selectionRects.value)
    }

    // Ouvre l'éditeur sur le paragraphe `index` de l'article `articleId`,
    // curseur placé à `cursor` (index de caractère dans le paragraphe complet).
    // Utilisé après un split (Entrée) ou une fusion (Backspace/Delete) pour
    // rouvrir l'éditeur sur le résultat. Le paragraphe peut être réparti sur
    // plusieurs fragments de pagination : on résout le bon fragment plutôt
    // que de supposer qu'il tient dans le premier (::0).
    function openTexteFragment(articleId, index, cursor = 0) {
        const blockId = `${articleId}__texte__${index}`
        const located = fragments.value?.locateIndex(blockId, cursor)
        const fragId = located?.fragId ?? `${blockId}::0`
        const localIndex = located?.index ?? cursor

        activateFragment(
            fragId,
            { articleId, kind: 'texte', index },
            { index: localIndex, length: 0 }
        )
    }

    function closeEditor() {
        const el = findFragEl(editingId.value)
        const html = fragments.value?.getFragment(editingId.value)
        if (el && html != null) applyMirrorHtml(el, html)

        editorVisible.value = false
        editingId.value = null
        pendingIndex.value = null
        caret.clear()
    }

    // Après un split/merge, rouvrir peut retomber sur exactement le même
    // fragId qu'avant fermeture (ex: mergeNext garde le paragraphe courant au
    // même index). Si on enchaîne closeEditor() puis la réouverture dans le
    // même tick, Vue ne rend jamais l'état "fermé" intermédiaire : le
    // <QuillBlock> (v-if="editorVisible", :key="editingId") n'est ni démonté
    // ni remonté, donc son mountQuill() — qui ne s'exécute qu'au montage —
    // ne relit jamais le nouveau contenu fusionné : Quill reste affiché avec
    // son texte pré-fusion. Ce nextTick force Vue à vraiment démonter avant
    // qu'on ne rouvre, garantissant un montage frais avec le contenu à jour.
    function settleClose() {
        return nextTick()
    }

    async function commitEdit() {
        fragments.value?.setFragment(editingId.value, liveHtml.value)
        await refresh()
        closeEditor()
        await settleClose()

        const current = editingIdx.value
        if (current?.kind !== 'texte' || current.index == null) return

        openTexteFragment(current.articleId, current.index + 1)
    }

    // Fusionne le fragment ouvert avec son voisin. `direction` vaut
    // 'mergeNext' (Delete, fusionne avec le paragraphe suivant) ou
    // 'mergePrev' (Backspace, fusionne avec le paragraphe précédent) — les
    // deux partagent exactement le même protocole : persister le contenu
    // Quill en cours, fusionner dans le modèle, rafraîchir, puis rouvrir
    // l'éditeur sur le paragraphe résultant avec le curseur au point de jonction.
    async function mergeFragment(direction) {
        fragments.value?.setFragment(editingId.value, liveHtml.value)

        const articleId = editingIdx.value?.articleId
        const blockId = fragments.value?.getBlockId(editingId.value)
        const entry = registry.value?.get(blockId)
        const result = entry?.[direction]?.()
        if (!result) return

        await refresh()
        closeEditor()
        await settleClose()

        openTexteFragment(articleId, result.index, result.cursor)
    }

    const mergeNextFragment = () => mergeFragment('mergeNext')
    const mergePrevFragment = () => mergeFragment('mergePrev')

    // Résout, DANS LE DOM FOLIO déjà rendu du fragment cible (avant même que
    // Quill n'y soit monté), l'index de caractère de la première/dernière
    // ligne visuelle le plus proche horizontalement de clientX — élimine tout
    // flash "caret en tout début de fragment" le temps que Quill démarre :
    // contrairement à un clic, on n'a pas de point de départ naturel, donc on
    // vise juste sous le haut (ligne d'entrée si on descend) ou juste au-dessus
    // du bas (ligne d'entrée si on remonte) du fragment.
    function resolveEntryIndex(targetEl, clientX, direction) {
        const rect = targetEl.getBoundingClientRect()
        // `clientX` vient du faux curseur (coords ÉCRAN, offset iframe inclus) ;
        // `rect` et getCharIndexAtPoint raisonnent dans le viewport du réalm du
        // fragment. On retire l'offset de l'iframe pour rester cohérent (0 hors
        // iframe → comportement inchangé pour l'éditeur historique).
        const win = targetEl.ownerDocument.defaultView
        const fx = win.frameElement ? win.frameElement.getBoundingClientRect().left : 0
        const y = direction === 'down' ? rect.top + 4 : rect.bottom - 4
        return getCharIndexAtPoint(targetEl, clientX - fx, y) ?? 0
    }

    // ArrowDown/ArrowUp en bord de ligne visuelle (cf. QuillBlock.vue) : bascule
    // vers le fragment voisin en DOM (listFragEls, ordre de lecture), qu'il
    // s'agisse d'une coupure de pagination interne au même paragraphe ou d'une
    // vraie frontière entre deux paragraphes — contrairement à merge, la
    // navigation n'est pas limitée aux bords de paragraphe. La position
    // horizontale à préserver est lue sur caret.cursorRect (le faux curseur,
    // déjà en coordonnées viewport et synchronisé avec le DOM Folio).
    function navigateFragment(direction) {
        const allFrags = listFragEls()
        const currentEl = findFragEl(editingId.value)
        const pos = currentEl ? allFrags.indexOf(currentEl) : -1
        if (pos === -1) return

        const targetEl = allFrags[direction === 'down' ? pos + 1 : pos - 1]
        if (!targetEl) return // déjà au tout premier/dernier fragment du document

        const fragId = targetEl.dataset.fragId
        const fragIdx = parseBlockId(targetEl.dataset.blockId)
        const clientX = caret.cursorRect.value?.left
        const index = clientX != null ? resolveEntryIndex(targetEl, clientX, direction) : 0

        activateFragment(fragId, fragIdx, { index, length: 0 })
    }

    const navigateDown = () => navigateFragment('down')
    const navigateUp = () => navigateFragment('up')

    function onFragmentStateChange({ html, index, length = 0 }) {
        liveHtml.value = html

        const el = findFragEl(editingId.value)
        if (!el) { caret.clear(); return }

        applyMirrorHtml(el, html)
        // updateCaretOrSelection (et non setCaretRect) : Quill peut émettre un
        // selection-change avec length > 0 (ex: synchro de la sélection au
        // montage, cf. mountQuill) sans que l'utilisateur ait réellement
        // collapsé la sélection en un curseur — il ne faut alors PAS effacer
        // l'overlay de sélection déjà affiché (cf. régression : la sélection
        // disparaissait toute seule juste après avoir été posée par un drag).
        caret.updateCaretOrSelection(editingId.value, index, length)

        if (switchingFragment.value) {
            requestAnimationFrame(() => {
                switchingFragment.value = false
                toolbar.updateVisibility(caret.selectionRects.value)
            })
        }
    }

    // Efface l'overlay de sélection dès l'amorce d'un nouveau geste, plutôt
    // que d'attendre le mouseup : sinon l'ancienne sélection reste visible,
    // superposée à la nouvelle en train de se dessiner, pendant tout le drag.
    function onColumnMouseDown(e) {
        caret.setSelectionRects([])
        toolbar.hide()
        crossSelection.value = null
    }

    function onColumnMouseUp(e) {
        // Sélection lue dans le réalm de l'événement : le document principal pour
        // l'éditeur historique, celui de l'iframe pour le rendu unifié.
        const sel = (e.target?.ownerDocument?.defaultView ?? window).getSelection()
        if (!sel || sel.isCollapsed) return

        const anchorEl = sel.anchorNode && (sel.anchorNode.nodeType === 1
            ? sel.anchorNode.closest('[data-frag-id]')
            : sel.anchorNode.parentElement?.closest('[data-frag-id]'))
        const focusEl = sel.focusNode && (sel.focusNode.nodeType === 1
            ? sel.focusNode.closest('[data-frag-id]')
            : sel.focusNode.parentElement?.closest('[data-frag-id]'))

        if (!anchorEl || !focusEl) return

        if (anchorEl === focusEl) {
            const fragId = anchorEl.dataset.fragId
            const fragIdx = parseBlockId(anchorEl.dataset.blockId)
            const startIdx = charIndexFromNodeOffset(anchorEl, sel.anchorNode, sel.anchorOffset)
            const endIdx = charIndexFromNodeOffset(anchorEl, sel.focusNode, sel.focusOffset)
            const index = Math.min(startIdx, endIdx)
            const length = Math.abs(endIdx - startIdx)

            const range = sel.getRangeAt(0)
            caret.setSelectionRects(Array.from(range.getClientRects()).map(r => ({
                top: r.top,
                left: r.left,
                width: r.width,
                height: r.height
            })))

            // Toute lecture utile de la sélection native est faite : on la vide
            // avant d'activer le fragment, qui va muter le DOM (applyMirrorHtml
            // sur l'ancien fragment). La laisser vivante pendant une mutation DOM
            // fait parfois "reheal" le navigateur en étendant la sélection à tout
            // l'élément parent le temps d'un repaint — d'où le clignotement/la
            // couleur de sélection native visible en concurrence avec l'overlay.
            sel.removeAllRanges()

            suppressNextClick = true
            activateFragment(fragId, fragIdx, { index, length })
            return
        }

        activateCrossSelection(sel, anchorEl, focusEl)
    }

    function onColumnClick(e) {
        if (suppressNextClick) {
            suppressNextClick = false
            return
        }

        caret.setSelectionRects([])
        toolbar.hide()
        crossSelection.value = null

        const el = e.target.closest('[data-frag-id]')
        if (!el || !fragments.value) return

        const fragId = el.dataset.fragId
        const fragIdx = parseBlockId(el.dataset.blockId)
        const index = getCharIndexAtPoint(el, e.clientX, e.clientY)

        activateFragment(fragId, fragIdx, { index, length: 0 })
    }

    return {
        quillBlockRef,
        editorVisible,
        editingId,
        initialHtml,
        pendingIndex,
        pendingLength,
        isFirstFragment,
        isLastFragment,
        onColumnClick,
        onColumnMouseDown,
        onColumnMouseUp,
        onFragmentStateChange,
        commitEdit,
        mergeNextFragment,
        mergePrevFragment,
        navigateDown,
        navigateUp,
        closeEditor,
    }
}
