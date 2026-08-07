<template>
  <!-- Couche des FUYANTES : le trait qui joint une row de callout à ce qu'elle
       règle sur la planche. Mutualisée entre tous les hôtes (format, styles) —
       chacun ne calcule que ses segments, le rendu vit ici. -->
  <svg class="fc-leads" :width="box.w" :height="box.h" aria-hidden="true">
    <g v-for="l in shapes" :key="l.key" class="fc-lead" :class="{ 'fc-lead--on': l.on }">
      <line :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2" />
      <polyline v-if="l.head" class="fc-lead__head" :points="l.head" />
      <circle v-if="l.dot" :cx="l.x2" :cy="l.y2" :r="DOT_R" />
    </g>
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // [{ key, x1, y1, x2, y2 }] en coords LOCALES de l'hôte : (x1,y1) = point
  // d'accroche de la row, (x2,y2) = le but (ancre cotée, centre de zone, balise).
  leaders: { type: Array, default: () => [] },
  box: { type: Object, default: () => ({ w: 0, h: 0 }) },
  // Clé de la row survolée : sa fuyante redevient convergente.
  hovered: { type: String, default: null },
  // Rendu au repos : 'arrow' (défaut) | 'dot' (convergente) | 'plain' (trait nu).
  mode: { type: String, default: 'arrow' },
})

// La flèche s'arrête AVANT son but : elle le désigne sans le toucher — une pointe
// posée sur la balise mangerait le pixel qu'on est justement en train de régler.
const END_GAP = 7
const HEAD = 5 // longueur des branches du chevron
const HEAD_SPREAD = 0.42 // demi-ouverture, en radians
const DOT_R = 1.6

// Une fuyante convergente touche son but ; au repos, en mode flèche, elle s'arrête
// à `END_GAP` et porte un chevron orienté dans l'axe du trait. Segment trop court
// pour loger le retrait : on converge plutôt que de dessiner un moignon.
const shapes = computed(() =>
  props.leaders.map((l) => {
    const on = props.hovered != null && props.hovered === l.key
    const dx = l.x2 - l.x1
    const dy = l.y2 - l.y1
    const len = Math.hypot(dx, dy)
    if (on || props.mode !== 'arrow' || len <= END_GAP + HEAD) {
      return { ...l, on, head: null, dot: on || props.mode !== 'plain' }
    }
    const a = Math.atan2(dy, dx)
    const x2 = l.x2 - Math.cos(a) * END_GAP
    const y2 = l.y2 - Math.sin(a) * END_GAP
    const branch = (da) => `${x2 - Math.cos(a + da) * HEAD},${y2 - Math.sin(a + da) * HEAD}`
    return {
      ...l, on, x2, y2, dot: false,
      head: `${branch(-HEAD_SPREAD)} ${x2},${y2} ${branch(HEAD_SPREAD)}`,
    }
  }),
)
</script>

<style scoped>
.fc-leads {
  position: absolute;
  inset: 0;
  overflow: visible;
  pointer-events: none;
}

.fc-lead line,
.fc-lead polyline {
  fill: none;
  stroke: var(--c-ink2);
  stroke-width: 1;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: var(--op-muted);
}

.fc-lead circle {
  fill: var(--c-ink2);
  opacity: var(--op-muted);
}

/* Fuyante de la row survolée : convergente, encre pleine, accent. */
.fc-lead--on line,
.fc-lead--on polyline {
  stroke: var(--c-accent);
  opacity: 1;
}

.fc-lead--on circle {
  fill: var(--c-accent);
  opacity: 1;
}
</style>
