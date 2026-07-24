<template>
  <UiTable v-if="styles.length">
    <tbody>
      <tr v-for="(style, i) in styles" :key="style.name" :class="{ 'row--declared': style.declared }">
        <!-- Colonne d'ajout (à GAUCHE) : au survol de la ligne, un « + » dans la
             gouttière, centré sur la bordure avec la ligne suivante. Il ouvre un
             petit éditeur pour insérer un style déclaré JUSTE APRÈS cette ligne. -->
        <td v-if="canInsert" class="add-col">
          <button
              class="add-plus"
              :class="{ 'add-plus--open': openAfter === style.name }"
              title="Insérer un style ici"
              @click="togglePopover(style.name, $event)"
          >
            <i class="pi pi-plus" aria-hidden="true"></i>
          </button>
        </td>

        <td class="name-cell">
          <button
              v-if="openStyleEditor && !style.declared"
              class="edit-style"
              :class="{ 'edit-style--modified': isModified(style.name) }"
              :title="isModified(style.name) ? 'Apparence modifiée — éditer' : 'Éditer l\'apparence de ce style'"
              @click="openStyleEditor(style.name)"
          >
            <i class="pi pi-pencil" aria-hidden="true"></i>
            <span v-if="isModified(style.name)" class="edit-dot" aria-hidden="true"></span>
          </button>
          <span class="style-name" :class="{ 'style-name--declared': style.declared }">{{ style.name }}</span>
          <button
              v-if="style.declared && removeDeclaredStyle"
              class="remove-declared"
              title="Retirer ce style ajouté"
              @click="removeDeclaredStyle(style.name)"
          >
            <i class="pi pi-times" aria-hidden="true"></i>
          </button>
        </td>

        <!-- Colonne « succession » : entre style et rôle. Une puce chevauchant la
             bordure avec la ligne suivante = exiger que les deux styles voisins
             se succèdent toujours. Rien sous la dernière ligne (pas de suivant). -->
        <td v-if="showRequire" class="succ-col">
          <span v-if="i < styles.length - 1" class="succ-anchor">
            <SuccessionLink
                :active="isAdjacent(style.name, styles[i + 1].name)"
                :title="`Exiger que « ${style.name} » soit toujours suivi de « ${styles[i + 1].name} »`"
                @toggle="toggleAdjacency(depthKey, style.name, styles[i + 1].name)"
            />
          </span>
        </td>

        <td class="role-col">
          <BaseSelect v-model="styleRoles[style.name]">
            <option v-for="role in STYLE_ROLES" :key="role" :value="role">{{ role }}</option>
          </BaseSelect>
        </td>

        <!-- Colonne « exigé » : une case PAR STYLE, toujours accessible. Exiger un
             style, c'est exiger qu'au moins un paragraphe le porte au niveau. -->
        <td v-if="showRequire" class="require-col">
          <label class="require" :title="`Exiger un paragraphe « ${style.name} » à ce niveau`">
            <input
                type="checkbox"
                :checked="isRequired(style.name)"
                @change="toggleRequireStyle(depthKey, style.name)"
            />
            <span>exigé</span>
          </label>
        </td>

      </tr>
    </tbody>
  </UiTable>
  <p v-else class="empty">Aucun style situé ici.</p>

  <!-- Popover téléporté dans <body> : sinon l'overflow:hidden du conteneur
       scrollable d'UiTable le rognerait. Positionné en fixed sous le « + ». -->
  <Teleport to="body">
    <div v-if="openAfter" class="add-backdrop" @click="closePopover"></div>
    <div
        v-if="openAfter"
        class="add-popover"
        :style="{ top: `${popoverPos.top}px`, left: `${popoverPos.left}px` }"
        @click.stop
    >
      <input
          ref="nameInput"
          v-model="draftName"
          class="add-name"
          type="text"
          placeholder="nouveau style"
          @keydown.enter.prevent="confirmAdd"
          @keydown.esc="closePopover"
      />
      <div class="add-row">
        <BaseSelect v-model="draftRole">
          <option v-for="role in STYLE_ROLES" :key="role" :value="role">{{ role }}</option>
        </BaseSelect>
        <button class="add-go" title="Ajouter" :disabled="!draftName.trim()" @click="confirmAdd">
          <i class="pi pi-arrow-right" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, inject, nextTick, ref } from 'vue'
import BaseSelect from '../ui/atoms/BaseSelect.vue'
import SuccessionLink from '../ui/atoms/SuccessionLink.vue'
import UiTable from '../ui/molecules/UiTable.vue'
import { STYLE_ROLES } from '../../script/typology'

