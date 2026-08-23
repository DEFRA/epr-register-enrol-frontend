// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ERROR_TOO_LARGE = 'The selected file must be smaller than 20MB'
const ERROR_INVALID_TYPE =
  'The selected file must be a PDF, Word, Excel, CSV, image or Outlook message'
const ERROR_NO_DOCUMENT_TYPE = 'Select a document type'
const ERROR_NO_FILE = 'Select a file to upload'

function renderUploadForm() {
  document.body.innerHTML = `
    <form data-testid="upload-form"
          data-error-too-large="${ERROR_TOO_LARGE}"
          data-error-invalid-type="${ERROR_INVALID_TYPE}"
          data-error-no-document-type="${ERROR_NO_DOCUMENT_TYPE}"
          data-error-no-file="${ERROR_NO_FILE}">
      <div class="govuk-form-group">
        <select data-testid="document-type-input">
          <option value=""></option>
          <option value="samplingPlan">Sampling plan</option>
        </select>
      </div>
      <div class="govuk-form-group">
        <input type="file" data-testid="file-input" />
      </div>
      <button type="submit" data-testid="upload-button">Upload file</button>
    </form>
  `
}

function getUploadForm() {
  return document.querySelector('[data-testid="upload-form"]')
}

function getFileInput() {
  return document.querySelector('[data-testid="file-input"]')
}

function getDocumentTypeSelect() {
  return document.querySelector('[data-testid="document-type-input"]')
}

function stubFiles(input, files) {
  Object.defineProperty(input, 'files', {
    value: files,
    configurable: true
  })
}

