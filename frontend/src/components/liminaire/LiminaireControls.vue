<template>
  <!-- Overlay des contrôles liminaire, posé SUR la planche du FolioView (ancré sur
       `geometry`, les rects écran des pages émis par FolioView). Racine inerte
       (`pointer-events:none`) : elle ne porte que le SELECT DE TYPE (un par page
       taguable, sous la page). Le découpage par paragraphe (flèche) a été retiré — la
       scission se fait via la précédence des styles (select « ce qui précède »). -->
  <div ref="rootRef" class="lim-ctl">
    <template v-if="geo">
      <div
          v-for="slot in typeSlots"
          :key="slot.key"
          class="lim-ctl__type"
          :style="{ left: `${slot.x}px`, top: `${slot.y}px` }"
      >
        <BaseSelect
            class="lim-ctl__select"
            :class="{ 'has-suggestion': slot.pending }"
            :title="slot.pending ? slot.pending.why : ''"
            :model-value="slot.type"
            @update:model-value="$emit('set-type', slot.page, $event)"
        >
          <!-- La ligne courante porte la suggestion (lisible au repos) ; la liste
               ne la répète pas, elle la met seulement en couleur. -->
          <option value="">{{ slot.pending ? `⚡ ${labelOf(slot.pending.key)} ?` : '— type —' }}</option>
          <option
              v-for="t in LIMINAIRE_PAGES"
              :key="t.key"
              :value="t.key"
              :class="{ 'opt-suggest': slot.pending && slot.pending.key === t.key }"
          >{{ t.label }}</option>
        </BaseSelect>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BaseSelect from '../ui/atoms/BaseSelect.vue'
import { LIMINAIRE_PAGES, LIMINAIRE_BY_KEY } from '../../script/liminaire-vocab'

const props = defineProps({
  // { pages: [{left,top,width,height}] } en coords ÉCRAN, émis par FolioView.
  // pages[0] = verso (spread.left), pages[1] = recto (spread.right).
  geometry: { type: Object, default: null },
  // Le vis-à-vis focusé (cellules d'imposition { left, right }).
  spread: { type: Object, default: null },
  types: { type: Object, required: true },
  suggestions: { type: Object, required: true },
})

defineEmits(['set-type'])

// ── Géométrie : origine de l'overlay (pour ramener les rects écran en local) ──
const rootRef = ref(null)
const origin = ref({ left: 0, top: 0 })

function measure() {
  const el = rootRef.value
  if (!el) return
  const r = el.getBoundingClientRect()
  origin.value = { left: r.left, top: r.top }
}

let ro = null
onMounted(() => {
  measure()
  ro = new ResizeObserver(measure)
  ro.observe(rootRef.value)
})
onBeforeUnmount(() => ro?.disconnect())
// Chaque nouvelle géométrie (repagination, échelle, molette) peut naître d'un
// relayout qui déplace aussi l'overlay : on ré-ancre l'origine avant de recalculer.
watch(() => props.geometry, measure)

// Repères de la planche en coordonnées LOCALES de l'overlay.
const geo = computed(() => {
  const pages = props.geometry?.pages
  if (!pages?.length) return null
  const o = origin.value
  const rects = pages.map((r) => ({
    left: r.left - o.left,
    top: r.top - o.top,
    right: r.left - o.left + r.width,
    bottom: r.top - o.top + r.height,
    cx: r.left - o.left + r.width / 2,
  }))
  return { rects }
})

// Un select par page taguable : cellule qui porte une page (ni blanche ni garde),
// alignée sur son rect. pages[0] ↔ spread.left, pages[1] ↔ spread.right.
const typeSlots = computed(() => {
  const g = geo.value
  const sp = props.spread
  if (!g || !sp) return []
  const cells = [sp.left, sp.right]
  const out = []
  g.rects.forEach((rect, i) => {
    const cell = cells[i]
    if (!cell || cell.cover || cell.blank || !cell.page) return
    const key = cell.page.key
    const type = props.types[key] ?? ''
    out.push({
      key,
      page: cell.page,
      type,
      // `pending` = suggestion non encore décidée ; un type posé referme la question.
      pending: type ? null : (props.suggestions[key] ?? null),
      // Sous la page, centré : le select est en dehors du folio, il n'en masque
      // pas le contenu.
      x: rect.cx,
      y: rect.bottom,
    })
  })
  return out
})

function labelOf(key) {
  return LIMINAIRE_BY_KEY.get(key)?.label ?? key
}
</script>

<style scoped>
/* Racine inerte : elle ne fait que porter les contrôles positionnés (le folio
   dessous garde le pointeur et le survol). */
.lim-ctl {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* Select de type, centré SOUS la page (ancré à son bord bas). */
.lim-ctl__type {
  position: absolute;
  pointer-events: auto;
  transform: translate(-50%, 0.5em);
}

.lim-ctl__select {
  min-width: 11em;
}

/* Un type encore SUGGÉRÉ (non décidé) : le select reprend la signature de
   l'indice — trait discontinu et teinte d'accent — pour qu'on lise « proposé ». */
.lim-ctl__select.has-suggestion {
  border-style: dashed;
  border-color: var(--c-accent);
  color: var(--c-accent);
}

.lim-ctl__select .opt-suggest {
  color: var(--c-accent);
  font-weight: 600;
}
</style>
