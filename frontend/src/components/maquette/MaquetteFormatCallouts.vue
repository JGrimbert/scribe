<template>
  <!-- Contrôles de FORMAT posés SUR l'aperçu (écran Maquette). Trois zones :
       - deux GROUPES à droite du folio (haut = en-tête, bas = pied), champs nus
         reliés à leur zone par un trait droit (rail + fuyantes, par-dessus le folio) ;
       - à droite encore, les dimensions (format + X/Y + unité), et à GAUCHE le
         groupe du grand fond + de la manchette, en miroir ;
       - les SELECTS de contenu (titre courant / folio) posés à même la bande grisée.
       `styleDefaults` muté en place. Géométrie de planche via `geometry`. -->
  <div ref="rootRef" class="fc">
    <!-- Zones surlignables : survolées (ici, ou via le label du contrôle) elles se
         marquent. `page` en premier (dessous) : les zones précises la couvrent. -->
    <div
        v-for="z in zoneList" :key="z.id"
        class="fc-zone" :class="{ 'fc-zone--on': hovered === z.key }"
        :style="rectStyle(z.rect)"
        @mouseenter="hovered = z.key" @mouseleave="hovered = null"
    />

    <!-- Note de manchette : ses filets, TOUJOURS posés (gris clair) dans le grand fond.
         Simulation de texte, décor pur — par-dessus les zones (transparentes au repos),
         mais sans leur prendre le survol : c'est la `zone-manchette` (réduite à la note)
         qui le capte et bleute les filets. -->
    <div v-for="(r, i) in manchetteLines" :key="i" class="fc-manch"
         :class="{ 'fc-manch--on': hovered === 'manchette' }" :style="rectStyle(r)" />

    <FcLeaders :leaders="leaders" :box="box" :hovered="hovered" />

    <!-- ── Selects de contenu, posés sur les bandes grisées ─────────────────── -->
    <template v-if="header.enabled">
      <div v-if="anchors['header-recto-box']" class="fc-band"
           :style="bandSelectStyle(anchors['header-recto-box'], 'recto', header.justification)"
           @mouseenter="hovered = 'header'" @mouseleave="hovered = null">
        <BareSelect v-model="header.recto" :options="HEADER_OPTIONS" />
      </div>
      <div v-if="anchors['header-verso-box']" class="fc-band"
           :style="bandSelectStyle(anchors['header-verso-box'], 'verso', header.justification)"
           @mouseenter="hovered = 'header'" @mouseleave="hovered = null">
        <BareSelect v-model="header.verso" :options="HEADER_OPTIONS" />
      </div>
    </template>
    <template v-if="footer.enabled">
      <!-- Pied = folio : un seul select par page, le STYLE de numérotation (1 / I / a),
           réglage global au livre (même valeur des deux côtés). Placé selon la justif. -->
      <div v-if="anchors['footer-recto-box']" class="fc-band"
           :style="bandSelectStyle(anchors['footer-recto-box'], 'recto', footer.justification)"
           @mouseenter="hovered = 'footer'" @mouseleave="hovered = null">
        <BareSelect v-model="folioFormat" :options="FOLIO_FORMAT_OPTIONS" />
      </div>
      <div v-if="anchors['footer-verso-box']" class="fc-band"
           :style="bandSelectStyle(anchors['footer-verso-box'], 'verso', footer.justification)"
           @mouseenter="hovered = 'footer'" @mouseleave="hovered = null">
        <BareSelect v-model="folioFormat" :options="FOLIO_FORMAT_OPTIONS" />
      </div>
    </template>

    <template v-if="geo">
      <!-- ── Colonne GAUCHE : les cotes VERTICALES + le grand fond, ferrées par leur
           DROITE au rail gauche (intitulé côté planche, champ vers l'extérieur).
           Blanc de tête en haut, grand fond au milieu, blanc de pied en bas. Les
           blancs sont cotés sur le bord extérieur de la page de gauche (recto), le
           grand fond tombe aux bords extérieurs (marges re-miroitées, cf.
           formatAnchors). ────────────────────────────────────────────────────── -->
      <FcGroup :x="geo.leftRailX" :y="geo.top + geo.railPad" side="left" anchor="top" :max-width="geo.leftRailW">
        <FcCote label="Blanc de tête" :value="toUnit(marginsView.topCm, unit)" :step="step" :unit="unit"
                hover-key="blanc-tete" :measure-ref="(el) => setRow('blanc-tete', el)"
                @hover="hovered = $event" @input="setMargin('topCm', $event)" />
      </FcGroup>
      <FcGroup :x="geo.leftRailX" :y="geo.midY" side="left" anchor="mid" :max-width="geo.leftRailW" :gap="8">
        <FcCote label="Grand fond" :value="toUnit(marginsView.outerCm, unit)" :step="step" :unit="unit"
                hover-key="grand-fond" :measure-ref="(el) => setRow('grand-fond', el)"
                @hover="hovered = $event" @input="setMargin('outerCm', $event)" />
        <FcCote label="Petit fond" :value="toUnit(marginsView.innerCm, unit)" :step="step" :unit="unit"
                hover-key="petit-fond" :measure-ref="(el) => setRow('petit-fond', el)"
                @hover="hovered = $event" @input="setMargin('innerCm', $event)" />
      </FcGroup>
      <FcGroup :x="geo.leftRailX" :y="geo.bottom - geo.railPad" side="left" anchor="bottom" :max-width="geo.leftRailW">
        <FcCote label="Blanc de pied" :value="toUnit(marginsView.bottomCm, unit)" :step="step" :unit="unit"
                hover-key="blanc-pied" :measure-ref="(el) => setRow('blanc-pied', el)"
                @hover="hovered = $event" @input="setMargin('bottomCm', $event)" />
      </FcGroup>

      <!-- ── Colonne DROITE : hauteur d'en-tête + justif (haut), manchette (milieu),
           hauteur de pied + justif (bas), ferrées par leur GAUCHE au rail droit. ── -->
      <FcGroup :x="geo.railX" :y="geo.top + geo.railPad" anchor="top" :max-width="geo.railW">
        <FcBand :band="header" label="En-tête" :value="toUnit(header.heightCm, unit)" :step="step" :unit="unit"
                hover-key="header" :measure-ref="(el) => setRow('header-height', el)"
                @hover="hovered = $event" @input="setBandHeight(header, $event)">
          <template #default="{ disabled }">
            <BareSelect v-model="header.justification" :options="JUSTIF_OPTIONS" :disabled="disabled" />
          </template>
        </FcBand>
      </FcGroup>

      <FcGroup :x="geo.railX" :y="geo.midY" anchor="mid" :max-width="geo.railW">
        <FcBand :band="manchette" label="Manchette" :value="toUnit(manchette.widthCm, unit)" :step="step" :unit="unit"
                hover-key="manchette" :measure-ref="(el) => setRow('manchette', el)"
                @hover="hovered = $event" @input="setManchetteWidth($event)" />
      </FcGroup>

      <FcGroup :x="geo.railX" :y="geo.bottom - geo.railPad" anchor="bottom" :max-width="geo.railW">
        <FcBand :band="footer" label="Hauteur pied" :value="toUnit(footer.heightCm, unit)" :step="step" :unit="unit"
                hover-key="footer" :measure-ref="(el) => setRow('footer-height', el)"
                @hover="hovered = $event" @input="setBandHeight(footer, $event)">
          <template #default="{ disabled }">
            <BareSelect v-model="footer.justification" :options="JUSTIF_OPTIONS" :disabled="disabled" />
          </template>
        </FcBand>
      </FcGroup>

      <!-- ── Dimensions : layer flottant SOUS la planche, centré sur la gouttière.
           Deux lignes : le format choisi, puis la cote X × Y et son unité. Sans zone
           surlignable : elles désignent la planche entière, qu'on voit déjà — le
           survol la barbouillerait pour rien. ──────────────────────────────────── -->
      <div class="fc-row fc-float" :style="{ left: `${geo.centerX}px`, top: `${geo.bottom}px` }">
        <BareSelect v-model="selectedKey" :options="DIM_OPTIONS" />
        <span class="fc-dims__wh">
          <NumInput :value="toUnit(effective && effective.widthCm, unit)" :step="step" unit=""
                    @input="setDimension('widthCm', $event)" />
          <span class="fc-times">×</span>
          <NumInput :value="toUnit(effective && effective.heightCm, unit)" :step="step" unit=""
                    @input="setDimension('heightCm', $event)" />
          <BareSelect v-model="unit" :options="UNIT_OPTIONS" muted />
        </span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue'
import BareSelect from './BareSelect.vue'
import NumInput from './NumInput.vue'
import FcGroup from './callouts/FcGroup.vue'
import FcCote from './callouts/FcCote.vue'
import FcBand from './callouts/FcBand.vue'
import FcLeaders from './callouts/FcLeaders.vue'
import './callouts/callouts.css' // rows posées ici même (petit fond, dimensions)
import { buildFormatAnchors } from '../../script/formatAnchors'
import { useCalloutRig } from '../../composables/useCalloutRig'
import {
  PAGE_FORMATS, UNITS, effectiveMargins, effectivePage, matchFormat,
  toUnit, fromUnit, unitStep,
} from '../../script/pageFormats'

const props = defineProps({
  page: { type: Object, default: null },
  styleDefaults: { type: Object, required: true },
  // { pages: [{left,top,width,height}] } (coords écran) émis par FolioView.
  geometry: { type: Object, default: null },
})

const header = computed(() => props.styleDefaults.runningTitles.header)
const footer = computed(() => props.styleDefaults.runningTitles.footer)
const manchette = computed(() => props.styleDefaults.manchette)

// Le pied n'affiche plus QUE le folio (numéro de page) : on n'y choisit que le style
// de numérotation (1 / I / a). Son contenu est donc verrouillé sur `folio` des deux
// côtés dès qu'il est actif.
watchEffect(() => {
  if (footer.value.enabled) {
    footer.value.recto = 'folio'
    footer.value.verso = 'folio'
  }
})

// Numérotation du folio : GLOBALE au livre (pas par bande), d'où sa place à côté
// de `header`/`footer` dans le modèle.
const folioFormat = computed({
  get: () => props.styleDefaults.runningTitles.folioFormat ?? 'numerique',
  set: (v) => { props.styleDefaults.runningTitles.folioFormat = v },
})

const HEADER_OPTIONS = [
  { value: 'titre', label: 'Titre du livre' },
  { value: 'chapitre', label: 'Nom du chapitre' },
  { value: 'aucun', label: 'Rien' },
]
const JUSTIF_OPTIONS = [
  { value: 'centre', label: 'Centré' },
  { value: 'regard', label: 'En regard' },
]
// Style de numérotation, montré par l'exemple : « 1 » vaut mieux qu'« arabe ».
const FOLIO_FORMAT_OPTIONS = [
  { value: 'numerique', label: '1' },
  { value: 'romain', label: 'I' },
  { value: 'alpha', label: 'a' },
]
const DIM_OPTIONS = [
  { value: '', label: 'Original (.odt)' },
  ...PAGE_FORMATS.map((f) => ({ value: f.key, label: f.label })),
  { value: 'custom', label: 'Personnaliser…' },
]
const UNIT_OPTIONS = UNITS.map((u) => ({ value: u.key, label: u.label }))

// ── Unité d'affichage (le modèle reste en cm) ────────────────────────────────
const unit = ref('cm')
const step = computed(() => unitStep(unit.value))

const effective = computed(() => effectivePage(props.page, props.styleDefaults.pageSize))
const marginsView = computed(() => effectiveMargins(props.page, props.styleDefaults.pageMargins))

// ── Sélecteur de format (stocke des DIMENSIONS, pas un nom) ───────────────────
const selectedKey = computed({
  get() {
    const ps = props.styleDefaults.pageSize
    if (!ps) return ''
    return matchFormat(ps.widthCm, ps.heightCm)?.key ?? 'custom'
  },
  set(key) {
    if (key === '') {
      props.styleDefaults.pageSize = null
    } else if (key === 'custom') {
      const base = effective.value ?? { widthCm: 14.8, heightCm: 21 }
      props.styleDefaults.pageSize = { widthCm: base.widthCm, heightCm: base.heightCm }
    } else {
      const f = PAGE_FORMATS.find((x) => x.key === key)
      if (f) props.styleDefaults.pageSize = { widthCm: f.widthCm, heightCm: f.heightCm }
    }
  },
})

function setDimension(key, raw) {
  const cm = fromUnit(raw, unit.value)
  if (cm == null || cm <= 0) return
  if (!props.styleDefaults.pageSize) {
    const base = effective.value ?? { widthCm: 14.8, heightCm: 21 }
    props.styleDefaults.pageSize = { widthCm: base.widthCm, heightCm: base.heightCm }
  }
  props.styleDefaults.pageSize[key] = cm
}

// Éditer une marge matérialise la surcharge (copie des marges effectives) au besoin.
function setMargin(key, raw) {
  const cm = fromUnit(raw, unit.value)
  if (cm == null || cm < 0) return
  if (!props.styleDefaults.pageMargins) {
    props.styleDefaults.pageMargins = { ...effectiveMargins(props.page, null) }
  }
  props.styleDefaults.pageMargins[key] = cm
}

// Cote OPTIONNELLE (hauteur de bande, largeur de manchette) : vidée ou invalide
// = null, c'est-à-dire « auto ».
function optionalCm(raw) {
  if (String(raw).trim() === '') return null
  const cm = fromUnit(raw, unit.value)
  return cm != null && cm > 0 ? cm : null
}

function setBandHeight(band, raw) {
  band.heightCm = optionalCm(raw)
}

function setManchetteWidth(raw) {
  manchette.value.widthCm = optionalCm(raw)
}

// ── Socle géométrie/mesure/fuyantes, partagé avec MaquetteStyleCallouts ───────
const { rootRef, origin, box, baseGeo, leaders, setRow } = useCalloutRig({
  geometry: () => props.geometry,
  buildLeaders: buildFormatLeaders,
  // Les ancres suivent les cotes éditées EN DIRECT (styleDefaults muté en place) →
  // relancer la mesure quand elles changent.
  watchSources: [[() => props.styleDefaults, { deep: true }]],
})

const anchors = computed(() =>
  buildFormatAnchors({
    pages: props.geometry?.pages ?? null,
    pageSize: effective.value,
    margins: marginsView.value,
    runningTitles: props.styleDefaults.runningTitles,
    manchette: manchette.value,
    origin: origin.value,
  }),
)

const manchetteLines = computed(() => anchors.value['manchette-lines'] ?? [])

// Repères de la planche dérivés du socle (`baseGeo` porte recto/verso/rails/railPad).
const geo = computed(() => {
  const b = baseGeo.value
  if (!b) return null
  const { recto, verso, gut, railPad, top, leftRailX, railX } = b
  const bottom = Math.max(recto.bottom, verso.bottom)
  return {
    railX, leftRailX, top, bottom, railPad,
    midY: (top + bottom) / 2,
    // Coude des fuyantes : MILIEU de la gouttière centrale (bord de page + ½ gut),
    // FIXE quel que soit le recul des piles.
    gutterMidRight: verso.right + gut / 2, gutterMidLeft: recto.left - gut / 2,
    // Largeur du rail : du point de ferrage au bord de l'aperçu. Les piles y sont
    // bornées (cf. FcGroup.maxWidth) — au-delà elles sortiraient du champ.
    leftRailW: leftRailX,
    railW: box.value.w - railX,
    // Centre de la gouttière (bords intérieurs des deux pages) : ancre du layer
    // flottant des dimensions.
    centerX: (recto.right + verso.left) / 2,
  }
})

// Position d'un select de contenu sur sa bande, selon la justification : `centre`
// = centré ; `regard` = bord EXTÉRIEUR (recto affiché à gauche → bord gauche ; verso
// à droite → bord droit), le select ferré contre ce bord.
function bandSelectStyle(box, side, justif) {
  const cy = box.y + box.h / 2
  // `--fc-band-h` borne la hauteur (et la police) du select à celle de la bande
  // rendue par FolioView : il ne la dépasse jamais.
  const h = { '--fc-band-h': `${box.h}px` }
  if (justif === 'regard') {
    return side === 'recto'
      ? { ...h, left: `${box.x}px`, top: `${cy}px`, transform: 'translateY(-50%)' }
      : { ...h, left: `${box.x + box.w}px`, top: `${cy}px`, transform: 'translate(-100%, -50%)' }
  }
  return { ...h, left: `${box.x + box.w / 2}px`, top: `${cy}px`, transform: 'translate(-50%, -50%)' }
}

// ── Survol : la zone désignée par le contrôle survolé se marque ───────────────
const hovered = ref(null)

// Zone de chaque contrôle, APLATIE : une zone porte un rect par page (cf.
// formatAnchors), tous marqués ensemble sous la même clé. Que des zones PRÉCISES :
// la planche entière n'en a pas — elle couvrirait tout l'aperçu d'une surface
// réceptive au survol, pour ne montrer que ce qu'on regarde déjà.
const zoneList = computed(() => {
  const a = anchors.value
  return [
    ['blanc-tete', a['zone-blanc-tete']],
    ['blanc-pied', a['zone-blanc-pied']],
    ['petit-fond', a['zone-petit-fond']],
    ['grand-fond', a['zone-grand-fond']],
    ['manchette', a['zone-manchette']],
    ['header', a['zone-header']],
    ['footer', a['zone-footer']],
  ].flatMap(([key, rects]) => (rects ?? []).map((rect, i) => ({ key, id: `${key}:${i}`, rect })))
})

function rectStyle(r) {
  return { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` }
}

// Le rect d'une zone le plus proche d'une abscisse : les fonds en ont un par page,
// le trait doit viser celui de la page où son label est posé.
function nearestRect(rects, x) {
  if (!rects?.length) return null
  return rects.reduce((best, r) => (Math.abs(r.x + r.w / 2 - x) < Math.abs(best.x + best.w / 2 - x) ? r : best))
}

// Chaque rail porte un mix de deux fuyantes : « vers un point » (blancs, hauteurs
// de bande — le trait vise l'ancre cotée) et « horizontale vers zone » (fonds,
// manchette — le trait file vers le centre du liséré désigné).
const LEFT_POINT = ['blanc-tete', 'blanc-pied']
const LEFT_ZONE = ['grand-fond', 'petit-fond']
const RIGHT_POINT = ['header-height', 'footer-height']
const RIGHT_ZONE = ['manchette']

// Fuyantes du format : chaque rail porte un mix « vers un point » (blancs, hauteurs de
// bande — le trait vise l'ancre cotée) et « vers zone » (fonds, manchette — le trait
// file vers le centre du liséré désigné). Appelé par le socle APRÈS le nextTick de la
// mesure (lignes montées, cf. useCalloutRig) ; `o`/`rowCenterY` viennent de lui.
function buildFormatLeaders({ o, rowCenterY }) {
  const g = geo.value
  if (!g) return []
  const anc = anchors.value
  const { railX, leftRailX, gutterMidRight: xmRight, gutterMidLeft: xmLeft } = g
  const next = []
  // « vers un point » : du bord de la carte (ferrée au rail) vers l'ancre cotée, coudée
  // à la gouttière — segment 2 en biais vers la balise (y ≠ celui du label).
  const pointLead = (key, rx, xm) => {
    const cy = rowCenterY(key, o.top)
    if (cy != null && anc[key]) next.push({ key, x1: rx, y1: cy, xm, x2: anc[key].x, y2: anc[key].y })
  }
  // « vers zone » : du bord de la carte au centre du liséré le PLUS PROCHE (une zone en
  // couvre deux, une par page). Coude à la gouttière ; segment 2 horizontal (bandeau).
  const zoneLead = (key, rx, xm) => {
    const cy = rowCenterY(key, o.top)
    if (cy == null) return
    const z = nearestRect(anc[`zone-${key}`], rx)
    if (z) next.push({ key, x1: rx, y1: cy, xm, x2: z.x + z.w / 2, y2: cy })
  }

  for (const key of LEFT_POINT) pointLead(key, leftRailX, xmLeft)
  for (const key of LEFT_ZONE) zoneLead(key, leftRailX, xmLeft)
  for (const key of RIGHT_POINT) pointLead(key, railX, xmRight)
  for (const key of RIGHT_ZONE) zoneLead(key, railX, xmRight)
  return next
}
</script>

<style scoped>
.fc {
  position: absolute;
  inset: 0;
  pointer-events: none;
  /* Au-dessus de l'iframe du FolioView (z-index 1 en double-page). */
  z-index: 3;
}

/* Zone surlignable : transparente au repos (mais réceptive au survol), teintée et
   cernée d'un POINTILLÉ quand elle (ou son label) est survolée. `outline` posé
   vers l'intérieur : la zone est mesurée au pixel près sur le papier, un trait
   débordant mentirait sur sa limite. */
.fc-zone {
  position: absolute;
  pointer-events: auto;
  /*border-radius: var(--radius-sm);*/
  background: transparent;
  transition: background-color 0.12s ease;
}

.fc-zone--on {
  background: color-mix(in srgb, var(--c-accent-alt) 16%, transparent);
  outline: 1px dotted var(--c-accent-alt);
  outline-offset: -1px;
}

/* Filet de note-manchette : simulation de texte, jamais un contrôle — il ne prend ni
   le survol (la `zone-manchette` dessous le garde) ni le clic. Gris CLAIR au repos,
   bleuté (teal) quand la zone est survolée. */
.fc-manch {
  position: absolute;
  pointer-events: none;
  background: color-mix(in srgb, var(--c-ink2) 28%, transparent);
  transition: background-color 0.12s ease;
}

.fc-manch--on {
  background: color-mix(in srgb, var(--c-accent-alt) 65%, transparent);
}

/* Selects de contenu (titre courant / folio) posés sur la bande. Chacun porte SON
   propre fond gris — le pavé gris peint dans l'iframe a été retiré (cf. folioStyles). */
.fc-band {
  position: absolute;
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  /* Ne dépasse jamais la hauteur de la bande en-tête/pied rendue par FolioView. */
  height: var(--fc-band-h, auto);
  white-space: nowrap;
  pointer-events: auto;
}

/* Fond teal léger (gris bleuté), franc sans radius ni bordure — le pavé gris de
   l'iframe est retiré, ce select EST le repère du titre courant / folio. La
   redécoupe champ-blanc/pastille de BareSelect ne vaut PAS ici : on remet le wrapper
   à plat teal et on rend champ + chevron transparents pour le laisser transparaître. */
.fc-band :deep(.bare-select) {
  height: 100%;
  border: none;
  border-radius: 0;
  background: color-mix(in srgb, var(--c-accent-alt) 30%, var(--c-surface0));
}

.fc-band :deep(.bare-select select) {
  height: 100%;
  padding-top: 0;
  padding-bottom: 0;
  line-height: 1;
  background: transparent;
  color: var(--c-accent-alt-darker);
  font-size: min(var(--fs-sm), calc(var(--fc-band-h, 1rem) - 4px));
}

.fc-band :deep(.bare-select__chevron) {
  background: transparent;
  color: var(--c-accent-alt-darker);
}

/* `.fc-grp`, `.fc-row` et `.fc-row__label` sont mutualisés avec les briques
   `FcGroup`/`FcCote`/`FcBand` → déplacés dans `callouts/callouts.css` (global,
   pour traverser la frontière de composant). */

/* Dimensions : row flottante SOUS la planche, centrée sur la gouttière — deux
   lignes (le format, puis la cote), d'où le contenu centré au lieu d'être ferré. */
.fc-float {
  position: absolute;
  transform: translate(-50%, var(--sp-3));
  align-items: center;
  gap: var(--sp-2);
  white-space: nowrap;
  pointer-events: auto;
}

.fc-dims__wh {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
}

.fc-times {
  color: var(--c-ink2);
  font-size: var(--fs-xs);
}
</style>
