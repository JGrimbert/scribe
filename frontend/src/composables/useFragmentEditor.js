import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { applyMirrorHtml, getCharIndexAtPoint, charIndexFromNodeOffset, getRangeRects } from '../script/liveEdit.js'
import { syncQuillToFragment } from '../script/syncQuill.js'

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
export function useFragmentEditor({ findFragEl, listFragEls, registry, fragments, refresh, scalePercent, caret, toolbar }) {
    const quillBlockRef = ref(null)

    const editorVisible = ref(false)
    const editingId = ref(null)
    const editingIdx = ref(null)
    const initialHtml = ref('')
    const liveHtml = ref('')      // lecture courante, pour commit/merge
    const pendingIndex = ref(null)
    const pendingLength = ref(0)
    const switchingFragment = ref(false)

    // Sélection "virtuelle" à cheval sur plusieurs fragments : aucun Quill ne
    // peut la représenter (un seul est monté à la fois), donc pas d'éditeur
    // ouvert tant qu'elle est active — juste un overlay + une interception
    // clavier ciblée. Voir activateCrossSelection/handleCrossSelectionKeydown.
    const crossSelection = ref(null)

    let suppressNextClick = false

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
        const sel = window.getSelection()
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

            suppressNextClick = true
            activateFragment(fragId, fragIdx, { index, length })
            return
        }

        activateCrossSelection(sel, anchorEl, focusEl)
    }

    // Sélection dont l'ancre et le focus tombent dans deux fragments
    // différents — soit une vraie frontière de paragraphe, soit une simple
    // coupure de page interne à un même paragraphe. Dans les deux cas, aucun
    // Quill ne peut la représenter (un seul fragment chargé à la fois) : on
    // résout les deux bords en position globale (blockId + offset dans le
    // paragraphe complet, via fragments.globalIndex) plutôt qu'en local, ce
    // qui unifie les deux cas — même blockId aux deux bords = simple édition
    // mono-paragraphe, blockId différents = fusion multi-paragraphe.
    function activateCrossSelection(sel, anchorEl, focusEl) {
        const allFrags = listFragEls()
        const anchorPos = allFrags.indexOf(anchorEl)
        const focusPos = allFrags.indexOf(focusEl)
        if (anchorPos === -1 || focusPos === -1) return

        // Ordre réel dans le document (l'utilisateur peut glisser dans les
        // deux sens) : détermine qui est le bord "début" vs "fin".
        const reversed = anchorPos > focusPos
        const startEl = reversed ? focusEl : anchorEl
        const endEl = reversed ? anchorEl : focusEl
        const startNode = reversed ? sel.focusNode : sel.anchorNode
        const startNodeOffset = reversed ? sel.focusOffset : sel.anchorOffset
        const endNode = reversed ? sel.anchorNode : sel.focusNode
        const endNodeOffset = reversed ? sel.anchorOffset : sel.focusOffset

        const startLocal = charIndexFromNodeOffset(startEl, startNode, startNodeOffset)
        const endLocal = charIndexFromNodeOffset(endEl, endNode, endNodeOffset)

        const startResolved = fragments.value?.globalIndex(startEl.dataset.fragId, startLocal)
        const endResolved = fragments.value?.globalIndex(endEl.dataset.fragId, endLocal)
        if (!startResolved || !endResolved) return

        const startBlock = parseBlockId(startResolved.blockId)
        const endBlock = parseBlockId(endResolved.blockId)
        if (startBlock.kind !== 'texte' || endBlock.kind !== 'texte') return
        if (startBlock.articleId !== endBlock.articleId) return // pas de fusion inter-article

        // Un fragment était en cours d'édition : on persiste son contenu
        // avant de le fermer, sinon les modifs en cours dans Quill sont
        // perdues (même précaution que dans activateFragment).
        if (editingId.value) {
            fragments.value?.setFragment(editingId.value, liveHtml.value)
            closeEditor()
        }

        const coveredEls = allFrags.slice(Math.min(anchorPos, focusPos), Math.max(anchorPos, focusPos) + 1)
        const rects = coveredEls.flatMap((el, i) => {
            const from = i === 0 ? startLocal : 0
            const to = i === coveredEls.length - 1 ? endLocal : Infinity
            return getRangeRects(el, from, to)
        })

        suppressNextClick = true
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

    // Touche tapée pendant qu'une sélection cross-fragment est affichée :
    // Entrée garde les deux restes comme deux paragraphes séparés, tout le
    // reste (Backspace/Delete/caractère imprimable) les fusionne en un seul —
    // un caractère tapé est inséré au point de jonction dans le même geste.
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

    watch(crossSelection, (val, oldVal) => {
        if (val && !oldVal) {
            document.addEventListener('keydown', handleCrossSelectionKeydown)
        } else if (!val && oldVal) {
            document.removeEventListener('keydown', handleCrossSelectionKeydown)
        }
    })

    onBeforeUnmount(() => {
        document.removeEventListener('keydown', handleCrossSelectionKeydown)
    })

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
        closeEditor,
    }
}
