import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isGithubActions = process.env.GITHUB_ACTIONS === 'true'
const isNetlify = process.env.NETLIFY === 'true'
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'EsmeNails'
const envBase = typeof process.env.VITE_APP_BASE === 'string'
  ? process.env.VITE_APP_BASE.trim()
  : ''

// Netlify serves the app from root by default, so force '/' there unless explicitly changed later.
const base = isNetlify
  ? '/'
  : (envBase || (isGithubActions ? `/${repositoryName}/` : '/'))

// https://vite.dev/config/
export default defineConfig({
  base: '/EsmeNails/',
  plugins: [react()],
})
