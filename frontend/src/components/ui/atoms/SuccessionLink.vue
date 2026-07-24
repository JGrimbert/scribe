<template>
  <!-- Puce de « succession » chevauchant la bordure entre deux lignes. Silhouette
       d'AMPOULE pharmaceutique (couchée) : un corps rectangulaire (l'espace de
       l'icône, côtés verticaux + coins arrondis) d'où, au milieu de chaque flanc,
       part un col à base CONCAVE qui se resserre en fine pointe. Au survol / actif,
       une icône « lien » paraît : les deux styles voisins sont exigés consécutifs. -->
  <button
      type="button"
      class="succ"
      :class="{ 'succ--on': active }"
      role="checkbox"
      :aria-checked="active ? 'true' : 'false'"
      :title="title"
      @click="$emit('toggle')"
  >
    <svg class="succ-shape" viewBox="0 0 36 18" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <!-- Ombre intérieure très légère : rim assombri le long du contour → relief
             (le corps paraît creusé dans son cadre). `id` unique par instance. -->
        <filter :id="fid" x="-15%" y="-25%" width="130%" height="150%">
          <feOffset in="SourceAlpha" dy="0" result="o" />
          <feGaussianBlur in="o" stdDeviation="1.3" result="b" />
          <feComposite in="SourceGraphic" in2="b" operator="out" result="inv" />
          <feFlood class="succ-flood" result="c" />
          <feComposite in="c" in2="inv" operator="in" result="sh" />
          <feComposite in="sh" in2="SourceGraphic" operator="over" />
        </filter>
      </defs>
      <path class="succ-fill" :d="D" :filter="`url(#${fid})`" />
      <path class="succ-outline" :d="D" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
    </svg>
    <i class="pi pi-link succ-icon" aria-hidden="true"></i>
  </button>
</template>

<script setup>
defineProps({
  // La paire est-elle exigée (présente dans requiresAdjacency).
  active: { type: Boolean, default: false },
  title: { type: String, default: '' },
})
defineEmits(['toggle'])

// Le tracé de l'ampoule, partagé par le fond (filtré) et le contour (net).
const D =
  'M13,3 L23,3 Q29.5,3 30,8 Q31.3,8.45 32,8.75 Q32.6,9 32,9.25 Q31.3,9.55 30,10 Q29.5,15 23,15 L13,15 Q6.5,15 6,10 Q4.7,9.55 4,9.25 Q3.4,9 4,8.75 Q4.7,8.45 6,8 Q6.5,3 13,3 Z'

// Id de filtre unique : plusieurs puces coexistent, un id partagé ferait pointer
// tous les `url(#…)` sur la même définition (inoffensif ici mais HTML invalide).
const fid = `succ-inner-${uid()}`
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
  display: flex;
  align-items: center;
  justify-content: center;
  /* Aspect ~ viewBox (36/18) pour ne pas déformer le tracé. */
  width: 2.2rem;
  height: 1.1rem;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

/* Contour + fond FIGÉS (ton des bordures de table, fond papier) — ils ne changent
   NI au survol NI à l'état actif. Seule l'icône réagit. */
.succ-shape {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.succ-fill {
  fill: var(--c-paper);
}

.succ-outline {
  fill: none;
  stroke: var(--c-border);
  stroke-width: 1px;
}

/* Couleur de l'ombre intérieure, pilotée par token (thème-aware) et très discrète. */
.succ-flood {
  flood-color: var(--c-ink);
  flood-opacity: 0;
}

/* L'icône lien : le SEUL élément qui réagit. Centrée par le flex du bouton,
   toujours en accent ; masquée au repos, atténuée au survol, pleine quand la
   succession est exigée (actif). */
.succ-icon {
  position: relative;
  font-size: 0.64rem;
  line-height: 1;
  color: var(--c-accent-alt);
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: none;
}

.succ:hover .succ-icon {
  opacity: 0.55;
}

.succ--on .succ-icon {
  opacity: 1;
}

.succ:focus-visible {
  outline: 2px solid var(--c-accent-alt);
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
