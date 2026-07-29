<template>
  <!-- Jalon d'action : la borne de fin du liminaire. Étendre absorbe le chapitre
       suivant DANS le liminaire, exclure relâche le dernier absorbé. Ce n'est
       qu'un APERÇU (borderShift) : rien n'est écrit tant qu'un recalibrage n'a pas
       reconstruit l'arbre — d'où le liseré d'avertissement. Réutilise LimBorderButton,
       la signature partagée des gestes de borne. -->
  <div class="jalon-card" :class="{ 'is-shifted': borderShift > 0 }">
    <i class="pi pi-flag-fill" aria-hidden="true"></i>
    <span class="jalon-lead">Fin du liminaire</span>

    <div class="jalon-actions">
      <LimBorderButton
          icon="pi-arrow-down-left"
          :disabled="!canExtend"
          :title="canExtend ? `Absorber « ${nextTitle} » dans le liminaire` : 'Plus aucun chapitre à absorber'"
          @click.stop="$emit('extend')"
      >
        Étendre
      </LimBorderButton>
      <LimBorderButton
          icon="pi-arrow-up-right"
          :disabled="borderShift === 0"
          :title="borderShift > 0 ? 'Rendre le dernier chapitre absorbé au corps du livre' : 'Rien à exclure'"
          @click.stop="$emit('exclude')"
      >
        Exclure
      </LimBorderButton>
    </div>

    <p v-if="borderShift > 0" class="jalon-note jalon-note--warn">
      Aperçu — {{ borderShift }} chapitre{{ borderShift > 1 ? 's' : '' }} absorbé{{ borderShift > 1 ? 's' : '' }}, non enregistré.
    </p>
    <p v-else-if="canExtend" class="jalon-note">Prochain : « {{ nextTitle }} »</p>
  </div>
</template>

<script setup>
import LimBorderButton from '../liminaire/LimBorderButton.vue'

defineProps({
  canExtend: { type: Boolean, default: true },
  nextTitle: { type: String, default: null },
  borderShift: { type: Number, default: 0 },
})

defineEmits(['extend', 'exclude'])
</script>

<style scoped>
.jalon-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  height: 9em;
  padding: var(--sp-3);
  border: 1px dashed var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-paper-cream, color-mix(in srgb, var(--c-accent-alt-darker) 5%, var(--c-surface)));
  text-align: center;
}

/* Une borne déplacée est un état à signaler : elle n'est qu'un aperçu. */
.jalon-card.is-shifted {
  border-color: color-mix(in srgb, var(--c-danger) 55%, var(--c-border));
}

.jalon-card > i {
  color: var(--c-accent-alt-darker);
  font-size: var(--fs-md);
}

.jalon-lead {
  font-size: var(--fs-xs);
  color: var(--c-ink2);
}

.jalon-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--sp-2);
}

.jalon-note {
  margin: 0;
  max-width: 16em;
  font-size: var(--fs-xs);
  color: var(--c-ink2);
  opacity: var(--op-muted);
}

.jalon-note--warn {
  color: var(--c-danger);
  opacity: 1;
}
</style>
