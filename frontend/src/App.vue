<template>
  <div class="app" :data-bar-theme="barTheme">
    <div class="menu">
      <span class="brand">
        <span class="brand__mark">
          <svg class="brand__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 20l10 -10m0 -5v5h5m-9 -1v5h5m-9 -1v5h5" />
            <path d="M19 10c.638 -.636 1 -1.515 1 -2.486a3.515 3.515 0 0 0 -3.517 -3.514c-.97 0 -1.847 .367 -2.483 1" />
          </svg>
        </span>
        <span class="brand__name">Scribe</span>
      </span>
      <div class="menu-actions">
        <BaseButton
            variant="ghost"
            icon="pi-book"
            :active="route.name === 'registry'"
            title="Registre des documents"
            @click="router.push('/')"
        />
        <BaseButton
            v-if="lastDocumentId"
            variant="ghost"
            icon="pi-chart-bar"
            :active="route.name === 'document'"
            title="Analyse"
            @click="router.push(`/documents/${lastDocumentId}`)"
        />
        <BaseButton
            v-if="lastDocumentPath"
            variant="ghost"
            icon="pi-file-edit"
            :active="isDocumentRoute"
            title="Éditeur"
            @click="router.push(lastDocumentPath)"
        />
        <BaseButton
            variant="ghost"
            icon="pi-eye"
            :active="quillVisible"
            :title="quillVisible ? 'Masquer la fenêtre Quill' : 'Afficher la fenêtre Quill'"
            @click="quillVisible = !quillVisible"
        />
        <div ref="settingsEl" class="settings">
          <BaseButton
              variant="ghost"
              icon="pi-cog"
              title="Styles"
              :active="settingsOpen"
              @click="settingsOpen = !settingsOpen"
          />
          <div v-if="settingsOpen" class="settings-menu">
            <p class="settings-menu__label">Style des barres</p>
            <button
                v-for="opt in themes"
                :key="opt.id"
                class="settings-menu__item"
                :class="{ 'is-active': opt.id === barTheme }"
                @click="pickTheme(opt.id)"
            >
              <span class="settings-menu__swatch" :style="{ background: opt.swatch }"></span>
              <span class="settings-menu__name">{{ opt.label }}</span>
              <i v-if="opt.id === barTheme" class="pi pi-check settings-menu__check"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <router-view />
  </div>
</template>

<script setup>
import { ref, computed, provide, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from './components/ui/BaseButton.vue'

const route = useRoute()
const router = useRouter()

const quillVisible = ref(false)
provide('quillVisible', quillVisible)

// ── Thème des barres (topbar + fil d'Ariane), commuté via l'engrenage ──
// La pastille reprend la couleur d'accent de premier plan de chaque thème.
const themes = [
  { id: 'teal', label: 'Teal', swatch: '#138297' },
  { id: 'caramel', label: 'Caramel brûlé', swatch: '#b5551a' },
  { id: 'espresso', label: 'Espresso', swatch: '#7a3d12' },
]
const BAR_THEME_KEY = 'scribe.bar.theme'
const barTheme = ref(localStorage.getItem(BAR_THEME_KEY) || 'teal')
watch(barTheme, (v) => localStorage.setItem(BAR_THEME_KEY, v))

const settingsOpen = ref(false)
const settingsEl = ref(null)

function pickTheme(id) {
  barTheme.value = id
  settingsOpen.value = false
}

// Fermeture au clic extérieur (le clic d'ouverture reste dans settingsEl, donc
// n'auto-ferme pas).
function onDocClick(e) {
  if (settingsOpen.value && settingsEl.value && !settingsEl.value.contains(e.target)) {
    settingsOpen.value = false
  }
}
document.addEventListener('click', onDocClick)
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

const isDocumentRoute = computed(() => route.matched.some(r => r.name === 'document-layout'))

// Mémorise la dernière route document visitée pour le bouton "Éditeur"
// (équivalent de l'ancien `documentId` : montrer/retrouver le document en cours).
const lastDocumentPath = ref(null)
const lastDocumentId = ref(null)
router.afterEach((to) => {
  if (to.params.id) {
    lastDocumentPath.value = to.fullPath
    lastDocumentId.value = to.params.id
  }
})
</script>

<style lang="scss">
@import 'primeicons/primeicons.css';
@import "./assets/base.css";
@import "../public/paged.css";

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.scroll-folio {
  width: 100%; /* explicite : une marge auto désactiverait le stretch flex et ferait dépendre
                  la largeur du contenu mis à l'échelle par le JS — boucle de rétroaction avec Folia */
  height: 100%; /* PAS `flex: 1` : le parent (CustomScrollbar) est un bloc, le flex serait ignoré
                   et la hauteur deviendrait celle du contenu — Folia mesurerait alors sa propre
                   hauteur scalée et la réduirait de 0.92 à chaque passage, jusqu'à disparition */
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding-top: 1.5em;
  padding-bottom: 1.5em;
  padding-left: 1.5em;
}

/*
        MENU
 */

.menu {
  flex: 0 0 auto;
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  z-index: 1;
  color: #fff;
  background: var(--c-bar-accent);
/*  height: var(--bar-size);
  color: var(--c-ink2);
  box-shadow: var(--shadow-bar);*/

  &::before {
    content: "";
    position: absolute;
    inset: 0;
/*    background: var(--c-accent);
    opacity: 0.3;
    filter: saturate(2);*/
    z-index: -1;
  }

  .base-button--active {
    color: var(--c-bar-accent-color);
  }

  /* Wordmark : icône dans une boîte de largeur --bar-size, calée pile au-dessus
   du chevron du fil d'Ariane ; « Scribe » démarre donc à l'aplomb du premier
   crumb. Accent + letter-spacing = titre discret, sans aplat ni capitales. */
  .brand {
    display: flex;
    align-items: center;
  }

  .brand__mark {
    width: var(--bar-size);
    height: var(--bar-size);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--c-bar-accent-color);
  }

  .brand__icon {
    width: 20px;
    height: 20px;
  }

  .brand__name {
    color: var(--c-bar-accent-color);
    font-weight: 600;
    font-size: var(--fs-md);
    letter-spacing: 0.06em;
  }

}

.menu-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.6em;
  padding-right: 0.6em;
}


/* ── Menu de styles (engrenage) ── */
.settings {
  position: relative;
  display: flex;
}

.settings-menu {
  position: absolute;
  top: calc(100% + 0.4em);
  right: 0;
  min-width: 12em;
  background: var(--c-paper);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-pop);
  padding: 0.3em;
  z-index: 10;
}

.settings-menu__label {
  padding: 0.3em 0.5em 0.4em;
  font-size: var(--fs-xs);
  color: var(--c-muted);
}

.settings-menu__item {
  display: flex;
  align-items: center;
  gap: 0.6em;
  width: 100%;
  padding: 0.45em 0.5em;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: var(--fs-sm);
  color: var(--c-ink);
  text-align: left;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.settings-menu__item:hover {
  background: var(--c-hover);
}

.settings-menu__item.is-active {
  color: var(--c-bar-accent);
  font-weight: 600;
}

.settings-menu__swatch {
  flex: 0 0 auto;
  width: 0.9em;
  height: 0.9em;
  border-radius: var(--radius-pill);
}

.settings-menu__name {
  flex: 1 1 auto;
}

.settings-menu__check {
  flex: 0 0 auto;
  font-size: 0.8em;
}
</style>