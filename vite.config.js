import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isGithubActions = process.env.GITHUB_ACTIONS === 'true'
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'EsmeNails'
const base = process.env.VITE_APP_BASE
  || (isGithubActions ? `/${repositoryName}/` : '/')

// https://vite.dev/config/
export default defineConfig({
  base: '/EsmeNails/',
  plugins: [react()],
})
