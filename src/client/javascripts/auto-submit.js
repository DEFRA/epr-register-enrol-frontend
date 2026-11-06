// RA-732: deliberately no Apply button and no no-JS fallback, as agreed for
// the change requests filters.

export function initAutoSubmit(doc = document) {
  const forms = doc.querySelectorAll('form[data-module="app-auto-submit"]')

  forms.forEach((form) => {
    const selects = () => Array.from(form.querySelectorAll('select'))

    form.addEventListener('change', (event) => {
      if (event.target.tagName !== 'SELECT') {
        return
      }
      // A disabled select isn't submitted, so a placeholder leaves no empty
      // `?status=` in the URL.
      selects()
        .filter((select) => select.value === '')
        .forEach((select) => {
          select.disabled = true
        })
      form.submit()
    })

    // Back from the next page can restore this page from the bfcache with
    // the selects still disabled.
    window.addEventListener('pageshow', () => {
      selects().forEach((select) => {
        select.disabled = false
      })
    })
  })
}
