<template>
  <div class="ui-callout" :class="`ui-callout--${tone}`">
    <div class="ui-callout__row">
      <span class="ui-callout__badge"><slot name="title">{{ title }}</slot></span>
      <div class="ui-callout__body" :class="{ 'ui-callout__body--truncate': truncate }">
        <slot />
      </div>
    </div>

    <!-- Section secondaire (détail), centrée, fond plus clair : ex. progression. -->
    <div v-if="hasDetail" class="ui-callout__detail"><slot name="detail" /></div>
  </div>
</template>

<script setup>
import { Comment, computed, useSlots } from 'vue'

defineProps({
  // Texte de la cartouche (ignoré si le slot #title est fourni).
  title: { type: String, default: '' },
  // info : bloc neutre (attente, chargement) — error : échec.
  tone: { type: String, default: 'info', validator: (v) => ['info', 'error'].includes(v) },
  // Tronque le corps sur une seule ligne (…) plutôt que de le laisser passer à
  // la ligne. Pour un message court (UiNote) ; laissé faux pour du contenu
  // multi-éléments (liste d'étapes).
  truncate: { type: Boolean, default: false },
})

// N'affiche la section détail que si le slot rend réellement quelque chose
// (un v-if faux côté appelant laisse un simple commentaire).
const slots = useSlots()
const hasDetail = computed(() => {
  const nodes = slots.detail?.()
  return !!nodes && nodes.some((n) => n.type !== Comment)
})
</script>

<style scoped>
/* Bloc « callout » : fond en teinte douce, bordure plus affirmée. La cartouche
   de titre est un onglet collé à la bordure (pas de marge, coin partagé), la
   section détail un sous-panneau plus clair. Toutes les nuances dérivent d'UNE
   teinte (--tone) via color-mix. */
.ui-callout {
  --tone: var(--c-info);
  --callout-bg: color-mix(in srgb, var(--tone) 10%, var(--c-paper));
  --callout-border: color-mix(in srgb, var(--tone) 42%, var(--c-paper));
  --callout-badge: color-mix(in srgb, var(--tone) 22%, var(--c-paper));
  --callout-ink: color-mix(in srgb, var(--tone) 58%, var(--c-ink));

  width: 100%;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--callout-border);
  border-radius: var(--radius-md);
  background: var(--callout-bg);
  font-size: var(--fs-sm);
  /* la cartouche et le détail collent aux coins arrondis */
  overflow: hidden;
}

.ui-callout--error {
  --tone: var(--c-danger);
}

/* Une seule ligne : cartouche + corps inline (pas de retour à la ligne). */
.ui-callout__row {
  display: flex;
  align-items: stretch;
  min-width: 0;
}

/* Cartouche : onglet collé au coin haut-gauche, fond plus soutenu, sans marge. */
.ui-callout__badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  padding: var(--sp-1) var(--sp-3);
  background: var(--callout-badge);
  color: var(--callout-ink);
  font-size: var(--fs-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.ui-callout__body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  padding: var(--sp-2) var(--sp-3);
  color: color-mix(in srgb, var(--tone) 24%, var(--c-ink));
}

/* Corps tronqué (…) quand l'espace manque, plutôt que de déborder/wrap. */
.ui-callout__body--truncate {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ui-callout__detail {
  display: flex;
  justify-content: center;
  padding: var(--sp-2) var(--sp-3);
  /* plus clair que le bloc, translucide */
  background: var(--c-surface3);
  border-top: 1px solid color-mix(in srgb, var(--callout-border) 55%, transparent);
}
</style>
