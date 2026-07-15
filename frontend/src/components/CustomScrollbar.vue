<template>
  <div class="custom-scrollbar" ref="containerEl">
    <div class="custom-scrollbar__content" ref="contentEl" @scroll="handleScroll">
      <slot />
    </div>
    <div
        class="custom-scrollbar__track"
        ref="trackEl"
        @click="handleTrackClick"
        :style="trackStyle"
    >
      <div
          class="custom-scrollbar__thumb"
          ref="thumbEl"
          @mousedown="handleThumbMouseDown"
          :style="thumbStyle"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'

const containerEl = ref(null)
const contentEl = ref(null)
const trackEl = ref(null)
const thumbEl = ref(null)

const props = defineProps({
  topOffset: { type: Number, default: 0 }
})

// État
const isDragging = ref(false)
const dragStartY = ref(0)
const scrollStartY = ref(0)
const containerHeight = ref(0)
const contentHeight = ref(0)
const trackHeight = ref(0)
const thumbHeight = ref(0)
const thumbPosition = ref(0)

// Calcul des dimensions (relatif au container parent)
function updateDimensions() {
  if (!containerEl.value || !contentEl.value || !trackEl.value) return

  const containerRect = containerEl.value.getBoundingClientRect()
  containerHeight.value = containerRect.height
  contentHeight.value = contentEl.value.scrollHeight

  // Hauteur de la track = hauteur du container parent
  trackHeight.value = containerHeight.value

  // Hauteur du thumb (proportionnelle)
  const ratio = containerHeight.value / contentHeight.value
  thumbHeight.value = Math.max(20, trackHeight.value * ratio)

  updateThumbPosition()
}

function updateThumbPosition() {
  if (!contentEl.value) return
  const scrollY = contentEl.value.scrollTop
  const maxScroll = contentHeight.value - containerHeight.value

  if (maxScroll <= 0) {
    thumbPosition.value = 0
    return
  }

  const ratio = scrollY / maxScroll
  thumbPosition.value = ratio * (trackHeight.value - thumbHeight.value)
}

function handleScroll() {
  updateThumbPosition()
}

function handleTrackClick(e) {
  if (!contentEl.value || !trackEl.value) return
  const trackRect = trackEl.value.getBoundingClientRect()
  const clickY = e.clientY - trackRect.top
  const thumbCenter = thumbHeight.value / 2
  let newPosition = Math.max(0, Math.min(clickY - thumbCenter, trackHeight.value - thumbHeight.value))

  const ratio = newPosition / (trackHeight.value - thumbHeight.value)
  contentEl.value.scrollTop = ratio * (contentHeight.value - containerHeight.value)
}

function handleThumbMouseDown(e) {
  isDragging.value = true
  dragStartY.value = e.clientY
  scrollStartY.value = contentEl.value.scrollTop
  e.preventDefault()
}

function handleMouseMove(e) {
  if (!isDragging.value || !contentEl.value) return
  const deltaY = e.clientY - dragStartY.value
  const newThumbPosition = Math.max(0, Math.min(thumbPosition.value + deltaY, trackHeight.value - thumbHeight.value))

  const ratio = newThumbPosition / (trackHeight.value - thumbHeight.value)
  contentEl.value.scrollTop = ratio * (contentHeight.value - containerHeight.value)

  dragStartY.value = e.clientY
  thumbPosition.value = newThumbPosition
}

function handleMouseUp() {
  isDragging.value = false
}


let mutationObserver = null

onMounted(() => {
  nextTick(() => {
    updateDimensions()

    // Observer les changements dans le contenu
    mutationObserver = new MutationObserver(() => {
      nextTick(() => {
        updateDimensions()
      })
    })

    if (contentEl.value) {
      mutationObserver.observe(contentEl.value, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
      })
    }
  })

  contentEl.value.addEventListener('scroll', handleScroll)
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)

  const resizeObserver = new ResizeObserver(updateDimensions)
  resizeObserver.observe(containerEl.value)
  resizeObserver.observe(contentEl.value)

  onUnmounted(() => {
    if (mutationObserver) {
      mutationObserver.disconnect()
    }
    contentEl.value?.removeEventListener('scroll', handleScroll)
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
    resizeObserver.disconnect()
  })
})

const trackStyle = computed(() => ({
  height: `${trackHeight.value-props.topOffset}px`,
  marginTop: `${props.topOffset}px`
}))

const thumbStyle = computed(() => ({
  height: `${thumbHeight.value-props.topOffset}px`,
  transform: `translateY(${thumbPosition.value}px)`
}))
</script>

<style scoped>
.custom-scrollbar {
  position: relative;
  height: 100%;
  width: 100%;
}

.custom-scrollbar__content {
  height: 100%;
  width: 100%;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding-right: 12px;
  padding-bottom: 296px;
}

.custom-scrollbar__content::-webkit-scrollbar {
  display: none;
}

.custom-scrollbar__track {
  position: absolute;
  right: 0;
  top: 0;
  width: 12px;
  background: rgba(0, 0, 0, 0.1);
  cursor: pointer;
  pointer-events: none;
  z-index: 10;
  border-radius: 6px;
}

.custom-scrollbar__thumb {
  position: absolute;
  right: 0;
  top: 0;
  width: 12px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 6px;
  cursor: pointer;
  pointer-events: auto;
  transition: background 0.2s ease;
}

.custom-scrollbar__thumb:hover {
  background: rgba(0, 0, 0, 0.6);
}

.custom-scrollbar__thumb:active {
  background: rgba(0, 0, 0, 0.8);
}

.custom-scrollbar__track:hover {
  pointer-events: auto;
  background: rgba(0, 0, 0, 0.2);
}
</style>