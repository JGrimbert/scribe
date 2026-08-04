import { reactive, ref, onMounted, nextTick } from 'vue'
import MaquetteFormatCallouts from './MaquetteFormatCallouts.vue'

export default {
  title: 'Maquette/MaquetteFormatCallouts',
  component: MaquetteFormatCallouts,
}

// styleDefaults témoin (mêmes clés que useTypologyConfig) : A5, marges miroir,
// en-tête + pied actifs.
function makeDefaults() {
  return reactive({
    pageSize: { widthCm: 14.8, heightCm: 21 },
    pageMargins: { topCm: 2, bottomCm: 3, innerCm: 1.5, outerCm: 2.5 },
    runningTitles: {
      header: { enabled: true, recto: 'titre', verso: 'chapitre', heightCm: 1, justification: 'regard' },
      footer: { enabled: true, recto: 'folio', verso: 'folio', heightCm: 1, justification: 'regard' },
      folioFormat: 'numerique',
    },
    hyphenation: false,
  })
}

// La scène reproduit une planche : deux pages A5 côte à côte (recto gauche, verso
// droite), leur empagement + bande d'en-tête esquissés. Après montage on MESURE
// leurs rects écran → `geometry`, exactement comme le FolioView réel.
export const SurLaPlanche = {
  render: () => ({
    components: { MaquetteFormatCallouts },
    setup() {
      const styleDefaults = makeDefaults()
      const geometry = ref(null)
      const rectoEl = ref(null)
      const versoEl = ref(null)
      const measure = () => {
        if (!rectoEl.value || !versoEl.value) return
        const r = (el) => {
          const b = el.getBoundingClientRect()
          return { left: b.left, top: b.top, width: b.width, height: b.height }
        }
        geometry.value = { pages: [r(rectoEl.value), r(versoEl.value)] }
      }
      onMounted(async () => {
        await nextTick()
        measure()
        window.addEventListener('resize', measure)
      })
      return { styleDefaults, geometry, rectoEl, versoEl }
    },
    template: `
      <div style="position:relative;width:820px;height:520px;margin:0 auto;">
        <div style="position:absolute;inset:0;display:flex;gap:2px;align-items:center;justify-content:center;">
          <div ref="rectoEl" style="position:relative;width:211px;height:300px;border:1px solid var(--c-border);background:var(--c-surface);box-shadow:0 1px 6px rgba(0,0,0,.15);">
            <div style="position:absolute;left:21px;right:36px;top:29px;bottom:43px;border:1px solid var(--c-border);"></div>
            <div style="position:absolute;left:21px;right:36px;top:29px;height:14px;background:color-mix(in srgb, var(--c-ink2) 24%, transparent);"></div>
          </div>
          <div ref="versoEl" style="position:relative;width:211px;height:300px;border:1px solid var(--c-border);background:var(--c-surface);box-shadow:0 1px 6px rgba(0,0,0,.15);">
            <div style="position:absolute;left:36px;right:21px;top:29px;bottom:43px;border:1px solid var(--c-border);"></div>
            <div style="position:absolute;left:36px;right:21px;top:29px;height:14px;background:color-mix(in srgb, var(--c-ink2) 24%, transparent);"></div>
          </div>
        </div>
        <MaquetteFormatCallouts :page="null" :style-defaults="styleDefaults" :geometry="geometry" />
      </div>
    `,
  }),
}
