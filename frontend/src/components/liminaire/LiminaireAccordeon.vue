<template>
  <!-- Les vis-à-vis se chevauchent en profondeur, seul celui qui a le focus est
       à pleine taille (les autres à 0.75 → un tiers plus petit). Navigation SOUS
       la scène uniquement (flèches + pastilles), puis une réglette qui situe le
       vis-à-vis dans le liminaire.
       Le DERNIER cran n'est pas un vis-à-vis mais l'action d'étendre le
       liminaire — d'où `slideCount = spreads + 1` dans toute la mécanique. -->
  <div class="accordeon">
    <div class="acc-stage" @wheel.prevent="onWheel">
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
    <!-- La réglette EST la barre de défilement du liminaire : elle en reprend
         la facture complète, triangles de bout compris. -->
    <div class="acc-rail" title="Situation dans le liminaire">
      <button
          type="button"
          class="acc-rail-arrow acc-rail-arrow--left"
          title="Vis-à-vis précédent"
          :disabled="focused === 0"
          @click.stop="$emit('update:focused', focused - 1)"
      ></button>
      <div class="acc-rail-track" @click="scrubTo">
        <div class="acc-rail-thumb" :style="railThumbStyle"></div>
      </div>
      <button
          type="button"
          class="acc-rail-arrow acc-rail-arrow--right"
          title="Vis-à-vis suivant"
          :disabled="focused >= spreads.length"
          @click.stop="$emit('update:focused', focused + 1)"
      ></button>
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
          <!-- Le côté se pose CONTRE le type qui le conditionne : la convention
               du type propose un côté, ce bouton l'arbitre. Cyclable plutôt que
               déroulant — trois valeurs, c'est un geste, pas une liste. Il vit
               DANS le slot du type pour que la largeur du bloc ne change pas :
               un contrôle de plus ferait bouger les flèches. -->
          <button
              v-if="ctl.kind === 'page'"
              type="button"
              class="acc-side"
              :class="{ 'is-conflict': ctl.conflict, 'is-auto': ctl.chosenSide === 'auto' }"
              :title="sideTitle(ctl)"
              @click.stop="cycleSide(ctl)"
          >{{ SIDE_MARKS[ctl.chosenSide] }}</button>
          <BaseSelect
              v-if="ctl.kind === 'page'"
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
import { computed, watch } from 'vue'
import BaseSelect from '../ui/BaseSelect.vue'
import LiminaireFolio from '../LiminaireFolio.vue'
import { LIMINAIRE_PAGES, LIMINAIRE_BY_KEY, PAGE_SIDES } from '../../script/liminaire'

const props = defineProps({
  // Les vis-à-vis d'imposition (cf. toSpreads). Purement présentationnel : les
  // types et suggestions arrivent résolus, ce composant ne lit pas la config.
  spreads: { type: Array, required: true },
  focused: { type: Number, required: true },
  // page.key → type posé, et page.key → suggestion en attente.
  types: { type: Object, required: true },
  suggestions: { type: Object, required: true },
  // page.key → côté choisi ('auto'|'recto'|'verso'), côté attendu par la
  // convention du type (ou null), et conflit entre les deux. Résolus par le
  // composer : ce composant ne lit pas la config.
  sides: { type: Object, default: () => ({}) },
  expectedSides: { type: Object, default: () => ({}) },
  conflicts: { type: Object, default: () => ({}) },
  recalibratable: { type: Boolean, default: true },
  starting: { type: Boolean, default: false },
  recalError: { type: String, default: null },
  borderShift: { type: Number, default: 0 },
  canExtend: { type: Boolean, default: true },
  nextTitle: { type: String, default: null },
})

const emit = defineEmits(['update:focused', 'set-type', 'set-side', 'extend', 'exclude', 'redefine'])

// Marques d'un caractère : le bouton doit tenir dans le slot du type sans le
// rogner. « · » = auto (personne n'a tranché), R/V = imposé à la main.
const SIDE_MARKS = { auto: '·', recto: 'R', verso: 'V' }

function cycleSide(ctl) {
  const next = PAGE_SIDES[(PAGE_SIDES.indexOf(ctl.chosenSide) + 1) % PAGE_SIDES.length]
  emit('set-side', ctl.page, next)
}

function sideTitle(ctl) {
  const pose = ctl.chosenSide === 'auto' ? 'Côté libre' : `Forcé en ${ctl.chosenSide}`
  if (ctl.conflict) return `${pose} — mais le type appelle un ${ctl.expected}`
  if (ctl.expected) return `${pose} · le type appelle un ${ctl.expected}`
  return `${pose} (cliquer pour changer)`
}

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

