// Référence visuelle des tokens de base.css — à consulter avant d'ajouter
// une couleur ou une taille en dur où que ce soit.

const COLORS = [
  'c-bg', 'c-surface', 'c-surface2', 'c-surface3', 'c-surface4',
  'c-ink', 'c-ink2', 'c-accent', 'c-accent2', 'c-border', 'c-muted', 'c-danger',
]

const RADII = ['radius-sm', 'radius-md', 'radius-pill']
const SPACES = ['sp-1', 'sp-2', 'sp-3', 'sp-4', 'sp-6']
const FONTS = ['fs-xs', 'fs-sm', 'fs-md', 'fs-lg']

export default {
  title: 'Fondations/Tokens',
}

export const Palette = {
  render: () => ({
    setup: () => ({ COLORS }),
    template: `
      <div style="display: flex; flex-wrap: wrap; gap: 1rem;">
        <div v-for="c in COLORS" :key="c" style="width: 9rem;">
          <div :style="{ background: 'var(--' + c + ')', height: '3.5rem', border: '1px solid var(--c-border)', borderRadius: 'var(--radius-md)' }"></div>
          <code style="font-size: 0.75rem;">--{{ c }}</code>
        </div>
      </div>
    `,
  }),
}

export const Typographie = {
  render: () => ({
    setup: () => ({ FONTS }),
    template: `
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <p v-for="f in FONTS" :key="f" :style="{ fontSize: 'var(--' + f + ')', margin: 0 }">
          <code style="opacity: 0.5; font-size: 0.75rem;">--{{ f }}</code>
          — Portez ce vieux whisky au juge blond qui fume
        </p>
        <p :style="{ fontFamily: 'var(--font-serif)', margin: 0 }">
          <code style="opacity: 0.5; font-size: 0.75rem;">--font-serif</code>
          — réservé au contenu du manuscrit
        </p>
      </div>
    `,
  }),
}

export const RythmeEtFormes = {
  render: () => ({
    setup: () => ({ RADII, SPACES }),
    template: `
      <div style="display: flex; gap: 3rem;">
        <div>
          <h4 style="margin: 0 0 0.5rem;">Espacements</h4>
          <div v-for="s in SPACES" :key="s" style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.4rem;">
            <span :style="{ width: 'var(--' + s + ')', height: '1rem', background: 'var(--c-accent2)', display: 'inline-block' }"></span>
            <code style="font-size: 0.75rem;">--{{ s }}</code>
          </div>
        </div>
        <div>
          <h4 style="margin: 0 0 0.5rem;">Radius</h4>
          <div v-for="r in RADII" :key="r" style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.4rem;">
            <span :style="{ width: '3rem', height: '1.6rem', border: '1px solid var(--c-accent)', borderRadius: 'var(--' + r + ')', display: 'inline-block' }"></span>
            <code style="font-size: 0.75rem;">--{{ r }}</code>
          </div>
        </div>
      </div>
    `,
  }),
}
