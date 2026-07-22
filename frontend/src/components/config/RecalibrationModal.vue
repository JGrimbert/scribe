<template>
  <!-- Recalibration : en MODALE, plus en plein écran — on y entre depuis le
       composer du liminaire, et on doit pouvoir en ressortir sans avoir perdu de
       vue l'écran qu'on configurait.
       `open` est DISTINCT de `preview` : la modale s'ouvre d'abord, et attend son
       contenu dedans. Conditionner l'ouverture aux données faisait patienter sur
       un écran inchangé, sans rien dire. -->
  <div v-if="open" class="recal-modal" role="dialog" aria-modal="true" aria-label="Redéfinir les bornes du livre">
    <div class="recal-backdrop" @click="$emit('close')"></div>
    <div class="recal-panel">
      <header class="recal-head">
        <h3>Redéfinir les bornes</h3>
        <!-- Le mode d'emploi passe en pastille : il se consulte, il n'a pas à
             occuper une ligne à chaque ouverture. -->
        <UiHint text="Posez le début du contenu (ce qui précède part en liminaire) et, s'il y en a une, la partie finale — table des matières, index, glossaire. Dépliez un titre pour voir ses sous-titres." />
        <button type="button" class="recal-close" title="Fermer" @click="$emit('close')">
          <i class="pi pi-times"></i>
        </button>
      </header>

      <p v-if="starting" class="recal-wait">
        <i class="pi pi-spin pi-spinner"></i> Relecture du fichier d'origine…
      </p>

      <UiNote v-else-if="recalError" variant="error" class="recal-fail">{{ recalError }}</UiNote>

      <ImportCalibration
          v-else-if="preview"
          class="recal-calibration"
          mode="recalibration"
          :preview-id="preview.previewId"
          :outline="preview.outline"
          :suggested-structure-start-index="preview.suggestedStructureStartIndex"
          :suggested-structure-end-index="preview.suggestedStructureEndIndex ?? null"
          :current-structure-start-index="shiftedStartIndex"
          :current-structure-end-index="preview.currentStructureEndIndex ?? null"
          @committed="$emit('committed', $event)"
          @cancel="$emit('close')"
      />
    </div>
  </div>
</template>

<script setup>
import UiHint from '../ui/atoms/UiHint.vue'
import UiNote from '../ui/molecules/UiNote.vue'
import ImportCalibration from '../import/ImportCalibration.vue'

defineProps({
  open: { type: Boolean, default: false },
  starting: { type: Boolean, default: false },
  recalError: { type: String, default: null },
  preview: { type: Object, default: null },
  shiftedStartIndex: { type: Number, default: null },
})

defineEmits(['close', 'committed'])
</script>

<style scoped>
/* Modale de recalibration.
   `z-index` AU-DESSUS de la doc-bar (99) : l'overlay doit la recouvrir, elle et
   son bouton « Relancer l'analyse » — un bouton d'analyse encore vif pendant
   qu'on reconstruit l'arbre du livre invite à une opération contradictoire.
   Le panneau, lui, reste calé SOUS la barre (padding-top), qui garde ainsi son
   fil d'Ariane lisible à travers le voile. */
.recal-modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Deux barres à dégager en haut (topbar + doc-bar), d'où le facteur 2. */
  padding: calc(var(--bar-size) * 2 + var(--sp-4)) var(--sp-4) var(--sp-4);
}

/* Voile CLAIR, pas un assombrissement : le panneau floute ce qu'il a derrière
   lui, donc un overlay noir se retrouvait mélangé dans sa propre teinte et
   salissait le blanc de la modale. Un blanc très dilué + un flou léger
   détachent l'arrière-plan sans le teindre. */
.recal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(2px);
}

/* Hauteur PLAFONNÉE, et pas seulement bornée au viewport : la calibration est
   une liste longue, un panneau à sa mesure remplissait tout l'écran et
   redevenait le plein écran qu'on venait de quitter. */
.recal-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(100%, 62em);
  /* `height` et non `max-height` : la liste étant posée en absolu dans son
     conteneur (cf. ImportCalibration), elle ne « pousse » plus le panneau — sans
     hauteur à distribuer, tout s'effondrait à quelques pixels. La modale a donc
     une taille de travail stable, que la liste soit longue ou courte. */
  height: min(100%, 34em);
  /* Le panneau ne peint AUCUN fond : il ne porte que le flou, le cadre et
     l'ombre. Ses deux sections (header, corps) posent chacune le leur, côte à
     côte. Un fond sur le panneau se serait ajouté au leur — deux couches
     translucides superposées, dont la teinte n'est plus celle qu'on a écrite.
     `overflow: hidden` fait suivre au fond des sections l'arrondi du cadre. */
  backdrop-filter: blur(10px);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

/* Reprend la signature exacte de la doc-bar (fond, encre, flou, filet) : c'est
   la même famille de surface. Les tokens `--c-doc-bar-*` sont posés par
   `base.css` sur `.doc-bar` via `[data-bar-theme]` — d'où leur reprise ici, avec
   le repli teal si aucun thème n'a été appliqué.
   Le padding négatif ramène la barre aux bords du panneau, dont le padding
   latéral vaut pour le contenu, pas pour elle. */
.recal-head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-4);
  /* Teinté (signature de la doc-bar), là où le corps est blanc : c'est ce
     contraste qui sépare le bandeau du contenu. Pas de `backdrop-filter` ici —
     le panneau floute déjà, un second flou n'ajouterait rien et empilerait une
     couche de plus. */
  background: var(--c-doc-bar-bck, rgba(142, 212, 225, 0.3));
  border-bottom: var(--c-doc-bar-border, 1px solid var(--c-accent-alt));
}

.recal-head h3 {
  margin: 0;
  font-size: var(--fs-md);
  font-weight: 600;
}

/* Pousse la croix à droite — le `?` doit rester collé au titre qu'il explique. */
.recal-close { margin-left: auto; }

.recal-close {
  border: 0;
  background: none;
  color: var(--c-ink2);
  font: inherit;
  cursor: pointer;
}

.recal-close:hover { color: var(--c-accent); }

/* Le CORPS : blanc translucide, distinct du bandeau teinté. C'est lui qui porte
   le padding du contenu (le panneau n'en a plus, sinon le bandeau ne pourrait
   pas aller d'un bord à l'autre). */
.recal-wait,
.recal-fail,
.recal-calibration {
  flex: 1 1 auto;
  min-height: 0;
  /* 0,45 et non 0,62 : au-delà, le corps composite à ~(254,251,245) sur le fond
     sable, soit un blanc que les lignes de titre (blanches, elles) ne peuvent
     plus quitter. En laissant passer davantage de sable, le fond se réchauffe
     et les lignes s'en détachent pour de bon. */
  background: rgba(255, 255, 255, 0.45);
  padding: var(--sp-4);
}

/* Attente et échec : centrés dans la place que prendra la calibration, pour que
   le panneau ne saute pas de composition quand elle arrive. */
.recal-wait,
.recal-fail {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}
</style>