// Au-delà de ce rang, l'atténuation ne se creuse plus : sans plafond, les crans
// lointains d'un long liminaire finiraient délavés jusqu'à l'illisible.
const ACC_DIM_MAX = 3

function accStyle(i) {
  const n = slideCount.value
  const t = n > 1 ? i / (n - 1) : 0.5
  const dist = Math.abs(i - props.focused)
  const scale = i === props.focused ? 1 : 0.75
  return {
    left: `${t * 100}%`,
    transform: `translateX(-${t * 100}%) translateY(${dist * ACC_DROP}px) scale(${scale})`,
    zIndex: String(n - dist),
    // Consommé par le CSS (teinte + ombre) : l'éloignement est une donnée de
    // rang, le rendu qu'on en tire reste une affaire de feuille de style.
    '--acc-dim': String(Math.min(dist, ACC_DIM_MAX)),
  }
}

// ─── Molette : le liminaire se parcourt à l'horizontale ──────────────────────
// Un pavé tactile émet ~40 événements/s ; sans seuil d'accumulation, un seul
// geste traverserait tout le liminaire. On avance d'UN cran par palier franchi.
const WHEEL_STEP = 60
let wheelAcc = 0

// Cran visé par le dernier `emit` non encore répercuté. Sans lui, plusieurs
// événements du MÊME tick liraient tous le `props.focused` d'avant — un geste
// vif de pavé tactile n'avancerait que d'un cran au lieu de plusieurs. Remis à
// zéro dès que la prop rattrape, ce qui le rend auto-réparant si le parent
// refuse le déplacement.
let wheelTarget = null
watch(() => props.focused, () => { wheelTarget = null })

function onWheel(event) {
  // `deltaX` autant que `deltaY` : molette verticale classique comme geste
  // horizontal du pavé tactile, les deux disent « au suivant ».
  wheelAcc += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
  if (Math.abs(wheelAcc) < WHEEL_STEP) return
  const dir = Math.sign(wheelAcc)
  wheelAcc = 0
  const from = wheelTarget ?? props.focused
  const next = Math.min(slideCount.value - 1, Math.max(0, from + dir))
  if (next === from) return
  wheelTarget = next
  emit('update:focused', next)
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
    const key = cell.page.key
    return {
      side,
      kind: 'page',
      key,
      page: cell.page,
      type,
      // `side` du contrôle = le côté CHOISI (auto par défaut), à ne pas
      // confondre avec `side` du slot, qui dit verso/recto dans la planche.
      chosenSide: props.sides[key] ?? 'auto',
      expected: props.expectedSides[key] ?? null,
      conflict: !!props.conflicts[key],
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
  transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1), filter 0.35s ease;

  /* TOUS les folios portent leur ombre — elle dit « du papier posé », pas
     « sélectionné ». Ce qui distingue les crans, c'est la PROFONDEUR : plus on
     s'éloigne du focus (--acc-dim, 0 à 3), plus l'ombre se resserre et plus la
     teinte se retire (désaturation + voile clair), comme un objet qui recule
     dans la brume. Une seule déclaration `filter` : les fonctions s'y
     composent, deux règles séparées s'écraseraient. */
  filter:
      drop-shadow(0 2px 5px rgba(0, 0, 0, calc(0.13 - var(--acc-dim, 0) * 0.025)))
      saturate(calc(1 - var(--acc-dim, 0) * 0.18))
      brightness(calc(1 + var(--acc-dim, 0) * 0.022));
}

