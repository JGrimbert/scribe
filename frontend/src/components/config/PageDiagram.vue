<template>
  <!-- Aperçu schématique recto/verso. Convention typographique (Imprimerie
       nationale) : l'EMPAGEMENT (rectangle bordé) est la surface imprimée dans
       les marges, titre courant + folio COMPRIS. Le blanc de tête/pied va du
       bord de la feuille au bord de l'empagement. L'en-tête occupe le haut de
       l'empagement, le folio le bas, et le CORPS de texte se réduit d'autant.
       Ombres portées harmonisées avec le carrousel de pages. -->
  <figure class="diagram">
    <svg :viewBox="`0 0 ${g.vbW} ${g.vbH}`" role="img" :aria-label="ariaLabel">
      <template v-for="p in g.pages" :key="p.side">
        <rect class="page" :x="p.x" :y="g.pageY" :width="g.PW" :height="g.PH" rx="1" />
        <!-- Empagement : titre courant + corps + folio ; la marge = l'écart avec
             la bordure de page. -->
        <rect class="emp" :x="p.emp.x" :y="p.emp.y" :width="p.emp.w" :height="p.emp.h" />
        <!-- En-tête / pied : au sommet / au bas de l'empagement (dedans). -->
        <rect v-if="p.header" class="band" :x="p.header.x" :y="p.header.y" :width="p.header.w" :height="p.header.h" />
        <rect v-if="p.footer" class="band" :x="p.footer.x" :y="p.footer.y" :width="p.footer.w" :height="p.footer.h" />
        <!-- Folio : rectangle grisé DANS sa bande (pleine hauteur), sans chiffre. -->
        <rect v-for="(f, i) in p.folios" :key="i" class="folio" :x="f.x" :y="f.y" :width="f.w" :height="f.h" rx="1.5" />
        <text class="side" :x="p.x + g.PW / 2" :y="g.pageY + g.PH + 18" text-anchor="middle">{{ p.label }}</text>
      </template>
    </svg>
  </figure>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // { widthCm, heightCm } — dimensions effectives.
  pageSize: { type: Object, default: null },
  // { topCm, bottomCm, innerCm, outerCm } — marges miroir effectives.
  margins: { type: Object, default: null },
  // { header, footer } — cf. style-defaults (le folio est un contenu de bande).
  runningTitles: { type: Object, default: null },
})

const PH = 300 // hauteur de page en unités SVG ; la largeur suit le ratio

const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi))

const g = computed(() => {
  const ps = props.pageSize || { widthCm: 14.8, heightCm: 21 }
  const ratio = (ps.widthCm || 14.8) / (ps.heightCm || 21)
  const PW = PH * ratio
  const scale = PH / (ps.heightCm || 21)

  const m = props.margins || { topCm: 2, bottomCm: 2, innerCm: 1.5, outerCm: 2 }
  const mt = m.topCm * scale
  const mb = m.bottomCm * scale
  const inner = m.innerCm * scale
  const outer = m.outerCm * scale

  const rt = props.runningTitles || {}

  const padX = 18 // marge autour (place pour l'ombre + les libellés)
  const padTop = 16
  const padBottom = 28
  const gap = 10
  const pageY = padTop
  const versoX = padX
  const rectoX = padX + PW + gap

  // Empagement (surface imprimée dans les marges). Verso : grand fond à GAUCHE,
  // petit fond à DROITE (vers la reliure) ; recto inversé.
  const empOf = (pageX, isVerso) => ({
    x: pageX + (isVerso ? outer : inner),
    y: pageY + mt,
    w: PW - inner - outer,
    h: PH - mt - mb,
  })

  // Le folio est un CONTENU (`folio`) : un rectangle grisé DANS sa bande, à sa
  // pleine hauteur, placé selon la justification. `regard` = bord extérieur.
  const folioInBand = (band, box, isVerso) => {
    if (!band?.enabled || !box) return null
    const side = isVerso ? band.verso : band.recto
    if (side !== 'folio') return null
    const w = Math.min(20, box.w - 4)
    let x
    if (band.justification === 'regard') x = isVerso ? box.x : box.x + box.w - w
    else x = box.x + box.w / 2 - w / 2
    return { x, y: box.y, w, h: box.h }
  }

  const build = (side, pageX, isVerso, label) => {
    const emp = empOf(pageX, isVerso)
    const maxBand = emp.h * 0.3
    // En-tête au sommet de l'empagement, pied au bas — le corps (non dessiné) est
    // l'écart entre les deux, donc réduit dès qu'une bande est là.
    const header = rt.header?.enabled
      ? { x: emp.x, y: emp.y, w: emp.w, h: clamp(rt.header.heightCm ? rt.header.heightCm * scale : 13, 4, maxBand) }
      : null
    const footer = rt.footer?.enabled
      ? (() => { const h = clamp(rt.footer.heightCm ? rt.footer.heightCm * scale : 11, 4, maxBand); return { x: emp.x, y: emp.y + emp.h - h, w: emp.w, h } })()
      : null

    const folios = [folioInBand(rt.header, header, isVerso), folioInBand(rt.footer, footer, isVerso)].filter(Boolean)

    return { side, x: pageX, label, emp, header, footer, folios }
  }

  const pages = [
    build('verso', versoX, true, 'verso · pair'),
    build('recto', rectoX, false, 'recto · impair'),
  ]

  return { PW, PH, pageY, vbW: padX * 2 + PW * 2 + gap, vbH: pageY + PH + padBottom, pages }
})

const ariaLabel = 'Aperçu de la mise en page recto/verso : marges, en-tête, pied et numéro de page'
</script>

<style scoped>
.diagram {
  margin: 0;
}

.diagram svg {
  width: 100%;
  max-width: 520px;
  height: auto;
  display: block;
  margin: 0 auto;
  overflow: visible; /* laisse l'ombre portée déborder du viewBox */
}

/* Traits nets quelle que soit l'échelle (largeur en px de rendu, pas en viewBox). */
.page,
.emp,
.band {
  vector-effect: non-scaling-stroke;
}

/* Page : blanc + fine bordure + ombre portée — mêmes valeurs que les pages du
   carrousel (cf. useFolioFrame : box-shadow 0 1px 6px rgba(0,0,0,.15)). */
.page {
  fill: var(--c-surface);
  stroke: var(--c-border);
  stroke-width: 1;
  filter: drop-shadow(0 1px 6px rgba(0, 0, 0, 0.15));
}

/* Empagement + en-tête/pied : MÊME bordure gris clair que le rectangle de page. */
.emp,
.band {
  fill: none;
  stroke: var(--c-border);
  stroke-width: 1;
}

/* Folio : seul élément grisé, avec la même ombre que les pages. */
.folio {
  fill: color-mix(in srgb, var(--c-ink2) 32%, transparent);
  filter: drop-shadow(0 1px 6px rgba(0, 0, 0, 0.15));
}

.side {
  fill: var(--c-ink2);
  font-family: var(--font-ui);
  font-size: 11px;
  font-variant: small-caps;
  letter-spacing: 0.03em;
}
</style>
