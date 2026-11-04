import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://<user>.github.io/WhichDublin/, so assets need the repo path as their base.
export default defineConfig({ plugins: [react()], base: process.env.BASE_PATH || '/', build: { sourcemap: true } })
