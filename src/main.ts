import './style.css'
import { detectLang, setLang } from './i18n'
import { loadPrefs } from './prefs'
import { mountLandscape } from './ui/landscape'
import { showHome, showWarning, type App } from './ui/screens'

const prefs = loadPrefs()
setLang(prefs.lang ?? detectLang(navigator.languages))

const app: App = {
  prefs,
  land: mountLandscape(document.getElementById('land')!),
  root: document.getElementById('app')!,
}

if (prefs.warningSeen) showHome(app)
else showWarning(app, () => showHome(app))

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {
    // no offline mode, the app still works online
  })
}
