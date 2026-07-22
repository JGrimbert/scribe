<template>
  <!-- Le cran terminal : pas un vis-à-vis, une action. Style franchement distinct
       (pas de folios, un cadre en pointillés) pour qu'on ne le compte pas comme
       une page du livre. Le wrapper `.acc-spread--final` (position, échelle, focus)
       reste chez LiminaireAccordeon — ici, seule la carte. -->
  <div class="extend-card">
    <i class="pi pi-plus-circle"></i>
    <p class="extend-lead">Le liminaire s'arrête ici.</p>

    <LimBorderButton
        icon="pi-arrow-down-left"
        :disabled="!canExtend"
        :title="canExtend ? `Absorber « ${nextTitle} » dans le liminaire` : 'Plus aucun chapitre à absorber'"
        @click.stop="$emit('extend')"
    >
      Étendre le liminaire
    </LimBorderButton>
    <!-- Annoncer CE qu'on absorbe : sans le titre, l'action est un saut dans le
         noir. -->
    <p v-if="canExtend" class="extend-note">Prochain : « {{ nextTitle }} »</p>

    <LimBorderButton
        ghost
        :disabled="!recalibratable || starting"
        @click.stop="$emit('redefine')"
    >
      Redéfinir les bornes…
    </LimBorderButton>

    <p v-if="!recalibratable" class="extend-note">
      Document importé avant que le <code>.odt</code> ne soit conservé : seul un réimport
      rattache son fichier d'origine.
    </p>
    <p v-else-if="recalError" class="extend-note extend-note--error">{{ recalError }}</p>
  </div>
</template>

<script setup>
import LimBorderButton from './LimBorderButton.vue'

defineProps({
  recalibratable: { type: Boolean, default: true },
  starting: { type: Boolean, default: false },
  recalError: { type: String, default: null },
  canExtend: { type: Boolean, default: true },
  nextTitle: { type: String, default: null },
})

defineEmits(['extend', 'redefine'])
</script>

<style scoped>
.extend-card {
  background: var(--c-paper-cream);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  /* Même gabarit qu'un vis-à-vis : sinon le cran terminal saute d'échelle. */
  height: 18.4em;
  padding: var(--sp-4);
  border: 1px dashed var(--c-border);
  border-radius: var(--radius-md);
  text-align: center;
  color: var(--c-ink2);
}

.pi-plus-circle {
  font-size: 1.4em;
  opacity: var(--op-muted);
}

.extend-lead {
  margin: 0;
  font-size: var(--fs-sm);
}

.extend-note {
  margin: 0;
  max-width: 22em;
  font-size: var(--fs-xs);
  opacity: var(--op-muted);
}

.extend-note--error {
  color: var(--c-danger);
  opacity: 1;
}
</style>
