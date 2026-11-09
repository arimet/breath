import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'

const PUBLIC_SHELL = ['manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']

/** Writes dist/sw.js with the list of built files to precache, versioned by their names. */
function serviceWorker(): Plugin {
  return {
    name: 'breath-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const built = Object.keys(bundle).filter((f) => f !== 'index.html' && !f.endsWith('.map'))
      const shell = ['./', ...built, ...PUBLIC_SHELL]
      const version = createHash('sha256').update(shell.join('\n')).digest('hex').slice(0, 12)
      const source = readFileSync('sw/sw.js', 'utf8').replace('__VERSION__', version).replace('__SHELL__', JSON.stringify(shell))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  // relative URLs: GitHub Pages serves the app under /breath/
  base: './',
  plugins: [serviceWorker()],
})
