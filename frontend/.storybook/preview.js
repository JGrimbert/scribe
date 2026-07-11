import 'primeicons/primeicons.css'
import '../src/assets/base.css'

export default {
  decorators: [
    // même fond que l'app (base.css stylise le body de l'iframe) + respiration
    (story) => ({
      components: { story },
      template: '<div style="padding: 1.5rem;"><story /></div>',
    }),
  ],
  parameters: {
    layout: 'fullscreen',
  },
}
