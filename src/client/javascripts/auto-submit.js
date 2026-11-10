// RA-732: deliberately no Apply button and no no-JS fallback, as agreed for
// the change requests filters.

export function initAutoSubmit(doc = document) {
  const forms = doc.querySelectorAll('form[data-module="app-auto-submit"]')
  if (forms.length === 0) {
    return
  }
  const unnamed = []

  forms.forEach((form) => {
    form.addEventListener('change', (event) => {
      if (event.target.tagName !== 'SELECT') {
        return
      }
      // An unnamed select isn't submitted, so a placeholder leaves no empty
      // `?status=` in the URL. Disabling it instead would drop focus to the
      // body while the next page loads.
      form.querySelectorAll('select[name]').forEach((select) => {
        if (select.value === '') {
          unnamed.push({ select, name: select.name })
          select.removeAttribute('name')
        }
      })
      form.submit()
    })
  })

  // Back from the next page can restore this page from the bfcache with the
  // names still removed.
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) {
      return
    }
    unnamed.splice(0).forEach(({ select, name }) => {
      select.name = name
    })
  })
}
