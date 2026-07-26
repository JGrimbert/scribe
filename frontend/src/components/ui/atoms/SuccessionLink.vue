<template>
  <!-- Puce de « succession » chevauchant la bordure entre deux lignes. Silhouette
       d'AMPOULE : corps rectangulaire (l'espace de l'icône) + col concave en fine
       pointe de chaque côté. L'icône « lien » est DANS le SVG (et non en HTML) :
       ainsi l'ampoule et l'icône sont rasterisées ensemble → leur écart reste
       identique d'une puce à l'autre, quelle que soit la position sous-pixel. -->
  <button
      type="button"
      class="succ"
      :class="{ 'succ--on': active }"
      role="checkbox"
      :aria-checked="active ? 'true' : 'false'"
      :title="title"
      @click="$emit('toggle')"
  >
    <svg class="succ-shape" viewBox="0 0 36 24" aria-hidden="true">
      <defs>
        <linearGradient :id="gid" x1="0" y1="0" x2="0" y2="0.6">
          <stop class="succ-grad-top" offset="0" />
          <stop class="succ-grad-bot" offset="0.6" />
        </linearGradient>
      </defs>
      <path class="succ-fill" :d="D" :fill="`url(#${gid})`" />
      <path class="succ-outline" :d="D" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
      <text
          class="succ-icon"
          x="18"
          y="12.6"
          font-family="primeicons"
          font-size="13.5"
          text-anchor="middle"
          dominant-baseline="central"
      >&#xe9c1;</text>
    </svg>
  </button>
</template>

<script setup>
defineProps({
  // La paire est-elle exigée (présente dans requiresAdjacency).
  active: { type: Boolean, default: false },
  title: { type: String, default: '' },
})
defineEmits(['toggle'])

// Tracé de l'ampoule (viewBox 36×24 → aspect 1.5, identique au bloc CSS : pas
// d'étirement, donc l'icône du SVG n'est pas déformée).
const D =
  'M13,4 L23,4 Q29.5,4 30,10.67 Q31.3,11.27 32,11.67 Q32.6,12 32,12.33 Q31.3,12.73 30,13.33 Q29.5,20 23,20 L13,20 Q6.5,20 6,13.33 Q4.7,12.73 4,12.33 Q3.4,12 4,11.67 Q4.7,11.27 6,10.67 Q6.5,4 13,4 Z'

// Id de dégradé unique par instance (sinon tous les `url(#…)` pointeraient sur
// une seule def — HTML invalide).
const gid = `succ-grad-${uid()}`
</script>

<script>
let n = 0
function uid() {
  return ++n
}
</script>

<style scoped>
.succ {
  position: relative;
  display: block;
  /* Aspect 1.5 = celui du viewBox (36/24) → pas de déformation du tracé. */
  width: 2.2rem;
  height: 1.467rem;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.succ-shape {
  display: block;
  width: 100%;
  height: 100%;
}

/* Fond = dégradé vertical : couleur de bordure (l'ombre) en haut → anneau de table
   en bas (cf. stops plus bas). */
.succ-outline {
  fill: none;
  stroke: var(--c-border);
  stroke-width: 1px;
}

.succ-grad-top {
  /* Ombre douce : entre l'invisible (45 %) et le trop-marqué (100 %). */
  stop-color: color-mix(in srgb, var(--c-border) 80%, var(--c-table-ring));
}
.succ-grad-bot {
  stop-color: var(--c-table-ring);
}

/* L'icône lien (élément SVG `<text>`, donc `fill` et non `color`). OFF : présente,
   sépia translucide ; survol : plus nette ; ON : accent teal, pleine. */
.succ-icon {
  fill: var(--c-ink2);
  opacity: 0.45;
  transition: opacity 0.15s ease, fill 0.15s ease;
  pointer-events: none;
}

.succ:hover .succ-icon {
  opacity: 0.7;
}

.succ--on .succ-icon {
  fill: var(--c-accent-alt);
  opacity: 1;
}

.succ:focus-visible {
  outline: 2px solid var(--c-accent-alt);
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
