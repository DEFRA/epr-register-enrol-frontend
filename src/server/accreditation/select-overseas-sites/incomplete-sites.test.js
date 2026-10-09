import { describe, test, expect } from 'vitest'
import { incompleteSiteErrors } from './incomplete-sites.js'

const t = () => 'Complete the missing details for {siteName}'
const editUrl = (applicationId, siteId) => `/edit/${applicationId}/${siteId}`

describe('#incompleteSiteErrors', () => {
  test('names each incomplete site and links to its edit page', () => {
    const errors = incompleteSiteErrors(
      t,
      'app-1',
      {
        accredited: [{ siteId: 1, siteName: 'Acme', incomplete: true }],
        newSites: [{ siteId: 2, siteName: 'Done', incomplete: false }],
        registeredSitesAdded: []
      },
      editUrl
    )

    expect(errors).toEqual([
      {
        message: 'Complete the missing details for Acme',
        href: '/edit/app-1/1'
      }
    ])
  })

  test('shows a site name containing replacement patterns exactly as entered', () => {
    const [error] = incompleteSiteErrors(
      t,
      'app-1',
      {
        accredited: [
          { siteId: 1, siteName: 'Smith $& Co $`', incomplete: true }
        ],
        newSites: [],
        registeredSitesAdded: []
      },
      editUrl
    )

    expect(error.message).toBe(
      'Complete the missing details for Smith $& Co $`'
    )
  })
})
