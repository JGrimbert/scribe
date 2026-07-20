<template>
  <!-- Les vis-à-vis se chevauchent en profondeur, seul celui qui a le focus est
       à pleine taille (les autres à 0.75 → un tiers plus petit). Navigation SOUS
       la scène uniquement (flèches + pastilles), puis une réglette qui situe le
       vis-à-vis dans le liminaire.
       Le DERNIER cran n'est pas un vis-à-vis mais l'action d'étendre le
       liminaire — d'où `slideCount = spreads + 1` dans toute la mécanique. -->
  <div class="accordeon">
    <div class="acc-stage">
      <div class="acc-backdrop" aria-hidden="true"></div>
      <div
          v-for="(spread, si) in spreads"
          :key="si"
          class="acc-spread"
          :class="{ 'is-focused': si === focused }"
          :style="accStyle(si)"
          @click="$emit('update:focused', si)"
      >
        <!-- La mention ne coiffe QUE le vis-à-vis au premier plan, chaque mot
             centré sur sa page. Hors flux (bottom: 100%) : elle ne pousse pas
             les folios, sinon le focus se décalerait des autres. -->
        <div v-if="si === focused" class="acc-legend" aria-hidden="true">
          <span>Verso</span><span>Recto</span>
        </div>
        <div class="spread">
          <div
              v-for="(cell, ci) in [spread.left, spread.right]"
              :key="ci"
              class="folio-slot"
              :class="ci === 0 ? 'is-left' : 'is-right'"
          >
            <LiminaireFolio
                :cell="cell"
                :type="typeOfCell(cell)"
                :suggestion="suggestionOfCell(cell)"
            />
          </div>
        </div>

        <!-- Le DERNIER vis-à-vis borne le liminaire : c'est lui, et lui seul,
             qu'on peut rendre au corps du livre. Hors flux (top: 100%) pour la
             même raison que la mention Verso/Recto. -->
        <div v-if="si === focused && si === spreads.length - 1" class="acc-spread-action">
          <button
              type="button"
              class="lim-border-btn"
              :disabled="!borderShift"
              :title="borderShift
                ? 'Rendre le dernier chapitre absorbé au corps du livre'
                : 'Le liminaire d’origine s’arrête avant le premier titre : aucune borne ne peut le raccourcir'"
              @click.stop="$emit('exclude')"
          >
            <i class="pi pi-arrow-up-right"></i>
            Exclure du liminaire
          </button>
        </div>
      </div>

      <!-- Cran terminal : pas un vis-à-vis, une action. Style franchement
           distinct (pas de folios, un cadre en pointillés) pour qu'on ne le
           compte pas comme une page du livre. -->
      <div
          class="acc-spread acc-spread--extend"
          :class="{ 'is-focused': focused === spreads.length }"
          :style="accStyle(spreads.length)"
          @click="$emit('update:focused', spreads.length)"
      >
        <div class="extend-card">
          <i class="pi pi-plus-circle"></i>
          <p class="extend-lead">Le liminaire s'arrête ici.</p>

          <button
              type="button"
              class="lim-border-btn"
              :disabled="!canExtend"
              :title="canExtend ? `Absorber « ${nextTitle} » dans le liminaire` : 'Plus aucun chapitre à absorber'"
              @click.stop="$emit('extend')"
          >
            <i class="pi pi-arrow-down-left"></i>
            Étendre le liminaire
          </button>
          <!-- Annoncer CE qu'on absorbe : sans le titre, l'action est un saut
               dans le noir. -->
          <p v-if="canExtend" class="extend-note">Prochain : « {{ nextTitle }} »</p>

          <button
              type="button"
              class="lim-border-btn lim-border-btn--ghost"
              :disabled="!recalibratable || starting"
              @click.stop="$emit('redefine')"
          >
            Redéfinir les bornes…
          </button>

          <p v-if="!recalibratable" class="extend-note">
            Document importé avant que le <code>.odt</code> ne soit conservé : seul un réimport
            rattache son fichier d'origine.
          </p>
          <p v-else-if="recalError" class="extend-note extend-note--error">{{ recalError }}</p>
        </div>
      </div>
    </div>

    <!-- La réglette AU-DESSUS de la zone d'inputs : elle ferme la scène, et
         c'est elle qui coupe le halo radial (centré juste dessous). -->
    <div class="acc-rail" title="Situation dans le liminaire" @click="scrubTo">
      <div class="acc-rail-thumb" :style="railThumbStyle"></div>
    </div>

    <!-- Entre les flèches : le(s) type(s) du vis-à-vis au premier plan. Un
         vis-à-vis peut porter DEUX pages taguables (mentions | dédicace). -->
    <div class="acc-nav">
      <button type="button" class="acc-arrow" title="Vis-à-vis précédent" :disabled="focused === 0" @click="$emit('update:focused', focused - 1)">
        <i class="pi pi-chevron-left"></i>
      </button>

      <div class="acc-controls">
        <div v-for="ctl in focusedControls" :key="ctl.side" class="acc-control">
          <!-- Slot inerte (blanche / couverture) : même gabarit, même liseré,
               pour que la barre garde exactement la même largeur. -->
          <span v-if="ctl.kind === 'inert'" class="acc-inert">{{ ctl.label }}</span>
          <BaseSelect
              v-else
              class="acc-select"
              :class="{ 'has-suggestion': ctl.pending }"
              :title="ctl.pending ? ctl.pending.why : ''"
              :model-value="ctl.type"
              @update:model-value="$emit('set-type', ctl.page, $event)"
          >
            <!-- UNE SEULE ligne porte la suggestion : la ligne courante (le
                 placeholder), lisible au repos. La liste ne la répète pas — le
                 type y garde son libellé nu, seulement mis en couleur pour
                 qu'on voie où cliquer pour l'appliquer. -->
            <option value="">{{ ctl.pending ? `⚡ ${labelOf(ctl.pending.key)} ?` : '— type —' }}</option>
            <option
                v-for="t in LIMINAIRE_PAGES"
                :key="t.key"
                :value="t.key"
                :class="{ 'opt-suggest': ctl.pending && ctl.pending.key === t.key }"
            >{{ t.label }}</option>
          </BaseSelect>
        </div>
      </div>

      <button type="button" class="acc-arrow" title="Vis-à-vis suivant" :disabled="focused >= spreads.length" @click="$emit('update:focused', focused + 1)">
        <i class="pi pi-chevron-right"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import BaseSelect from '../ui/BaseSelect.vue'
