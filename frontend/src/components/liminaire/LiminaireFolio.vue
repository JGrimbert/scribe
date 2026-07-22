<template>
  <!-- UN folio physique de l'accordéon. Sans état ET sans contrôle : la page ne
       porte que son verdict, les contrôles vivent sous la scène (une page
       réduite et chevauchée ne se clique pas). -->
  <div
      v-if="cell"
      class="folio"
      :class="{ 'folio--blank': cell.blank && !cell.cover, 'folio--cover': cell.cover, 'folio--implicit': cell.implicit }"
  >
    <span v-if="!cell.cover" class="folio-num">{{ cell.number }}</span>

    <template v-if="cell.cover">
      <span class="folio-blank-label">Page de garde</span>
    </template>

    <template v-else-if="cell.blank">
      <span class="folio-blank-label">{{ cell.implicit ? 'blanche · parité' : 'Page blanche' }}</span>
    </template>

    <template v-else>
      <span class="folio-typelabel" :class="{ 'is-empty': !type }">
        <i v-if="!type && suggestion" class="pi pi-bolt"></i>
        {{ type ? labelOf(type) : suggestion ? `${labelOf(suggestion.key)} ?` : '— non typé —' }}
      </span>

      <p class="folio-preview" :title="cell.page.preview">{{ cell.page.preview || '(vide)' }}</p>
    </template>
  </div>

  <!-- Intérieur de couverture (la face de la page 1) : pas de folio à afficher. -->
  <div v-else class="folio folio--cover" aria-hidden="true"></div>
</template>

<script setup>
import { LIMINAIRE_BY_KEY } from '../../script/liminaire'

defineProps({
  // Un slot d'imposition (cf. computeImposition) ou null pour un vis-à-vis vide.
  cell: { type: Object, default: null },
  type: { type: String, default: '' },
  suggestion: { type: Object, default: null },
})

function labelOf(key) {
  return LIMINAIRE_BY_KEY.get(key)?.label ?? key
}
</script>

<style scoped>
/* Le folio : un rectangle de page, ratio ~A5 portrait. */
.folio {
  position: relative;
  width: 100%;
  max-width: 13em;
  aspect-ratio: 1 / 1.414;
  border: 1px solid var(--c-border);
  background: var(--c-surface0);
  border-radius: var(--radius-sm);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  padding: var(--sp-3) var(--sp-2) var(--sp-2);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  overflow: hidden;
}

/* Blanche et garde ne portent RIEN : sans trame, deux rectangles vides ne se
   distinguent ni l'un de l'autre, ni d'une page pleine qu'on n'a pas typée.
   Les hachures obliques disent « cette page n'est pas à remplir » ; le PAS les
   sépare — large et pâle pour la blanche (du papier qui reste blanc), serré et
   franc pour la garde (une face qu'on ne verra jamais). */
.folio--blank {
  border-style: dashed;
  box-shadow: none;
}

.folio--cover {
  border: 1px dashed var(--c-border);
}

.folio--blank, .folio--cover {
  justify-content: center;
  background: repeating-linear-gradient(
      45deg,
      var(--c-folio-bg),
      var(--c-folio-bg) 9px,
      color-mix(in srgb, var(--c-border) 55%,  var(--c-folio-bg)) 9px,
      color-mix(in srgb, var(--c-border) 55%,  var(--c-folio-bg)) 10px
  );
}

.folio-num {
  position: absolute;
  top: 0.25em;
  left: 0.4em;
  font-size: var(--fs-xs);
  color: var(--c-ink2);
  opacity: var(--op-muted);
  font-variant-numeric: tabular-nums;
}

/* Sur la trame, un libellé nu devient illisible : il lui faut son propre fond. */
.folio-blank-label {
  padding: 0.15em 0.5em;
  border-radius: var(--radius-sm);
  background: var(--c-folio-bg);
  font-size: var(--fs-xs);
  font-style: italic;
  color: var(--c-ink2);
}

/* Verdict en lecture seule : le type posé, ou la suggestion en attente —
   reprise de la teinte d'accent pour qu'elle se lise « proposée ». */
.folio-typelabel {
  margin-top: var(--sp-2);
  font-size: var(--fs-xs);
  font-weight: 600;
  text-align: center;
  line-height: 1.3;
}

.folio-typelabel.is-empty {
  font-weight: 500;
  color: var(--c-accent);
  opacity: var(--op-muted);
}

.folio-preview {
  margin: 0;
  font-family: var(--font-serif);
  font-size: var(--fs-xs);
  color: var(--c-ink2);
  text-align: center;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}
</style>