function makeFile({
  name = 'plan.pdf',
  size = 1024,
  type = 'application/pdf'
} = {}) {
  const file = new File([new Uint8Array(1)], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function selectFile(input, file) {
  stubFiles(input, file ? [file] : [])
  input.dispatchEvent(new Event('change'))
}

function dispatchSubmit(form) {
  const event = new Event('submit', { bubbles: true, cancelable: true })
  form.dispatchEvent(event)
  return event.defaultPrevented
}

function dispatchPageshow(persisted) {
  const event = new Event('pageshow')
  event.persisted = persisted
  window.dispatchEvent(event)
}

async function loadApplication() {
  vi.resetModules()
  return import('./application.js')
}

describe('sampling-plan-upload client validation', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('does nothing when the upload form is not on the page', async () => {
    document.body.innerHTML = '<div></div>'
    await expect(loadApplication()).resolves.toBeDefined()
    expect(document.querySelector('[data-testid="file-error"]')).toBeNull()
  })

  it('does nothing when the form is missing the document-type select', async () => {
    document.body.innerHTML =
      '<form data-testid="upload-form"><input data-testid="file-input" type="file" /></form>'
    await expect(loadApplication()).resolves.toBeDefined()
    const input = getFileInput()
    selectFile(input, makeFile())
    expect(document.getElementById('file-error')).toBeNull()
  })

  it('shows an error and blanks the input when an invalid file type is selected', async () => {
    renderUploadForm()
    await loadApplication()
    const input = getFileInput()

    selectFile(
      input,
      makeFile({ name: 'plan.exe', type: 'application/x-msdownload' })
    )

    const errorEl = document.getElementById('file-error')
    expect(errorEl.textContent).toContain(ERROR_INVALID_TYPE)
    expect(
      input
        .closest('.govuk-form-group')
        .classList.contains('govuk-form-group--error')
    ).toBe(true)
    expect(input.classList.contains('govuk-file-upload--error')).toBe(true)
    expect(input.getAttribute('aria-describedby')).toBe('file-error')
    expect(input.value).toBe('')
  })

  it('shows an error when the file exceeds the size limit', async () => {
    renderUploadForm()
    await loadApplication()
    const input = getFileInput()

    selectFile(input, makeFile({ size: 21 * 1024 * 1024 }))

    expect(document.getElementById('file-error').textContent).toContain(
      ERROR_TOO_LARGE
    )
  })

  it('clears a previous file error once a valid file is selected', async () => {
    renderUploadForm()
    await loadApplication()
    const input = getFileInput()

    selectFile(
      input,
      makeFile({ name: 'plan.exe', type: 'application/x-msdownload' })
    )
    expect(document.getElementById('file-error')).not.toBeNull()

    selectFile(input, makeFile({ name: 'plan.pdf' }))

    expect(document.getElementById('file-error')).toBeNull()
    expect(input.closest('.govuk-form-group').classList).not.toContain(
      'govuk-form-group--error'
    )
    expect(input.getAttribute('aria-describedby')).toBeNull()
  })

  it('shows and clears the document-type error on change', async () => {
    renderUploadForm()
    await loadApplication()
    const select = getDocumentTypeSelect()

    select.value = ''
    select.dispatchEvent(new Event('change'))
    let errorEl = document.getElementById('document-type-error')
    expect(errorEl.textContent).toContain(ERROR_NO_DOCUMENT_TYPE)
    expect(select.getAttribute('aria-describedby')).toBe('document-type-error')

    select.value = 'samplingPlan'
    select.dispatchEvent(new Event('change'))
    errorEl = document.getElementById('document-type-error')
    expect(errorEl).toBeNull()
    expect(select.getAttribute('aria-describedby')).toBeNull()
  })

  it('blocks submit and shows both errors when nothing has been selected', async () => {
    renderUploadForm()
    await loadApplication()
    const form = getUploadForm()

    const prevented = dispatchSubmit(form)

    expect(prevented).toBe(true)
    expect(document.getElementById('file-error').textContent).toContain(
      ERROR_NO_FILE
    )
    expect(
      document.getElementById('document-type-error').textContent
    ).toContain(ERROR_NO_DOCUMENT_TYPE)
  })

  it('blocks submit and re-validates the file when the last selection was invalid', async () => {
    renderUploadForm()
    await loadApplication()
    const form = getUploadForm()
    const input = getFileInput()
    const select = getDocumentTypeSelect()

    selectFile(
      input,
      makeFile({ name: 'plan.exe', type: 'application/x-msdownload' })
    )
    select.value = 'samplingPlan'
    select.dispatchEvent(new Event('change'))

    const prevented = dispatchSubmit(form)

    expect(prevented).toBe(true)
    expect(document.getElementById('file-error').textContent).toContain(
      ERROR_INVALID_TYPE
    )
    expect(document.getElementById('document-type-error')).toBeNull()
  })

  it('allows submit through when a valid file and document type are selected', async () => {
    renderUploadForm()
    await loadApplication()
    const form = getUploadForm()
    const input = getFileInput()
    const select = getDocumentTypeSelect()

    selectFile(input, makeFile())
    select.value = 'samplingPlan'
    select.dispatchEvent(new Event('change'))

    const prevented = dispatchSubmit(form)

    expect(prevented).toBe(false)
    expect(document.getElementById('file-error')).toBeNull()
    expect(document.getElementById('document-type-error')).toBeNull()
  })

  it('leaves a server-rendered file error alone on a normal (non-persisted) pageshow', async () => {
    renderUploadForm()
    const errorEl = document.createElement('p')
    errorEl.id = 'file-error'
    errorEl.setAttribute('data-testid', 'file-error')
    errorEl.textContent = ERROR_TOO_LARGE
    const input = getFileInput()
    input.insertAdjacentElement('beforebegin', errorEl)
    input.closest('.govuk-form-group').classList.add('govuk-form-group--error')
    input.setAttribute('aria-describedby', 'file-error')

    await loadApplication()
    const inputBefore = getFileInput()

    dispatchPageshow(false)

    expect(document.getElementById('file-error')).not.toBeNull()
    expect(getFileInput()).toBe(inputBefore)
  })

  it('clears the form and swaps the file input on a genuine bfcache restore', async () => {
    renderUploadForm()
    const errorEl = document.createElement('p')
    errorEl.id = 'file-error'
    errorEl.setAttribute('data-testid', 'file-error')
    errorEl.textContent = ERROR_TOO_LARGE
    const input = getFileInput()
    input.insertAdjacentElement('beforebegin', errorEl)
    input.closest('.govuk-form-group').classList.add('govuk-form-group--error')
    input.setAttribute('aria-describedby', 'file-error')

    await loadApplication()
    const inputBefore = getFileInput()
    const form = getUploadForm()

    dispatchPageshow(true)

    expect(document.getElementById('file-error')).toBeNull()
    const inputAfter = getFileInput()
    expect(inputAfter).not.toBe(inputBefore)
    expect(inputAfter.value).toBe('')

    // userSelectedFile must also have been reset, and the fresh input must
    // have its own change listener re-attached by swapFileInput().
    const select = getDocumentTypeSelect()
    select.value = 'samplingPlan'
    select.dispatchEvent(new Event('change'))
    const prevented = dispatchSubmit(form)
    expect(prevented).toBe(true)
    expect(document.getElementById('file-error').textContent).toContain(
      ERROR_NO_FILE
    )

    selectFile(
      inputAfter,
      makeFile({ name: 'plan.exe', type: 'application/x-msdownload' })
    )
    expect(document.getElementById('file-error').textContent).toContain(
      ERROR_INVALID_TYPE
    )
  })
})

// A small, self-contained set of sample codes — the enhancement reads its
// code list back from each <select>'s rendered <option>s (per RA-377), so
// tests don't need the real, much larger BASEL_OECD_CODES list. More than 10
// entries so the "first 10 on an empty query" cap (AC03) is observable.
const SAMPLE_CODES = [
  'A1010',
  'A1020',
  'A1030',
  'A1040',
  'A1050',
  'A1060',
  'A1070',
  'A1080',
  'A1090',
  'A1100',
  'B2010',
  'B2020',
  'Y46'
]

function renderBaselCodesForm(rows) {
  const selectsHtml = rows
    .map(
      (value, i) => `
      <div class="govuk-form-group">
        <label class="govuk-label" for="basel-code-${i + 1}">Code ${i + 1}</label>
        <select class="govuk-select" id="basel-code-${i + 1}" name="code-${i}"
                data-testid="basel-code-${i + 1}-input"
                data-autocomplete="basel-oecd-code"
                data-no-results-text="No matches found">
          <option value="">Choose a code</option>
          ${SAMPLE_CODES.map(
            (code) =>
              `<option value="${code}"${code === value ? ' selected' : ''}>${code}</option>`
          ).join('')}
        </select>
      </div>`
    )
    .join('')

  document.body.innerHTML = `
    <h1 data-testid="page-heading">What are the Basel Convention codes for the waste?</h1>
    <form data-testid="basel-codes-form" data-error-summary-title="There is a problem">
      ${selectsHtml}
      <button type="submit" data-testid="continue-button">Continue</button>
    </form>
  `
}

function getContinueButton() {
  return document.querySelector('[data-testid="continue-button"]')
}

function typeInto(input, value) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('basel/OECD code type-ahead client validation', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('does nothing when no basel/OECD code fields are on the page', async () => {
    document.body.innerHTML = '<div></div>'
    await expect(loadApplication()).resolves.toBeDefined()
    expect(document.querySelector('[data-testid="error-summary"]')).toBeNull()
  })

  it('enhances each select into a combobox, preserving its data-testid on the new input', async () => {
    renderBaselCodesForm(['A1010'])
    await loadApplication()

    const hiddenSelect = document.getElementById('basel-code-1-select')
    expect(hiddenSelect).not.toBeNull()
    expect(hiddenSelect.getAttribute('data-testid')).toBeNull()

    const visibleInput = document.getElementById('basel-code-1')
    expect(visibleInput).not.toBeNull()
    expect(visibleInput.getAttribute('data-testid')).toBe('basel-code-1-input')
  })

  it('leaves Continue enabled when the pre-selected values are valid or blank', async () => {
    renderBaselCodesForm(['A1010', ''])
    await loadApplication()

    expect(getContinueButton().disabled).toBe(false)
  })

  it('disables Continue and shows a GDS error when a typed value matches no code', async () => {
    renderBaselCodesForm([''])
    await loadApplication()

    const input = document.getElementById('basel-code-1')
    typeInto(input, 'ZZZZZ')

    expect(getContinueButton().disabled).toBe(true)
    expect(
      input
        .closest('.govuk-form-group')
        .classList.contains('govuk-form-group--error')
    ).toBe(true)
    expect(input.classList.contains('govuk-input--error')).toBe(true)
    expect(input.getAttribute('aria-describedby')).toBe(
      'basel-code-1-client-error'
    )

    const errorMessage = document.getElementById('basel-code-1-client-error')
    expect(errorMessage).not.toBeNull()
    expect(errorMessage.textContent).toContain('No matches found')

    const summary = document.querySelector('[data-testid="error-summary"]')
    expect(summary).not.toBeNull()
    expect(
      summary.querySelector('.govuk-error-summary__title').textContent
    ).toBe('There is a problem')
    expect(summary.querySelector('a').getAttribute('href')).toBe(
      '#basel-code-1'
    )
  })

  it('re-enables Continue and clears the error once the value is fixed', async () => {
    renderBaselCodesForm([''])
    await loadApplication()

    const input = document.getElementById('basel-code-1')
    typeInto(input, 'ZZZZZ')
    expect(getContinueButton().disabled).toBe(true)

    typeInto(input, 'A1010')

    expect(getContinueButton().disabled).toBe(false)
    expect(document.getElementById('basel-code-1-client-error')).toBeNull()
    expect(document.querySelector('[data-testid="error-summary"]')).toBeNull()
    expect(
      input
        .closest('.govuk-form-group')
        .classList.contains('govuk-form-group--error')
    ).toBe(false)
    expect(input.getAttribute('aria-describedby')).toBeNull()
  })

  it('re-enables Continue and clears the error once the value is cleared back to blank', async () => {
    renderBaselCodesForm([''])
    await loadApplication()

    const input = document.getElementById('basel-code-1')
    typeInto(input, 'ZZZZZ')
    expect(getContinueButton().disabled).toBe(true)

    typeInto(input, '')

    expect(getContinueButton().disabled).toBe(false)
    expect(document.getElementById('basel-code-1-client-error')).toBeNull()
  })

  it('treats an exact match as valid case-insensitively', async () => {
    renderBaselCodesForm([''])
    await loadApplication()

    const input = document.getElementById('basel-code-1')
    typeInto(input, 'a1010')

    expect(getContinueButton().disabled).toBe(false)
  })

  it('keeps Continue disabled while any one of several rows is invalid', async () => {
    renderBaselCodesForm(['A1010', ''])
    await loadApplication()

    const secondInput = document.getElementById('basel-code-2')
    typeInto(secondInput, 'NOPE')
    expect(getContinueButton().disabled).toBe(true)

    typeInto(secondInput, 'B2010')
    expect(getContinueButton().disabled).toBe(false)
  })

  it('lets you pick a suggestion by clicking it, syncing the hidden select and re-validating', async () => {
    renderBaselCodesForm([''])
    await loadApplication()

    const input = document.getElementById('basel-code-1')
    const hiddenSelect = document.getElementById('basel-code-1-select')

    typeInto(input, 'B20')

    const option = await vi.waitFor(() => {
      const match = Array.from(
        document.querySelectorAll('li[role="option"]')
      ).find((el) => el.textContent.trim() === 'B2010')
      if (!match) {
        throw new Error('suggestion not rendered yet')
      }
      return match
    })

    option.dispatchEvent(new Event('mousedown', { bubbles: true }))
    option.dispatchEvent(new Event('click', { bubbles: true }))

    await vi.waitFor(() => {
      if (hiddenSelect.value !== 'B2010') {
        throw new Error('hidden select not synced yet')
      }
    })

    expect(getContinueButton().disabled).toBe(false)
    expect(document.querySelector('[data-testid="error-summary"]')).toBeNull()
  })

  it("excludes a code already chosen in another row from that row's suggestions", async () => {
    renderBaselCodesForm(['B2010', ''])
    await loadApplication()

    const secondInput = document.getElementById('basel-code-2')
    typeInto(secondInput, 'B20')

    // Scoped to row 2's own dropdown: row 1's pre-selected value seeds its
    // *own* widget with a permanently-rendered (CSS-hidden) suggestion <li>
    // from construction, which a page-wide query would also pick up.
    await vi.waitFor(() => {
      const wrapper = secondInput.closest('.autocomplete__wrapper')
      const options = Array.from(
        wrapper.querySelectorAll('li[role="option"]')
      ).map((el) => el.textContent.trim())
      if (options.length === 0) {
        throw new Error('suggestions not rendered yet')
      }
      expect(options).toEqual(['B2020'])
    })
  })

  it('shows the first 10 codes when an empty field is focused/clicked (AC03)', async () => {
    renderBaselCodesForm([''])
    await loadApplication()

    const input = document.getElementById('basel-code-1')
    input.dispatchEvent(new Event('click', { bubbles: true }))

    await vi.waitFor(() => {
      const wrapper = input.closest('.autocomplete__wrapper')
      const options = Array.from(
        wrapper.querySelectorAll('li[role="option"]')
      ).map((el) => el.textContent.trim())
      if (options.length === 0) {
        throw new Error('suggestions not rendered yet')
      }
      expect(options).toHaveLength(10)
      expect(options).not.toContain('Y46')
    })
  })

  it("shows the library's own no-results option in the open dropdown once focused", async () => {
    renderBaselCodesForm([''])
    await loadApplication()

    const input = document.getElementById('basel-code-1')
    input.dispatchEvent(new Event('focus', { bubbles: true }))
    typeInto(input, 'ZZZZZ')

    await vi.waitFor(() => {
      const wrapper = input.closest('.autocomplete__wrapper')
      const noResults = wrapper.querySelector('li[aria-disabled="true"]')
      if (!noResults) {
        throw new Error('not rendered yet')
      }
      expect(noResults.textContent).toBe('No matches found')
    })
  })

  it('clears the hidden select via onConfirm when blurring after typing an unmatched value without picking a suggestion', async () => {
    renderBaselCodesForm(['A1010'])
    await loadApplication()

    const input = document.getElementById('basel-code-1')
    const hiddenSelect = document.getElementById('basel-code-1-select')
    expect(hiddenSelect.value).toBe('A1010')

    input.dispatchEvent(new Event('focus', { bubbles: true }))
    await vi.waitFor(() => {
      if (!input.classList.contains('autocomplete__input--focused')) {
        throw new Error('focus state not applied yet')
      }
    })
    typeInto(input, 'NOPE')
    input.dispatchEvent(new Event('blur'))

    await vi.waitFor(() => {
      if (hiddenSelect.value !== '') {
        throw new Error('not cleared yet')
      }
    })
    expect(getContinueButton().disabled).toBe(true)
  })

  it('syncs the hidden select via onConfirm when blurring after hand-typing a full valid code without picking a suggestion', async () => {
    renderBaselCodesForm([''])
    await loadApplication()

    const input = document.getElementById('basel-code-1')
    const hiddenSelect = document.getElementById('basel-code-1-select')

    input.dispatchEvent(new Event('focus', { bubbles: true }))
    await vi.waitFor(() => {
      if (!input.classList.contains('autocomplete__input--focused')) {
        throw new Error('focus state not applied yet')
      }
    })
    typeInto(input, 'B2010')
    input.dispatchEvent(new Event('blur'))

    await vi.waitFor(() => {
      if (hiddenSelect.value !== 'B2010') {
        throw new Error('not synced yet')
      }
    })
    expect(getContinueButton().disabled).toBe(false)
  })

  it('seeds hasError from a server-rendered error so Continue stays disabled until the row is fixed, and the server error can be cleared', async () => {
    document.body.innerHTML = `
      <h1 data-testid="page-heading">What are the Basel Convention codes for the waste?</h1>
      <form data-testid="basel-codes-form" data-error-summary-title="There is a problem">
        <div class="govuk-form-group govuk-form-group--error">
          <label class="govuk-label" for="basel-code-1">Code 1</label>
          <p class="govuk-error-message" id="basel-code-1-client-error">Enter at least one code</p>
          <select class="govuk-select govuk-select--error" id="basel-code-1" name="code-0"
                  data-testid="basel-code-1-input"
                  data-autocomplete="basel-oecd-code"
                  data-no-results-text="No matches found"
                  data-has-error="true">
            <option value="">Choose a code</option>
            ${SAMPLE_CODES.map((code) => `<option value="${code}">${code}</option>`).join('')}
          </select>
        </div>
        <button type="submit" data-testid="continue-button">Continue</button>
      </form>
    `

    await loadApplication()

    expect(getContinueButton().disabled).toBe(true)

    const input = document.getElementById('basel-code-1')
    typeInto(input, 'A1010')

    expect(getContinueButton().disabled).toBe(false)
    expect(document.getElementById('basel-code-1-client-error')).toBeNull()
  })

  it('syncs the hidden select case-insensitively when blurring after hand-typing a valid code in non-canonical case', async () => {
    renderBaselCodesForm([''])
    await loadApplication()

    const input = document.getElementById('basel-code-1')
    const hiddenSelect = document.getElementById('basel-code-1-select')

    input.dispatchEvent(new Event('focus', { bubbles: true }))
    await vi.waitFor(() => {
      if (!input.classList.contains('autocomplete__input--focused')) {
        throw new Error('focus state not applied yet')
      }
    })
    typeInto(input, 'b2010')
    input.dispatchEvent(new Event('blur'))

    await vi.waitFor(() => {
      if (hiddenSelect.value !== 'B2010') {
        throw new Error('not synced yet')
      }
    })
    expect(getContinueButton().disabled).toBe(false)
  })

  it('lists multiple errored rows in one error summary, reusing it across rows', async () => {
    renderBaselCodesForm(['', ''])
    await loadApplication()

    typeInto(document.getElementById('basel-code-1'), 'NOPE1')
    typeInto(document.getElementById('basel-code-2'), 'NOPE2')

    const summary = document.querySelector('[data-testid="error-summary"]')
    expect(summary).not.toBeNull()
    const links = summary.querySelectorAll('a')
    expect(links).toHaveLength(2)
    expect(links[0].getAttribute('href')).toBe('#basel-code-1')
    expect(links[1].getAttribute('href')).toBe('#basel-code-2')
  })

  it('does not duplicate the inline error message while a row stays invalid across keystrokes', async () => {
    renderBaselCodesForm([''])
    await loadApplication()

    const input = document.getElementById('basel-code-1')
    typeInto(input, 'NOP')
    typeInto(input, 'NOPE')

    expect(
      document.querySelectorAll('#basel-code-1-client-error')
    ).toHaveLength(1)
  })

  it('still applies row-level error styling when the page has no Continue button', async () => {
    renderBaselCodesForm([''])
    getContinueButton().remove()
    await loadApplication()

    const input = document.getElementById('basel-code-1')
    expect(() => typeInto(input, 'ZZZZZ')).not.toThrow()
    expect(
      input
        .closest('.govuk-form-group')
        .classList.contains('govuk-form-group--error')
    ).toBe(true)
  })

  it('falls back to default copy when the form/select do not carry the data-* overrides', async () => {
    document.body.innerHTML = `
      <h1 data-testid="page-heading">heading</h1>
      <select id="basel-code-1" data-testid="basel-code-1-input" data-autocomplete="basel-oecd-code">
        <option value="">Choose a code</option>
        <option value="A1010">A1010</option>
      </select>
      <button type="submit" data-testid="continue-button">Continue</button>
    `
    await loadApplication()

    const input = document.getElementById('basel-code-1')
    typeInto(input, 'ZZZZZ')

    const errorMessage = document.getElementById('basel-code-1-client-error')
    expect(errorMessage.textContent).toContain('No matches found')

    const summary = document.querySelector('[data-testid="error-summary"]')
    expect(
      summary.querySelector('.govuk-error-summary__title').textContent
    ).toBe('There is a problem')
  })
})

describe('#country field enhancement', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('does nothing when there is no #country select on the page', async () => {
    document.body.innerHTML = '<div></div>'
    await expect(loadApplication()).resolves.toBeDefined()
  })

  it('enhances #country into a combobox, preserving its data-testid on the new input', async () => {
    document.body.innerHTML = `
      <select id="country" data-testid="country-input">
        <option value=""></option>
        <option value="France">France</option>
      </select>
    `
    await loadApplication()

    const hiddenSelect = document.getElementById('country-select')
    expect(hiddenSelect).not.toBeNull()
    expect(hiddenSelect.getAttribute('data-testid')).toBeNull()

    const visibleInput = document.getElementById('country')
    expect(visibleInput).not.toBeNull()
    expect(visibleInput.getAttribute('data-testid')).toBe('country-input')
  })
})
