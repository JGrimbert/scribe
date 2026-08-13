<template>
  <!-- Couche des FUYANTES : le trait qui joint une row de callout à ce qu'elle
       règle sur la planche. Mutualisée entre tous les hôtes (format, styles) —
       chacun ne calcule que ses segments, le rendu vit ici. Chaque fuyante est un
       COUDE : segment horizontal du label au milieu de la gouttière de fond, puis
       trait en biais vers la balise exacte. -->
  <svg class="fc-leads" :width="box.w" :height="box.h" aria-hidden="true">
    <g v-for="l in shapes" :key="l.key" class="fc-lead" :class="{ 'fc-lead--on': l.on }">
      <polyline :points="l.body" />
      <polygon v-if="l.head" class="fc-lead__head" :points="l.head" />
      <circle v-if="l.dot" :cx="l.x2" :cy="l.y2" :r="DOT_R" />
    </g>
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // [{ key, x1, y1, xm, x2, y2 }] en coords LOCALES de l'hôte : (x1,y1) = point
  // d'accroche de la row, (xm,y1) = coude au milieu de la gouttière de fond,
  // (x2,y2) = le but (ancre cotée, centre de zone, balise). `xm` absent → trait droit.
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
const HEAD = 7 // longueur des branches du chevron
const HEAD_SPREAD = 0.42 // demi-ouverture, en radians
const DOT_R = 2

// En mode flèche, la fuyante s'arrête à `END_GAP` et porte un chevron orienté dans
// l'axe du DERNIER segment (le coude). Le survol ne change QUE la couleur (classe
// `--on`) : ni prolongement jusqu'à la balise ni point terminal. Segment final trop
// court pour loger le retrait : on pose un point plutôt qu'un moignon.
const shapes = computed(() =>
  props.leaders.map((l) => {
    const on = props.hovered != null && props.hovered === l.key
    // Le dernier segment part du coude (ou de l'origine si trait droit) ; il reste
    // au niveau `y1` — le premier segment est horizontal.
    const mx = l.xm ?? l.x1
    const dx = l.x2 - mx
    const dy = l.y2 - l.y1
    const len = Math.hypot(dx, dy)
    const bodyTo = (ex, ey) =>
      l.xm != null ? `${l.x1},${l.y1} ${l.xm},${l.y1} ${ex},${ey}` : `${l.x1},${l.y1} ${ex},${ey}`
    if (props.mode !== 'arrow' || len <= END_GAP + HEAD) {
      return { ...l, on, body: bodyTo(l.x2, l.y2), head: null, dot: props.mode !== 'plain' }
    }
    const a = Math.atan2(dy, dx)
    const x2 = l.x2 - Math.cos(a) * END_GAP
    const y2 = l.y2 - Math.sin(a) * END_GAP
    const branch = (da) => `${x2 - Math.cos(a + da) * HEAD},${y2 - Math.sin(a + da) * HEAD}`
    return {
      ...l, on, x2, y2, dot: false,
      body: bodyTo(x2, y2),
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
  /* Ombre NETTE (offset franc, flou nul) : le corps se détache du papier et de la
     trame sans halo. Portée à la couche entière — moins coûteux qu'un filtre par g. */
  filter: drop-shadow(0.5px 1px 0 color-mix(in srgb, var(--c-ink) 22%, transparent));
}

.fc-lead polyline {
  fill: none;
  stroke: var(--c-ink2);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: var(--op-muted);
}

/* Pointe = triangle PLEIN (polygon fermé) : même encre que le corps. */
.fc-lead__head,
.fc-lead circle {
  fill: var(--c-ink2);
  opacity: var(--op-muted);
}

/* Fuyante de la row survolée : encre pleine, accent (corps + pointe). */
.fc-lead--on polyline {
  stroke: var(--c-accent);
  opacity: 1;
}

.fc-lead--on .fc-lead__head,
.fc-lead--on circle {
  fill: var(--c-accent);
  opacity: 1;
}

.fc-lead--on circle {
  fill: var(--c-accent);
  opacity: 1;
}
</style>
