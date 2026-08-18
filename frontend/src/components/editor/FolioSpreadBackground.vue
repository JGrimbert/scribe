<template>
  <!-- Trame de fond de la double-page (filets pointillés figurant les frontières de
       planches). Placée DERRIÈRE l'iframe (transparente) → visible dans les gouttières.
       Purement décoratif : la géométrie (période/phase/gouttière) est calculée par
       useFolioSpreadGeometry et reçue en `vars` ; ici on ne fait que peindre. -->
  <div
      class="folio-pad-bg"
      :class="{ 'folio-pad-bg--local': scope === 'local' }"
      :style="styleVars"
      aria-hidden="true"
  >
    <!-- Volume « papier » de chaque page : fond crème léger + croix aux COINS DE LA PAGE
         (à l'intersection des gouttières). Enfant de la couche → il glisse avec elle.
         Révélé pendant le creux d'une bascule (fillVisible), quand les vraies pages sont
         estompées. Coords fenêtre : la couche est fixed inset:0, l'enfant absolu s'y cale. -->
    <div
        v-for="(box, i) in pageBoxes"
        :key="i"
        class="folio-pad-fill"
        :class="{ 'folio-pad-fill--on': fillVisible }"
        :style="box"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // Cotes scalées de la trame (cf. useFolioSpreadGeometry). Null = aucune page rendue
  // → fond caché (opacity 0). Sinon { gutter, period, phase, pageH, gutterTop,
  // gutterBottom, liseret, periodY, phaseY }, toutes en px.
  vars: { type: Object, default: null },
  // Portée de la trame : 'window' (fixed, toute la fenêtre) ou 'local' (bornée au
  // wrapper des pages, cf. FolioView bgScope) — les phases sont alors comptées depuis
  // le bord du wrapper en amont.
  scope: { type: String, default: 'window' },
  // Décalage horizontal (px) de la couche, posé en transform — le glissement filmstrip
  // (cf. useFolioSpreadGeometry.runSlide). Transform SUR l'élément fixed lui-même (et
  // non un ancêtre) : il l'offset sans en changer le référentiel.
  shift: { type: Number, default: 0 },
  // Transition CSS du transform ACTIVE seulement pendant le glissement (sinon le
  // placement initial hors écran s'animerait aussi).
  animated: { type: Boolean, default: false },
  // Rects de PAGE (coords fenêtre) de cette couche : le volume crème + croix s'y pose.
  pages: { type: Array, default: null },
  // Révèle le volume crème + croix (le footprint des pages), pendant le creux d'une
  // bascule — les vraies pages étant estompées.
  fillVisible: { type: Boolean, default: false },
})

const pageBoxes = computed(() =>
  (props.pages ?? []).map((p) => ({
    left: `${p.left}px`,
    top: `${p.top}px`,
    width: `${p.width}px`,
    height: `${p.height}px`,
  })),
)

// Variables CSS « posées par JS » (cf. le bloc du même nom dans le style) : révélées
// dès que la géométrie est calée. Avant (vars null), opacity 0 et les --pad-* gardent
// leur défaut 0px du CSS.
const styleVars = computed(() => {
  const v = props.vars
  // 320 ms : à garder synchro avec SLIDE_MS de useFolioSpreadGeometry.
  const motion = {
    transform: props.shift ? `translateX(${props.shift}px)` : 'none',
    transition: props.animated ? 'transform 320ms ease' : 'none',
  }
  if (!v) return { ...motion, opacity: 0 }
  return {
    ...motion,
    opacity: 1,
    '--pad-gutter': `${v.gutter}px`,
    '--pad-period': `${v.period}px`,
    '--pad-phase': `${v.phase}px`,
    '--pad-page-h': `${v.pageH}px`,
    '--pad-gutter-top': `${v.gutterTop}px`,
    '--pad-gutter-bottom': `${v.gutterBottom}px`,
    '--pad-liseret': `${v.liseret}px`,
    '--pad-period-y': `${v.periodY}px`,
    '--pad-phase-y': `${v.phaseY}px`,
  }
})
</script>

