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

const LABELS = {
  change: 'Change',
  withdraw: 'Withdraw from application',
  add: 'Add to application',
  interimRemove: 'Withdraw from application',
  interimDisclosure: 'Show interim sites',
  addAnotherInterimSite: 'Add another interim site',
  withdrawnDisclosure: 'Show withdrawn interim sites',
  restore: 'Add back to application'
}

function interimSite(overrides = {}) {
  return {
    siteId: 42,
    siteName: 'Interim Depot',
    country: 'France',
    addressLine: 'Unit 1, Rotterdam',
    contactName: 'Jane Smith',
    contactEmail: 'jane@example.com',
    contactPhone: '+441234567890',
    operationCodes: ['R12', 'R13'],
    editUrl: '/interim/edit/900001',
    ...overrides
  }
}

function site(overrides = {}) {
  return {
    siteId: 900001,
    orsId: '001',
    siteName: 'Site Alpha',
    country: 'Germany',
    interimSites: [],
    withdrawnInterimSites: [],
    editUrl: '/edit/900001',
    promoteUrl: '/promote/900001',
    ...overrides
  }
}

function accreditedParams(overrides = {}) {
  return {
    site: site(),
    readOnly: false,
    crumb: 'test-crumb',
    labels: LABELS,
    testIdPrefix: 'accredited-site',
    editTestId: 'edit-button-accredited',
    removeFormTestId: 'remove-form-accredited',
    removeTestId: 'remove-button-accredited',
    removeAction: 'removeAccredited',
    ...overrides
  }
}

function render(params) {
  return load(
    env.renderString(
      `{%- from "overseas-site-row/macro.njk" import overseasSiteRows -%}` +
        `<table><tbody>{{- overseasSiteRows(params) -}}</tbody></table>`,
      { params }
    )
  )
}

