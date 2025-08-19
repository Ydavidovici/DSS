import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// For dev HMR proxy (optional): set env before `vite`
// BACKEND_ORIGIN=http://localhost:3001 AUTH_ORIGIN=http://localhost:3002 vite
const BACKEND = process.env.BACKEND_ORIGIN || 'http://localhost:3001';
const AUTH    = process.env.AUTH_ORIGIN    || 'http://localhost:3002';

export default defineConfig({
    plugins: [react()],
    base: '/',                       // SPA at root
    publicDir: 'static',             // <--- put static assets in ./static (copied into outDir)
    build: {
        outDir: resolve(__dirname, 'public'),   // <--- overwrite /public with built app
        emptyOutDir: true
    },
    server: {
        port: 5173,
        proxy: {
            '/api':  { target: BACKEND, changeOrigin: true },
            '/auth': { target: AUTH,    changeOrigin: true }
        }
    }
})