<style scoped>
/* Trame de fond (double-page) : fines pointillées figurant les frontières de
   planches, en GRILLE. Chaque période porte les filets qui bordent ses gouttières
   (X : deux filets aux bords extérieurs de la planche accolée ; Y : trois filets —
   tête V et pied 2·V, asymétriques) : le pavage cerne la PLANCHE au lieu de séparer
   ses deux pages d'un trait
   (vis-à-vis accolé, cf. FolioView contiguousSpread) — la reliure centrale n'a plus de
   filet. L'espace entre deux rangées de folios se lit comme une bande — c'est ce
   qui rend nette la séparation quand plusieurs planches sont empilées. (En régime
   historique non accolé, la période vaut la page et chaque page est cernée,
   reliure comprise.)
   `position: fixed` : elle couvre TOUTE la fenêtre — elle passe donc
   derrière la doc-bar et descend jusqu'en bas, au-delà de la planche, et échappe à
   l'`overflow: hidden` de la vue (aucun ancêtre ne porte de transform/filter, qui
   referait de la frame le référentiel du fixed). La grille reste calée sur les
   pages par `--pad-period*` / `--pad-phase*`, posées en JS (styleVars) sur la
   géométrie scalée.
   Les deux axes vivent dans DEUX pseudo-éléments et non deux couches de fond : le
   pointillé se fait au `mask`, qui s'applique à l'élément entier — le mask
   horizontal des verticales hacherait les horizontales. */
.folio-pad-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0; /* révélé par styleVars une fois périodes/phases calées (≥ 1 page) */
  /* ── Réglages ── */
  /* Bleu profond du menu, très dilué : la trame se devine sans jamais concurrencer
     le texte des pages. (Élément hors iframe → les tokens du DS sont résolus.) */
  --pad-color: color-mix(in srgb, var(--c-accent) 22%, transparent);
  --pad-line: 2px;      /* épaisseur du filet */
  --pad-dash: 4px;      /* longueur d'un tiret */
  --pad-gap: 4px;       /* espace entre tirets */
  /* ── Posés par JS (styleVars) ── */
  --pad-gutter: 0px;        /* gouttière verticale V : écart entre les deux filets, axe X */
  --pad-period: 0px;        /* page + gouttière, axe X */
  --pad-phase: 0px;         /* bord sortant de la 1re page, en coordonnées écran */
  --pad-page-h: 0px;        /* hauteur de page scalée (axe Y) */
  --pad-gutter-top: 0px;    /* gouttière de TÊTE = V */
  --pad-gutter-bottom: 0px; /* gouttière de PIED = 2·V */
  --pad-liseret: 0px;       /* liseret entre rangs = 6·V */
  --pad-period-y: 0px;      /* page + pied + liseret + tête, axe Y */
  --pad-phase-y: 0px;       /* HAUT de la 1re page, en coordonnées écran */
}

/* Trame LOCALE (scope) : bornée au wrapper des pages au lieu de couvrir la
   fenêtre. Indispensable dès que plusieurs planches coexistent à l'écran — en
   `fixed`, chacune peindrait sa grille sur toute la fenêtre. Les phases sont
   alors comptées depuis le bord du wrapper (cf. useFolioSpreadGeometry). */
.folio-pad-bg--local {
  position: absolute;
}

/* Volume « papier » d'une page : fond crème léger (distinct du fond principal) + croix
   coin à coin de la PAGE. Absolu dans la couche (fixed inset:0) → posé en coords fenêtre
   et solidaire du transform de glissement. Révélé en fondu pendant le creux (--on). */
.folio-pad-fill {
  position: absolute;
  z-index: -1; /* derrière les filets de la trame (pseudos), qui restent nets */
  opacity: 0;
  transition: opacity 160ms ease;
  --fill-cream: color-mix(in srgb, var(--c-surface0) 60%, transparent);
  --fill-line: color-mix(in srgb, var(--c-ink) 15%, transparent);
  background-color: var(--fill-cream);
  background-image:
    linear-gradient(to top right, transparent calc(50% - 0.5px), var(--fill-line) calc(50% - 0.5px), var(--fill-line) calc(50% + 0.5px), transparent calc(50% + 0.5px)),
    linear-gradient(to bottom right, transparent calc(50% - 0.5px), var(--fill-line) calc(50% - 0.5px), var(--fill-line) calc(50% + 0.5px), transparent calc(50% + 0.5px));
}

