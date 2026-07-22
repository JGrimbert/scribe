<template>
  <div class="quill-block" @click="requestActivate">
    <div v-if="!active" class="preview">
      <p v-for="(p, i) in modelValue" :key="i">{{ p }}</p>
      <p v-if="!modelValue || !modelValue.length" class="empty">—</p>
    </div>

    <!-- v-if (et non v-show) : le wrapper est entièrement recréé/détruit à
         chaque activation/désactivation. Nécessaire car Quill insère sa
         toolbar comme sibling de editorHost — il faut que tout le sous-arbre
         disparaisse proprement avec le wrapper, sinon les toolbars s'accumulent
         dans le DOM à chaque clic. -->
    <div v-else ref="wrapper" class="editor-wrapper">
      <div ref="editorHost" class="editor-host"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { isOnFirstLine, isOnLastLine } from '../../script/quillCaret.js'
import { registerInternalLinkBlot } from '../../script/internalLinkBlot.js'

const props = defineProps({
  modelValue: { type: String, default: "" },
  active: { type: Boolean, default: false }, // contrôlé par le parent — un seul actif à la fois
  initialIndex: { type: Number, default: null },
  initialLength: { type: Number, default: 0 },
  // Un paragraphe peut être réparti sur plusieurs fragments de pagination :
  // ces deux flags indiquent si CE fragment est le premier/dernier du bloc,
  // c.-à-d. si on est sur un vrai bord de paragraphe (et pas une coupure de
  // page interne où fusionner avec le voisin serait une erreur).
  isFirstFragment: { type: Boolean, default: true },
  isLastFragment: { type: Boolean, default: true },
})
const emit = defineEmits([
    'update:modelValue',
    'request-activate',
    'state-change',
    'maj',
    'merge-next',
    'merge-prev',
    'arrow-down',
    'arrow-up',
    'toolbar-ready',
    'quill-ready',
    'request-internal-link',
])

const editorHost = ref(null)
let quill = null

// Le clipboard de Quill écrase les espaces insécables (U+202F étroite, très
// utilisée en français avant « » ; : ! ? ; et U+00A0) en espaces normales → le
// mot se coupe de sa ponctuation en fin de ligne. On les neutralise par des
// sentinelles (zone privée) avant le paste, restaurées à chaque lecture du HTML.
// Subtilité : la source (`modelValue` = outerHTML) sérialise U+00A0 en ENTITÉ
// `&nbsp;`, pas en caractère — il faut donc traiter l'entité EN PLUS du
// caractère, sinon la protection est un no-op et l'insécable redevient sécable.
const NBSP_SENTINELS = [['\u00A0', '\uE000'], ['\u202F', '\uE001']]
function protectNbsp(html) {
  // U+00A0 arrive sérialisé en entité `&nbsp;` → on la neutralise d'abord vers la
  // sentinelle de U+00A0, puis on traite les formes caractère (U+00A0, U+202F).
  const withEntity = html.replaceAll('&nbsp;', NBSP_SENTINELS[0][1])
  return NBSP_SENTINELS.reduce((s, [nb, sentinel]) => s.replaceAll(nb, sentinel), withEntity)
}
function restoreNbsp(html) {
  return NBSP_SENTINELS.reduce((s, [nb, sentinel]) => s.replaceAll(sentinel, nb), html)
}
function currentHtml() {
  return restoreNbsp(quill.root.innerHTML)
}

function requestActivate() {
  if (!props.active) emit('request-activate')
}

async function mountQuill() {
  const { default: Quill } = await import('quill')
  await import('quill/dist/quill.snow.css')

  registerInternalLinkBlot(Quill)

  quill = new Quill(editorHost.value, {
    theme: 'snow',
    modules: {
      toolbar: {
        container: [['bold', 'italic'], [{ list: 'ordered' }, { list: 'bullet' }], ['internalLink']],
        handlers: {
          internalLink() {
            const range = quill.getSelection()
            if (!range || range.length === 0) return
            emit('request-internal-link', range)
          },
        },
      },
    },
  })

  const toolbarEl = quill.container.previousElementSibling
  const linkButton = toolbarEl.querySelector('.ql-internalLink')
  if (linkButton) linkButton.innerHTML = '<i class="pi pi-link"></i>'
  emit('toolbar-ready', toolbarEl)

  quill.clipboard.dangerouslyPasteHTML(protectNbsp(props.modelValue || ''))
  quill.focus()

  quill.on('text-change', () => {
    emit('update:modelValue', currentHtml())
    emitState()
  })

  quill.on('selection-change', emitState)

  quill.on('text-change', (delta, oldDelta, source) => {
    if (source !== 'user') return
    for (const op of delta.ops || []) {
      if ( typeof op.insert === 'string' && op.insert.includes('\n')) {
        emit('maj')
        return
      }
    }
  })

  quill.root.addEventListener('keydown', (e) => {

    switch (e.key) {

      case 'Delete':
        handleMergeNext(e)
        break

      case 'Backspace':
        handleMergePrev(e)
        break

      case 'ArrowDown':
        handleArrowDown(e)
        break

      case 'ArrowUp':
        handleArrowUp(e)
        break

    }
  })

  // Curseur Quill positionné exactement où l'utilisateur a cliqué (ou, pour un
  // ArrowUp/ArrowDown venant du fragment voisin, où useFragmentEditor l'a déjà
  // résolu sur le DOM Folio AVANT ce montage — cf. navigateFragment).
  const length = quill.getLength()
  const startIndex = props.initialIndex != null
      ? Math.min(Math.max(props.initialIndex, 0), Math.max(length - 1, 0))
      : 0
  const selLength = Math.min(props.initialLength || 0, Math.max(length - 1 - startIndex, 0))

  quill.focus()
  quill.setSelection(startIndex, selLength)

  // On force l'émission : pas d'attente d'un changement de sélection
  // utilisateur pour que le faux-curseur apparaisse dans le Folia
  emitState()

  // Quill est monté (`.ql-editor` existe) : le parent peut synchroniser les
  // métriques du fragment actif. Émis ICI et pas au changement d'`editingId` :
  // mountQuill étant async (import dynamique), un simple nextTick côté parent
  // tombe avant que `new Quill()` n'ait créé `.ql-editor` (course confirmée :
  // hasInner:false).
  emit('quill-ready')
}

