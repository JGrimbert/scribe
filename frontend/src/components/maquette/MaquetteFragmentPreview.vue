<template>
  <!-- Aperçu LÉGER du nœud survolé dans la liste des familles : pas de Paged.js,
       pas d'iframe — juste le titre + les premiers paragraphes rendus en HTML nu,
       stylés par les visuals du .odt (police/corps/alignement/emphase). But :
       reconnaître une famille d'un coup d'œil, instantanément. Le vrai FolioView
       (témoin du modèle) reste dessous, il ne bouge plus au survol. -->
  <div class="mfp" aria-hidden="true">
    <div class="mfp-sheet" :style="{ aspectRatio: ratio }">
      <div class="mfp-flow">
        <!-- data-style + apparence inline : même mapping que la feuille visuals de
             Paged.js (styleVisualToInlineCss), donc rendu fidèle des styles. -->
        <div
            v-for="row in rows"
            :key="row.key"
            class="mfp-row"
            :data-style="row.styleName"
            :style="row.css"
            v-html="row.html"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { buildBlocks } from '../../script/paginate.js'
import { styleVisualToInlineCss } from '../../script/folioStyles.js'

const props = defineProps({
  // Le nœud à esquisser (`data[nodeId]` : { titre, styleName, texte[]… }).
  node: { type: Object, default: null },
  // Id du nœud (pour construire les blocs) et sa profondeur (choix du tag de titre).
  nodeId: { type: String, default: null },
  depth: { type: Number, default: 0 },
  // Apparence par style effectif (`effectiveVisuals`) : styleName → StyleVisual.
  visuals: { type: Object, default: () => ({}) },
  // Ratio largeur/hauteur de la page effective (gabarit du feuillet).
  ratio: { type: Number, default: 148 / 210 },
})

// On ne coule que le HAUT du chapitre (le reste est masqué + fondu) : l'aperçu
// sert à reconnaître une famille, pas à lire le nœud.
const MAX_BLOCKS = 16

const rows = computed(() => {
  if (!props.node) return []
  const section = { ...props.node, id: props.nodeId ?? 'frag', depth: props.depth }
  return buildBlocks([section])
    .slice(0, MAX_BLOCKS)
    .map((b) => ({
      key: b.id,
      html: b.html,
      styleName: b.styleName,
      css: styleVisualToInlineCss(props.visuals?.[b.styleName]),
    }))
})
</script>

<style scoped>
/* Overlay par-dessus le FolioView (témoin), le temps du survol. Non interactif :
   la liste survolée vit ailleurs (le volet du bas). */
.mfp {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

/* Feuillet « façon page » : papier + ombre, au ratio du format, borné en hauteur
   par la scène. Le contenu qui déborde est masqué et fondu en bas. */
.mfp-sheet {
  position: relative;
  height: 100%;
  max-width: 100%;
  background: var(--c-surface0);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
  overflow: hidden;
  font-family: var(--font-serif);
  color: var(--c-ink);
}

.mfp-flow {
  height: 100%;
  /* Empagement approché (les marges réelles vivent dans le format ; ici on veut
     juste que le texte ne colle pas au bord). */
  padding: 8% 9%;
  overflow: hidden;
}

/* Fondu du bas : le texte s'efface au lieu d'être coupé net — on lit « le haut
   d'une page », pas un bloc tronqué. */
.mfp-sheet::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 28%;
  background: linear-gradient(to bottom, transparent, var(--c-surface0));
  pointer-events: none;
}

/* Le wrapper porte l'apparence du style (inline) ; l'inline hérite aux enfants
   pour la police/le corps/l'alignement. Les titres/paragraphes internes gardent
   leurs marges par défaut (elles fusionnent avec celles du wrapper). */
.mfp-row :deep(h1),
.mfp-row :deep(h2),
.mfp-row :deep(h3),
.mfp-row :deep(h4),
.mfp-row :deep(h5),
.mfp-row :deep(h6),
.mfp-row :deep(p),
.mfp-row :deep(ul),
.mfp-row :deep(ol) {
  font: inherit;
  color: inherit;
  text-align: inherit;
}
</style>
