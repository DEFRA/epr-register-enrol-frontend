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
