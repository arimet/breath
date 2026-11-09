import { expect, test } from 'vitest'
import { STRINGS, detectLang, setLang, t } from '../src/i18n'

test('French and English have the same keys and no empty string', () => {
  expect(Object.keys(STRINGS.en).sort()).toEqual(Object.keys(STRINGS.fr).sort())
  for (const lang of ['fr', 'en'] as const) {
    for (const value of Object.values(STRINGS[lang])) expect(value.trim()).not.toBe('')
  }
})

test('detectLang picks French for any fr locale, English otherwise', () => {
  expect(detectLang(['fr-FR'])).toBe('fr')
  expect(detectLang(['fr-CA', 'en'])).toBe('fr')
  expect(detectLang(['de', 'en-US'])).toBe('en')
  expect(detectLang([])).toBe('en')
})

test('t follows the current language', () => {
  setLang('en')
  expect(t('start')).toBe(STRINGS.en.start)
  setLang('fr')
  expect(t('start')).toBe(STRINGS.fr.start)
})