// `styleRoles` est muté en place (v-model sur `styleRoles[style.name]`) : c'est la
// map réactive de la typologie, détenue par le composable. Les styles arrivent
// déjà dans l'ordre d'apparition (cf. groupByZone / firstIndex), styles déclarés
// intercalés à leur place (`declared: true`).
const props = defineProps({
  styles: { type: Array, required: true },
  styleRoles: { type: Object, required: true },
  // Colonnes « exigé » + « succession » (niveaux de chapitrage seulement) : quand
  // true, `ruleSet` (jeu effectif du niveau) et `depthKey` doivent être fournis.
  showRequire: { type: Boolean, default: false },
  ruleSet: { type: Object, default: null },
  // Profondeur du niveau — passée aux mutations de règles pour viser son jeu.
  depthKey: { type: Number, default: null },
  // Zone de la table (clé de `zones.js`) — requise pour insérer un style déclaré
  // (il faut savoir dans quelle zone il tombe). Absente → pas de bouton « + ».
  zoneKey: { type: String, default: null },
})

// Ouvre le panneau d'édition d'apparence (fourni par ConfigView). Injecté plutôt
// que remonté par événement : la table est réutilisée dans TypologySection ET
// directement dans ConfigView (« Non situés »), un fil d'événements traverserait
// deux profondeurs pour la moitié des cas.
const openStyleEditor = inject('openStyleEditor', null)

// Surcharges d'apparence (réactif) : sert au badge « modifié ». Injecté, comme
// `openStyleEditor` — même raison (table réutilisée à deux profondeurs).
const styleOverrides = inject('styleOverrides', null)
function isModified(name) {
  return !!styleOverrides?.[name]
}

// Mutations des règles + styles déclarés, détenues par le composable et fournies
// par ConfigView (comme openStyleEditor). Appelées avec le `depthKey`/`zoneKey`
// de CETTE table ; jamais invoquées hors chapitrage (colonnes sous `showRequire`
// / `canInsert`).
const toggleRequireStyle = inject('toggleRequireStyle', null)
const toggleAdjacency = inject('toggleAdjacency', null)
const addDeclaredStyle = inject('addDeclaredStyle', null)
const removeDeclaredStyle = inject('removeDeclaredStyle', null)

function isRequired(name) {
  return !!props.ruleSet?.requiresStyles?.includes(name)
}
function isAdjacent(a, b) {
  return !!props.ruleSet?.requiresAdjacency?.some((p) => p[0] === a && p[1] === b)
}

// Insertion possible seulement si on connaît la zone ET qu'on sait ajouter.
const canInsert = computed(() => !!props.zoneKey && !!addDeclaredStyle)

// Popover d'ajout : le nom du style APRÈS lequel il est ouvert (null = fermé),
// et sa position écran (fixed, calculée depuis le « + » cliqué).
const openAfter = ref(null)
const popoverPos = ref({ top: 0, left: 0 })
const draftName = ref('')
const draftRole = ref('corps')
const nameInput = ref(null)

const POPOVER_W = 192 // 12rem

function togglePopover(afterName, ev) {
  if (openAfter.value === afterName) return closePopover()
  const r = ev.currentTarget.getBoundingClientRect()
  // Ouvre vers la droite depuis le « + » (à gauche), sans déborder l'écran.
  popoverPos.value = { top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - POPOVER_W - 8) }
  openAfter.value = afterName
  draftName.value = ''
  draftRole.value = 'corps'
  nextTick(() => nameInput.value?.focus?.())
}

function closePopover() {
  openAfter.value = null
}

function confirmAdd() {
  if (!openAfter.value || !draftName.value.trim()) return
  const ok = addDeclaredStyle({
    name: draftName.value,
    role: draftRole.value,
    zoneKey: props.zoneKey,
    afterName: openAfter.value,
  })
  if (ok) closePopover()
}
</script>

<style scoped>
/* La puce de succession et le « + » chevauchent les bordures de la table : le
   conteneur d'UiTable (overflow:hidden pour ses angles/scroll) les rognerait. On
   le rend visible — la table de config est courte, elle n'a pas besoin du cap de
   défilement (d'où le retrait de la prop `scroll`). */
:deep(.ui-table-scroll) {
  overflow: visible;
}

/* Plus d'anneau à GAUCHE : c'est là que le « + » déborde (centré sur la bordure
   gauche de la table), il lui faut de la place pour ne pas être rogné. `.ui-table-box`
   est la RACINE d'UiTable (elle porte notre `data-v`, donc pas de `:deep` — qui
   génère un descendant et ne l'atteindrait pas) ; classe doublée pour passer devant
   le `padding` d'UiTable.
   `fit-content` : la table se resserre sur son contenu au lieu de remplir la
   colonne (l'espace à droite reste libre pour un usage ultérieur). */
.ui-table-box.ui-table-box {
  width: fit-content;
  max-width: 100%;
}

/* La table se dimensionne sur son contenu (colonnes) et non sur le conteneur :
   `max-content` (et non `auto`, qui pour un <table> REMPLIT la largeur dispo). Le
   box en `fit-content` s'y ajuste, laissant l'espace à droite libre. `:deep` +
   classe doublée pour passer devant le `width:100%` d'UiTable. */
