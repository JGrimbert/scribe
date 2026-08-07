<template>
  <!-- Mini-nuage d'UN type de mots (personnages, lieux, verbes…), en regard du
       grand nuage : celui-ci n'en montre qu'un type à la fois, les minis rendent
       les autres présents sans les y mélanger. C'est aussi la NAVIGATION du
       nuage — le mini entier est le bouton qui le promeut en grand nuage (et le
       type promu quitte la liste, cf. l'hôte). Les mots n'y sont donc pas
       cliquables : la sélection d'un mot appartient au grand nuage. -->
  <button type="button" class="mini-cloud" :title="`Voir le nuage — ${label}`" @click="$emit('activate')">
    <span class="mini-cloud__title">{{ label }}</span>

    <span v-if="!placed.length" class="mini-cloud__empty">Aucun mot de ce type.</span>
    <svg
        v-else
        class="mini-cloud__svg"
        :viewBox="`0 0 ${CLOUD_W + CLOUD_MARGIN * 2} ${CLOUD_H + CLOUD_MARGIN * 2}`"
        role="img"
        :aria-label="`Nuage — ${label}`"
    >
      <g :transform="`translate(${CLOUD_W / 2 + CLOUD_MARGIN}, ${CLOUD_H / 2 + CLOUD_MARGIN})`">
        <text
            v-for="word in placed"
            :key="word.text"
            class="mini-cloud__word"
            :transform="`translate(${word.x}, ${word.y})`"
            :style="wordStyle(word)"
        >
          {{ word.text }}
        </text>
      </g>
    </svg>
  </button>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useAnalyse } from '../../../composables/useAnalyse'
import { useWordCloud } from '../../../composables/useWordCloud'
import { buildCloudWords } from '../../../script/cloudCategories'

// `category` : clé de catégorie de cloudCategories (nom|personne|lieu|verbe|adj).
// `limit` : le mini-nuage est une VITRINE, pas un inventaire — au-delà d'une
// vingtaine de mots les tailles s'écrasent dans une boîte de cette taille.
const props = defineProps({
  category: { type: String, required: true },
  label: { type: String, required: true },
  limit: { type: Number, default: 20 },
})

defineEmits(['activate'])

const { analysis, selectedLemma } = useAnalyse()

const lexical = computed(() => analysis.value?.lexical ?? null)
// Mêmes mots que le grand nuage (entités pour les noms propres, lemmes pour le
// reste) : promouvoir un mini ne change donc que l'échelle, pas le contenu.
const words = computed(() =>
  buildCloudWords(lexical.value?.lemmas, lexical.value?.entities)
    .filter((w) => w.category === props.category)
    .slice(0, props.limit),
)

// Boîte courte et large (la colonne en empile plusieurs), tout horizontal : à
// cette taille un mot pivoté n'est plus lisible. `static` : aucun repoussement —
// autant de simulations que de minis tourneraient sinon à côté du grand nuage.
const DIMS = { width: 320, height: 130, verticalRatio: 0, margin: 10, static: true }
const { placed, selected, wordStyle, CLOUD_W, CLOUD_H, CLOUD_MARGIN } =
  useWordCloud(words, null, DIMS)

// Le mot retenu ailleurs (grand nuage) se rallume ici s'il est de ce type : le
// mini reste le témoin de la sélection courante, sans être lui-même sélectionnable.
watch(selectedLemma, (l) => { selected.value = l?.lemma ?? null }, { immediate: true })
</script>

<style scoped>
/* Le mini ENTIER est le bouton : on remet donc à plat le chrome natif, la surface
   cliquable devant couvrir le nuage lui-même (c'est lui qu'on vise). */
.mini-cloud {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.2em;
  width: 100%;
  padding: 0.2em 0.3em;
  border: 0;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

/* Titre ancré (hors flux) sous le nuage, ferré à DROITE : une légende posée un
   demi-cran plus bas que le pied de la vignette, sans réserver de bande au-dessus. */
.mini-cloud__title {
  position: absolute;
  bottom: -0.95em;
  right: 0.3em;
  margin: 0;
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-ink2);
}

.mini-cloud__svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

/* Même main que le grand nuage (police, ancrage, transitions) : les deux se
   lisent comme un seul objet à deux échelles. Inertes : le clic appartient au
   mini entier (promotion), pas au mot. */
.mini-cloud__word {
  font-family: impact;
  text-anchor: middle;
  dominant-baseline: central;
  pointer-events: none;
  transition: font-size 0.3s ease, fill 0.3s ease;
}

.mini-cloud__empty {
  font-size: var(--fs-xs);
  color: var(--c-muted);
}
</style>
