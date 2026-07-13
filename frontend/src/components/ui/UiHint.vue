<template>
  <span
      ref="trigger"
      class="ui-hint"
      tabindex="0"
      role="note"
      :aria-label="text"
      @mouseenter="show"
      @mouseleave="hide"
      @focus="show"
      @blur="hide"
  >
    <span class="ui-hint__dot" aria-hidden="true">?</span>
    <!-- Téléportée dans <body> + position: fixed : la bulle échappe à tout
         contexte d'empilement / overflow parent (sinon elle passe sous les
         surfaces translucides voisines qui la refloutent). -->
    <Teleport to="body">
      <span v-if="open" ref="tip" class="ui-hint__tip" role="tooltip" :style="tipStyle">
        {{ text }}
      </span>
    </Teleport>
  </span>
</template>

<script setup>
import { nextTick, ref } from 'vue'

// Pastille « ? » + bulle au survol/focus. Réutilisable seul (ex : à la suite
// d'une liste de chips) ; StatItem s'appuie dessus aussi.
defineProps({
  text: { type: String, required: true },
})

const trigger = ref(null)
const tip = ref(null)
const open = ref(false)
const tipStyle = ref({})

const MARGIN = 8

async function show() {
  open.value = true
  await nextTick()
  const r = trigger.value.getBoundingClientRect()
  const half = (tip.value?.offsetWidth ?? 0) / 2
  const center = Math.min(
    Math.max(r.left + r.width / 2, MARGIN + half),
    window.innerWidth - MARGIN - half,
  )
  tipStyle.value = { top: `${r.bottom + MARGIN}px`, left: `${center}px` }
}

function hide() {
  open.value = false
}
</script>

<style scoped>
.ui-hint {
  display: inline-flex;
  outline: none;
}

.ui-hint__dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.15em;
  height: 1.15em;
  background: var(--c-accent-alt);
  color: var(--c-accent-alt-ink);
  border-radius: var(--radius-pill);
  font-size: 0.8em;
  font-weight: 700;
  line-height: 1;
  cursor: help;
}

/* Fixée au viewport (téléportée), au-dessus de tout, fond opaque. */
.ui-hint__tip {
  position: fixed;
  z-index: 9999;
  transform: translateX(-50%);
  width: max-content;
  max-width: 18em;
  padding: 0.5em 0.7em;
  background: var(--c-paper);
  color: var(--c-ink);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 14px rgba(26, 22, 18, 0.18);
  font-family: var(--font-ui);
  font-size: var(--fs-xs);
  font-weight: normal;
  line-height: 1.35;
  white-space: normal;
  text-align: left;
  pointer-events: none;
}
</style>
