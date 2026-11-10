// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { initAutoSubmit } from './auto-submit.js'

function renderForm() {
  document.body.innerHTML = `
    <form method="get" action="/list" data-module="app-auto-submit">
      <select name="status" id="status">
        <option value="">Select status</option>
        <option value="Queried">Queried</option>
      </select>
      <select name="type" id="type">
        <option value="">Select type</option>
        <option value="add-overseas-site" selected>New ORS accreditation</option>
      </select>
    </form>
  `
  const form = document.querySelector('form')
  form.submit = vi.fn()
  return form
}

function choose(id, value) {
  const select = document.getElementById(id)
  select.value = value
  select.dispatchEvent(new Event('change', { bubbles: true }))
  return select
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('initAutoSubmit', () => {
  it('is a no-op when there is no auto-submit form', () => {
    document.body.innerHTML = '<form><select></select></form>'
    expect(() => initAutoSubmit(document)).not.toThrow()
  })

  it('submits the form when a select changes', () => {
    const form = renderForm()
    initAutoSubmit(document)

    choose('status', 'Queried')

    expect(form.submit).toHaveBeenCalledTimes(1)
  })

  it('leaves out a select left on its placeholder, so the URL has no empty filter', () => {
    const form = renderForm()
    initAutoSubmit(document)

    const status = document.getElementById('status')
    const type = choose('type', '')

    expect(form.submit).toHaveBeenCalledTimes(1)
    expect(type.hasAttribute('name')).toBe(false)
    expect(status.hasAttribute('name')).toBe(false)
  })

  it('leaves the changed select enabled, so it keeps focus', () => {
    renderForm()
    initAutoSubmit(document)
    const type = document.getElementById('type')
    type.focus()

    choose('type', '')

    expect(type.disabled).toBe(false)
    expect(document.activeElement).toBe(type)
  })

  it('keeps the selects that have a value', () => {
    renderForm()
    initAutoSubmit(document)

    const status = choose('status', 'Queried')

    expect(status.name).toBe('status')
    expect(document.getElementById('type').name).toBe('type')
  })

  it('sends a select chosen after a submit that did not leave the page', () => {
    const form = renderForm()
    initAutoSubmit(document)
    choose('type', '')

    const status = choose('status', 'Queried')

    expect(form.submit).toHaveBeenCalledTimes(2)
    expect(status.name).toBe('status')
    expect(document.getElementById('type').hasAttribute('name')).toBe(false)
  })

  it('ignores changes from other forms', () => {
    const form = renderForm()
    document.body.insertAdjacentHTML(
      'beforeend',
      '<form><select id="other"><option value="a">a</option></select></form>'
    )
    initAutoSubmit(document)

    choose('other', 'a')

    expect(form.submit).not.toHaveBeenCalled()
  })
})

describe('back to the page', () => {
  const pageshow = (persisted) =>
    window.dispatchEvent(
      new window.PageTransitionEvent('pageshow', { persisted })
    )

  it('names the selects again when the page is shown from the cache', () => {
    renderForm()
    initAutoSubmit(document)
    choose('type', '')

    pageshow(true)

    expect(document.getElementById('status').name).toBe('status')
    expect(document.getElementById('type').name).toBe('type')
  })

  it('leaves the selects alone on a fresh page load', () => {
    renderForm()
    initAutoSubmit(document)
    choose('type', '')

    pageshow(false)

    expect(document.getElementById('status').hasAttribute('name')).toBe(false)
    expect(document.getElementById('type').hasAttribute('name')).toBe(false)
  })

  it('names each select only once after repeated submits', () => {
    renderForm()
    initAutoSubmit(document)
    choose('type', '')
    choose('status', '')

    pageshow(true)
    choose('status', 'Queried')
    pageshow(true)

    expect(document.getElementById('status').name).toBe('status')
    expect(document.getElementById('type').name).toBe('type')
  })
})
