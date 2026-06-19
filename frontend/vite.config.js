import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

import fs from 'fs'
import path from 'path'

export default defineConfig({
    plugins: [
        vue(),

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