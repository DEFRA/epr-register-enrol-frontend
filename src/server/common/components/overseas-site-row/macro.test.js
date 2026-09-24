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
  orsIdLabel: 'ORS ID',
  interimSiteLabel: 'Interim site',
  interimRemove: 'Withdraw from application',
  interimRows: {
    country: 'Country',
    address: 'Address',
    contactName: 'Contact name',
    contactEmail: 'Contact email',
    contactPhone: 'Contact phone',
    recyclingOperation: 'Recycling operation codes'
  }
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
      `{%- from "overseas-site-row/macro.njk" import overseasSiteBlock -%}` +
        `{{- overseasSiteBlock(params) -}}`,
      { params }
    )
  )
}

describe('overseasSiteBlock component', () => {
  describe('the overseas reprocessing site row', () => {
    test('renders the site name, ORS id and country against the given testid prefix', () => {
      const $ = render(accreditedParams())

      expect($('[data-testid="accredited-site-row-900001"]')).toHaveLength(1)
      expect($('[data-testid="accredited-site-name-900001"]').text()).toBe(
        'Site Alpha'
      )
      expect(
        $('[data-testid="accredited-site-orsid-900001"]').text()
      ).toContain('001')
      expect($('[data-testid="accredited-site-country-900001"]').text()).toBe(
        'Germany'
      )
    })

    test('omits the ORS id cell entirely when the site has no ORS id', () => {
      const $ = render(accreditedParams({ site: site({ orsId: null }) }))

      expect($('[data-testid="accredited-site-orsid-900001"]')).toHaveLength(0)
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

      expect($('.govuk-summary-list__actions')).toHaveLength(0)
      expect($('[data-testid="accredited-site-row-900001"]')).toHaveLength(1)
    })
  })

  describe('the interim-site accordion', () => {
    test('renders no accordion when the site has no interim sites', () => {
      const $ = render(accreditedParams())

      expect($('[data-testid="interim-sites-accordion-900001"]')).toHaveLength(
        0
      )
      expect($('.govuk-accordion')).toHaveLength(0)
    })

    // AC10: the accordion is the component the ticket asks for, and it only
    // becomes interactive if the GOV.UK JS can find it by module name.
    test('renders a govuk accordion wired to the govuk-accordion module', () => {
      const $ = render(
        accreditedParams({ site: site({ interimSites: [interimSite()] }) })
      )

      const accordion = $('[data-testid="interim-sites-accordion-900001"]')
      expect(accordion).toHaveLength(1)
      expect(accordion.hasClass('govuk-accordion')).toBe(true)
      expect(accordion.attr('data-module')).toBe('govuk-accordion')
      expect(accordion.attr('id')).toBe('interim-sites-900001')
    })

    test("shows the interim site's name in the accordion heading", () => {
      const $ = render(
        accreditedParams({ site: site({ interimSites: [interimSite()] }) })
      )

      expect($('[data-testid="interim-site-name-900001"]').text()).toContain(
        'Interim Depot'
      )
    })

    // AC02/AC10: the R codes must be visible per interim site, not just stored.
    test("lists the interim site's details and its R codes", () => {
      const $ = render(
        accreditedParams({ site: site({ interimSites: [interimSite()] }) })
      )

      expect($('[data-testid="interim-site-country-900001"]').text()).toBe(
        'France'
      )
      expect($('[data-testid="interim-site-address-900001"]').text()).toBe(
        'Unit 1, Rotterdam'
      )
      expect($('[data-testid="interim-site-contact-name-900001"]').text()).toBe(
        'Jane Smith'
      )
      expect(
        $('[data-testid="interim-site-operation-codes-900001"]').text()
      ).toBe('R12, R13')
    })

    test('omits a detail row whose value is absent', () => {
      const $ = render(
        accreditedParams({
          site: site({
            interimSites: [interimSite({ addressLine: '', operationCodes: [] })]
          })
        })
      )

      expect($('[data-testid="interim-site-address-900001"]')).toHaveLength(0)
      expect(
        $('[data-testid="interim-site-operation-codes-900001"]')
      ).toHaveLength(0)
      expect($('[data-testid="interim-site-country-900001"]')).toHaveLength(1)
    })

    test('renders Change and Withdraw from application actions per interim site', () => {
      const $ = render(
        accreditedParams({ site: site({ interimSites: [interimSite()] }) })
      )

      expect($('[data-testid="change-interim-site-900001"]').attr('href')).toBe(
        '/interim/edit/900001'
      )
      const button = $('[data-testid="remove-button-interim-site-900001"]')
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

      expect($('[data-testid="change-interim-site-900001"]')).toHaveLength(0)
      expect(
        $('[data-testid="remove-button-interim-site-900001"]')
      ).toHaveLength(0)
      expect($('[data-testid="interim-site-name-900001"]')).toHaveLength(1)
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

    test('renders one accordion section per interim site', () => {
      const $ = render(accreditedParams({ site: twoInterimSites }))

      expect($('.govuk-accordion__section')).toHaveLength(2)
    })

    test('keys the first section on the parent ORS id and the rest on their own id', () => {
      const $ = render(accreditedParams({ site: twoInterimSites }))

      expect($('[data-testid="interim-site-row-900001"]')).toHaveLength(1)
      expect($('[data-testid="interim-site-row-is43"]')).toHaveLength(1)
      expect($('[data-testid="interim-site-name-is43"]').text()).toContain(
        'Second Depot'
      )
    })

    test('gives every section a unique heading and content id, as the accordion requires', () => {
      const $ = render(accreditedParams({ site: twoInterimSites }))

      const ids = $('.govuk-accordion__section-content')
        .map((_, el) => $(el).attr('id'))
        .get()
      expect(ids).toEqual([
        'interim-sites-900001-content-1',
        'interim-sites-900001-content-2'
      ])
      expect(new Set(ids).size).toBe(ids.length)
    })

    test('keeps each interim site R codes and actions independent', () => {
      const $ = render(accreditedParams({ site: twoInterimSites }))

      expect(
        $('[data-testid="interim-site-operation-codes-900001"]').text()
      ).toBe('R12, R13')
      expect(
        $('[data-testid="interim-site-operation-codes-is43"]').text()
      ).toBe('R13')
      expect($('[data-testid="remove-button-interim-site-is43"]')).toHaveLength(
        1
      )
    })
  })
})
