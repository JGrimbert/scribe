<template>
  <component
      :is="isStatic ? 'span' : 'button'"
      :type="isStatic ? null : 'button'"
      class="base-chip"
      :class="{ 'base-chip--active': active, 'base-chip--static': isStatic }"
  >
    <span v-if="dot" class="chip-dot" :style="{ background: dot }"></span>
    <slot />
    <span v-if="count !== null" class="chip-count">{{ count }}</span>
  </component>
</template>

<script setup>
defineProps({
  active: { type: Boolean, default: false },
  count: { type: [Number, String], default: null },
  // couleur d'une pastille optionnelle (ex : thème)
  dot: { type: String, default: null },
  // chip d'information seule : non cliquable, atténuée (pas un <button>).
  isStatic: { type: Boolean, default: false },
})
</script>

<style scoped>
.base-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.25em 0.6em;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-pill);
  background: var(--c-surface);
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-size: var(--fs-sm);
  line-height: 1.3;
}

.base-chip:not(.base-chip--static):hover,
.base-chip--active {
  border-color: var(--c-accent);
  color: var(--c-accent);
}

/* Information seule : atténuée, non interactive. */
.base-chip--static {
  cursor: default;
  border-style: dashed;
  opacity: var(--op-soft);
}

.chip-dot {
  width: 0.7em;
  height: 0.7em;
  border-radius: 50%;
  flex-shrink: 0;
}

.chip-count {
  font-size: 0.85em;
  opacity: var(--op-muted);
  font-variant-numeric: tabular-nums;
}
</style>
