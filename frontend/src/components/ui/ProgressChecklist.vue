<template>
  <UiCallout class="progress-checklist" tone="info">
    <template #title>
      <i class="progress-checklist__hourglass pi pi-hourglass"></i>
      <span>{{ title }}</span>
      <span class="progress-checklist__dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
    </template>

    <ul class="progress-checklist__items">
      <li
          v-for="(item, i) in items"
          :key="i"
          class="progress-checklist__item"
          :class="`is-${item.status}`"
      >
        <i class="progress-checklist__icon pi" :class="ICONS[item.status]"></i>
        <span>{{ item.label }}</span>
      </li>
    </ul>

    <template #detail>
      <ScoreBar v-if="progress" :pct="progress.pct" :label="progress.label" track-width="16em" />
    </template>
  </UiCallout>
</template>

<script setup>
import UiCallout from './UiCallout.vue'
import ScoreBar from './ScoreBar.vue'

defineProps({
  title: { type: String, default: 'Chargement' },
  // [{ label, status }], status ∈ pending | running | done | unavailable | error
  items: { type: Array, default: () => [] },
  // { pct, label } d'une tâche longue, ou null
  progress: { type: Object, default: null },
})

const ICONS = {
  pending: 'pi-circle',
  running: 'pi-spinner pi-spin',
  done: 'pi-check-circle',
  unavailable: 'pi-minus-circle',
  error: 'pi-exclamation-circle',
}
</script>

<style scoped>
.progress-checklist__items {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  column-gap: var(--sp-4);
  row-gap: var(--sp-2);
  list-style: none;
}

.progress-checklist__dots {
  /* largeur fixe : les points qui s'effacent ne font pas « respirer » le titre */
  width: 1.1em;
  letter-spacing: 0.08em;
}

.progress-checklist__item {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  /* le style évolue avec le statut : transition douce */
  transition: color 0.35s ease, opacity 0.35s ease;
}

.progress-checklist__icon {
  font-size: 0.95em;
}

.progress-checklist__item.is-pending,
.progress-checklist__item.is-unavailable {
  opacity: var(--op-faint);
}

.progress-checklist__item.is-running {
  /* --tone / --callout-ink hérités du bloc UiCallout parent */
  color: var(--tone);
  font-weight: 600;
}

.progress-checklist__item.is-done {
  color: var(--callout-ink);
}

.progress-checklist__item.is-error {
  color: var(--c-danger);
}

/* Sablier qui se retourne en boucle. */
.progress-checklist__hourglass {
  animation: pc-hourglass 2s ease-in-out infinite;
}

@keyframes pc-hourglass {
  0%,
  40% {
    transform: rotate(0deg);
  }
  50%,
  90% {
    transform: rotate(180deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* Trois points : apparition l'un après l'autre, disparition simultanée, pause. */
.progress-checklist__dots i {
  font-style: normal;
  opacity: 0;
  animation: 1.8s infinite both;
}

.progress-checklist__dots i:nth-child(1) {
  animation-name: pc-dot-1;
}

.progress-checklist__dots i:nth-child(2) {
  animation-name: pc-dot-2;
}

.progress-checklist__dots i:nth-child(3) {
  animation-name: pc-dot-3;
}

@keyframes pc-dot-1 {
  0% { opacity: 0; }
  12%, 60% { opacity: 1; }
  70%, 100% { opacity: 0; }
}

@keyframes pc-dot-2 {
  0%, 12% { opacity: 0; }
  28%, 60% { opacity: 1; }
  70%, 100% { opacity: 0; }
}

@keyframes pc-dot-3 {
  0%, 28% { opacity: 0; }
  44%, 60% { opacity: 1; }
  70%, 100% { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .progress-checklist__hourglass,
  .progress-checklist__dots i {
    animation: none;
  }
  .progress-checklist__dots i {
    opacity: 1;
  }
}
</style>
