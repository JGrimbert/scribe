<template>
  <!-- La réglette EST la barre de défilement du liminaire : elle en reprend la
       facture complète, triangles de bout compris. Le pouce occupe 1/N et se pose
       sur le cran courant — il matérialise « où on en est », sans être un vrai
       scroll. -->
  <div class="acc-rail" title="Situation dans le liminaire">
    <button
        type="button"
        class="acc-rail-arrow acc-rail-arrow--left"
        title="Vis-à-vis précédent"
        :disabled="focused === 0"
        @click.stop="$emit('update:focused', focused - 1)"
    ></button>
    <div class="acc-rail-track" @click="scrubTo">
      <div class="acc-rail-thumb" :style="railThumbStyle"></div>
    </div>
    <button
        type="button"
        class="acc-rail-arrow acc-rail-arrow--right"
        title="Vis-à-vis suivant"
        :disabled="focused >= slideCount - 1"
        @click.stop="$emit('update:focused', focused + 1)"
    ></button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  focused: { type: Number, required: true },
  // Les vis-à-vis (0..n-1) plus le cran terminal (n) : cf. LiminaireAccordeon.
  slideCount: { type: Number, required: true },
})

const emit = defineEmits(['update:focused'])

const railThumbStyle = computed(() => {
  const n = props.slideCount
  return { width: `${100 / n}%`, left: `${(props.focused / n) * 100}%` }
})

function scrubTo(event) {
  const rail = event.currentTarget
  const ratio = (event.clientX - rail.getBoundingClientRect().left) / rail.clientWidth
  const n = props.slideCount
  emit('update:focused', Math.min(n - 1, Math.max(0, Math.floor(ratio * n))))
}
</script>

<style scoped lang="scss">
/* La réglette AU-DESSUS de la zone d'inputs : elle ferme la scène. */
.acc-rail {
  display: flex;
  align-items: center;
  margin-bottom: var(--sp-4);

  &-track {
    position: relative;
    flex: 1 1 auto;
    height: 6px;
    border-radius: 3px;
    background: var(--c-border);
    cursor: pointer;
  }

  /* Mêmes triangles pleins que CustomScrollbar : 12 px de boîte, bordure de 4 px,
     teal — orientés à l'horizontale puisque le liminaire se parcourt en largeur. */
  &-arrow {
    position: relative;
    flex: 0 0 auto;
    width: 12px;
    height: 12px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    opacity: var(--op-soft);
  }

  &-arrow:hover:not(:disabled) { opacity: 1; }
  &-arrow:disabled { opacity: var(--op-faint); cursor: default; }

  &-arrow::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    border: 4px solid transparent;
  }

  &-arrow--left::before {
    transform: translate(-75%, -50%);
    border-right-color: var(--c-accent-alt);
  }

  &-arrow--right::before {
    transform: translate(-25%, -50%);
    border-left-color: var(--c-accent-alt);
  }

  /* Teal, comme le pouce des CustomScrollbar de l'app : la réglette EST une
     barre de défilement (celle du liminaire), elle doit s'en réclamer. */
  &-thumb {
    position: absolute;
    top: 0;
    height: 100%;
    min-width: 12px;
    border-radius: 3px;
    background: var(--c-accent-alt);
    transition: left 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
  }

  &-track:hover .acc-rail-thumb {
    background: var(--c-accent-alt-darker);
  }
}
</style>
