# Internationalization (i18n) Guide - hapi-i18n

This guide explains how to use the English and Welsh language support in the EPR Register & Enrol Frontend application using **hapi-i18n**.

## Overview

The application uses **hapi-i18n**, a Hapi-native plugin for managing translations between English (en) and Welsh (cy). 

Language preference is determined by:
1. **URL path prefix** (highest priority) - `/en/` or `/cy/`
2. **Query parameter** - `?lang=en` or `?lang=cy`
3. **Cookie** - Stored language preference
4. **Browser Accept-Language header** - Browser's language preference
5. **Default** - English (`en`) if no preference found

## Project Structure

```
src/
├── config/
│   ├── i18n.js                             # hapi-i18n configuration
│   └── nunjucks/
│       ├── filters/filters.js              # Standard filters
│       └── context/context.js              # Template context
├── locales/
│   ├── en/
│   │   └── translation.json               # English translations
│   └── cy/
│       └── translation.json               # Welsh translations
└── server/
    ├── common/
    │   └── components/language-switcher/  # Language toggle component
    └── [pages]/
        ├── index.js                       # Routes with language prefix
        ├── index.njk                      # Templates using t()
        └── controller.js                  # Controllers using request.t()
```

## Adding Translations

### 1. Add Translation Keys

Edit the translation files to add new keys:

**`src/locales/en/translation.json`:**
```json
{
  "pages": {
    "home": {
      "title": "Welcome to EPR",
      "description": "Register your organisation..."
    }
  }
}
```

**`src/locales/cy/translation.json`:**
```json
{
  "pages": {
    "home": {
      "title": "Croeso i EPR",
      "description": "Cofrestrwch eich sefydliad..."
    }
  }
}
```

### 2. Use Translations in Templates
ing the translation function in Nunjucks templates is now simpler:

```nunjucks
{# Basic translation - use t() directly #}
<h1>{{ t('pages.about.title') }}</h1>
<p>{{ t('pages.about.description') }}</p>

{# Language switcher #}
{% include "language-switcher/index.njk" %}
```
- `languageToggle` - Opposite language code for switching

### 3. Using the Language Switcher Component

Include the language switcher component in your templates:

```nunjucks
{% from "e Translations in Controllers

Controllers can use `request.t()` to get translated strings:

```javascript
// src/server/about/controller.js
export const aboutController = {
  handler(request, h) {
    return h.view('about/index', {
      pageTitle: request.t('pages.about.title'),
      description: request.t('pages.about.description')
    })
  }
}cation supports language-prefixed URLs:

- **English:**
  - `/` - Home page
  - `/en/` - Home page (explicit)
  - `/en/about` - About page
  - `/en/regulator` - Regulator page

- **Welsh:**
  - `/cy/` - Home page (Welsh)
  - `/cy/about` - About page (Welsh)
  - `/cy/regulator` - Regulator page (Welsh)

## Adding Language Support to Routes

When creating new routes, support both default and language-prefixed paths:

