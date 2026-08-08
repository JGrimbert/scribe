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
/* Onglet coloré : teal-dark (= menu principal) sur fond teal clair au repos ;
   inversé à l'appui (fond teal-dark, texte blanc). MÊME géométrie verticale qu'un
   feuillet (top 2.4em, height 8em) posée au niveau de repos le plus bas via un
   retrait Y fixe (cf. jalonStyle) : il ne bouge pas, les pages montent au-dessus
   de lui et le REJOIGNENT exactement quand la zone se replie en onglet. */
.maq-jalon {
  position: absolute;
  top: 2.4em;
  left: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5em;
  height: 8em;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  /* Fonds PLEINS (mix sur blanc, pas sur transparent) : pas de jeu d'opacité qui
     laisserait transparaître les feuillets derrière l'onglet. */
  background: color-mix(in srgb, var(--c-accent-alt) 16%, #fff);
  cursor: pointer;
  transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1),
              background-color 0.2s ease;
}

.maq-jalon:hover {
  background: color-mix(in srgb, var(--c-accent-alt) 26%, #fff);
}

.maq-jalon.is-active {
  background: var(--c-accent-alt-mid);
}

/* Nom vertical lisible de BAS EN HAUT (vertical-rl + rotation 180°). Teal-dark au
   repos, blanc quand l'onglet est appuyé (le fond passe en teal-dark). */
.maq-jalon__name {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  transform: rotate(180deg);
  font-size: var(--fs-xs);
  font-weight: 500;
  letter-spacing: 0.05em;
  white-space: nowrap;
  color: var(--c-accent-alt-mid);
  transition: color 0.2s ease;
}

.maq-jalon.is-active .maq-jalon__name {
  color: #fff;
}
</style>