import LiminaireFolio from '../LiminaireFolio.vue'
import { LIMINAIRE_PAGES, LIMINAIRE_BY_KEY } from '../../script/liminaire'

const props = defineProps({
  // Les vis-à-vis d'imposition (cf. toSpreads). Purement présentationnel : les
  // types et suggestions arrivent résolus, ce composant ne lit pas la config.
  spreads: { type: Array, required: true },
  focused: { type: Number, required: true },
  // page.key → type posé, et page.key → suggestion en attente.
  types: { type: Object, required: true },
  suggestions: { type: Object, required: true },
  recalibratable: { type: Boolean, default: true },
  starting: { type: Boolean, default: false },
  recalError: { type: String, default: null },
  borderShift: { type: Number, default: 0 },
  canExtend: { type: Boolean, default: true },
  nextTitle: { type: String, default: null },
})

const emit = defineEmits(['update:focused', 'set-type', 'extend', 'exclude', 'redefine'])

function typeOfCell(cell) {
  return cell?.page ? (props.types[cell.page.key] ?? '') : ''
}

function suggestionOfCell(cell) {
  return cell?.page ? (props.suggestions[cell.page.key] ?? null) : null
}

// Le cran terminal (l'action d'étendre) compte comme une position : les
// vis-à-vis occupent 0..n-1, l'action n.
const slideCount = computed(() => props.spreads.length + 1)

