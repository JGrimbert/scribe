<template>
  <!-- Cadres des paragraphes rendus, posés SUR la planche du FolioView : un rect par
       bloc (`blockGeometry`, coords écran), VISIBLE par défaut et renforcé à son
       survol — reprise de la signature des outlines liminaire (`.lim-ctl__outline`),
       ici sans flèche de découpage. Racine inerte : seuls les cadres captent le
       pointeur (pour le survol). Ancré via l'origine de l'overlay (rects ramenés en
       coords locales), même patron que LiminaireControls / MaquetteFormatCallouts. -->
  <div ref="rootRef" class="bo">
    <div
        v-for="b in locals"
        :key="b.key"
        class="bo__outline"
        :style="{ left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` }"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  // Rects ÉCRAN des blocs rendus, clés par `data-block-id` (block-geometry de FolioView).
  blocks: { type: Array, default: () => [] },
})

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
// Chaque nouvelle géométrie peut naître d'un relayout qui déplace aussi l'overlay :
// on ré-ancre l'origine avant de recalculer les rects locaux.
watch(() => props.blocks, measure)

const locals = computed(() => {
  const o = origin.value
  return props.blocks.map((b) => ({
    key: b.key,
    left: b.left - o.left,
    top: b.top - o.top,
    width: b.width,
    height: b.height,
  }))
})
</script>

<style scoped>
/* Racine inerte : elle ne fait que porter les cadres positionnés (le folio dessous
   garde le pointeur). Au-dessus de l'iframe (z-index 1 en double-page). */
.bo {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}

/* Cadre d'un paragraphe : visible par défaut (pointillé discret), renforcé au survol
   — même encre que les outlines liminaire. */
.bo__outline {
  position: absolute;
  pointer-events: auto;
  border: 1px dashed color-mix(in srgb, var(--c-accent-alt) 45%, transparent);
  border-radius: var(--radius-sm);
  transition: background-color 0.12s ease, border-color 0.12s ease;
}

.bo__outline:hover {
  border-style: solid;
  border-color: var(--c-accent-alt);
  background: color-mix(in srgb, var(--c-accent-alt) 8%, transparent);
}
</style>