```javascript
// src/server/mypage/index.js
import { mypageController } from './controller.js'

export const mypage = {
  plugin: {
    name: 'mypage',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/mypage',
          ...mypageController
        },
        {
          method: 'GET',
          path: '/{language}/mypage',
          ...mypageController
        }
      ])
    }
  }Current Language

In templates:
```nunjucks
{# Get current locale #}
<p>Current language: {{ request.getLocale() }}</p>
```

In controllers:
```javascript
export const myController = {
  handler(request, h) {
    const currentLanguage = request.getLocale()
    return h.view('mypage', { language: currentLanguage })
  }
}
```

## Language Switcher Component

Include the language switcher component in your templates:

```nunjucks
{% include "language-switcher/index.njk" %}
```
Configuration

The hapi-i18n plugin is configured in `src/config/i18n.js`:

```javascript
{
  localesPath: path.resolve('src/locales'),
  locale: 'en',                    // Default language
  fallbacks: { default: 'en' },    // Fallback language
  updateFiles: false,              // Don't auto-create missing keys
  extension: '.json'               // Translation file extension
}
```
```

## Test Assets

View the application in different languages:

- English: `/` or `/en/`
- Welsh: `/cy/`

Switch languages using the language switcher component or by changing the URL prefix.

## Translation File Format

Translation files support nested objects with dot notation:

```json
{
- In templates: `{{ t('header.navigation.home') }}`
- In controllers: `request.t('header.navigation.home')`

## Interpolation

Translations can use dynamic values with interpolation:

**Translation file:**
```json
{
  "greeting": "Hello {{name}}, welcome to {{service}}"
}
```

**Template:**
```nunjucks
{{ t('greeting', { name: userName, service: 'EPR' }) }}
```

**Controller:**
```javascript
request.t('greeting', { name: userName, service: 'EPR' })
```

## Pluralization

For plural forms, use nested keys:

**Translation file:**
```json
{
  "items": {
    "one": "You have 1 item",
    "other": "You have {{count}} items"
  }
}
```

## Query Parameter

Switch languages on-the-fly with query parameters:

```
/about?lang=cy  # View in Welsh
/about?lang=en  # View in English``nunjucks
{{ 'greeting' | t(currentLanguage, { name: uslanguage files
2. Check for typos in the key path (dot notation)
3. Ensure the template syntax is correct: `{{ t('key') }}`
4. Restart the development server
5. Check browser console for error messages

### Language Not Changing

1. Verify URL prefix is correct: `/en/` or `/cy/`
2. Check that the route file registers both default and language-prefixed paths
3. Verify translation files are in `src/locales/{language}/translation.json`
4. Try using query parameter: `?lang=cy`

### Missing Translations in Other Routes

Add translations to both files for all keys used in your app. The plugin will fall back to the default language if a key is missing
}
```

## Troubleshooting
Test Assets

View the application in different languages:

- English: `/` or `/en/` or `/?lang=en`
- Welsh: `/cy/` or `/?lang=cy`

Switch languages using the language switcher component or by changing the URL.

## Command Reference

### Run Development Server
```bash
npm run dev
```

### Run Tests
```bash
npm test
```

### Format Code
```bash
npm run format
```

### Check Lint
```bash
npm run lint
```

### Build Frontend
```bash
npm run build:frontend
### Run Development Server
```bash
npm run dev
```

### Run Tests
```bash
npm test
```
all languages** - Ensure all keys exist in both English and Welsh files
5. **Test both languages** - Validate UI layout in both languages
6. **Use language switcher** - Make it easy for users to switch languages
7. **Maintain consistency** - Use standardized translations for common terms
8. **Document special terms** - Keep a glossary of technical terms and their Welsh equivalents

## Migration from i18next

If upgrading from i18next:

**Old way (removed):**
```nunjucks
{{ 'key' | t(currentLanguage) }}
```

**New way (hapi-i18n):**
```nunjucks
{{ t('key') }}
```

**Old controller:**
```javascript
i18next.t('key', { lng: language })
```

**New controller:**
```javascript
request.t('key')
```

## Resources

- [hapi-i18n Documentation](https://github.com/artberri/hapi-i18n)
- [Hapi Framework](https://hapi.dev/)
- [Nunjucks Documentation](https://mozilla.github.io/nunjucks/)
- [I18n Best Practices](https://www.internationalization.com/i18n/localization-best-practices

## Best Practices

1. **Keep keys organized** - Group related translations under common parent keys
2. **Consistent naming** - Use kebab-case for keys: `new-user` not `newUser`
3. **Translate early** - Add translations for all UI text immediately
4. **Provide fallbacks** - Ensure all keys exist in both language files
5. **Test both languages** - Validate UI layout in both English and Welsh
6. **Use language switcher** - Make it easy for users to switch languages
7. **Maintain consistency** - Use standardized translations for common terms

## Resources

- [i18next Documentation](https://www.i18next.com/)
- [i18next React Tutorial](https://www.i18next.com/how-tos/react-native)
- [Nunjucks Documentation](https://mozilla.github.io/nunjucks/)
