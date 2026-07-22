<template>
  <span class="stacked-bar" :style="{ width }">
    <span
        v-for="segment in visible"
        :key="segment.key"
        class="stacked-bar__segment"
        :style="{ width: segment.pct + '%', background: segment.color }"
        :title="`${segment.label} : ${segment.value}`"
    ></span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

// Une barre 100 % empilée : la RÉPARTITION d'un total entre plusieurs
// catégories, pas une progression. D'où la différence avec ScoreBar, qui montre
// une valeur unique sur une échelle.
//
// Les couleurs sont fournies par l'appelant : ce composant ne sait pas ce qu'il
// peint, et le choix rampe (ordinale) vs catégorielle (identité) se décide dans
// le domaine métier, pas ici.
const props = defineProps({
  // [{ key, value, color, label }] — les valeurs sont brutes, la mise à
  // l'échelle est faite ici.
  segments: { type: Array, required: true },
  width: { type: String, default: '7em' },
})

const total = computed(() => props.segments.reduce((sum, s) => sum + s.value, 0))

// Un segment à 0 n'est pas rendu : à 0 %, il ne se voit pas mais son title
// reste survolable sur une bande de 0 px — un tooltip fantôme.
const visible = computed(() =>
    props.segments
        .filter((s) => s.value > 0)
        .map((s) => ({ ...s, pct: total.value ? (s.value / total.value) * 100 : 0 })),
)
</script>

<style scoped>
.stacked-bar {
  display: inline-flex;
  height: 0.5em;
  border-radius: var(--radius-pill);
  background: rgba(0, 0, 0, 0.08);
  overflow: hidden;
  flex-shrink: 0;
  vertical-align: -0.05em;
}

.stacked-bar__segment {
  display: block;
  height: 100%;
}
</style>