.folio-pad-fill--on {
  opacity: 1;
}

/* Les deux axes partagent tout sauf leur direction : un tile d'EXACTEMENT une
   période (et non un `repeating-linear-gradient` étalé sur toute la boîte, dont la
   copie de gauche redémarrait à une phase arbitraire → filet parasite dans la
   première page), et un mask perpendiculaire qui le découpe en pointillé.
   Les axes diffèrent par leur découpe : X porte DEUX filets encadrant la gouttière
   verticale V (origine = bord sortant de la page, second à `--pad-gutter`) ; Y en
   porte QUATRE (haut de page, pied de page, fin du pied / début du liseret, fin du
   liseret / début de la tête) — sous la page : pied 2·V, puis liseret 6·V, puis tête V
   du rang suivant. Le reste de la période — la page — est transparent. */
.folio-pad-bg::before,
.folio-pad-bg::after {
  content: "";
  position: absolute;
  inset: 0;
}

.folio-pad-bg::before {
  background-image: linear-gradient(
    to right,
    var(--pad-color) 0,
    var(--pad-color) var(--pad-line),
    transparent var(--pad-line),
    transparent var(--pad-gutter),
    var(--pad-color) var(--pad-gutter),
    var(--pad-color) calc(var(--pad-gutter) + var(--pad-line)),
    transparent calc(var(--pad-gutter) + var(--pad-line))
  );
  background-size: var(--pad-period) 100%;
  background-position-x: calc(var(--pad-phase) - var(--pad-line) / 2);
  -webkit-mask-image: repeating-linear-gradient(
    to bottom, #000 0, #000 var(--pad-dash),
    transparent var(--pad-dash), transparent calc(var(--pad-dash) + var(--pad-gap))
  );
  mask-image: repeating-linear-gradient(
    to bottom, #000 0, #000 var(--pad-dash),
    transparent var(--pad-dash), transparent calc(var(--pad-dash) + var(--pad-gap))
  );
}

.folio-pad-bg::after {
  /* Quatre filets par période (haut de page → suivant) : haut de page, pied de page,
     fin du pied (2·V) / début du liseret, fin du liseret (6·V) / début de la tête (V).
     Sous la page : pied 2·V, liseret 6·V, tête V du rang suivant. */
  background-image: linear-gradient(
    to bottom,
    var(--pad-color) 0,
    var(--pad-color) var(--pad-line),
    transparent var(--pad-line),
    transparent var(--pad-page-h),
    var(--pad-color) var(--pad-page-h),
    var(--pad-color) calc(var(--pad-page-h) + var(--pad-line)),
    transparent calc(var(--pad-page-h) + var(--pad-line)),
    transparent calc(var(--pad-page-h) + var(--pad-gutter-bottom)),
    var(--pad-color) calc(var(--pad-page-h) + var(--pad-gutter-bottom)),
    var(--pad-color) calc(var(--pad-page-h) + var(--pad-gutter-bottom) + var(--pad-line)),
    transparent calc(var(--pad-page-h) + var(--pad-gutter-bottom) + var(--pad-line)),
    transparent calc(var(--pad-page-h) + var(--pad-gutter-bottom) + var(--pad-liseret)),
    var(--pad-color) calc(var(--pad-page-h) + var(--pad-gutter-bottom) + var(--pad-liseret)),
    var(--pad-color) calc(var(--pad-page-h) + var(--pad-gutter-bottom) + var(--pad-liseret) + var(--pad-line)),
    transparent calc(var(--pad-page-h) + var(--pad-gutter-bottom) + var(--pad-liseret) + var(--pad-line))
  );
  background-size: 100% var(--pad-period-y);
  background-position-y: calc(var(--pad-phase-y) - var(--pad-line) / 2);
  -webkit-mask-image: repeating-linear-gradient(
    to right, #000 0, #000 var(--pad-dash),
    transparent var(--pad-dash), transparent calc(var(--pad-dash) + var(--pad-gap))
  );
  mask-image: repeating-linear-gradient(
    to right, #000 0, #000 var(--pad-dash),
    transparent var(--pad-dash), transparent calc(var(--pad-dash) + var(--pad-gap))
  );
}
</style>
