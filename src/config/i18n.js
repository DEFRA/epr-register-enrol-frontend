import hapiI18n from 'hapi-i18n'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const localesPath = path.resolve(dirname, '../locales')

export const i18nPlugin = {
  plugin: hapiI18n,
  options: {
    localesPath,
    defaultLocale: 'en',
    locales: ['en', 'cy'],
    cookie: 'language',
    queryParameter: 'lang',
    updateFiles: false,
    autoLocale: false
  }
}
