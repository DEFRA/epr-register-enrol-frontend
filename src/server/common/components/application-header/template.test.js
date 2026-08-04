import { renderComponent } from '../../test-helpers/component-helpers.js'

describe('Application Header Component', () => {
  let $header

  describe('With operator, material and site details', () => {
    beforeEach(() => {
      $header = renderComponent('application-header', {
        operatorName: 'Delta Green Ltd',
        materialType: 'Plastic',
        siteName: '1 Recycling Way, Leeds',
        materialLabel: 'Material:',
        siteLabel: 'Site:'
      })
    })

    test('Should render the application header component', () => {
      expect($header('[data-testid="application-header"]')).toHaveLength(1)
    })

    test('Should render the operator name unlabelled, one size larger than a page heading', () => {
      const $operatorName = $header(
        '[data-testid="application-header-operator-name"]'
      )
      expect($operatorName.text().trim()).toBe('Delta Green Ltd')
      expect($operatorName.text()).not.toContain('Operator')
      expect($operatorName.hasClass('govuk-heading-xl')).toBe(true)
    })

    test('Should render a visible section-break rule after the site row', () => {
      const $separator = $header('[data-testid="application-header-separator"]')
      expect($separator).toHaveLength(1)
      expect($separator.is('hr')).toBe(true)
      expect($separator.hasClass('govuk-section-break--visible')).toBe(true)
    })

    test('Should contain the material type', () => {
      expect(
        $header('[data-testid="application-header-material-type"]')
          .text()
          .trim()
      ).toBe('Plastic')
    })

    test('Should contain the site name', () => {
      expect(
        $header('[data-testid="application-header-site-name"]').text().trim()
      ).toBe('1 Recycling Way, Leeds')
    })

    test('Should use the given labels for material and site', () => {
      expect($header('.govuk-summary-list__key').eq(0).text().trim()).toBe(
        'Material:'
      )
      expect($header('.govuk-summary-list__key').eq(1).text().trim()).toBe(
        'Site:'
      )
    })

    test('Should use the same govuk-summary-list--no-border pattern as the existing application-metadata block for material/site', () => {
      expect($header('dl').hasClass('govuk-summary-list')).toBe(true)
      expect($header('dl').hasClass('govuk-summary-list--no-border')).toBe(true)
    })
  })

  describe('With no labels given', () => {
    beforeEach(() => {
      $header = renderComponent('application-header', {
        operatorName: 'Delta Green Ltd',
        materialType: 'Plastic',
        siteName: '1 Recycling Way, Leeds'
      })
    })

    test('Should fall back to the default English labels', () => {
      expect($header('.govuk-summary-list__key').eq(0).text().trim()).toBe(
        'Material:'
      )
      expect($header('.govuk-summary-list__key').eq(1).text().trim()).toBe(
        'Site:'
      )
    })
  })
})
