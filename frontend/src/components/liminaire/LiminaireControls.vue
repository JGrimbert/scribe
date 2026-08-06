<template>
  <!-- Overlay des contrôles liminaire, posé SUR la planche du FolioView (ancré sur
       `geometry`, les rects écran des pages émis par FolioView). Racine inerte
       (`pointer-events:none`) : elle ne couvre le folio que pour porter ses
       enfants positionnés, qui seuls reçoivent le pointeur (révélés au survol par
       l'hôte). Trois familles de contrôles :
       - le SELECT DE TYPE, un par page taguable, posé sur la page ;
       - les CHEVRONS de navigation entre vis-à-vis, en regard des bords de la
         planche ;
       - le DÉCOUPAGE : chaque élément rendu est OUTLINÉ (visible par défaut) ; sa
         flèche renvoi/nouvelle page n'apparaît qu'à son survol, centrée
         verticalement au bord extérieur (cf. `blockGeometry`). -->
  <div ref="rootRef" class="lim-ctl">
    <template v-if="geo">
      <!-- Chevrons : à l'extérieur des bords gauche/droite de la planche, centrés
           en hauteur. Bornés aux deux bouts (pas de vis-à-vis avant le premier ni
           après le dernier). -->
      <button
          v-if="focused > 0"
          type="button"
          class="lim-ctl__nav lim-ctl__nav--prev"
          :style="{ left: `${geo.leftX}px`, top: `${geo.midY}px` }"
          title="Vis-à-vis précédent"
          @click="$emit('update:focused', focused - 1)"
      >
        <i class="pi pi-chevron-left"></i>
      </button>
      <button
          v-if="focused < spreadCount - 1"
          type="button"
          class="lim-ctl__nav lim-ctl__nav--next"
          :style="{ left: `${geo.rightX}px`, top: `${geo.midY}px` }"
          title="Vis-à-vis suivant"
          @click="$emit('update:focused', focused + 1)"
      >
        <i class="pi pi-chevron-right"></i>
      </button>

      <!-- Un select de type par page taguable, posé sur la page (haut, centré). Une
           page blanche ou de garde n'en porte pas. -->
      <div
          v-for="slot in typeSlots"
          :key="slot.key"
          class="lim-ctl__type"
          :style="{ left: `${slot.x}px`, top: `${slot.y}px` }"
      >
        <BaseSelect
            class="lim-ctl__select"
            :class="{ 'has-suggestion': slot.pending }"
            :title="slot.pending ? slot.pending.why : ''"
            :model-value="slot.type"
            @update:model-value="$emit('set-type', slot.page, $event)"
        >
          <!-- La ligne courante porte la suggestion (lisible au repos) ; la liste
               ne la répète pas, elle la met seulement en couleur. -->
          <option value="">{{ slot.pending ? `⚡ ${labelOf(slot.pending.key)} ?` : '— type —' }}</option>
          <option
              v-for="t in LIMINAIRE_PAGES"
              :key="t.key"
              :value="t.key"
              :class="{ 'opt-suggest': slot.pending && slot.pending.key === t.key }"
          >{{ t.label }}</option>
        </BaseSelect>
      </div>

      <!-- Outline de chaque élément rendu (visible par défaut). La flèche de
           découpage, enfant de l'outline, ne se montre qu'à SON survol (CSS),
           centrée verticalement, au bord extérieur. -->
      <div
          v-for="el in elements"
          :key="el.key"
          class="lim-ctl__outline"
          :style="{ left: `${el.left}px`, top: `${el.top}px`, width: `${el.width}px`, height: `${el.height}px` }"
      >
        <button
            v-if="el.arrow"
            type="button"
            class="lim-ctl__op"
            :class="[`lim-ctl__op--${el.side}`, { 'is-active': el.arrow.active }]"
            :title="el.arrow.title"
            @click="el.arrow.onClick"
        >
          <i :class="el.arrow.kind === 'join' ? 'pi pi-arrow-up' : 'pi pi-arrow-down'"></i>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BaseSelect from '../ui/atoms/BaseSelect.vue'
import { LIMINAIRE_PAGES, LIMINAIRE_BY_KEY } from '../../script/liminaire-vocab'
import { breakOfKey, toggleBreak } from '../../script/liminaire-config'

const props = defineProps({
  // { pages: [{left,top,width,height}] } en coords ÉCRAN, émis par FolioView.
  // pages[0] = verso (spread.left), pages[1] = recto (spread.right).
  geometry: { type: Object, default: null },
  // Rects ÉCRAN des paragraphes rendus, clés par `entry.key` (block-geometry de
  // FolioView) : le Y d'ancrage de « scinder ».
  blockGeometry: { type: Array, default: () => [] },
  // Le vis-à-vis focusé (cellules d'imposition { left, right }).
  spread: { type: Object, default: null },
  types: { type: Object, required: true },
  suggestions: { type: Object, required: true },
  // Config de tagging liminaire, mutée EN PLACE (frontières de découpage).
  config: { type: Object, required: true },
  // Index LOCAL du vis-à-vis focusé + nombre de vis-à-vis (bornes des chevrons).
  focused: { type: Number, required: true },
  spreadCount: { type: Number, required: true },
})

defineEmits(['set-type', 'update:focused'])

// ── Géométrie : origine de l'overlay (pour ramener les rects écran en local) ──
const rootRef = ref(null)
const origin = ref({ left: 0, top: 0 })

function measure() {
  const el = rootRef.value
  if (!el) return
  const r = el.getBoundingClientRect()
  origin.value = { left: r.left, top: r.top }
}

let ro = null
onMounted(() => {
  measure()
  ro = new ResizeObserver(measure)
  ro.observe(rootRef.value)
})
onBeforeUnmount(() => ro?.disconnect())
// Chaque nouvelle géométrie (repagination, échelle, molette) peut naître d'un
// relayout qui déplace aussi l'overlay : on ré-ancre l'origine avant de recalculer.
watch(() => props.geometry, measure)

// Repères de la planche en coordonnées LOCALES de l'overlay.
const geo = computed(() => {
  const pages = props.geometry?.pages
  if (!pages?.length) return null
  const o = origin.value
  const rects = pages.map((r) => ({
    left: r.left - o.left,
    top: r.top - o.top,
    right: r.left - o.left + r.width,
    bottom: r.top - o.top + r.height,
    cx: r.left - o.left + r.width / 2,
    height: r.height,
  }))
  const top = Math.min(...rects.map((r) => r.top))
  const bottom = Math.max(...rects.map((r) => r.bottom))
  return {
    rects,
    leftX: rects[0].left,
    rightX: rects[rects.length - 1].right,
    midY: (top + bottom) / 2,
  }
})

// Un select par page taguable : cellule qui porte une page (ni blanche ni garde),
// alignée sur son rect. pages[0] ↔ spread.left, pages[1] ↔ spread.right.
const typeSlots = computed(() => {
  const g = geo.value
  const sp = props.spread
  if (!g || !sp) return []
  const cells = [sp.left, sp.right]
  const out = []
  g.rects.forEach((rect, i) => {
    const cell = cells[i]
    if (!cell || cell.cover || cell.blank || !cell.page) return
    const key = cell.page.key
    const type = props.types[key] ?? ''
    out.push({
      key,
      page: cell.page,
      type,
      // `pending` = suggestion non encore décidée ; un type posé referme la question.
      pending: type ? null : (props.suggestions[key] ?? null),
      // Sous la page, centré : le select est en dehors du folio, il n'en masque
      // pas le contenu.
      x: rect.cx,
      y: rect.bottom,
    })
  })
  return out
})

// Éléments rendus de la page, OUTLINÉS (visibles par défaut) : un rect par
// paragraphe (`blockGeometry`, clé = `entry.key`). Chaque outline porte, révélée à
// SON survol, la flèche de découpage adéquate, centrée verticalement à son bord
// extérieur (gauche du verso, droite du recto) :
//  - « nouvelle page » (scinder) sur tout paragraphe sauf le 1er de sa page —
//    scinder devant le premier serait un non-geste ;
//  - « renvoi » (rattacher la page à la précédente) sur le 1er paragraphe d'une
//    page qui n'est pas la toute première du liminaire.
// La structure logique (cellules du vis-à-vis) donne le QUOI (page/rang) ; le rect
// donne le OÙ. La flèche est enfant de l'outline → la survoler garde le survol de
// l'outline (pas de clignotement), et le CSS `:hover` seul la révèle.
const elements = computed(() => {
  const g = geo.value
  const sp = props.spread
  if (!g || !sp) return []
  const o = origin.value
  // Clé d'entrée → { côté, rang dans la page, page } depuis les cellules.
  const info = new Map()
  ;[sp.left, sp.right].forEach((cell, i) => {
    if (!cell || cell.cover || cell.blank || !cell.page) return
    const page = cell.page
    ;(page.entries ?? []).forEach((entry, ei) =>
      info.set(entry.key, { side: i === 0 ? 'left' : 'right', ei, page }),
    )
  })

  const out = []
  for (const b of props.blockGeometry ?? []) {
    const meta = info.get(b.key)
    if (!meta) continue
    let arrow = null
    if (meta.ei > 0) {
      arrow = {
        kind: 'split',
        active: breakOfKey(props.config, b.key) === 'start',
        title: 'Démarrer une nouvelle page ici',
        onClick: () => toggleBreak(props.config, b.key, 'start'),
      }
    } else if (meta.page.ordinal > 0) {
      arrow = {
        kind: 'join',
        active: breakOfKey(props.config, meta.page.key) === 'joined',
        title: 'Rattacher cette page à la précédente',
        onClick: () => toggleBreak(props.config, meta.page.key, 'joined'),
      }
    }
    out.push({
      key: b.key,
      side: meta.side,
      left: b.left - o.left,
      top: b.top - o.top,
      width: b.width,
      height: b.height,
      arrow,
    })
  }
  return out
})

function labelOf(key) {
  return LIMINAIRE_BY_KEY.get(key)?.label ?? key
}
</script>

<style scoped>
/* Racine inerte : elle ne fait que porter les contrôles positionnés (le folio
   dessous garde le pointeur et le survol). */
.lim-ctl {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* Chevron de navigation, posé au bord de la planche. */
.lim-ctl__nav {
  position: absolute;
  pointer-events: auto;
  display: grid;
  place-items: center;
  width: 2.2em;
  height: 2.2em;
  border: 1px solid var(--c-border);
  border-radius: 50%;
  background: var(--c-card-float);
  backdrop-filter: var(--c-backdrop-filter-blur);
  color: var(--c-ink2);
  font: inherit;
  cursor: pointer;
}

.lim-ctl__nav:hover { border-color: var(--c-accent); color: var(--c-accent); }

/* Ferrés à l'extérieur du bord : le prev sort à gauche, le next à droite. */
.lim-ctl__nav--prev { transform: translate(calc(-100% - 0.5em), -50%); }
.lim-ctl__nav--next { transform: translate(0.5em, -50%); }

/* Select de type, centré SOUS la page (ancré à son bord bas). */
.lim-ctl__type {
  position: absolute;
  pointer-events: auto;
  transform: translate(-50%, 0.5em);
}

.lim-ctl__select {
  min-width: 11em;
}

/* Un type encore SUGGÉRÉ (non décidé) : le select reprend la signature de
   l'indice — trait discontinu et teinte d'accent — pour qu'on lise « proposé ». */
.lim-ctl__select.has-suggestion {
  border-style: dashed;
  border-color: var(--c-accent);
  color: var(--c-accent);
}

.lim-ctl__select .opt-suggest {
  color: var(--c-accent);
  font-weight: 600;
}

/* Outline d'un élément rendu (paragraphe) : visible par défaut, discret ; il
   marque la structure de la page et sert de cible de survol pour sa flèche. */
.lim-ctl__outline {
  position: absolute;
  pointer-events: auto;
  border: 1px dashed color-mix(in srgb, var(--c-accent-alt) 45%, transparent);
  border-radius: var(--radius-sm);
  transition: background-color 0.12s ease, border-color 0.12s ease;
}

.lim-ctl__outline:hover {
  border-style: solid;
  border-color: var(--c-accent-alt);
  background: color-mix(in srgb, var(--c-accent-alt) 8%, transparent);
}

/* Flèche de découpage : pastille à fond transparent, centrée VERTICALEMENT au bord
   extérieur de l'élément. Masquée au repos, révélée au survol de SON outline
   (enfant → survoler la flèche garde le survol de l'outline, pas de clignotement). */
.lim-ctl__op {
  position: absolute;
  top: 50%;
  display: grid;
  place-items: center;
  width: 1.6em;
  height: 1.6em;
  border: 1px solid var(--c-border);
  border-radius: 50%;
  background: var(--c-card-float);
  backdrop-filter: var(--c-backdrop-filter-blur);
  color: var(--c-ink2);
  font: inherit;
  font-size: var(--fs-xs);
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;
}

.lim-ctl__outline:hover .lim-ctl__op {
  opacity: 1;
  pointer-events: auto;
}

/* Frontière déjà posée : la flèche (révélée au survol) prend la teinte d'accent. */
.lim-ctl__op.is-active {
  color: var(--c-accent);
  border-color: var(--c-accent);
}

/* Au bord extérieur : à gauche du verso, à droite du recto (juste hors de l'élément). */
.lim-ctl__op--left { left: 0; transform: translate(calc(-100% - 0.3em), -50%); }
.lim-ctl__op--right { left: 100%; transform: translate(0.3em, -50%); }
</style>