:deep(.ui-table.ui-table) {
  width: max-content;
}

/* Pas de sélection de texte dans le tableau : c'est une grille de contrôles, pas
   un contenu à copier. */
.name-cell,
.succ-col,
.role-col,
.require-col,
.add-col {
  user-select: none;
}

.edit-style {
  position: relative;
  border: none;
  background: transparent;
  color: var(--c-ink2);
  cursor: pointer;
  padding: 2px 4px;
  margin-right: var(--sp-1);
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
}
.edit-style:hover {
  color: var(--c-accent-alt-darker);
  background: color-mix(in srgb, var(--c-ink) 8%, transparent);
}

/* Style dont l'apparence a été surchargée : crayon teal + pastille. */
.edit-style--modified {
  color: var(--c-accent-alt);
}
.edit-dot {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--c-accent-alt);
}

.style-name {
  font-weight: 500;
}

/* Style déclaré à la main : nom en italique atténué, il ne vient pas du .odt. */
.style-name--declared {
  font-style: italic;
  color: var(--c-ink2);
}

.row--declared {
  background: color-mix(in srgb, var(--c-accent-alt) 5%, transparent);
}

.remove-declared {
  margin-left: var(--sp-2);
  border: none;
  background: transparent;
  color: var(--c-ink2);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: var(--radius-sm);
  font-size: var(--fs-xs);
}
.remove-declared:hover {
  color: var(--c-danger);
  background: color-mix(in srgb, var(--c-ink) 8%, transparent);
}

.role-col {
  width: 1%;
  white-space: nowrap;
}

/* Colonne étroite ; sa cellule ancre la puce, qui déborde sur la bordure. */
.succ-col {
  position: relative;
  width: 2.2rem;
  padding: 0;
}

/* La puce est centrée sur la bordure BASSE de la ligne (entre elle et la
   suivante) : ancrée en bas de la cellule, remontée de sa demi-hauteur. Le +0.5px
   recale la pointe sur le CENTRE du filet : en `border-collapse`, la bordure est
   peinte à cheval sur la ligne de grille (bas de cellule), pas à l'intérieur —
   sans lui, la pointe tombe un demi-pixel trop haut (mesuré). */
.succ-anchor {
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translate(-50%, calc(50% + 0.5px));
  z-index: 2;
}

.require-col {
  width: 1%;
  white-space: nowrap;
}

.require {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  font-size: var(--fs-sm);
  cursor: pointer;
}

/* Colonne d'ajout : gouttière de GAUCHE, la plus fine possible (juste de quoi
   loger la moitié interne du « + » sans mordre sur le nom). `padding:0` sur le td :
   la ligne commence au ras de la bordure gauche de la table, où le « + » s'ancre. */
.add-col.add-col {
  position: relative;
  width: 0.9rem;
  padding: 0;
}

/* Le « + » : masqué, révélé au survol de la ligne. Centré sur l'ANGLE bas-gauche
   de la ligne — intersection de la bordure basse (bordure avec la ligne suivante)
   et de la bordure gauche de la table (`left:0` = bord gauche de la 1re cellule).
   Sort de la cellule dans les deux axes → la table ne doit pas le rogner à gauche
   (cf. l'override d'overflow ci-dessous). */
.add-plus {
  position: absolute;
  left: 0;
  bottom: 0;
  transform: translate(-50%, 50%);
  z-index: 3;
  display: grid;
  place-items: center;
  width: 1.15rem;
  height: 1.15rem;
  padding: 0;
  border: 1px solid var(--c-border);
  border-radius: 50%;
  background: var(--c-paper);
  color: var(--c-ink2);
  font-size: 0.6rem;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}
tr:hover .add-plus,
.add-plus--open {
  opacity: 1;
}
.add-plus:hover,
.add-plus--open {
  color: var(--c-accent-alt);
  border-color: var(--c-accent-alt);
}

/* Le petit éditeur d'insertion, téléporté dans <body>, fixed sous le « + ». */
.add-popover {
  position: fixed;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  width: 12rem;
  padding: var(--sp-2);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-surface);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
}

.add-name {
  width: 100%;
  padding: 0.3em 0.5em;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-paper);
  color: inherit;
  font: inherit;
  font-size: var(--fs-sm);
}

.add-row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.add-row :deep(select) {
  flex: 1 1 auto;
}

.add-go {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 1.7rem;
  height: 1.7rem;
  border: none;
  border-radius: var(--radius-md);
  background: var(--c-accent-alt);
  color: #fff;
  cursor: pointer;
}
.add-go:disabled {
  opacity: var(--op-faint);
  cursor: not-allowed;
}

/* Voile de clic-away : couvre l'écran sous le popover, invisible. */
.add-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10;
}

.empty {
  margin: var(--sp-2) 0 0;
  color: var(--c-ink2);
  font-size: var(--fs-md);
}
</style>
