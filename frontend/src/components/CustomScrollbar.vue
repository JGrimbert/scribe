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
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'

const containerEl = ref(null)
const contentEl = ref(null)
const trackEl = ref(null)
const thumbEl = ref(null)

const props = defineProps({
  // Sélecteur CSS pour l'élément du haut (ex: '.doc-bar')
  topElementSelector: {
    type: String,
    default: '.doc-bar'
  }
})

// État de drag
const isDragging = ref(false)
const dragStartY = ref(0)
const scrollStartY = ref(0)

// Calcul des dimensions et positions
const containerHeight = ref(0)
const contentHeight = ref(0)
const trackHeight = ref(0)
const trackTop = ref(0)
const thumbHeight = ref(0)
const thumbPosition = ref(0)

// Position de doc-bar
const docBarHeight = ref(0)
const menuHeight = ref(0)

// Mise à jour des dimensions
function updateDimensions() {
  if (!containerEl.value || !contentEl.value || !trackEl.value) return
  
  containerHeight.value = containerEl.value.clientHeight
  contentHeight.value = contentEl.value.scrollHeight
  
  // Calculer les hauteurs des barres
  const docBarEl = document.querySelector(props.topElementSelector)
  const menuEl = document.querySelector('.menu')
  
  if (docBarEl) {
    docBarHeight.value = docBarEl.offsetHeight
  }
  if (menuEl) {
    menuHeight.value = menuEl.offsetHeight
  }
  
  // Calculer la position et hauteur de la track
  // La track doit être positionnée entre le bas de doc-bar et le bas de la fenêtre
  const windowHeight = window.innerHeight
  trackTop.value = docBarHeight.value + menuHeight.value
  trackHeight.value = windowHeight - trackTop.value
  
  // Calcul de la hauteur du thumb (proportionnelle)
  const ratio = containerHeight.value / contentHeight.value
  thumbHeight.value = Math.max(20, trackHeight.value * ratio)
  
  // Position du thumb basée sur le scroll actuel
  updateThumbPosition()
}

// Mise à jour de la position du thumb
function updateThumbPosition() {
  if (!contentEl.value) return
  
  const scrollY = contentEl.value.scrollTop
  const maxScroll = contentHeight.value - containerHeight.value
  
  if (maxScroll <= 0) {
    thumbPosition.value = 0
    return
  }
  
  const ratio = scrollY / maxScroll
  
  const maxThumbPosition = trackHeight.value - thumbHeight.value
  thumbPosition.value = ratio * maxThumbPosition
}

// Gestion du scroll
function handleScroll() {
  updateThumbPosition()
}

// Clic sur la track
function handleTrackClick(e) {
  if (!contentEl.value || !trackEl.value || !thumbEl.value) return
  
  const trackRect = trackEl.value.getBoundingClientRect()
  const clickY = e.clientY - trackRect.top
  const thumbCenter = thumbHeight.value / 2
  
  let newPosition = clickY - thumbCenter
  
  // Limiter la position
  newPosition = Math.max(0, Math.min(newPosition, trackHeight.value - thumbHeight.value))
  
  // Calculer le scroll correspondant
  const ratio = newPosition / (trackHeight.value - thumbHeight.value)
  const maxScroll = contentHeight.value - containerHeight.value
  contentEl.value.scrollTop = ratio * maxScroll
}

// Début du drag sur le thumb
function handleThumbMouseDown(e) {
  isDragging.value = true
  dragStartY.value = e.clientY
  scrollStartY.value = contentEl.value.scrollTop
  
  // Empêcher la sélection de texte
  e.preventDefault()
}

// Déplacement pendant le drag
function handleMouseMove(e) {
  if (!isDragging.value || !contentEl.value || !trackEl.value) return
  
  const deltaY = e.clientY - dragStartY.value
  
  // Calculer la nouvelle position du thumb
  let newThumbPosition = thumbPosition.value + deltaY
  newThumbPosition = Math.max(0, Math.min(newThumbPosition, trackHeight.value - thumbHeight.value))
  
  // Calculer le scroll correspondant
  const ratio = newThumbPosition / (trackHeight.value - thumbHeight.value)
  const maxScroll = contentHeight.value - containerHeight.value
  contentEl.value.scrollTop = ratio * maxScroll
  
  // Mettre à jour la position pour le prochain mouvement
  dragStartY.value = e.clientY
  thumbPosition.value = newThumbPosition
}

// Fin du drag
function handleMouseUp() {
  isDragging.value = false
}

// Gestion du resize
function handleResize() {
  updateDimensions()
}

// Lifecycle
onMounted(() => {
  nextTick(() => {
    updateDimensions()
  })
  
  contentEl.value.addEventListener('scroll', handleScroll)
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
  window.addEventListener('resize', handleResize)
  
  // Observer pour les changements de taille du contenu
  const resizeObserver = new ResizeObserver(updateDimensions)
  resizeObserver.observe(contentEl.value)
  
  onUnmounted(() => {
    contentEl.value?.removeEventListener('scroll', handleScroll)
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
    window.removeEventListener('resize', handleResize)
    resizeObserver.disconnect()
  })
})

// Styles
const trackStyle = computed(() => ({
  top: `${trackTop.value}px`,
  height: `${trackHeight.value}px`
}))

const thumbStyle = computed(() => ({
  height: `${thumbHeight.value}px`,
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
  scrollbar-width: none; /* Masquer la scrollbar native */
  -ms-overflow-style: none; /* IE/Edge */
  padding-right: 12px; /* Espace pour la scrollbar */
}

.custom-scrollbar__content::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}

.custom-scrollbar__track {
  position: fixed;
  right: 0;
  width: 12px;
  background: transparent;
  cursor: pointer;
  pointer-events: none; /* Permet au contenu de recevoir les événements */
  z-index: 100;
}

.custom-scrollbar__thumb {
  position: absolute;
  right: 0;
  top: 0;
  width: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  cursor: pointer;
  pointer-events: auto; /* Le thumb reçoit les événements */
  transition: background 0.2s ease;
  will-change: transform;
}

.custom-scrollbar__thumb:hover {
  background: rgba(0, 0, 0, 0.5);
}

.custom-scrollbar__thumb:active {
  background: rgba(0, 0, 0, 0.7);
}

.custom-scrollbar__track:hover {
  pointer-events: auto; /* La track reçoit les événements au survol */
}
</style>
