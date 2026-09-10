import { renderComponent } from '../../test-helpers/component-helpers.js'

describe('Application Header Component', () => {
  let $header

  describe('With operator, material and site details', () => {
    beforeEach(() => {
      $header = renderComponent('application-header', {
        operatorName: 'Delta Green Ltd',
        materialType: 'Plastic',
        siteName: '1 Recycling Way, Leeds',
        year: 2027
      })
    })

    test('Should render the application header component', () => {
      expect($header('[data-testid="application-header"]')).toHaveLength(1)
    })

    test('Should render the operator name, material, year and site as a caption', () => {
      const $operatorName = $header(
        '[data-testid="application-header-operator-name"]'
      )
      expect($operatorName.hasClass('govuk-caption-m')).toBe(true)
      expect($operatorName.text().trim()).toBe(
        'Delta Green Ltd ( Plastic 2027 1 Recycling Way, Leeds  )'
      )
    })

    test('Should contain the material type', () => {
      expect(
        $header('[data-testid="application-header-operator-name"]').text()
      ).toContain('Plastic')
    })

    test('Should contain the site name', () => {
      expect(
        $header('[data-testid="application-header-operator-name"]').text()
      ).toContain('1 Recycling Way, Leeds')
    })

    test('Should contain the accreditation year', () => {
      expect(
        $header('[data-testid="application-header-operator-name"]').text()
      ).toContain('2027')
    })
  })
})
