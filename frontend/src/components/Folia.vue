<template>
  <div
      ref="containerRef"
      class="spread-scaler"
  >
    <div
        class="spread-wrapper"
        :style="wrapperStyle"
    >
      <div
          class="spread"
          :style="spreadStyle"
      >
        <slot
            :scale="scale"
            :scalePercent="scalePercent"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount
} from 'vue'

const MM_TO_PX = 3.779527559

const props = defineProps({
  pageWidthMm: {
    type: Number,
    default: 150,
  },

  pageHeightMm: {
    type: Number,
    default: 210,
  },

  pages: {
    type: Number,
    default: 2,
  },

  gapPx: {
    type: Number,
    default: 32,
  },

  allowUpscale: {
    type: Boolean,
    default: false,
  },
})

const containerRef = ref(null)
const scale = ref(1)

const spreadWidthPx = computed(() => {
  const pageCount = Math.max(props.pages, 1)
  return props.pageWidthMm * MM_TO_PX * pageCount +
      props.gapPx * (pageCount - 1)
})

const spreadHeightPx = computed(() =>
    props.pageHeightMm * MM_TO_PX
)

const scalePercent = computed(() =>
    Math.round(scale.value * 100)
)

function updateScale() {
  if (!containerRef.value) return

  const availableWidth =
      containerRef.value.clientWidth

  const availableHeight =
      containerRef.value.clientHeight

  const scaleX =
      availableWidth /
      spreadWidthPx.value

  const scaleY =
      availableHeight /
      spreadHeightPx.value

  let nextScale =
      Math.min(scaleX, scaleY)

  if (!props.allowUpscale) {
    nextScale = Math.min(nextScale, 1)
  }

  scale.value = Math.max(nextScale, 0.01)
}

const wrapperStyle = computed(() => ({
  width: `${spreadWidthPx.value * scale.value}px`,
  height: `${spreadHeightPx.value * scale.value}px`,
}))

const spreadStyle = computed(() => ({
  width: `${spreadWidthPx.value}px`,
  height: `${spreadHeightPx.value}px`,
  transform: `scale(${scale.value})`,
  transformOrigin: 'top left',
}))

let resizeObserver

onMounted(() => {
  updateScale()

  resizeObserver =
      new ResizeObserver(updateScale)

  resizeObserver.observe(
      containerRef.value
  )

  window.addEventListener(
      'resize',
      updateScale
  )
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()

  window.removeEventListener(
      'resize',
      updateScale
  )
})
</script>

<style scoped>
.spread-scaler {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  transform: scale(0.80);
  transform-origin: top left;
}

.spread {
  display: flex;
  align-items: flex-start; /* éviter le stretch vertical par défaut */
  flex-wrap: nowrap;
  gap: v-bind('`${props.gapPx}px`');
}
</style>