<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <button class="close" @click="$emit('close')">✕</button>

      <h2>{{ openedBloc.bloc.titre }}</h2>
      <p class="axe">{{ openedBloc.axe.titre }}</p>

      <ul>
        <li v-for="a in openedBloc.bloc.articles" :key="a.slug">
          {{ a.titre }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
defineProps({
  openedBloc: Object
})

defineEmits(['close'])
</script>