describe('overseasSiteRows component', () => {
  describe('the overseas reprocessing site row', () => {
    test('renders the site name, ORS id and country against the given testid prefix', () => {
      const $ = render(accreditedParams())

      expect($('[data-testid="accredited-site-row-900001"]')).toHaveLength(1)
      expect($('[data-testid="accredited-site-name-900001"]').text()).toBe(
        'Site Alpha'
      )
      expect(
        $('[data-testid="accredited-site-orsid-900001"]').text().trim()
      ).toBe('001')
      expect($('[data-testid="accredited-site-country-900001"]').text()).toBe(
        'Germany'
      )
    })

    // The ORS id reads before the site name. In the summary-list version this
    // was a CSS `order` trick with the DOM left in the other order; here the
    // cells are simply emitted in the order they are read.
    test('emits the cells in ORS id, site name, country, actions order', () => {
      const $ = render(accreditedParams())

      const cells = $('tr').first().children()
      const testIds = cells.map((_, el) => $(el).attr('data-testid')).get()

      // Four cells, the last being the actions cell, which carries no testid
      // of its own (its link and button carry their own).
      expect(cells).toHaveLength(4)
      expect(testIds).toEqual([
        'accredited-site-orsid-900001',
        'accredited-site-name-900001',
        'accredited-site-country-900001'
      ])
      expect(cells.last().hasClass('select-overseas-sites-actions-cell')).toBe(
        true
      )
    })

    // The site name, not the id, is what identifies the row to a screen reader.
    test('keeps the site name as the row header even though the id precedes it', () => {
      const $ = render(accreditedParams())

      const header = $('th[scope="row"]')
      expect(header).toHaveLength(1)
      expect(header.attr('data-testid')).toBe('accredited-site-name-900001')
    })

    // A table column has to exist in every row or every column below it
    // shifts, so an ORS id cell is always emitted - empty, not absent.
    test('still emits an empty ORS id cell when the site has no ORS id', () => {
      const $ = render(accreditedParams({ site: site({ orsId: null }) }))

      const cell = $('[data-testid="accredited-site-orsid-900001"]')
      expect(cell).toHaveLength(1)
      expect(cell.text().trim()).toBe('')
    })

    // AC11: the action wording is the point of the change, not an incidental.
    test('renders the Change link and the Withdraw from application button', () => {
      const $ = render(accreditedParams())

      expect(
        $('[data-testid="edit-button-accredited-900001"]').text().trim()
      ).toBe('Change')
      const button = $('[data-testid="remove-button-accredited-900001"]')
      expect(button.text().trim()).toBe('Withdraw from application')
      expect(button.attr('value')).toBe('removeAccredited')
    })

    test('carries the CSRF crumb and the site id on the withdraw form', () => {
      const $ = render(accreditedParams())
      const form = $('[data-testid="remove-form-accredited-900001"]')

      expect(form.find('input[name="crumb"]').attr('value')).toBe('test-crumb')
      expect(form.find('input[name="siteId"]').attr('value')).toBe('900001')
    })

    test('renders the Add to application link instead of Change/Withdraw in promote mode', () => {
      const $ = render(
        accreditedParams({
          testIdPrefix: 'registered-site',
          promote: true,
          promoteTestId: 'add-button-registered'
        })
      )

      const add = $('[data-testid="add-button-registered-900001"]')
      expect(add.text().trim()).toBe('Add to application')
      expect(add.attr('href')).toBe('/promote/900001')
      expect($('[data-testid="edit-button-accredited-900001"]')).toHaveLength(0)
      expect($('[data-testid="remove-button-accredited-900001"]')).toHaveLength(
        0
      )
    })

    test('renders no actions at all when the section is read-only', () => {
      const $ = render(accreditedParams({ readOnly: true }))

      expect($('.select-overseas-sites-actions-cell')).toHaveLength(0)
      expect($('[data-testid="accredited-site-row-900001"]')).toHaveLength(1)
    })
  })

  describe('the interim-site disclosure', () => {
    test('renders no disclosure when the site has no interim sites', () => {
      const $ = render(accreditedParams())

      expect($('[data-testid="interim-sites-disclosure-900001"]')).toHaveLength(
        0
      )
      expect($('details')).toHaveLength(0)
    })

    // Deliberately govuk-details and not govuk-accordion: the accordion always
    // injects a "Show all sections" control and a header per section, which is
    // exactly what this must not look like.
    test('renders a single govuk-details disclosure, not an accordion', () => {
      const $ = render(
        accreditedParams({ site: site({ interimSites: [interimSite()] }) })
      )

      const disclosure = $('[data-testid="interim-sites-disclosure-900001"]')
      expect(disclosure).toHaveLength(1)
      expect(disclosure.is('details')).toBe(true)
      expect(disclosure.hasClass('govuk-details')).toBe(true)
      expect($('.govuk-accordion')).toHaveLength(0)
    })

    test('is collapsed by default, so an ORS shows only the disclosure link', () => {
      const $ = render(
        accreditedParams({ site: site({ interimSites: [interimSite()] }) })
      )

      expect(
        $('[data-testid="interim-sites-disclosure-900001"]').attr('open')
      ).toBeUndefined()
    })

    test('labels the disclosure with the number of interim sites', () => {
      const $ = render(
        accreditedParams({
          site: site({
            interimSites: [
              interimSite({ siteId: 42 }),
              interimSite({ siteId: 43 })
            ]
          })
        })
      )

      expect(
        $('[data-testid="interim-sites-disclosure-summary-900001"]')
          .text()
          .trim()
      ).toBe('Show interim sites (2)')
    })

    // The whole entry is one line: name, country and R codes read as a single
    // sentence, with the actions beside them.
    test('summarises each interim site on one line as name, country, R codes', () => {
      const $ = render(
        accreditedParams({ site: site({ interimSites: [interimSite()] }) })
      )

      const item = $('[data-testid="interim-site-row-42"]')
      expect(item).toHaveLength(1)
      expect(
        item.find('.select-overseas-sites-interim-summary').text().trim()
      ).toBe('Interim Depot, France, R12, R13')
    })

    test('omits the country and R codes from the line when absent', () => {
      const $ = render(
        accreditedParams({
          site: site({
            interimSites: [interimSite({ country: '', operationCodes: [] })]
          })
        })
      )

      expect(
        $('[data-testid="interim-site-row-42"]')
          .find('.select-overseas-sites-interim-summary')
          .text()
          .trim()
      ).toBe('Interim Depot')
    })

    // The detail rows the first cut rendered - address, contact name, email,
    // phone - are gone. The line is a summary, not a record.
    test('does not render interim address or contact detail rows', () => {
      const $ = render(
        accreditedParams({ site: site({ interimSites: [interimSite()] }) })
      )

      expect($('[data-testid="interim-site-address-900001"]')).toHaveLength(0)
      expect(
        $('[data-testid="interim-site-contact-name-900001"]')
      ).toHaveLength(0)
      expect(
        $('[data-testid="interim-site-contact-email-900001"]')
      ).toHaveLength(0)
    })

    test('renders Change and Withdraw from application actions per interim site', () => {
      const $ = render(
        accreditedParams({ site: site({ interimSites: [interimSite()] }) })
      )

      expect($('[data-testid="change-interim-site-42"]').attr('href')).toBe(
        '/interim/edit/900001'
      )
      const button = $('[data-testid="remove-button-interim-site-42"]')
      expect(button.text().trim()).toBe('Withdraw from application')
      expect(button.attr('value')).toBe('removeInterimSite')
    })

    test('renders no interim actions when the section is read-only', () => {
      const $ = render(
        accreditedParams({
          readOnly: true,
          site: site({ interimSites: [interimSite()] })
        })
      )

      expect($('[data-testid="change-interim-site-42"]')).toHaveLength(0)
      expect($('[data-testid="remove-button-interim-site-42"]')).toHaveLength(0)
      expect($('[data-testid="interim-site-row-42"]')).toHaveLength(1)
    })
  })

  // The whole point of building this multi-ready in phase 1: the markup must
  // already be correct for many interim sites, so that enabling it later is a
  // backend and routing change rather than another rewrite of this template.
  describe('more than one interim site', () => {
    const twoInterimSites = site({
      interimSites: [
        interimSite({ siteId: 42, siteName: 'First Depot' }),
        interimSite({
          siteId: 43,
          siteName: 'Second Depot',
          country: 'Spain',
          operationCodes: ['R13']
        })
      ]
    })

    test('renders one list entry per interim site', () => {
      const $ = render(accreditedParams({ site: twoInterimSites }))

      expect($('.select-overseas-sites-interim-item')).toHaveLength(2)
    })

    // Every entry is named by its own id, the same way the edit, withdraw and
    // restore routes name it. Phase 1 keyed the first one on its parent ORS so
    // the e2e suite kept resolving while it still assumed one per ORS; that
    // special case is gone now the suite addresses them individually.
    test('keys every entry on the interim site own id', () => {
      const $ = render(accreditedParams({ site: twoInterimSites }))

      expect($('[data-testid="interim-site-row-42"]')).toHaveLength(1)
      expect($('[data-testid="interim-site-row-43"]')).toHaveLength(1)
      expect($('[data-testid="interim-site-name-43"]').text()).toContain(
        'Second Depot'
      )
      // The parent ORS id names the ORS row, and nothing inside it.
      expect($('[data-testid="interim-site-row-900001"]')).toHaveLength(0)
    })

    test('puts every interim site behind the one disclosure for that ORS', () => {
      const $ = render(accreditedParams({ site: twoInterimSites }))

      expect($('details')).toHaveLength(1)
      expect(
        $('[data-testid="interim-sites-disclosure-summary-900001"]')
          .text()
          .trim()
      ).toBe('Show interim sites (2)')
    })

    test('keeps each interim site R codes and actions independent', () => {
      const $ = render(accreditedParams({ site: twoInterimSites }))

      expect($('[data-testid="interim-site-operation-codes-42"]').text()).toBe(
        'R12, R13'
      )
      expect($('[data-testid="interim-site-operation-codes-43"]').text()).toBe(
        'R13'
      )
      expect($('[data-testid="remove-button-interim-site-43"]')).toHaveLength(1)
    })
  })

  // RA-603 C4. Withdrawing is soft, so it is reversible. This is the way back
  // once the undo banner has gone: a second disclosure that renders only when
  // that ORS actually has something withdrawn.
  describe('the withdrawn interim sites disclosure', () => {
    const withdrawn = (siteId, siteName) => ({
      ...interimSite({ siteId, siteName }),
      removedAt: '2026-08-14T09:30:00.000Z'
    })

    test('renders nothing when nothing has been withdrawn', () => {
      const $ = render(
        accreditedParams({ site: site({ interimSites: [interimSite()] }) })
      )

      expect(
        $('[data-testid="withdrawn-interim-sites-disclosure-900001"]')
      ).toHaveLength(0)
    })

    test('lists each withdrawn interim site with a way to put it back', () => {
      const $ = render(
        accreditedParams({
          site: site({
            interimSites: [interimSite()],
            withdrawnInterimSites: [withdrawn(51, 'Old Depot')]
          })
        })
      )

      expect(
        $('[data-testid="withdrawn-interim-sites-disclosure-900001"]')
      ).toHaveLength(1)
      expect(
        $('[data-testid="withdrawn-interim-site-name-51"]').text()
      ).toContain('Old Depot')
      const button = $('[data-testid="restore-button-interim-site-51"]')
      expect(button.attr('value')).toBe('restoreInterimSite')
    })

    test('counts the withdrawn sites separately from the active ones', () => {
      const $ = render(
        accreditedParams({
          site: site({
            interimSites: [interimSite({ siteId: 42 })],
            withdrawnInterimSites: [withdrawn(51, 'One'), withdrawn(52, 'Two')]
          })
        })
      )

      expect(
        $('[data-testid="interim-sites-disclosure-summary-900001"]')
          .text()
          .trim()
      ).toBe('Show interim sites (1)')
      expect(
        $('[data-testid="withdrawn-interim-sites-disclosure-summary-900001"]')
          .text()
          .trim()
      ).toBe('Show withdrawn interim sites (2)')
    })

    // The restore form has to name the interim site, not just its parent: the
    // parent may hold several withdrawn sites.
    test('sends the interim site own id with the restore', () => {
      const $ = render(
        accreditedParams({
          site: site({ withdrawnInterimSites: [withdrawn(51, 'Old Depot')] })
        })
      )

      const form = $('[data-testid="restore-form-interim-site-51"]')
      expect(form.find('input[name="interimSiteId"]').attr('value')).toBe('51')
      expect(form.find('input[name="siteId"]').attr('value')).toBe('900001')
    })

    // An ORS whose only interim sites are all withdrawn still needs its row
    // rendered, or there is nowhere to put them back from.
    test('renders the row for an ORS whose interim sites are all withdrawn', () => {
      const $ = render(
        accreditedParams({
          site: site({
            interimSites: [],
            withdrawnInterimSites: [withdrawn(51, 'Old Depot')]
          })
        })
      )

      expect(
        $('[data-testid="withdrawn-interim-sites-disclosure-900001"]')
      ).toHaveLength(1)
      expect($('[data-testid="interim-sites-accordion-900001"]')).toHaveLength(
        0
      )
    })

    test('offers no way back when the section is read-only', () => {
      const $ = render(
        accreditedParams({
          readOnly: true,
          site: site({ withdrawnInterimSites: [withdrawn(51, 'Old Depot')] })
        })
      )

      expect($('[data-testid="restore-button-interim-site-51"]')).toHaveLength(
        0
      )
      expect($('[data-testid="withdrawn-interim-site-name-51"]')).toHaveLength(
        1
      )
    })
  })
})
