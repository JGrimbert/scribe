<template>
  <div
      class="scaled-folio"
      :style="outerStyle"
  >
    <div
        class="scaled-folio-inner"
        :style="innerStyle"
    >
      <slot />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  scale: {
    type: Number,
    required: true,
  },

  widthMm: {
    type: Number,
    default: 150,
  },

  heightMm: {
    type: Number,
    default: 210,
  },
})

const outerStyle = computed(() => ({
  width: `${props.widthMm * props.scale}mm`,
  height: `${props.heightMm * props.scale}mm`,
  flex: '0 0 auto',
}))

const innerStyle = computed(() => ({
  width: `${props.widthMm}mm`,
  height: `${props.heightMm}mm`,
  transform: `scale(${props.scale})`,
  transformOrigin: 'top left',
}))
</script>

<style scoped>
.scaled-folio {
  position: relative;
  overflow: hidden;
}

.scaled-folio-inner {
  position: absolute;
  inset: 0;
}
</style>