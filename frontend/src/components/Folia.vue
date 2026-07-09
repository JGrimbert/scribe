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

  // Nombre RÉEL de folios dans la rangée (dimensionne la zone défilable).
  pageCount: {
    type: Number,
    default: 2,
  },

  // Cible de zoom : combien de pages doivent tenir dans la largeur visible,
  // INDÉPENDAMMENT du nombre réel de folios (pageCount). Au-delà, les folios
  // supplémentaires défilent horizontalement plutôt que de réduire le zoom.
  visiblePages: {
    type: Number,
    default: 2.5,
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

function widthForPageCount(count) {
  return props.pageWidthMm * MM_TO_PX * count +
      props.gapPx * (count - 1)
}

// Largeur réelle de la rangée (tous les folios) : détermine la place à
// réserver pour le défilement, ne joue AUCUN rôle dans le calcul du zoom.
const actualSpreadWidthPx = computed(() =>
    widthForPageCount(Math.max(props.pageCount, 1))
)

// Largeur de référence (visiblePages) : seule base du calcul du zoom.
const targetWidthPx = computed(() =>
    widthForPageCount(props.visiblePages)
)

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
      targetWidthPx.value

  const scaleY =
      (availableHeight * 0.92) /
      spreadHeightPx.value

  let nextScale =
      Math.min(scaleX, scaleY)

  if (!props.allowUpscale) {
    nextScale = Math.min(nextScale, 1)
  }

  scale.value = Math.max(nextScale, 0.01)
}

const wrapperStyle = computed(() => ({
  width: `${actualSpreadWidthPx.value * scale.value}px`,
  height: `${spreadHeightPx.value * scale.value}px`,
}))

const spreadStyle = computed(() => ({
  width: `${actualSpreadWidthPx.value}px`,
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
  height: 100%;
  display: flex;
  align-items: center;
}

.spread-wrapper {
  flex-shrink: 0; /* sinon le flex du parent .spread-scaler compresse le wrapper au lieu de laisser déborder/scroller */
}

.spread {
  display: flex;
  align-items: flex-start; /* éviter le stretch vertical par défaut */
  flex-wrap: nowrap;
  gap: v-bind('`${props.gapPx}px`');
}
</style>