<template>
  <div class="home">
    <header class="home__header">
      <h2>Vos manuscrits</h2>
      <p class="home__hint">
        Choisissez un document à étudier, ou importez-en un nouveau. La liste reste accessible
        depuis l'écran de configuration de chaque document.
      </p>
    </header>

    <DocumentList @select="open" />

    <footer class="home__footer">
      <ImportButton />
    </footer>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import DocumentList from './DocumentList.vue'
import ImportButton from './ImportButton.vue'

const router = useRouter()

// Depuis l'accueil on entre dans le document par son écran de travail (le
// dashboard), pas par sa configuration : on vient lire ce qu'il raconte. C'est
// l'aside de la config qui, elle, fait changer de document à écran constant.
function open(id) {
  router.push(`/documents/${id}`)
}
</script>

<style scoped>
.home {
  padding: var(--sp-6) var(--sp-4);
  max-width: 42em;
  margin: 0 auto;
  width: 100%;
}

.home__header h2 {
  margin: 0 0 var(--sp-2);
  font-size: var(--fs-lg);
}

.home__hint {
  margin: 0 0 var(--sp-6);
  color: var(--c-ink2);
  font-size: var(--fs-md);
  max-width: 52ch;
}

.home__footer {
  margin-top: var(--sp-6);
}
</style>
