<template>
  <select
      class="base-select"
      :value="modelValue"
      @change="$emit('update:modelValue', $event.target.value)"
  >
    <slot />
  </select>
</template>

<script setup>
defineProps({
  modelValue: { type: [String, Number], default: null },
})

defineEmits(['update:modelValue'])
</script>

<style scoped>
.base-select {
  padding: 0.35em 0.5em;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-surface);
  color: inherit;
  font: inherit;
  font-size: var(--fs-md);
}
</style>