.acc-spread.is-focused {
  cursor: default;
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

/* Action du dernier vis-à-vis : elle FLOTTE au-dessus du papier, dans le haut
   de la planche. Sous les folios (`top: 100%`) elle sortait du champ et se
   faisait couper par l'`overflow` de la scène.
   `pointer-events: none` sur la rampe : seul le bouton intercepte le clic, le
   reste de la surface continue de sélectionner le vis-à-vis. */
.acc-spread-action {
  position: absolute;
  top: var(--sp-4);
  left: 0;
  right: 0;
  z-index: 2;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

/* Posé SUR le papier : il lui faut un fond opaque et une ombre, sinon le texte
   de la page transparaît sous le libellé. */
.acc-spread-action .lim-border-btn {
  pointer-events: auto;
  background: var(--c-surface0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}

/* Le cran terminal : une carte d'action, pas une page. Fond crème et trait
   discontinu — assez présent pour ne plus flotter dans le vide, assez distinct
   du papier (--c-paper, blanc à peine crème) pour ne pas se compter comme une
   page du livre. */
.acc-spread--extend .extend-card {
  background: var(--c-paper-cream);
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
/* Rangée : triangle · piste · triangle. Les flèches encadrent la piste au lieu
   de flotter dessus — c'est la disposition d'une scrollbar. */
.acc-rail {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-bottom: var(--sp-4);
}

.acc-rail-track {
  position: relative;
  flex: 1 1 auto;
  height: 6px;
  border-radius: 3px;
  background: var(--c-border);
  cursor: pointer;
}

/* Mêmes triangles pleins que CustomScrollbar : 12 px de boîte, bordure de 4 px,
   teal — orientés à l'horizontale puisque le liminaire se parcourt en largeur. */
.acc-rail-arrow {
  position: relative;
  flex: 0 0 auto;
  width: 12px;
  height: 12px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  opacity: var(--op-soft);
}

.acc-rail-arrow:hover:not(:disabled) { opacity: 1; }
.acc-rail-arrow:disabled { opacity: var(--op-faint); cursor: default; }

.acc-rail-arrow::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border: 4px solid transparent;
}

.acc-rail-arrow--left::before {
  transform: translate(-75%, -50%);
  border-right-color: var(--c-accent-alt);
}

.acc-rail-arrow--right::before {
  transform: translate(-25%, -50%);
  border-left-color: var(--c-accent-alt);
}

/* Teal, comme le pouce des CustomScrollbar de l'app : la réglette EST une
   barre de défilement (celle du liminaire), elle doit s'en réclamer. */
.acc-rail-thumb {
  position: absolute;
  top: 0;
  height: 100%;
  min-width: 12px;
  border-radius: 3px;
  background: var(--c-accent-alt);
  transition: left 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.acc-rail-track:hover .acc-rail-thumb {
  background: var(--c-accent-alt-darker);
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
  /* `nowrap` + hauteur FIXE : c'est ce qui rend la barre insensible à son
     contenu. En `wrap`, deux slots de 13em plus le bouton de côté frôlaient la
     largeur disponible et basculaient sur deux lignes — la barre grandissait
     alors en hauteur selon le vis-à-vis regardé. */
  flex-wrap: nowrap;
  height: 2.2em;
  width: calc(26em + var(--sp-3));
}

/* Gabarit FIXE : les deux slots font la même largeur quoi qu'ils contiennent,
   donc les flèches ne bougent jamais d'un vis-à-vis à l'autre. */
/* Grille et non flex : les DEUX colonnes existent toujours, que le slot porte
   un bouton de côté ou non. Un slot inerte (blanche, couverture, cran terminal)
   laisse la seconde colonne vide mais RÉSERVÉE — sans quoi son select
   s'élargirait de 2em et les libellés ne s'aligneraient plus d'un vis-à-vis à
   l'autre. */
.acc-control {
  flex: 0 0 13em;
  display: grid;
  grid-template-columns: 1fr 2em;
  gap: var(--sp-1);
  /* Le slot occupe TOUTE la hauteur de la barre et ses enfants s'y étirent :
     un select, un liseré inerte et une pastille de côté font alors exactement
     la même hauteur. Laissé à leur taille naturelle, le bloc inerte tombait
     2 px sous le select. */
  height: 100%;
  align-items: stretch;
}

/* `grid-row: 1` EXPLICITE sur les deux : le bouton de côté précède le select
   dans le DOM, et le placement automatique, une fois passé en colonne 2, aurait
   renvoyé le select à la ligne suivante — la barre montait alors sur deux
   rangées. */
.acc-select,
.acc-inert {
  grid-column: 1;
  grid-row: 1;
  min-width: 0;
}

/* Pastille d'un caractère, dans la colonne qui lui est réservée. */
.acc-side {
  grid-column: 2;
  grid-row: 1;
  /* Épouse la hauteur du select plutôt qu'une valeur en dur : si la métrique du
     select bouge, les deux restent d'aplomb. */
  align-self: stretch;
  width: 2em;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-surface0);
  color: var(--c-ink2);
  font: inherit;
  font-size: var(--fs-md);
  font-weight: 600;
  cursor: pointer;
}

.acc-side:hover { border-color: var(--c-accent); color: var(--c-accent); }

/* Personne n'a tranché : le point se fait discret, sinon « · » se lit comme une
   décision au même titre que R ou V. */
.acc-side.is-auto { color: var(--c-ink2); opacity: var(--op-muted); }

/* Le côté forcé contredit la convention du type — c'est le seul état qui
   réclame l'œil. */
.acc-side.is-conflict {
  border-color: var(--c-danger);
  color: var(--c-danger);
  opacity: 1;
}

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