// Les crans s'ÉTALENT sur toute la largeur : le i-ème est ancré à i/(n-1) de la
// largeur et retranché d'autant de sa propre largeur — le premier colle à
// gauche, le dernier à droite, les autres s'égrènent entre les deux. Le
// chevauchement naît de ce que la largeur d'un vis-à-vis excède son pas.
// Aucun recentrage sur le focus : sélectionner ne déplace rien, ça ZOOME sur
// place (origine centrale). Aucune opacité non plus — les pages restent
// pleines, seule l'échelle et la profondeur les distinguent.
// Chaque cran d'éloignement DESCEND le vis-à-vis : l'escalier sépare des pages
// qui, alignées, se confondraient sous le chevauchement.
const ACC_DROP = 11

function accStyle(i) {
  const n = slideCount.value
  const t = n > 1 ? i / (n - 1) : 0.5
  const dist = Math.abs(i - props.focused)
  const scale = i === props.focused ? 1 : 0.75
  return {
    left: `${t * 100}%`,
    transform: `translateX(-${t * 100}%) translateY(${dist * ACC_DROP}px) scale(${scale})`,
    zIndex: String(n - dist),
  }
}

// Les pages taguables du vis-à-vis au premier plan — jusqu'à DEUX (le verso et
// le recto peuvent porter chacun un type : mentions | dédicace).
// TOUJOURS deux entrées (verso puis recto), même quand une seule est taguable :
// une page blanche ou la couverture rend un bloc inerte de même gabarit. Sans
// lui, la barre se rétrécirait et LES FLÈCHES BOUGERAIENT d'un vis-à-vis à
// l'autre — le flux doit rester absolument fixe.
const focusedControls = computed(() => {
  // Cran terminal : rien à taguer, mais un slot inerte quand même — un
  // conteneur vide rétrécirait la barre et déplacerait les flèches.
  if (props.focused === props.spreads.length) {
    return [{ side: 'extend', kind: 'inert', label: 'Fin du liminaire' }]
  }
  const sp = props.spreads[props.focused]
  if (!sp) return []
  return [
    { cell: sp.left, side: 'verso' },
    { cell: sp.right, side: 'recto' },
  ].map(({ cell, side }) => {
    if (!cell || cell.cover) return { side, kind: 'inert', label: 'Page de garde' }
    if (cell.blank) return { side, kind: 'inert', label: 'Page blanche' }
    const type = typeOfCell(cell)
    return {
      side,
      kind: 'page',
      key: cell.page.key,
      page: cell.page,
      type,
      // `pending` = une suggestion NON encore décidée. Un type déjà posé
      // referme la question : le select redevient un select ordinaire.
      pending: type ? null : suggestionOfCell(cell),
    }
  })
})

// Réglette : le pouce occupe 1/N et se place sur le cran courant — il
// matérialise « où on en est » dans le liminaire, sans être un vrai scroll.
const railThumbStyle = computed(() => {
  const n = slideCount.value
  return { width: `${100 / n}%`, left: `${(props.focused / n) * 100}%` }
})

function scrubTo(event) {
  const rail = event.currentTarget
  const ratio = (event.clientX - rail.getBoundingClientRect().left) / rail.clientWidth
  const n = slideCount.value
  emit('update:focused', Math.min(n - 1, Math.max(0, Math.floor(ratio * n))))
}

function labelOf(key) {
  return LIMINAIRE_BY_KEY.get(key)?.label ?? key
}
</script>

<style scoped>
/* Une planche = un livre ouvert : deux folios se rejoignant au centre. */
.spread {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  width: min(100%, 30em);
}

.folio-slot {
  display: flex;
}

.folio-slot.is-left { justify-content: flex-end; }
.folio-slot.is-right { justify-content: flex-start; }

