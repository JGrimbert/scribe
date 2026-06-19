<template>
  <div ref="containerRef" className="folio-scaler">
    <slot
        :scale="scale"
        :scalePercent="Math.round(scale * 100)"
    />
  </div>
</template>

<script setup>
import {ref, onMounted, onBeforeUnmount} from 'vue'

const props = defineProps({
  pageWidthMm: {type: Number, default: 150},
  pageHeightMm: {type: Number, default: 210},
  pagesPerRow: {type: Number, default: 2},
  gapPx: {type: Number, default: 32},
  allowUpscale: {type: Boolean, default: false},
})

const containerRef = ref(null)
const scale = ref(1)

let observer

function updateScale() {
  if (!containerRef.value) return

  const {clientWidth, clientHeight} = containerRef.value

  const mmToPx = 3.779527559

  const pageWidthPx = props.pageWidthMm * mmToPx
  const pageHeightPx = props.pageHeightMm * mmToPx

  const scaleX =
      (
          clientWidth -
          props.gapPx * (props.pagesPerRow - 1)
      ) /
      (pageWidthPx * props.pagesPerRow)

  const scaleY =
      clientHeight /
      pageHeightPx

  let nextScale = Math.min(scaleX, scaleY)

  if (!props.allowUpscale) {
    nextScale = Math.min(nextScale, 1)
  }

  scale.value = Math.max(nextScale, 0.05)
}

onMounted(() => {
  updateScale()

  observer = new ResizeObserver(updateScale)

  if (containerRef.value) {
    observer.observe(containerRef.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
})
</script>

<style scoped>
.folio-scaler {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>