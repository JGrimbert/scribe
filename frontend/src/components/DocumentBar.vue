<template>
  <div class="doc-bar">
    <button
        class="doc-bar__chevron"
        :title="sidebarExpanded ? 'Replier la structure' : 'Déplier la structure'"
        @click="$emit('toggle-sidebar')"
    >
      <i class="pi" :class="sidebarExpanded ? 'pi-angle-left' : 'pi-angle-right'"></i>
    </button>

    <nav class="breadcrumb" aria-label="Fil d'Ariane">
      <button
          class="crumb crumb--root"
          :class="{ 'crumb--current': !currentNodeId }"
          :title="scoped ? 'Analyser le livre entier' : title"
          @click="$emit('select', null)"
      >
        {{ title || 'Livre' }}
      </button>

      <template v-for="crumb in crumbs" :key="crumb.id">
        <i class="pi pi-angle-right crumb-sep"></i>
        <button
            class="crumb"
            :class="{ 'crumb--current': crumb.id === currentNodeId }"
            @click="$emit('select', crumb.id)"
        >
          {{ crumb.titre }}
        </button>
      </template>
    </nav>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { pathToInAxes } from '../script/trame'

const props = defineProps({
  title: String,
  trame: Object,
  data: Object,
  currentNodeId: String,
  sidebarExpanded: Boolean,
  // true = mode analyse (le fil d'Ariane pilote le scope), false = édition.
  scoped: Boolean,
})

defineEmits(['toggle-sidebar', 'select'])

const crumbs = computed(() => {
  if (!props.currentNodeId || !props.trame || !props.data) return []
  return pathToInAxes(props.trame.axes, props.currentNodeId).map((id) => ({
    id,
    titre: props.data[id]?.titre || '(sans titre)',
  }))
})
</script>

<style scoped>
.doc-bar {
  position: relative;
  flex: 0 0 auto;
  height: var(--bar-size);
  display: flex;
  align-items: center;
  backdrop-filter: var(--c-backdrop-filter-blur);
  color: var(--c-ink);
  overflow: hidden;
}

/* Même teinte que le menu (accent + saturate), opacité moindre : un cadet plus
   clair de la topbar, qui se fond entre elle et la sidebar (camaïeu). */
.doc-bar::before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--c-accent);
  opacity: 0.16;
  filter: saturate(2);
  z-index: -1;
}

/* Le chevron occupe exactement la largeur du rail : il se pose au-dessus de la
   sidebar repliée, prolongeant visuellement la colonne (« fondu »). */
.doc-bar__chevron {
  flex: 0 0 auto;
  width: var(--bar-size);
  height: var(--bar-size);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: var(--op-soft);
}

.doc-bar__chevron:hover {
  opacity: 1;
}

.breadcrumb {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.15em;
  overflow: hidden;
  white-space: nowrap;
  padding-right: 0.6em;
}

.crumb {
  flex: 0 1 auto;
  min-width: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--fs-sm);
  padding: 0.15em 0.35em;
  border-radius: var(--radius-sm);
  cursor: pointer;
  opacity: var(--op-soft);
  overflow: hidden;
  text-overflow: ellipsis;
}

.crumb--root {
  font-weight: bold;
  flex-shrink: 0;
}

.crumb:hover {
  opacity: 1;
  background: var(--c-surface3);
}

.crumb--current {
  opacity: 1;
  color: var(--c-accent);
  font-weight: bold;
}

.crumb-sep {
  flex: 0 0 auto;
  font-size: 0.7em;
  opacity: var(--op-faint);
}
</style>
