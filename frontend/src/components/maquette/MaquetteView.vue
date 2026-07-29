<template>
  <!-- Écran Maquette. Deux colonnes (2/3 main · 1/3 aside) qui se remplissent des
       inputs de la SOURCE focusée dans l'accordéon ; en bas, hors du flux et
       collé au bord, un dock accordéon (pellicule de crans). ITÉRATION 1 :
       coquille — sources factices, main/aside en placeholder. -->
  <div class="maquette">
    <div class="maquette__panels">
      <AnalyseBlock aside="right" bare>
        <template #main>
          <section class="maquette__main">
            <h2 class="maquette__title">{{ focusedTitle }}</h2>
            <p class="maquette__placeholder">
              Inputs du composant relatif à la source focusée — à câbler.
            </p>
          </section>
        </template>
        <template #aside>
          <section class="maquette__aside">
            <p class="maquette__placeholder">Aperçu / réglages secondaires — à câbler.</p>
          </section>
        </template>
      </AnalyseBlock>
    </div>

    <!-- Dock hors flux, calé sur la seule zone main (2/3) : même structure flex
         2:1 que `.split` au-dessus, l'aside n'est qu'un espaceur pour que
         l'accordéon s'aligne sous main et s'arrête à 2/3. -->
    <div class="maquette__dock">
      <div class="maquette__dock-main">
        <MaquetteAccordeon
            :crans="crans"
            :focused="focused"
            @update:focused="focused = $event"
        />
      </div>
      <div class="maquette__dock-aside" aria-hidden="true"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import MaquetteAccordeon from './MaquetteAccordeon.vue'
import AnalyseBlock from '../analyse/AnalyseBlock.vue'

// ITÉRATION 1 — sources FACTICES. Chaque source = une série de vis-à-vis ;
// `spreads` en fixe le nombre. Le câblage réel (format, liminaire, modèles de
// chapitrage) viendra source par source.
const sources = [
  { key: 'maquette', label: 'Maquette', spreads: 1 },
  { key: 'liminaire', label: 'Liminaire', spreads: 3 },
  { key: 'chap1', label: 'Chapitrage n1', spreads: 1 },
  { key: 'chap2', label: 'Chapitrage n2', spreads: 1 },
]

// Liste PLATE des crans : les vis-à-vis d'une source, puis un jalon avant la
// suivante (donc n-1 jalons pour n sources).
const crans = computed(() => {
  const out = []
  sources.forEach((src, si) => {
    for (let s = 0; s < src.spreads; s++) {
      out.push({ kind: 'spread', sourceKey: src.key, label: src.label })
    }
    if (si < sources.length - 1) {
      out.push({ kind: 'jalon', label: `${src.label} → ${sources[si + 1].label}` })
    }
  })
  return out
})

const focused = ref(0)

const focusedTitle = computed(() => {
  const cran = crans.value[focused.value]
  if (!cran) return ''
  return cran.kind === 'jalon' ? `Jalon · ${cran.label}` : cran.label
})
</script>

<style scoped>
.maquette {
  position: relative;
  height: 100%;
  overflow: hidden;
}

.maquette__panels {
  height: 100%;
  overflow: auto;
  padding: var(--sp-5);
  /* Réserve la place du dock (hors flux) pour que rien ne se cache dessous. */
  padding-bottom: 16em;
}

.maquette__title {
  margin: 0 0 var(--sp-2);
  font-size: var(--fs-lg);
  font-weight: 600;
}

.maquette__aside {
  padding: var(--sp-4);
}

.maquette__placeholder {
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}

/* Dock hors du flux, collé au bord bas. Fond transparent (les folios flottent au
   ras des panneaux). Structure flex 2:1 identique à `.split` : l'accordéon ne
   couvre que la zone main. */
.maquette__dock {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: var(--sp-4);
  padding: 0 var(--sp-5) var(--sp-4);
  pointer-events: none;
}

.maquette__dock-main {
  flex: 2 1 0;
  min-width: 0;
  pointer-events: auto;
}

.maquette__dock-aside {
  flex: 1 1 0;
}
</style>