function handleMergeNext(e) {
  // Pas le dernier fragment du bloc : on n'est qu'à une coupure de page
  // interne au paragraphe, pas à sa vraie fin — ne rien fusionner.
  if (!props.isLastFragment) return

  const range = quill.getSelection()
  if (!range || range.length !== 0) return

  const text = quill.getText()

  const cleanLength = text.replace(/\n$/, '').length

  const isAtEnd = range.index >= cleanLength - 1

  if (!isAtEnd) return

  emit('merge-next')

  e.preventDefault()
}

function handleMergePrev(e) {
  // Pas le premier fragment du bloc : coupure de page interne, pas le
  // vrai début du paragraphe — ne rien fusionner.
  if (!props.isFirstFragment) return

  const range = quill.getSelection()
  if (!range || range.length !== 0) return

  // début logique du contenu (sans \n final)
  const text = quill.getText()
  const cleanLength = text.replace(/\n$/, '').length

  const isAtStart = range.index === 0

  if (!isAtStart) return

  emit('merge-prev')
  e.preventDefault()
}

// Symétrique de handleMergeNext/Prev, mais pour la navigation verticale : si
// le curseur est sur la dernière/première ligne VISUELLE (et pas juste le
// dernier/premier caractère — une ligne peut se terminer avant la fin du
// texte), la flèche sort du fragment plutôt que de laisser Quill caler le
// caret en bout de ligne faute de ligne suivante. La position horizontale à
// restaurer dans le fragment voisin est résolue côté useFragmentEditor,
// depuis le DOM Folio déjà rendu (cf. navigateFragment) — pas depuis Quill,
// qui n'est pas encore monté sur ce voisin.
function handleArrowDown(e) {
  if (e.shiftKey) return // laisser Quill étendre la sélection normalement

  const range = quill.getSelection()
  if (!range || range.length !== 0) return
  if (!isOnLastLine(quill, range.index)) return

  emit('arrow-down')
  e.preventDefault()
}

function handleArrowUp(e) {
  if (e.shiftKey) return

  const range = quill.getSelection()
  if (!range || range.length !== 0) return
  if (!isOnFirstLine(quill, range.index)) return

  emit('arrow-up')
  e.preventDefault()
}


function emitState() {
  const range = quill.getSelection()
  emit('state-change', {
    html: currentHtml(),
    index: range ? range.index : null,
    length: range ? range.length : 0,
  })
}

function restoreFocus(index, length = 0) {
  if (!quill) return
  quill.focus()
  quill.setSelection(index, length, 'silent') // 'silent' : pas de text-change/selection-change parasite
  emitState() // on réutilise le même mécanisme que sur le mount pour forcer la synchro du curseur Folia
}

function applyInternalLink(range, targetId) {
  if (!quill || !range || range.length === 0) return
  quill.formatText(range.index, range.length, 'internalLink', { id: targetId }, 'user')
}

//defineExpose({ restoreFocus })

defineExpose({
  restoreFocus,
  applyInternalLink,
  getQuill: () => quill,
  getEditorEl: () => editorHost.value?.querySelector('.ql-editor'),
})

watch(
    () => props.active,
    async (isActive) => {
      if (isActive) {
        await nextTick()
        await mountQuill()
      } else {
        quill = null
      }
    },
    { immediate: true }   // <-- ajouté
)

onBeforeUnmount(() => {
  quill = null
})
</script>

<style scoped>
.quill-block {
  cursor: text;
}

/* La preview ET l'éditeur doivent être visuellement indissociables :
   même police, même taille, même interligne, mêmes marges de paragraphe. */
.preview,
.quill-block :deep(.ql-editor) {
  font-family: var(--editor-font-family, Georgia, 'Times New Roman', serif);
  /* Plancher de justification : le livre est toujours justifié (paged.css), mais
     cette CSS vit dans l'iframe et n'atteint plus Quill (document principal)
     depuis le passage en frame. syncQuill recopie la vraie valeur calculée du
     fragment par-dessus ; ce plancher garantit la métrique dès le montage. */
  text-align: justify;
  /*font-size: var(--editor-font-size, 1rem);
  line-height: var(--editor-line-height, 1.185);
  color: var(--editor-color, inherit);
  padding: 0;*/
}

.preview p,
.quill-block :deep(.ql-editor p) {
  margin: 0 0 0.75em;
}

.preview .empty {
  color: #999;
  font-style: italic;
}

/* Neutralise le cadre par défaut de Quill pour qu'il ne "saute pas aux yeux"
   au moment de l'activation — seule la toolbar signale le mode édition. */
.quill-block :deep(.ql-container.ql-snow) {
  border: none;
}
.quill-block :deep(.ql-toolbar.ql-snow) {
  border: none;
  border-bottom: 1px solid #ddd;
  padding: 4px 0 8px;
  margin-bottom: 0.5em;
}

.quill-block :deep(a.lien-interne) {
  background: #ffe58f;
  text-decoration: none;
  padding: 0 0.15em;
  border-radius: 2px;
}
</style>