<template>
  <div class="calibration calibration--boxed">
    <!-- Titre et mode d'emploi sont portés par la modale hôte (`UiModal`) : la
         calibration vit TOUJOURS en modale désormais (import comme recalibrage),
         elle n'a plus d'en-tête propre. -->

    <!-- La liste défile dans la scrollbar maison (teal + flèches), comme partout
         ailleurs dans l'app ; le pied (Annuler / Valider) reste sous la main. -->
    <div class="outline-wrap">
    <CustomScrollbar class="outline">
      <template v-for="item in topLevelItems" :key="item.entry.index">
        <div
            class="divider"
            :class="{
              'divider--marked': item.entry.index === structureStartIndex || item.entry.index === structureEndIndex,
            }"
        >
          <div class="divider-handles">
            <button
                v-if="item.entry.index <= (structureEndIndex ?? Infinity)"
                class="divider-handle"
                :class="{ 'divider-handle--active': item.entry.index === structureStartIndex }"
                type="button"
                @click="structureStartIndex = item.entry.index"
            >
              Début du contenu
            </button>
            <button
                v-if="item.entry.index > structureStartIndex"
                class="divider-handle"
                :class="{ 'divider-handle--active': item.entry.index === structureEndIndex }"
                type="button"
                @click="toggleEnd(item.entry.index)"
            >
              {{ item.entry.index === structureEndIndex ? 'Partie finale ✕' : 'Partie finale' }}
            </button>
          </div>
        </div>

        <CalibrationNode v-if="item.type === 'node'" :node="item.node" @level-change="onLevelChange" />
        <div v-else class="matter-row">{{ item.entry.text }}</div>
      </template>
    </CustomScrollbar>
    </div>

    <div class="calibration-footer">
      <UiNote v-if="error" variant="error" class="footer-error">{{ error }}</UiNote>
      <BaseButton variant="outline" @click="$emit('cancel')">Annuler</BaseButton>
      <!-- L'avertissement ne s'affiche QUE si les bornes ont bougé : rouvrir la
           calibration puis la valider à l'identique reconstruit certes l'arbre,
           mais retrouve les mêmes nœuds — brandir « vos analyses seront à
           relancer » à chaque ouverture aurait usé la mise en garde.
           `component :is` plutôt qu'un `v-if` en double : le bouton s'écrit une
           fois, seule son enveloppe change. -->
      <component :is="bornesChanged ? UiHint : 'span'" v-bind="bornesChanged ? { text: BORNES_WARNING } : {}">
        <BaseButton variant="solid" :busy="committing" @click="onCommit">
          {{ commitLabel }}
        </BaseButton>
      </component>
    </div>
  </div>
</template>

<script setup>
import BaseButton from '../ui/atoms/BaseButton.vue'
import UiHint from '../ui/atoms/UiHint.vue'
import UiNote from '../ui/molecules/UiNote.vue'
import CalibrationNode from './CalibrationNode.vue'
import CustomScrollbar from '../ui/atoms/CustomScrollbar.vue'
import { useCalibration } from '../../composables/useCalibration'

const props = defineProps({
  previewId: { type: String, required: true },
  outline: { type: Array, required: true },
  suggestedStructureStartIndex: { type: Number, required: true },
  // Absent = le backend n'a rien trouvé de probant. Pas d'erreur : le livre
  // n'a alors pas de partie finale tant que l'utilisateur n'en pose pas une.
  suggestedStructureEndIndex: { type: Number, default: null },
  // Les bornes DÉJÀ validées pour ce document (recalibration). Elles priment
  // sur les suggestions : rouvrir la calibration sur une suggestion ferait
  // repartir l'utilisateur du réglage qu'il avait justement corrigé. Nulles à
  // l'import, et pour un document antérieur à ces colonnes.
  currentStructureStartIndex: { type: Number, default: null },
  currentStructureEndIndex: { type: Number, default: null },
  // Le flux est le même des deux côtés — c'est le previewId qui sait s'il
  // s'agit d'un remplacement (cf. `backend/CLAUDE.md`). Seuls les mots
  // changent : on ne « valide pas un import » quand on refait celui d'hier.
  mode: { type: String, default: 'import', validator: (v) => ['import', 'recalibration'].includes(v) },
})

const emit = defineEmits(['committed', 'cancel'])

const BORNES_WARNING =
    "La calibration a changé (bornes ou niveaux) : l'arbre du livre est reconstruit, les analyses seront à relancer."

const {
  structureStartIndex, structureEndIndex, committing, error,
  commitLabel, bornesChanged, topLevelItems,
  toggleEnd, onLevelChange, onCommit,
} = useCalibration(props, emit)
</script>

<style scoped>
.calibration {
  padding: 1.5em;
  max-width: 80ch;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* Mode RECALIBRAGE seulement : là, le composant vit dans une modale à hauteur
   plafonnée, et c'est sa LISTE qui doit défiler pour que le pied (Annuler /
   Valider) reste toujours sous la main.
   Ce mode déroge à la règle « pas de hauteur propre » qui vaut sur /import, où
   la calibration défile avec la page — lui en donner une là-bas remettrait la
   scrollbar imbriquée que le design system proscrit. La dérogation est donc
   bornée au mode, pas généralisée. */
