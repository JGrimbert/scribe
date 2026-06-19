import { computed, nextTick, ref } from 'vue'
import { applyMirrorHtml, getCharIndexAtPoint, charIndexFromNodeOffset } from '../script/liveEdit.js'
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
export function useFragmentEditor({ findFragEl, registry, fragments, refresh, scalePercent, caret, toolbar }) {
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

    function onFragmentStateChange({ html, index }) {
        liveHtml.value = html

        const el = findFragEl(editingId.value)
        if (!el) { caret.clear(); return }

        applyMirrorHtml(el, html)
        caret.setCaretRect(el, index)

        if (switchingFragment.value) {
            requestAnimationFrame(() => {
                switchingFragment.value = false
                toolbar.updateVisibility(caret.selectionRects.value)
            })
        }
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

        if (!anchorEl || anchorEl !== focusEl) return

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
    }

    function onColumnClick(e) {
        if (suppressNextClick) {
            suppressNextClick = false
            return
        }

        caret.setSelectionRects([])
        toolbar.hide()

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
        onColumnMouseUp,
        onFragmentStateChange,
        commitEdit,
        mergeNextFragment,
        mergePrevFragment,
        closeEditor,
    }
}
