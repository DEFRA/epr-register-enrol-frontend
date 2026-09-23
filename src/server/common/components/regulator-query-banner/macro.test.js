import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, test, expect } from 'vitest'
import nunjucks from 'nunjucks'
import { load } from 'cheerio'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const env = nunjucks.configure(
  [
    path.resolve(dirname, '../../../../../node_modules/govuk-frontend/dist/'),
    path.resolve(dirname, '..')
  ],
  { trimBlocks: true, lstripBlocks: true }
)

function renderRaw(params) {
  return env.renderString(
    `{%- from "regulator-query-banner/macro.njk" import regulatorQueryBanner -%}` +
      `{{- regulatorQueryBanner(params) -}}`,
    { params }
  )
}

function render(params) {
  return load(renderRaw(params))
}

describe('regulatorQueryBanner component', () => {
  test('renders nothing when the section is not queried', () => {
    const $ = render({ queried: false })
    expect($('[data-testid="regulator-query-banner"]')).toHaveLength(0)
  })

  test('renders the banner and its heading when the section is queried', () => {
    const $ = render({ queried: true, heading: 'Regulator query' })
    expect($('[data-testid="regulator-query-banner"]')).toHaveLength(1)
    expect($('[data-testid="regulator-query-heading"]').text()).toBe(
      'Regulator query'
    )
  })

  // RA-590. The officer's free-text note is internal-only and is communicated
  // to the operator outside the application, so the banner must never carry it.
  test('never renders the officer query-note element, even when queried', () => {
    const $ = render({ queried: true })
    expect($('[data-testid="query-note"]')).toHaveLength(0)
    expect($('blockquote')).toHaveLength(0)
  })

  // Asserts on the whole rendered markup rather than one element, because the
  // application record still carries the note - so a regression could surface
  // it in an attribute, a title or a stray interpolation, not just a blockquote.
  test('does not leak the officer note anywhere in the rendered markup', () => {
    const html = renderRaw({
      queried: true,
      heading: 'Regulator query',
      queryNote: 'SHOULD-NOT-APPEAR-officer-note',
      summary: 'The regulator has identified an issue with your business plan.',
      fields: [{ label: 'Spending breakdown', href: '/business-plan' }]
    })
    expect(html).not.toContain('SHOULD-NOT-APPEAR-officer-note')
  })

  test('renders the templated summary sentence when one is passed', () => {
    const $ = render({
      queried: true,
      summary: 'The regulator has identified an issue with your business plan.'
    })
    expect($('[data-testid="regulator-query-summary"]').text()).toBe(
      'The regulator has identified an issue with your business plan.'
    )
  })

  // The operator must still be able to act on the query. This is the
  // regression guard for RA-590 - removing the note must not remove the
  // fields-to-update list or its Change links.
  test('renders a Change link for every field the operator can update', () => {
    const $ = render({
      queried: true,
      updateHeading: 'Update the application',
      changeLinkText: 'Change',
      fields: [
        { label: 'Spending breakdown', href: '/business-plan' },
        { label: 'Sampling plan', href: '/sampling-plan' }
      ]
    })
    expect($('[data-testid="regulator-query-update-list"]')).toHaveLength(1)
    expect(
      $('[data-testid="regulator-query-change-link-0"]').attr('href')
    ).toBe('/business-plan')
    expect(
      $('[data-testid="regulator-query-change-link-1"]').attr('href')
    ).toBe('/sampling-plan')
  })
})