/* La reliure : le bord intérieur (droite du verso, gauche du recto) plus
   marqué. Le folio est la racine d'un composant enfant → :deep(). */
.is-left :deep(.folio) { border-right-width: 2px; border-top-right-radius: 0; border-bottom-right-radius: 0; }
.is-right :deep(.folio) { border-left-width: 2px; border-top-left-radius: 0; border-bottom-left-radius: 0; }

.accordeon {
  display: flex;
  flex-direction: column;
}

.acc-stage {
  position: relative;
  /* Calée sur la hauteur du vis-à-vis au focus (le plus haut) PLUS la rangée
     d'action que le dernier vis-à-vis pose sous lui : `overflow: hidden` coupe
     net ce qui dépasse, et le bouton « Exclure » y laissait sa moitié basse.
     Le vide résiduel sur les autres crans est le prix d'une scène qui ne saute
     pas de hauteur au changement de focus. */
  height: 22em;
  /* Coupe le halo net sur le bas de la scène — c'est-à-dire pile sur la
     réglette. */
  overflow: hidden;
}

/* Profondeur SANS gris : une ellipse TEINTÉE (accent), centrée sous la scène,
   qui monte derrière les pages et que la réglette tranche net.
   `saturate()` seul ne suffisait pas — sur un fond quasi neutre il n'a rien à
   amplifier, d'où l'effet quasi invisible. C'est la teinte qui porte l'effet,
   le filtre ne fait que la densifier. */
.acc-backdrop {
  position: absolute;
  inset: 0;
  background: radial-gradient(
      ellipse 75% 25% at 50% 100%,
      color-mix(in srgb, var(--c-accent-alt-darker) 1%, transparent),
      color-mix(in srgb, var(--c-accent-alt-darker) 1%, transparent) 45%,
      transparent 72%
  );
  pointer-events: none;
}

.acc-spread {
  position: absolute;
  /* Laisse juste la place à la mention Verso/Recto, posée hors flux au-dessus. */
  top: 1.7em;
  /* Plafonné à la largeur de la scène : à 26em fixes, une colonne étroite (main
     du split sur petit écran) faisait couper le vis-à-vis au premier plan par
     l'`overflow: hidden` de la scène. */
  width: min(26em, 100%);
  cursor: pointer;
  /* Compositor-only. `left` ne dépend que du rang, seul `transform` est animé. */
  transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.acc-spread.is-focused {
  cursor: default;
  /* Ombre courte et pâle : elle doit décoller la page, pas la souligner — et
     rester dans la scène, qui la couperait si elle portait loin. */
  filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.12));
}

/* ZÉRO transparence sur le vis-à-vis au premier plan : c'est du papier, il doit
   être franc. Les atténuations (numéro de folio, type non posé) laissaient
   l'ellipse transparaître au travers et le délavaient.
   La trame oblique des blanches/gardes est exclue de la règle : c'est elle qui
   les distingue d'une page pleine, la rendre opaque les banaliserait. */
.acc-spread.is-focused :deep(.folio:not(.folio--blank):not(.folio--cover)),
.acc-spread.is-focused :deep(.folio:not(.folio--blank):not(.folio--cover) *) {
  opacity: 1;
}

/* Mention Verso | Recto : mêmes colonnes que .spread, donc chaque mot tombe
   centré sur SA page. Hors flux pour ne pas décaler les folios. */
