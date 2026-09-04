// RA-462: progressively enhance the server-rendered concurrent-login notice
// (an in-flow GOV.UK notification banner) into a dismissible floating toast.
// With no JavaScript the banner stays in the page and its "Hide" button posts
// a normal form to dismiss it.

export function initSessionNotice(doc = document) {
  const notice = doc.querySelector('[data-module="app-session-notice"]')
  if (!notice) {
    return
  }

  const form = notice.querySelector('.app-session-notice__dismiss')
  const dismissUrl = notice.dataset.dismissUrl
  const isAlert = notice.dataset.variant === 'alert'

  notice.classList.add('app-session-notice--toast')
  notice.setAttribute('role', isAlert ? 'alert' : 'status')
  notice.setAttribute('aria-live', isAlert ? 'assertive' : 'polite')
  doc.body.appendChild(notice)

  const remove = () => {
    notice.remove()
    doc.removeEventListener('keydown', onKeydown)
  }

  const dismiss = async () => {
    try {
      const body = new URLSearchParams()
      const crumb = form?.querySelector('input[name="crumb"]')?.value
      if (crumb) {
        body.set('crumb', crumb)
      }
      const res = await fetch(dismissUrl, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body,
        credentials: 'same-origin'
      })
      if (!res.ok) {
        throw new Error(`dismiss failed: ${res.status}`)
      }
      remove()
    } catch {
      // Network/HTTP failure — fall back to the full-page form post so the
      // dismissal still lands.
      form?.submit()
    }
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      dismiss()
    }
  }

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      dismiss()
    })
  }
  doc.addEventListener('keydown', onKeydown)

  // Move keyboard focus to the toast so screen-reader and keyboard users are
  // taken to it, without trapping focus there.
  notice.setAttribute('tabindex', '-1')
  notice.focus()
}

initSessionNotice()
