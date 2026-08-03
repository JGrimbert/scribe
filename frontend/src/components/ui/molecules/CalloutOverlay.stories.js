import CalloutOverlay from './CalloutOverlay.vue'
import BaseSelect from '../atoms/BaseSelect.vue'

export default {
  title: 'Molecules/CalloutOverlay',
  component: CalloutOverlay,
}

// Schéma témoin : une page (rectangle) avec son empagement, aux mêmes coordonnées
// que les ancres ci-dessous — c'est le rôle de l'appelant de les faire coïncider.
const SCENE = `
  <div style="position:relative;width:640px;height:420px;">
    <div style="position:absolute;left:60px;top:30px;width:220px;height:310px;
                border:1px solid var(--c-border);background:var(--c-surface);"></div>
    <div style="position:absolute;left:80px;top:60px;width:180px;height:250px;
                border:1px solid var(--c-border);"></div>
    <div style="position:absolute;left:80px;top:60px;width:180px;height:16px;
                background:color-mix(in srgb, var(--c-ink2) 30%, transparent);"></div>
    <slot />
  </div>
`

const groups = [
  {
    key: 'tete',
    label: 'Tête',
    side: 'right',
    rows: [
      { key: 'blanc-tete', label: 'Blanc de tête', anchor: { x: 280, y: 45, span: { x1: 280, y1: 30, x2: 280, y2: 60 } } },
      { key: 'contenu', label: 'Pages impaires', anchor: { x: 260, y: 68, span: { x1: 260, y1: 60, x2: 260, y2: 76 } } },
    ],
  },
  {
    key: 'fonds',
    label: 'Fonds',
    side: 'bottom',
    rows: [
      { key: 'petit-fond', label: 'Petit fond', anchor: { x: 70, y: 340, span: { x1: 60, y1: 340, x2: 80, y2: 340 } } },
      { key: 'justification', label: 'Justification', anchor: null },
    ],
  },
]

export const SurUnePage = {
  render: () => ({
    components: { CalloutOverlay, BaseSelect },
    setup: () => ({ groups }),
    template: SCENE.replace('<slot />', `
      <CalloutOverlay :groups="groups">
        <template #blanc-tete><input type="number" value="2" style="width:4em" /></template>
        <template #contenu>
          <BaseSelect model-value="titre"><option value="titre">Titre du livre</option></BaseSelect>
        </template>
        <template #petit-fond><input type="number" value="1.5" style="width:4em" /></template>
        <template #justification>
          <BaseSelect model-value="centre"><option value="centre">Centré</option></BaseSelect>
        </template>
      </CalloutOverlay>
    `),
  }),
}
