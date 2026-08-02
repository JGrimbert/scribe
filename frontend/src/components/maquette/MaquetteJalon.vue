<template>
  <!-- Onglet de l'accordéon : étiquette NUE (ni cadre ni fond), nom à la
       verticale, cliquable. Posé en absolu dans son hôte (une zone, ou le panneau
       du dock), qui le décale par un `transform` inline. -->
  <button
      type="button"
      class="maq-jalon"
      :class="{ 'is-active': active }"
      :title="title || undefined"
      @click="$emit('click')"
  >
    <span class="maq-jalon__name">{{ label }}</span>
  </button>
</template>

<script setup>
defineProps({
  label: { type: String, default: '' },
  // Onglet appuyé (zone focusée, ou facette affichée).
  active: { type: Boolean, default: false },
  title: { type: String, default: '' },
})

defineEmits(['click'])
</script>

<style scoped>
.maq-jalon {
  position: absolute;
  top: 2.4em;
  left: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.4em;
  height: 10.5em;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
}

/* Nom vertical lisible de BAS EN HAUT (vertical-rl + rotation 180°). Grisé au
   repos ; la couleur seule (pas la graisse) distingue l'onglet appuyé. */
.maq-jalon__name {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  transform: rotate(180deg);
  font-size: var(--fs-xs);
  font-weight: 500;
  letter-spacing: 0.05em;
  white-space: nowrap;
  color: var(--c-muted);
  transition: color 0.2s ease;
}

.maq-jalon:hover .maq-jalon__name {
  color: var(--c-ink2);
}

.maq-jalon.is-active .maq-jalon__name {
  color: var(--c-accent-alt);
}
</style>