.acc-legend {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  margin-bottom: var(--sp-1);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  text-align: center;
  font-size: var(--fs-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  /* Sourde par la COULEUR, pas par l'opacité : rien ne doit être translucide
     sur le vis-à-vis au premier plan. */
  color: var(--c-ink2);
}

/* Action du dernier vis-à-vis, hors flux SOUS lui (même raison que la mention
   Verso/Recto : elle ne doit pas décaler les folios). */
.acc-spread-action {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: var(--sp-2);
  display: flex;
  justify-content: center;
}

/* Le cran terminal : une carte d'action, pas une page. Pointillés et fond
   effacé — rien ici ne doit se lire comme du papier. */
.acc-spread--extend .extend-card {
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

.acc-spread--extend .pi-plus-circle {
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

/* Les deux actions de borne partagent leur signature : ce sont les deux faces
   d'un même geste (déplacer la fin du liminaire). */
.lim-border-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-surface);
  color: var(--c-ink2);
  font: inherit;
  font-size: var(--fs-sm);
  padding: 0.35em 0.9em;
  cursor: pointer;
}

.lim-border-btn:hover:not(:disabled) {
  border-color: var(--c-accent);
  color: var(--c-accent);
}

.lim-border-btn:disabled {
  opacity: var(--op-faint);
  cursor: default;
}

/* Action secondaire du même bloc : elle ouvre la modale (donc engage un
   recalibrage), là où « Étendre » ne fait qu'un aperçu. Moins appuyée. */
.lim-border-btn--ghost {
  border-color: transparent;
  background: none;
  font-size: var(--fs-xs);
  text-decoration: underline;
}

/* Réglette de situation : où l'on est dans le liminaire. Pas un vrai scroll —
   la navigation est par vis-à-vis, pas au pixel. Elle sépare la scène des
   contrôles, et borne le halo. */
.acc-rail {
  position: relative;
  height: 6px;
  border-radius: 3px;
  background: var(--c-border);
  cursor: pointer;
  margin-bottom: var(--sp-4);
}

.acc-rail-thumb {
  position: absolute;
  top: 0;
  height: 100%;
  min-width: 12px;
  border-radius: 3px;
  background: var(--c-accent);
  transition: left 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
}

/* Zone d'inputs, SOUS la réglette : flèche · type(s) · flèche. */
.acc-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-3);
}

.acc-arrow {
  flex: 0 0 auto;
  width: 2em;
  height: 2em;
  border: 1px solid var(--c-border);
  border-radius: 50%;
  background: var(--c-surface);
  color: var(--c-ink2);
  font: inherit;
  cursor: pointer;
}

.acc-arrow:hover:not(:disabled) { border-color: var(--c-accent); color: var(--c-accent); }
.acc-arrow:disabled { opacity: var(--op-faint); cursor: default; }

/* Largeur FIXE, pas dérivée du contenu : un cran qui porte un seul slot (ou
   aucun) rétrécirait la barre et FERAIT BOUGER LES FLÈCHES d'un cran à l'autre.
   Le flux doit rester absolument fixe. */
.acc-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
  min-height: 2em;
  width: calc(26em + var(--sp-3));
}

/* Gabarit FIXE : les deux slots font la même largeur quoi qu'ils contiennent,
   donc les flèches ne bougent jamais d'un vis-à-vis à l'autre. */
.acc-control {
  flex: 0 0 13em;
  display: flex;
}

.acc-select { width: 100%; }

/* Slot inerte : le liseré du select à l'identique (mêmes padding, bordure,
   rayon, taille) — mais discontinu et sourd, pour dire « rien à décider ici ». */
.acc-inert {
  width: 100%;
  padding: 0.35em 0.5em;
  border: 1px dashed var(--c-border);
  border-radius: var(--radius-md);
  background: none;
  font-size: var(--fs-md);
  font-style: italic;
  color: var(--c-ink2);
  opacity: var(--op-muted);
  text-align: center;
}

/* Un type encore SUGGÉRÉ (non décidé) : le select reprend la signature de
   l'indice — trait discontinu et teinte d'accent — pour qu'on lise « proposé »
   et non « choisi ». La 1re ligne du menu applique la suggestion. */
.acc-select.has-suggestion {
  border-style: dashed;
  border-color: var(--c-accent);
  color: var(--c-accent);
}

.acc-select .opt-suggest {
  color: var(--c-accent);
  font-weight: 600;
}
</style>
