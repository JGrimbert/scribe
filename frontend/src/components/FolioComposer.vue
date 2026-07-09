<template>
  <div class="folio-composer" ref="composerRoot">
    <!-- LAYOUT / LIVRE -->
    <Folia :page-width-mm="pageWidthMm" :page-height-mm="pageHeightMm" :gap-px="gapPx" :pages="pages.length">
      <template #default="{ scalePercent }">
        <Folio v-for="(html, i) in pages" :key="i" :page-number="i + 1">
          <div class="column" :data-column-index="i"
               @click="onColumnClick"
               @mouseup="onColumnMouseUp"
          >
            <div v-html="html"></div>
            <div class="selection-overlay"></div>
          </div>
        </Folio>
        <div class="scale-indicator">{{ scalePercent }}%</div>
      </template>
    </Folia>

    <Teleport to="body">
      <div v-if="editorVisible" class="fragment-editor">

        <QuillBlock
            ref="quillBlockRef"
            :key="editingId"
            :model-value="initialHtml"
            :initial-index="pendingIndex"
            :initial-length="pendingLength"
            :is-first-fragment="isFirstFragment"
            :is-last-fragment="isLastFragment"
            active
            @state-change="onFragmentStateChange"
            @maj="commitEdit"
            @merge-next="mergeNextFragment"
            @merge-prev="mergePrevFragment"
            @toolbar-ready="registerToolbar"
        />
      </div>
    </Teleport>

    <Teleport to="body">
      <div
          v-if="cursorRect"
          class="fake-cursor"
          :style="{
            top: cursorRect.top + 'px',
            left: cursorRect.left + 'px',
            height: cursorRect.height + 'px'
          }"
      ></div>
      <div
          v-for="(rect, i) in selectionRects"
          :key="i"
          class="fake-selection-rect"
          :style="{
    position: 'fixed',
    top: rect.top + 'px',
    left: rect.left + 'px',
    width: rect.width + 'px',
    height: rect.height + 'px'
  }"
      />
    </Teleport>

    <div ref="measureEl" class="measure-engine" ></div>

  </div>
</template>

<script setup>
import {computed, nextTick, ref, watch} from 'vue'
import Folio from './Folio.vue'
import Folia from './Folia.vue'
import QuillBlock from "./QuillBlock.vue";
import {paginate} from "../script/paginate.js";
import {useFakeCaret} from "../composables/useFakeCaret.js";
import {useFloatingToolbar} from "../composables/useFloatingToolbar.js";
import {useFragmentEditor} from "../composables/useFragmentEditor.js";

/* ------------------ PROPS ------------------ */

const props = defineProps({
  trame: Object,
  data: Object,

  pageWidthMm: { type: Number, default: 150 },
  pageHeightMm: { type: Number, default: 210 },
  gapPx: { type: Number, default: 32 },
  scalePercent: Number,

})

/* ------------------ STATE ------------------ */

const pages = ref([])
const MM_TO_PX = 3.779527559
const composerRoot = ref(null)
const registry = ref(null)
const fragments = ref(null)   // { getFragment, getBlockId, setFragment }
const measureEl = ref(null)
const scalePercent = computed(() => props.scalePercent)

/* ------------------ DERIVED ------------------ */

const sections = computed(() => {
  if (!props.trame || !props.data) return []
  const out = []
  for (const axe of props.trame.axes) {
    push(out, axe.id, 0)
    for (const bloc of axe.blocs) {
      push(out, bloc.id, 1)
      for (const id of bloc.articles) {
        push(out, id, 2)
      }
    }
  }
  return out
})

function push(out, id, depth) {
  const item = props.data[id]
  if (!item) return
  out.push({ ...item, depth })
}

/* ------------------ PAGINATION ------------------ */

let raf = null

async function scheduleReflow() {
  if (!props.trame || !props.data) return []
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(async () => {
    await nextTick()
    await refresh()
  })
}

watch(
    sections,
    scheduleReflow,
    { deep: true, immediate: true }
)

async function refresh() {
  const result = await paginate({
    hMax: props.pageHeightMm * MM_TO_PX,
    sections,
    pages,
    measureEl,
  })

  pages.value = result.pages
  registry.value = result.registry
  fragments.value = result.fragments
}

/* ------------------ ÉDITION PAR FRAGMENT ------------------ */

function findFragEl(fragId) {
  return composerRoot.value?.querySelector(`[data-frag-id="${fragId}"]`)
}

const caret = useFakeCaret(findFragEl)
const toolbar = useFloatingToolbar()

const {
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
} = useFragmentEditor({ findFragEl, registry, fragments, refresh, scalePercent, caret, toolbar })

const { cursorRect, selectionRects } = caret
const { registerToolbar } = toolbar
</script>

<style scoped>
.folio-composer {
  width: 100%;
  height: 80vh;
}

.measure-engine {
  all: initial;
  border: none;
  display: block;
  height: 0px;
  width: 0px;
  overflow: hidden;
}

.column {
  position: relative;
  border: 1px solid #ccc;
}

.selection-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.selection-overlay :deep(.highlight-rect) {
  position: absolute;
  background: rgba(0, 100, 255, 0.25);
}


.fake-selection-rect {
  position: fixed;
  background-color: rgba(0, 100, 255, 0.25); /* proche du bleu de sélection natif macOS/Chrome */
  pointer-events: none; /* indispensable : sinon ça intercepte les clics/mouseup destinés à la colonne */
  z-index: 5; /* au-dessus du texte mirroré, mais vérifie par rapport au z-index de ton curseur clignotant */
  border-radius: 1px; /* évite l'effet "bloc" trop carré sur de petites largeurs */
}

.fake-cursor {
  position: fixed;
  width: 2px;
  background: #2f6fed;
  pointer-events: none;
  z-index: 999;
  animation: blink 1s steps(1) infinite;
}
@keyframes blink {
  50% { opacity: 0; }
}

.fragment-editor {
  position: fixed;
  top: 16px;
  right: 16px;
  width: 360px;
  max-height: 80vh;
  overflow: auto;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, .18);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.fragment-editor__header {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
  font-weight: 600;
}

.fragment-editor__footer {
  padding: 8px 12px;
  border-top: 1px solid #eee;
  text-align: right;
}

.ql-toolbar {
  transition: opacity 0.1s ease;
}
</style>