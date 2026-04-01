import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const localesPath = path.resolve(dirname, '../../../locales')

let translations = null

function loadTranslations() {
  if (translations) return translations

  const en = JSON.parse(readFileSync(path.join(localesPath, 'en/translation.json'), 'utf-8'))
  const cy = JSON.parse(readFileSync(path.join(localesPath, 'cy/translation.json'), 'utf-8'))

  translations = { en, cy }
  return translations
}

function getNestedValue(obj, keyPath) {
  return keyPath.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : keyPath
  }, obj)
}

export function getTranslator(locale = 'en') {
  const allTranslations = loadTranslations()
  const localeTranslations = allTranslations[locale] || allTranslations.en

  return (key) => {
    return getNestedValue(localeTranslations, key)
  }
}
