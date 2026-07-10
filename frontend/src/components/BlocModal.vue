<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <button class="close" @click="$emit('close')">✕</button>

      <h2>{{ node.titre }}</h2>

      <ul v-if="node.children.length">
        <li v-for="child in node.children" :key="child.id">
          {{ child.titre }}
        </li>
      </ul>
      <p v-else class="empty">Pas de sous-titre.</p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  node: Object,
})

defineEmits(['close'])
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal {
  background: var(--c-surface4, white);
  border-radius: 1em;
  padding: 1.5em;
  width: min(480px, 90vw);
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
}

.close {
  position: absolute;
  top: 0.75em;
  right: 0.75em;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 1em;
}

.empty {
  opacity: 0.6;
}
</style>
