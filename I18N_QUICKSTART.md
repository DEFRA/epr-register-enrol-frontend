# i18n Quick Start Guide - hapi-i18n

✅ **Internationalization (English & Welsh) is now set up with hapi-i18n!**

## What's Been Installed

- **hapi-i18n** - Hapi-native internationalization plugin
- **Translation files** - English and Welsh JSON files

## What's Been Created

### Configuration Files
- `src/config/i18n.js` - hapi-i18n setup and configuration

### Translation Files
- `src/locales/en/translation.json` - English translations
- `src/locales/cy/translation.json` - Welsh translations

### Components & Templates
- `src/server/common/components/language-switcher/` - Language toggle component
- Updated routes to support language prefixes (`/en/`, `/cy/`)

### Styling
- `src/client/stylesheets/components/_language-switcher.scss` - Component styles

### Documentation
- `I18N_GUIDE.md` - Comprehensive guide (in workspace root)

## How to Use

### 1. Add Translation Keys

Edit translation files:
```json
// src/locales/en/translation.json
{
  "myPage": {
    "title": "My Page Title",
    "description": "My page description"
  }
}

// src/locales/cy/translation.json
{
  "myPage": {
    "title": "Teitl Fy Nhudalen",
    "description": "Disgrifiad fy nhudalen"
  }
}
```

### 2. Use in Templates (Simple & Clean)

```nunjucks
<h1>{{ t('myPage.title') }}</h1>
<p>{{ t('myPage.description') }}</p>
```

### 3. Add Language Switcher

Include the component in your layouts:
```nunjucks
{% include "language-switcher/index.njk" %}
```

### 4. Access in Controllers (Even Simpler)

```javascript
export const myController = {
  handler(request, h) {
    const title = request.t('myPage.title')
    const locale = request.getLocale()
    
    return h.view('mypage', { pageTitle: title, language: locale })
  }
}
```

## Run the Application

```bash
# Development mode
npm run dev

# Production build
npm run build:frontend
npm start

# Tests
npm test
```

## Access in Browser

- **English:** http://localhost:3000/ or http://localhost:3000/en/
- **Welsh:** http://localhost:3000/cy/
- **Query parameter:** http://localhost:3000/?lang=cy

## Key Features ✨

✅ **Cleaner syntax** - Just use `{{ t('key') }}` in templates  
✅ **Simpler in controllers** - `request.t('key')` instead of import statements  
✅ **Hapi-native** - Follows Hapi conventions  
✅ **URL-based selection** - `/en/`, `/cy/`  
✅ **Query parameter support** - `?lang=cy`  
✅ **Language detection** - From browser preferences, cookies, URL  
✅ **Language switcher component** - Built-in  
✅ **Easy translation file management** - Simple JSON files  

## Example Translation Files Already Included

Both translation files include basic keys for:
- Header information
- Navigation items
- Common UI elements
- Language switcher labels

## Next Steps

1. **Update existing templates** to use `{{ t('key') }}` syntax
2. **Add page-specific translations** to the `.json` files
3. **Update controllers** to use `request.t('key')`
4. **Test throughout the application** in both English and Welsh
5. **Include language switcher** in page layouts/headers

## File Locations Reference

```
src/
├── config/i18n.js                                    # hapi-i18n setup
├── locales/{en,cy}/translation.json                 # Translation strings
├── server/
│   ├── server.js                                     # i18n plugin initialized
│   ├── common/
│   │   └── components/language-switcher/            # Language toggle
│   ├── [page-name]/
│   │   ├── index.js                                # Added language routes
│   │   ├── index.njk                               # Use {{ t('key') }}
│   │   └── controller.js                           # Use request.t('key')
└── client/stylesheets/
    └── components/_language-switcher.scss           # Component styles
```

## Translation Key Syntax

Use dot notation for nested keys:
```
header.serviceName
pages.home.title
navigation.about
common.yes
languageSwitcher.english
```

## Comparison: Old vs New

**Old Syntax (i18next):**
```nunjucks
{{ 'key' | t(currentLanguage) }}
```

**New Syntax (hapi-i18n):**
```nunjucks
{{ t('key') }}
```

**Old Controllers:**
```javascript
import i18next from '../../../config/i18n.js'
i18next.t('key', { lng: language })
```

**New Controllers:**
```javascript
request.t('key')
```

## Need Help?

See **`I18N_GUIDE.md`** for complete documentation including:
- Interpolation and pluralization
- Troubleshooting
- Best practices
- Advanced features

---

**Setup completed successfully!** 🎉

You can now translate your app into English and Welsh with clean, readable code.