/* PAS de `height: 100%` ici : la calibration est un item flex du panneau, et
   une hauteur en pourcentage l'empêchait de se comprimer — elle prenait la
   taille de sa liste et faisait déborder la modale. On la laisse flexer
   (`.recal-calibration` côté hôte), on ne fait qu'ôter ses marges d'écran. */
.calibration--boxed {
  padding: 0;
  max-width: none;
  /* Remplit le corps de la modale (item flex) et se comprime : sa LISTE défile,
     son pied reste sous la main. Sans `flex-grow`, elle reprenait la hauteur de
     sa liste et débordait la modale. */
  flex: 1 1 auto;
}

/* Le conteneur flexe, la scrollbar s'y pose en ABSOLU. Ce n'est pas un détour :
   `CustomScrollbar` se dimensionne en `height: 100%` (elle et son contenu
   interne), or un pourcentage ne se résout pas contre une hauteur obtenue par
   `flex-grow` sur l'axe principal — elle retombait sur `auto` et reprenait la
   hauteur de la liste (722 px pour 420 disponibles), sans jamais rien avoir à
   faire défiler. En absolu, le conteneur positionné lui donne enfin une
   hauteur définie.
   (`DocumentLayout` n'a pas ce souci : sa scrollbar est un item flex en
   direction RANGÉE, dont la hauteur est un `stretch` de l'axe transverse — et
   celle-là est bien définie.) */
.calibration--boxed .outline-wrap {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
}

/* La CustomScrollbar porte elle-même le défilement : pas d'`overflow-y` ici,
   qui en ferait une seconde. */
.calibration--boxed .outline {
  position: absolute;
  inset: 0;
  flex: none;
}

/* Gouttière à droite du texte : la largeur de la track (12 px, cf. `TRACK` dans
   CustomScrollbar) PLUS le même retrait que celui qui sépare la track du bord de
   la modale. Sans elle, les titres venaient toucher le rail. */
.calibration--boxed .outline :deep(.custom-scrollbar__content) {
  padding-right: calc(12px + var(--sp-4));
}

.calibration--boxed .calibration-footer {
  flex: 0 0 auto;
  border-top: 1px solid var(--c-border);
  padding-top: var(--sp-3);
}

/* Pas d'`overflow-y: auto` ni de `max-height` ici : la liste défile dans la
   CustomScrollbar qui la porte (mode boxed). Une hauteur propre y ajouterait
   une seconde barre imbriquée, proscrite par le DS. */
.outline {
  flex: 1 1 auto;
  padding: 0.25em;
}

/* Les lignes de titre portent `--c-surface4` (blanc à 20 %), pensé pour se
   poser sur le fond sable de l'application. Dans la modale, dont le corps est
   déjà blanc translucide, ce blanc-sur-blanc ne détachait plus rien : les
   niveaux se confondaient avec le fond. On leur donne ici une surface franche
   et un filet — c'est la lisibilité de la hiérarchie qui est en jeu. */
.outline :deep(.tree-row--card) {
  background: var(--c-surface0);
  border: 1px solid var(--c-border);
  border-left-width: 4px;
}

.outline :deep(.tree-row--card:hover) {
  border-color: var(--c-accent-alt);
  filter: none;
}

/* Liminaire et final : hors structure, donc en retrait — ils se lisent pour se
   repérer, ils ne se calibrent pas. */
.matter-row {
  padding: 0.5em 1em;
  margin-bottom: 0.35em;
  opacity: 0.4;
  font-size: 0.9em;
}

.divider {
  height: 0.6em;
  margin: 0.1em 0;
  position: relative;
  display: flex;
  align-items: center;
}

.divider::before {
  content: '';
  flex: 1 1 auto;
  height: 1px;
  background: var(--c-border, #e0d8cc);
  opacity: 0;
  transition: opacity 0.1s ease;
}

.divider:hover::before {
  opacity: 1;
}

.divider-handles {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.35em;
}

.divider-handle {
  font: inherit;
  font-size: 0.7em;
  padding: 0.1em 0.6em;
  border: 0;
  border-radius: 1em;
  background: var(--c-accent);
  color: white;
  white-space: nowrap;
  cursor: pointer;
  /* Invisibles au repos : deux pastilles devant chaque titre, ce serait une
     guirlande. Elles n'apparaissent qu'au survol de LEUR démarcation, ou si
     elles portent une borne posée. */
  opacity: 0;
  transition: opacity 0.1s ease;
}

.divider:hover .divider-handle {
  opacity: 0.6;
}

.divider--marked::before {
  opacity: 1;
  height: 2px;
  background: var(--c-accent);
}

.divider-handle--active,
.divider:hover .divider-handle--active {
  opacity: 1;
}

.calibration-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75em;
  margin-top: 1em;
}

.footer-error {
  /* pousse le callout d'échec à gauche du footer ; le chrome (fond/bordure/
     padding) vient de UiCallout */
  margin-right: auto;
}
</style>
