<template>
  <div class="stat-item" :class="{ 'stat-item--empty': empty, 'stat-item--hintable': hint }" :tabindex="hint ? 0 : null">
    <span class="stat-item__value">{{ empty ? '—' : value }}</span>
    <span class="stat-item__label">
      {{ label }}
      <span v-if="hint" class="stat-item__hint" aria-hidden="true">?</span>
    </span>
    <span v-if="hint" class="stat-item__tip" role="tooltip">{{ hint }}</span>
  </div>
</template>

<script setup>
defineProps({
  value: { type: [String, Number], default: null },
  label: { type: String, required: true },
  // Texte d'infobulle : « ? » à côté du label, bulle au survol de la tuile.
  hint: { type: String, default: null },
  // Aucune valeur calculée : affiche « — », la tuile occupe l'espace.
  empty: { type: Boolean, default: false },
})
</script>

<style scoped>
/* Chaque stat est sa propre tuile — même chrome que UiCard. Tout centré,
   valeur comme label. Pas de curseur/sélection de texte. */
.stat-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0.15em;
  padding: 0.55em 0.85em;
  background: var(--c-surface);
  backdrop-filter: var(--c-backdrop-filter-blur);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  cursor: default;
  user-select: none;
}

.stat-item--hintable {
  outline: none;
}

/* La tuile survolée/focalisée passe au-dessus des tuiles suivantes (chacune
   crée un contexte d'empilement via backdrop-filter, sinon la bulle est
   recouverte). */
.stat-item--hintable:hover,
.stat-item--hintable:focus-visible {
  z-index: 20;
}

.stat-item--empty .stat-item__value {
  opacity: var(--op-muted);
}

.stat-item__value {
  font-size: var(--fs-lg);
  font-variant-numeric: tabular-nums;
}

.stat-item__label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35em;
  font-size: var(--fs-xs);
  opacity: var(--op-muted);
  white-space: nowrap;
}

/* Pastille « ? » : fond couleur complémentaire, texte blanc. */
.stat-item__hint {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.15em;
  height: 1.15em;
  background: var(--c-accent-alt);
  color: var(--c-accent-alt-ink);
  border-radius: var(--radius-pill);
  font-size: 0.8em;
  font-weight: 700;
  line-height: 1;
}

/* Bulle maison : SOUS la tuile (vers le haut elle passerait sous le menu),
   centrée, opaque. */
.stat-item__tip {
  position: absolute;
  top: calc(100% + 0.4em);
  left: 50%;
  transform: translateX(-50%) translateY(-4px);
  z-index: 21;
  width: max-content;
  max-width: 15em;
  padding: 0.5em 0.7em;
  background: var(--c-paper);
  color: var(--c-ink);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 14px rgba(26, 22, 18, 0.18);
  font-size: var(--fs-xs);
  font-weight: normal;
  line-height: 1.35;
  white-space: normal;
  text-align: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

/* Flèche de la bulle (pointe vers le haut, vers la tuile). */
.stat-item__tip::after {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-bottom-color: var(--c-border);
}

.stat-item--hintable:hover .stat-item__tip,
.stat-item--hintable:focus-visible .stat-item__tip {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
</style>
