import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const extensionManifest = JSON.parse(JSON.stringify(manifest))
  extensionManifest.oauth2 = {
    ...extensionManifest.oauth2,
    client_id: env.VITE_GOOGLE_OAUTH_CLIENT_ID || extensionManifest.oauth2?.client_id || '',
  }

  return {
    plugins: [
      react(),
      crx({ manifest: extensionManifest }),
    ],
  }
})
