import { renderComponent } from '../../test-helpers/component-helpers.js'

describe('Application Header Component', () => {
  let $header

  describe('With operator, material and site details', () => {
    beforeEach(() => {
      $header = renderComponent('application-header', {
        operatorName: 'Delta Green Ltd',
        materialType: 'Plastic',
        siteName: '1 Recycling Way, Leeds',
        operatorLabel: 'Operator',
        materialLabel: 'Material',
        siteLabel: 'Site'
      })
    })

    test('Should render the application header component', () => {
      expect($header('[data-testid="application-header"]')).toHaveLength(1)
    })

    test('Should contain the operator name', () => {
      expect(
        $header('[data-testid="application-header-operator-name"]')
          .text()
          .trim()
      ).toBe('Delta Green Ltd')
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

    test('Should use the given labels', () => {
      expect(
        $header('.app-application-header__label').eq(0).text().trim()
      ).toBe('Operator')
      expect(
        $header('.app-application-header__label').eq(1).text().trim()
      ).toBe('Material')
      expect(
        $header('.app-application-header__label').eq(2).text().trim()
      ).toBe('Site')
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
      expect(
        $header('.app-application-header__label').eq(0).text().trim()
      ).toBe('Operator')
      expect(
        $header('.app-application-header__label').eq(1).text().trim()
      ).toBe('Material')
      expect(
        $header('.app-application-header__label').eq(2).text().trim()
      ).toBe('Site')
    })
  })
})
