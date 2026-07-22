import StatItem from './StatItem.vue'

export default {
  title: 'Atoms/StatItem',
  component: StatItem,
}

export const Simple = {
  args: { value: '105 329', label: 'mots' },
}

// Infobulle : un « ? » à côté du label (title natif au survol).
export const AvecInfobulle = {
  args: {
    value: '10 855',
    label: 'lemmes',
    hint: 'Formes de base distinctes — un lemme regroupe les flexions d’un mot.',
  },
}

// Aucune valeur calculée : « — » centré, la tuile occupe quand même l'espace.
export const Vide = {
  args: { label: 'phrases', empty: true },
}

// Le bandeau du dashboard : une tuile par stat (les cases flex: 1 remplissent
// la largeur ; celles non calculées restent vides).
export const Bandeau = {
  render: () => ({
    components: { StatItem },
    template: `
      <div style="display: flex; align-items: stretch; flex-wrap: wrap; gap: 0.6em;">
        <StatItem style="flex: 1 1 8em;" value="612 480" label="caractères" />
        <StatItem style="flex: 1 1 8em;" value="105 329" label="mots" />
        <StatItem style="flex: 1 1 8em;" value="6 865" label="phrases" />
        <StatItem style="flex: 1 1 8em;" value="4 210" label="paragraphes" />
        <StatItem style="flex: 1 1 8em;" value="762" label="chapitres" />
        <StatItem style="flex: 1 1 8em;" value="10 855" label="lemmes" hint="Formes de base distinctes." />
        <StatItem style="flex: 1 1 8em;" value="15,34" label="mots / phrase" />
        <StatItem style="flex: 1 1 8em;" value="10,3 %" label="diversité" hint="Mots distincts / mots totaux." />
        <StatItem style="flex: 1 1 8em;" empty label="densité" />
      </div>
    `,
  }),
}
