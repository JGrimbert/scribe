<template>
  <main v-if="trame && data" class="contenu-list">
    <div
        v-for="section in sections"
        :key="section.id"
        class="section"
        :class="`depth-${section.depth} type-${section.type}`"
    >
      <h3 class="titre">{{ section.titre || '(sans titre)' }}</h3>

      <QuillBlock
          :model-value="section.texte"
          :active="activeBlockId === blockId(section.id, 'texte')"
          @request-activate="activeBlockId = blockId(section.id, 'texte')"
          @update:model-value="(v) => onTexteUpdate(section, v)"
      />

      <div
          v-if="section.connexe && section.connexe.pistes && section.connexe.pistes.length"
          class="pistes"
      >
        <div class="pistes-label">Pistes</div>
        <QuillBlock
            :model-value="section.connexe.pistes"
            :active="activeBlockId === blockId(section.id, 'pistes')"
            @request-activate="activeBlockId = blockId(section.id, 'pistes')"
            @update:model-value="(v) => onPistesUpdate(section, v)"
        />
      </div>
    </div>
  </main>

  <div v-else class="empty">
    <p>Chargement ou absence de trame / data…</p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import QuillBlock from './QuillBlock.vue'

const props = defineProps({
  trame: Object, // trame.json — hiérarchie par ids
  data: Object,  // data.json — collection { [id]: item }
})

const emit = defineEmits(['update'])

// Un seul id de bloc actif pour toute la liste — c'est ce qui garantit
// qu'activer un Quill désactive automatiquement celui qui l'était avant
// (chaque QuillBlock compare son propre id à activeBlockId via la prop `active`).
//
// NOTE PAGINATION (à venir) : ce registre à une seule valeur deviendra le point
// d'accroche pour la future architecture "page simulée" — quand un même article
// sera scindé en plusieurs QuillBlock chaînés (fin/début de page), il faudra
// remplacer activeBlockId par un ensemble de blocs actifs appartenant à une même
// chaîne logique, pour pouvoir naviguer/écrire d'une page à l'autre comme si
// c'était un seul éditeur continu. Rien à construire pour ça maintenant.
const activeBlockId = ref(null)

function blockId(sectionId, field) {
  return `${sectionId}::${field}`
}

// Aplatit axes > blocs > articles en une liste plate, dans l'ordre du document.
const sections = computed(() => {
  if (!props.trame || !props.data) return []
  const out = []
  for (const axe of props.trame.axes) {
    pushSection(out, axe.id, 0)
    for (const bloc of axe.blocs) {
      pushSection(out, bloc.id, 1)
      for (const articleId of bloc.articles) {
        pushSection(out, articleId, 2)
      }
    }
  }
  return out
})

function pushSection(out, id, depth) {
  const item = props.data[id]
  if (!item) return
  out.push({ ...item, depth })
}

function onTexteUpdate(section, texte) {
  emit('update', { id: section.id, field: 'texte', value: texte })
}

function onPistesUpdate(section, pistes) {
  emit('update', { id: section.id, field: 'connexe.pistes', value: pistes })
}
</script>

<style scoped>
.contenu-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1rem;
  font-family: Georgia, 'Times New Roman', serif;
}
.section {
  border-bottom: 1px solid #eee;
  padding-bottom: 1rem;
}
.titre {
  font-family: Georgia, 'Times New Roman', serif;
}
.depth-0 .titre {
  font-size: 1.4rem;
  font-weight: 700;
}
.depth-1 .titre {
  font-size: 1.15rem;
  font-weight: 600;
  margin-left: 0.5rem;
}
.depth-2 .titre {
  font-size: 1rem;
  font-weight: 500;
  margin-left: 1.5rem;
}
.pistes {
  margin-top: 0.5rem;
  margin-left: 1rem;
}
.pistes-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: #888;
  margin-bottom: 0.25rem;
}
.empty {
  padding: 2rem;
  text-align: center;
  color: #888;
}
</style>