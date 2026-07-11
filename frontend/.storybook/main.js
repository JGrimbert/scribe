export default {
  stories: ['../src/**/*.stories.js'],
  framework: {
    name: '@storybook/vue3-vite',
    options: {},
  },
  // sert sand.png (fond du body importé via base.css dans preview.js)
  staticDirs: ['../public'],
}
