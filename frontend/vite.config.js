import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

// Le build UMD de Paged.js, servi tel quel à une URL fixe (dev). FolioView le
// charge en <script> DANS une iframe pour que Paged.js tourne dans SON réalm
// (styles/mesure/rendu confinés, cf. FolioView). Son champ `exports` interdit
// l'import direct de `dist/paged.js` et `?url` déroute le dep-optimizer ; d'où ce
// middleware, même idiome que `structure.json` ci-dessous. On résout le point
// d'entrée principal (`lib/index.cjs`, exposé) et on remonte au `dist`.
const require = createRequire(import.meta.url)
const pagedUmd = path.resolve(path.dirname(require.resolve('pagedjs')), '../dist/paged.js')

export default defineConfig({
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
        },
    },
    plugins: [
        vue(),

        {
            name: 'serve-pagedjs-umd',

            configureServer(server) {
                server.middlewares.use('/vendor/paged.js', (req, res) => {
                    res.setHeader('Content-Type', 'text/javascript')
                    res.end(fs.readFileSync(pagedUmd, 'utf8'))
                })
            }
        },

        {
            name: 'serve-structure-json',

            configureServer(server) {
                server.middlewares.use('/structure.json', (req, res) => {
                    const file = path.resolve(
                        __dirname,
                        '../../structure.json'
                    )

                    res.setHeader('Content-Type', 'application/json')
                    res.end(fs.readFileSync(file, 'utf8'))
                })

                server.middlewares.use('/data.json', (req, res) => {
                    const file = path.resolve(
                        __dirname,
                        '../../data.json'
                    )

                    res.setHeader('Content-Type', 'application/json')
                    res.end(fs.readFileSync(file, 'utf8'))
                })

                server.middlewares.use('/trame.json', (req, res) => {
                    const file = path.resolve(
                        __dirname,
                        '../../trame.json'
                    )

                    res.setHeader('Content-Type', 'application/json')
                    res.end(fs.readFileSync(file, 'utf8'))
                })
            }
        }
    ]
})