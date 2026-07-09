<template>
  <div
      class="folio"
      :class="{ recto: isRecto, verso: !isRecto, debug }"
      :style="folioStyle"
  >
    <header class="folio-header">
      <span class="folio-header-text">
        {{ headerText }}
      </span>
    </header>
    <div class="folio-content">
      <slot />
    </div>

    <footer class="folio-footer">
      <span class="folio-page-number">
        {{ pageNumber }}
      </span>
    </footer>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const FORMATS = {
  A4: {
    width: 210,
    height: 297,
  },

  A5: {
    width: 148,
    height: 210,
  },

  LIVRE: {
    width: 148,
    height: 210,
  },
}

const props = defineProps({
  pageNumber: {
    type: Number,
    required: true,
  },

  titreLivre: {
    type: String,
    default: '',
  },

  titreAxe: {
    type: String,
    default: '',
  },

  format: {
    type: String,
    default: 'LIVRE',
  },

  debug: {
    type: Boolean,
    default: false,
  },
})

const isRecto = computed(
    () => props.pageNumber % 2 === 1
)

const dimensions = computed(
    () => FORMATS[props.format] || FORMATS.LIVRE
)

const headerText = computed(
    () =>
        isRecto.value
            ? props.titreAxe
            : props.titreLivre
)

const folioStyle = computed(() => {
  const { width, height } = dimensions.value

  return {
    width: `${width}mm`,
    height: `${height}mm`,
  }
})

</script>

<style scoped>
.folio {
  position: relative;
  box-sizing: border-box;
  flex: 0 0 auto; /* flex-grow:0, flex-shrink:0, flex-basis:auto — la width: 150mm inline-style est alors respectée à la lettre */
  background: white;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  font-family: Georgia, 'Times New Roman', serif;
}

.folio-header {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;

  height: 18mm;

  display: flex;
  align-items: center;
  justify-content: center;

  pointer-events: none;
}

.folio-header-text {
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #888;
}

.folio-content {
  position: absolute;
  overflow: visible;
}

.folio.debug .folio-content {
  outline: 1px dotted #d6d6d6;
}

.folio-footer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;

  height: 20mm;

  display: flex;
  align-items: center;
}

.folio.recto .folio-footer {
  justify-content: flex-end;
}

.folio.verso .folio-footer {
  justify-content: flex-start;
}

.folio-page-number {
  padding-inline: 8mm;
  color: #888;
  font-size: 0.75rem;
}
</style>