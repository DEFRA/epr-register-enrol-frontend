import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach
} from 'vitest'
import { createServer } from '../../server.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { apiClient } from '../../common/api-client.js'
import { config } from '../../../config/config.js'
import { buildHeading, buildAuthoriserRows } from './controller.js'

const APPLICATION_ID = 'app-auth-001'

const t = (key) => key.split('.').pop()

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    materialType: 'Steel',
    year: 2025,
    siteId: 'site-001',
    isExporter: false,
    prns: {
      plannedTonnageBand: 'UpTo5000',
      authorisers: [],
      sectionStatus: 'InProgress'
    },
    businessPlan: { sectionStatus: 'NotStarted' },
    samplingPlan: { sectionStatus: 'NotStarted' },
    ...overrides
  }
}

describe('#buildHeading', () => {
  // Material and site are shown once, in the persistent application-header,
  // so this heading is just the translated prefix.
  test('uses the standard prefix for a reprocessor', () => {
    expect(buildHeading(false, t)).toBe('headingPrefix')
  })

  test('uses the exporter-specific prefix when isExporter is true', () => {
    expect(buildHeading(true, t)).toBe('headingPrefixExporter')
  })
})

describe('#buildAuthoriserRows', () => {
  test('returns empty array when authorisers is null', () => {
    expect(buildAuthoriserRows(null)).toEqual([])
  })

  test('returns empty array when authorisers is empty', () => {
    expect(buildAuthoriserRows([])).toEqual([])
  })

  test('maps authorisers to rows, checking those in the selection', () => {
    const rows = buildAuthoriserRows(
      [{ fullName: 'Jane Smith', email: 'jane@example.com' }],
      ['jane@example.com']
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].fullName).toBe('Jane Smith')
    expect(rows[0].email).toBe('jane@example.com')
    expect(rows[0].checked).toBe(true)
  })

  // RA-555: the whole point of the fix - an authoriser absent from the
  // selection renders unchecked, where this function used to hardcode true.
  test('leaves an authoriser unchecked when it is not in the selection', () => {
    const rows = buildAuthoriserRows(
      [
        { fullName: 'Alice', email: 'alice@example.com' },
        { fullName: 'Bob', email: 'bob@example.com' }
      ],
      ['alice@example.com']
    )
    expect(rows[0].checked).toBe(true)
    expect(rows[1].checked).toBe(false)
  })

  // RA-555: an empty selection is a real operator choice (everything
  // unticked), not a missing argument, and must not fall back to all-checked.
  test('checks nothing when the selection is empty', () => {
    const rows = buildAuthoriserRows(
      [{ fullName: 'Alice', email: 'alice@example.com' }],
      []
    )
    expect(rows[0].checked).toBe(false)
  })

  test('treats an omitted selection as nothing selected', () => {
    const rows = buildAuthoriserRows([
      { fullName: 'Alice', email: 'alice@example.com' }
    ])
    expect(rows[0].checked).toBe(false)
  })

  test('maps multiple authorisers with sequential indices', () => {
    const rows = buildAuthoriserRows([
      { fullName: 'Alice', email: 'alice@example.com' },
      { fullName: 'Bob', email: 'bob@example.com' }
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0].index).toBe(0)
    expect(rows[1].index).toBe(1)
  })

  // RA-290 AC01: existing (seeded) authorisers default opted-in, and per
  // clarification newly added authorisers (flagged by AC03) do too.
  //
  // RA-555 moved WHERE that default lives. It used to be a hardcoded
  // `checked: true` in this function; it is now the GET handler seeding the
  // selection from every saved authoriser when the session holds none. So the
  // AC is unchanged but is asserted against the rendered page rather than here
  // - see 'renders every saved authoriser checked when no selection is held'
  // in the GET describe block below. This test now only pins that a selection
  // containing both kinds of authoriser checks both, with no special-casing of
  // the addedForAuthorityToIssue flag.
  test('does not treat a newly-added authoriser differently from a seeded one', () => {
    const rows = buildAuthoriserRows(
      [
        { fullName: 'Alice', email: 'alice@example.com' },
        {
          fullName: 'Bob',
          email: 'bob@example.com',
          addedForAuthorityToIssue: true
        }
      ],
      ['alice@example.com', 'bob@example.com']
    )
    expect(rows.every((r) => r.checked === true)).toBe(true)
  })
})

describe('#tonnageAuthorityController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const operatorHeaders = {
    'x-test-user-type': 'operator'
  }

  describe('GET /accreditation/tonnage-authority/{applicationId}', () => {
    test('returns 200 with the "Authority to issue PRNs" heading', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
      expect(result).toContain('Authority to issue PRNs')
    })

    test('shows no-authorisers message when authorisers list is empty', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="no-authorisers-message"')
    })

    test('renders authoriser table when authorisers exist', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: 'UpTo5000',
            authorisers: [
              { fullName: 'Jane Smith', email: 'jane@example.com' }
            ],
            sectionStatus: 'InProgress'
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="authorisers-table"')
      expect(result).toContain('Jane Smith')
      expect(result).toContain('jane@example.com')
    })

    test('pre-checks a newly-added authoriser as well as existing ones', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: 'UpTo5000',
            authorisers: [
              { fullName: 'Jane Smith', email: 'jane@example.com' },
              {
                fullName: 'Bob',
                email: 'bob@example.com',
                addedForAuthorityToIssue: true
              }
            ],
            sectionStatus: 'InProgress'
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toMatch(/value="jane@example\.com"[\s\S]*?checked/)
      expect(result).toMatch(/value="bob@example\.com"[\s\S]*?checked/)
    })

    test('pre-checks saved authorisers', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: 'UpTo5000',
            authorisers: [
              { fullName: 'Jane Smith', email: 'jane@example.com' }
            ],
            sectionStatus: 'InProgress'
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toMatch(/value="jane@example\.com"[\s\S]*?checked/)
    })

    test('redirects to tonnage page when tonnage has not been completed', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: undefined,
            authorisers: [],
            sectionStatus: 'NotStarted'
          }
        })
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(`/accreditation/tonnage/${APPLICATION_ID}`)
    })

    test('returns 500 when API fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('network error'))

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('renders add authoriser details element', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="add-authoriser-details"')
      expect(result).toContain('data-testid="add-authoriser-button"')
    })

    test('exporter GET shows PERN-specific intro and subheading', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ isExporter: true })
      )

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('authority to issue PERNs')
      expect(result).toContain(
        'You can choose who will have authority to issue PERNs.'
      )
      expect(result).toContain(
        'Select those who you want to have authority to issue PERNs.'
      )
    })

    test('redirects to query-task-list when application is Queried and PRNs section has not been started', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          prns: {
            plannedTonnageBand: 'UpTo5000',
            authorisers: [],
            sectionStatus: 'NotStarted'
          }
        })
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/query-task-list/${APPLICATION_ID}`
      )
    })

    test.each(['Submitted', 'DulyMade', 'Updated', 'AwaitingDecision'])(
      'renders read-only (200, not a redirect) when application is locked (%s) and PRNs section is not Queried',
      async (applicationStatus) => {
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplication({
            applicationStatus,
            prns: {
              plannedTonnageBand: 'UpTo5000',
              authorisers: [
                { fullName: 'Jane Doe', email: 'jane@example.com' }
              ],
              sectionStatus: 'Completed'
            }
          })
        )

        const { statusCode, result } = await server.inject({
          method: 'GET',
          url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
          headers: operatorHeaders
        })

        expect(statusCode).toBe(statusCodes.ok)
        expect(result).toContain('data-testid="read-only-notice"')
      }
    )

    test('renders the page read-only when application is Queried and PRNs section is Completed', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          prns: {
            plannedTonnageBand: 'UpTo5000',
            authorisers: [{ fullName: 'Jane Doe', email: 'jane@example.com' }],
            sectionStatus: 'Completed'
          }
        })
      )

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="read-only-notice"')
      expect(result).not.toContain('data-testid="continue-button"')
      expect(result).not.toContain('data-testid="add-authoriser-details"')
      expect(result).toContain(
        `href="/accreditation/query-task-list/${APPLICATION_ID}"`
      )
    })

    test('does not render the regulator-query banner for a read-only section, even though another section is Queried', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          prns: {
            plannedTonnageBand: 'UpTo5000',
            authorisers: [],
            sectionStatus: 'Completed'
          },
          businessPlan: { sectionStatus: 'Queried' },
          query: { queryNote: 'Please break down the price support spend.' }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).not.toContain('data-testid="regulator-query-banner"')
      expect(result).not.toContain('Please break down the price support spend.')
    })

    test('renders the form and the query banner, without the officer note, when the PRNs section itself is Queried', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          prns: {
            plannedTonnageBand: 'UpTo5000',
            authorisers: [],
            sectionStatus: 'Queried'
          },
          query: { queryNote: 'Please confirm the authorised issuers.' }
        })
      )

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      // RA-590: the banner still tells the operator the section is queried,
      // and still carries the frontend-owned summary sentence, but must not
      // carry the officer's free-text note.
      expect(result).toContain('data-testid="regulator-query-banner"')
      expect(result).toContain(
        'The regulator has identified an issue with your tonnage and authority to issue PRNs.'
      )
      expect(result).not.toContain('data-testid="query-note"')
      // the record still carries the note, so assert on the whole response
      // rather than on the removed element alone.
      expect(result).not.toContain('Please confirm the authorised issuers.')
    })

    test('hides the regulator-query banner when REGULATOR_QUERY_TEXT_DISABLED is true', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          prns: {
            plannedTonnageBand: 'UpTo5000',
            authorisers: [],
            sectionStatus: 'Queried'
          },
          query: { queryNote: 'Please confirm the authorised issuers.' }
        })
      )
      const originalConfigGet = config.get.bind(config)
      const configSpy = vi
        .spyOn(config, 'get')
        .mockImplementation((key) =>
          key === 'regulatorQuery.textDisabled' ? true : originalConfigGet(key)
        )

      try {
        const { result } = await server.inject({
          method: 'GET',
          url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
          headers: operatorHeaders
        })

        expect(result).not.toContain('data-testid="regulator-query-banner"')
        expect(result).not.toContain('Please confirm the authorised issuers.')
      } finally {
        configSpy.mockRestore()
      }
    })

    test('does not render the "Update the application" change-link section', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          prns: {
            plannedTonnageBand: 'UpTo5000',
            authorisers: [],
            sectionStatus: 'Queried'
          },
          query: { queryNote: 'Please confirm the authorised issuers.' }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).not.toContain(
        'data-testid="regulator-query-update-heading"'
      )
      expect(result).not.toContain('href="#authorisers-fieldset"')
    })
  })

  describe('POST /accreditation/tonnage-authority/{applicationId} - addAuthoriser', () => {
    test('adds authoriser and redirects to same page on valid input', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          newFullName: 'Jane Smith',
          newEmail: 'jane@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/tonnage-authority/${APPLICATION_ID}`
      )
      expect(apiClient.patch).toHaveBeenCalledWith(
        expect.stringContaining('/tonnage'),
        expect.objectContaining({
          authorisers: expect.arrayContaining([
            expect.objectContaining({
              fullName: 'Jane Smith',
              email: 'jane@example.com',
              addedForAuthorityToIssue: true
            })
          ])
        })
      )
    })

    test('does not flag existing authorisers as newly added', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: 'UpTo5000',
            authorisers: [{ fullName: 'Alice', email: 'alice@example.com' }],
            sectionStatus: 'InProgress'
          }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          newFullName: 'Bob',
          newEmail: 'bob@example.com'
        }
      })

      const patchBody = patchSpy.mock.calls[0][1]
      const existing = patchBody.authorisers.find(
        (a) => a.email === 'alice@example.com'
      )
      const added = patchBody.authorisers.find(
        (a) => a.email === 'bob@example.com'
      )
      expect(existing.addedForAuthorityToIssue).toBeUndefined()
      expect(added.addedForAuthorityToIssue).toBe(true)
    })

    test('returns 400 with error when full name is missing', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          newFullName: '',
          newEmail: 'jane@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="new-full-name-error"')
    })

    test('returns 400 with error when email is empty', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          newFullName: 'Jane Smith',
          newEmail: ''
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="new-email-error"')
    })

    test('returns 400 with error when email format is invalid', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          newFullName: 'Jane Smith',
          newEmail: 'not-an-email'
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="new-email-error"')
    })

    test('returns 400 with error when email is a duplicate', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: 'UpTo5000',
            authorisers: [
              { fullName: 'Jane Smith', email: 'jane@example.com' }
            ],
            sectionStatus: 'InProgress'
          }
        })
      )

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          newFullName: 'Jane Again',
          newEmail: 'JANE@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="new-email-error"')
    })

    test('returns 500 when PATCH fails during addAuthoriser', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      vi.spyOn(apiClient, 'patch').mockRejectedValue(new Error('patch failed'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          newFullName: 'Jane Smith',
          newEmail: 'jane@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('appends new authoriser to existing list', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: 'UpTo5000',
            authorisers: [{ fullName: 'Alice', email: 'alice@example.com' }],
            sectionStatus: 'InProgress'
          }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          newFullName: 'Bob',
          newEmail: 'bob@example.com'
        }
      })

      const patchBody = patchSpy.mock.calls[0][1]
      expect(patchBody.authorisers).toHaveLength(2)
    })
  })

  describe('POST /accreditation/tonnage-authority/{applicationId} - saveAndContinue', () => {
    test('redirects to query-task-list when application is Queried and PRNs section has not been started, without patching', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          prns: {
            plannedTonnageBand: 'UpTo5000',
            authorisers: [
              { fullName: 'Jane Smith', email: 'jane@example.com' }
            ],
            sectionStatus: 'NotStarted'
          }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch')

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndContinue',
          selectedEmails: 'jane@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/query-task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).not.toHaveBeenCalled()
    })

    test('redirects back to this page (not a raw error) when the PATCH fails with a 409', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: 'UpTo5000',
            authorisers: [
              { fullName: 'Jane Smith', email: 'jane@example.com' }
            ],
            sectionStatus: 'InProgress'
          }
        })
      )
      const err = Object.assign(new Error('conflict'), { status: 409 })
      vi.spyOn(apiClient, 'patch').mockRejectedValue(err)

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndContinue',
          selectedEmails: 'jane@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/tonnage-authority/${APPLICATION_ID}`
      )
    })

    test('redirects to tonnage page without patching when tonnage has not been completed', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: undefined,
            authorisers: [
              { fullName: 'Jane Smith', email: 'jane@example.com' }
            ],
            sectionStatus: 'NotStarted'
          }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch')

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndContinue',
          selectedEmails: 'jane@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(`/accreditation/tonnage/${APPLICATION_ID}`)
      expect(patchSpy).not.toHaveBeenCalled()
    })

    test('returns 400 error when no checkboxes selected', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: 'UpTo5000',
            authorisers: [
              { fullName: 'Jane Smith', email: 'jane@example.com' }
            ],
            sectionStatus: 'InProgress'
          }
        })
      )

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'saveAndContinue' }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="field-error"')
    })

    test('patches with selected authorisers and redirects to prns-cya', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: 'UpTo5000',
            authorisers: [
              { fullName: 'Jane Smith', email: 'jane@example.com' },
              { fullName: 'Bob', email: 'bob@example.com' }
            ],
            sectionStatus: 'InProgress'
          }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndContinue',
          selectedEmails: 'jane@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/tonnage-cya/${APPLICATION_ID}`
      )
      const patchBody = patchSpy.mock.calls[0][1]
      expect(patchBody.authorisers).toHaveLength(1)
      expect(patchBody.authorisers[0].email).toBe('jane@example.com')
      expect(patchBody.sectionStatus).toBeUndefined()
    })

    test('redirects to query-task-list when application is Queried and PRNs section is not, without patching', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          prns: {
            authorisers: [
              { fullName: 'Jane Smith', email: 'jane@example.com' }
            ],
            sectionStatus: 'Completed'
          }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch')

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndContinue',
          selectedEmails: 'jane@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/query-task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).not.toHaveBeenCalled()
    })

    test.each(['Submitted', 'DulyMade', 'Updated', 'AwaitingDecision'])(
      'redirects back to this page when application is locked (%s) and PRNs section is not Queried, without patching',
      async (applicationStatus) => {
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplication({
            applicationStatus,
            prns: {
              authorisers: [
                { fullName: 'Jane Smith', email: 'jane@example.com' }
              ],
              sectionStatus: 'Completed'
            }
          })
        )
        const patchSpy = vi.spyOn(apiClient, 'patch')

        const { statusCode, headers } = await server.inject({
          method: 'POST',
          url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
          headers: operatorHeaders,
          payload: {
            submitAction: 'saveAndContinue',
            selectedEmails: 'jane@example.com'
          }
        })

        expect(statusCode).toBe(statusCodes.redirect)
        expect(headers.location).toBe(
          `/accreditation/tonnage-authority/${APPLICATION_ID}`
        )
        expect(patchSpy).not.toHaveBeenCalled()
      }
    )

    test('allows the save when the application is locked but the PRNs section itself is Queried', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Updated',
          prns: {
            plannedTonnageBand: 'UpTo5000',
            authorisers: [
              { fullName: 'Jane Smith', email: 'jane@example.com' }
            ],
            sectionStatus: 'Queried'
          }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndContinue',
          selectedEmails: 'jane@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(patchSpy).toHaveBeenCalled()
    })
  })

  describe('POST /accreditation/tonnage-authority/{applicationId} - saveAndComeLater', () => {
    test('patches with InProgress status and redirects to task list without requiring selection', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'saveAndComeLater' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/task-list/${APPLICATION_ID}`
      )
      const patchBody = patchSpy.mock.calls[0][1]
      expect(patchBody.sectionStatus).toBe('InProgress')
    })

    test('returns 500 when PATCH fails during saveAndContinue', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: 'UpTo5000',
            authorisers: [
              { fullName: 'Jane Smith', email: 'jane@example.com' }
            ],
            sectionStatus: 'InProgress'
          }
        })
      )
      vi.spyOn(apiClient, 'patch').mockRejectedValue(new Error('patch failed'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndContinue',
          selectedEmails: 'jane@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('returns 500 when GET fetch fails on POST', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('network error'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndContinue',
          selectedEmails: 'jane@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('exporter addAuthoriser validation error shows 400', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ isExporter: true })
      )

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          newFullName: '',
          newEmail: ''
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="new-full-name-error"')
    })
  })

  // RA-292 AC03: the regulator's case-management view flags newly-added
  // authority-to-issue contacts. `isNew` is derived server-side and is
  // authoritative there; the operator journey must round-trip it untouched and
  // must never surface it to the operator.
  describe('RA-292 authoriser isNew round-trip', () => {
    function patchedAuthorisers(patchSpy) {
      return patchSpy.mock.calls.at(-1)[1].authorisers
    }

    function appWithAuthorisers(authorisers) {
      return makeApplication({
        prns: {
          plannedTonnageBand: 'UpTo5000',
          authorisers,
          sectionStatus: 'InProgress'
        }
      })
    }

    test('preserves isNew true and false through the selection step', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        appWithAuthorisers([
          { fullName: 'Jane Smith', email: 'jane@example.com', isNew: true },
          { fullName: 'Bob Jones', email: 'bob@example.com', isNew: false }
        ])
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndContinue',
          selectedEmails: ['jane@example.com', 'bob@example.com']
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(patchedAuthorisers(patchSpy)).toEqual([
        { fullName: 'Jane Smith', email: 'jane@example.com', isNew: true },
        { fullName: 'Bob Jones', email: 'bob@example.com', isNew: false }
      ])
    })

    test('keeps isNew on surviving authorisers when one is unticked', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        appWithAuthorisers([
          { fullName: 'Jane Smith', email: 'jane@example.com', isNew: true },
          { fullName: 'Bob Jones', email: 'bob@example.com', isNew: false }
        ])
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndContinue',
          selectedEmails: 'jane@example.com'
        }
      })

      expect(patchedAuthorisers(patchSpy)).toEqual([
        { fullName: 'Jane Smith', email: 'jane@example.com', isNew: true }
      ])
    })

    test('does not fabricate isNew when the field is absent', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        appWithAuthorisers([
          { fullName: 'Jane Smith', email: 'jane@example.com' }
        ])
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndContinue',
          selectedEmails: 'jane@example.com'
        }
      })

      expect(patchedAuthorisers(patchSpy)[0]).not.toHaveProperty('isNew')
    })

    test('passes isNew through unchanged when it is null', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        appWithAuthorisers([
          { fullName: 'Jane Smith', email: 'jane@example.com', isNew: null }
        ])
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndContinue',
          selectedEmails: 'jane@example.com'
        }
      })

      expect(patchedAuthorisers(patchSpy)[0].isNew).toBeNull()
    })

    test('saveAndComeLater also preserves isNew', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        appWithAuthorisers([
          { fullName: 'Jane Smith', email: 'jane@example.com', isNew: true }
        ])
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndComeLater',
          selectedEmails: 'jane@example.com'
        }
      })

      expect(patchedAuthorisers(patchSpy)[0].isNew).toBe(true)
    })

    // Newness is derived server-side by merging on email. The operator side
    // must not guess it, so a freshly added authoriser is sent without the key.
    test('adding an authoriser keeps existing isNew and sets none on the new one', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        appWithAuthorisers([
          { fullName: 'Bob Jones', email: 'bob@example.com', isNew: false }
        ])
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          newFullName: 'Jane Smith',
          newEmail: 'jane@example.com'
        }
      })

      const sent = patchedAuthorisers(patchSpy)
      expect(sent[0]).toEqual({
        fullName: 'Bob Jones',
        email: 'bob@example.com',
        isNew: false
      })
      expect(sent[1]).not.toHaveProperty('isNew')
    })

    test('does not expose isNew to the operator on the rendered page', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        appWithAuthorisers([
          { fullName: 'Jane Smith', email: 'jane@example.com', isNew: true }
        ])
      )

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Jane Smith')
      expect(result).not.toContain('isNew')
    })

    test('buildAuthoriserRows drops isNew from the view model', () => {
      const rows = buildAuthoriserRows([
        { fullName: 'Jane Smith', email: 'jane@example.com', isNew: true }
      ])
      expect(rows[0]).not.toHaveProperty('isNew')
    })
  })
})

// RA-555: an operator who unticks an authoriser and then adds a new one used
// to find their untick silently reverted. `checked` was hardcoded true, so no
// selection state existed and any re-render re-ticked everything. These tests
// cover the reported path plus the three others that were reachable, and pin
// that unticking is not a deletion until the operator saves.
describe('#tonnageAuthorityController - RA-555 authoriser selection', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const operatorHeaders = { 'x-test-user-type': 'operator' }

  const ALICE = { fullName: 'Alice', email: 'alice@example.com' }
  const BOB = { fullName: 'Bob', email: 'bob@example.com' }
  const CHARLIE_EMAIL = 'charlie@example.com'

  function applicationWith(authorisers) {
    return makeApplication({
      prns: {
        plannedTonnageBand: 'UpTo5000',
        authorisers,
        sectionStatus: 'InProgress'
      }
    })
  }

  // The POST redirects, and a redirect discards the payload - so the session
  // cookie is the only thing carrying the selection to the following GET.
  // Replaying it is what makes this a real round trip rather than two
  // unrelated requests.
  function sessionCookie(response) {
    const raw = response.headers['set-cookie']
    if (!raw) {
      return null
    }
    return (Array.isArray(raw) ? raw : [raw])
      .map((c) => c.split(';')[0])
      .join('; ')
  }

  // Reads the rendered checkbox for one authoriser and reports whether it
  // carries the checked attribute. Returns null when the row is absent, so a
  // missing row can never be mistaken for an unchecked one.
  function isCheckedFor(html, email) {
    const match = html.match(new RegExp('value="' + email + '"[^>]*>'))
    return match ? match[0].includes('checked') : null
  }

  describe('GET', () => {
    // RA-290 AC01 still holds, but it is now the GET handler's seeding that
    // provides it rather than a hardcoded flag in buildAuthoriserRows.
    test('renders every saved authoriser checked when no selection is held', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        applicationWith([ALICE, BOB])
      )

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(isCheckedFor(result, ALICE.email)).toBe(true)
      expect(isCheckedFor(result, BOB.email)).toBe(true)
    })
  })

  describe('addAuthoriser round trip', () => {
    test('keeps an unticked authoriser unticked, and the new one ticked', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        applicationWith([ALICE, BOB])
      )
      vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      // Alice is unticked, so only Bob comes back in the payload.
      const post = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          selectedEmails: BOB.email,
          newFullName: 'Charlie',
          newEmail: CHARLIE_EMAIL
        }
      })
      expect(post.statusCode).toBe(statusCodes.redirect)

      const cookie = sessionCookie(post)
      expect(cookie).toBeTruthy()

      // The add has landed, so the list now includes Charlie.
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        applicationWith([
          ALICE,
          BOB,
          { fullName: 'Charlie', email: CHARLIE_EMAIL }
        ])
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, cookie }
      })

      // the reported bug
      expect(isCheckedFor(result, ALICE.email)).toBe(false)
      // the fix must not invert the bug
      expect(isCheckedFor(result, BOB.email)).toBe(true)
      expect(isCheckedFor(result, CHARLIE_EMAIL)).toBe(true)
    })

    // The add path writes the authoriser LIST, but must not apply the
    // selection to it - unticking is not a deletion until the operator saves.
    test('does not drop the unticked authoriser from the backend on add', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        applicationWith([ALICE, BOB])
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          selectedEmails: BOB.email,
          newFullName: 'Charlie',
          newEmail: CHARLIE_EMAIL
        }
      })

      const emails = patchSpy.mock.calls[0][1].authorisers.map((a) => a.email)
      expect(emails).toContain(ALICE.email)
      expect(emails).toContain(BOB.email)
      expect(emails).toContain(CHARLIE_EMAIL)
    })
  })

  // The three add-path re-renders keep the payload, so they must render from
  // the submitted selection. Before RA-555 all three re-ticked everything.
  describe('add-path error re-renders preserve the selection', () => {
    test.each([
      ['a missing name', { newFullName: '', newEmail: CHARLIE_EMAIL }],
      ['a duplicate email', { newFullName: 'Dup', newEmail: ALICE.email }]
    ])('survives %s', async (_label, addFields) => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        applicationWith([ALICE, BOB])
      )
      vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          selectedEmails: BOB.email,
          ...addFields
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(isCheckedFor(result, ALICE.email)).toBe(false)
      expect(isCheckedFor(result, BOB.email)).toBe(true)
    })

    test('survives a failed patch', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        applicationWith([ALICE, BOB])
      )
      vi.spyOn(apiClient, 'patch').mockRejectedValue(new Error('boom'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          selectedEmails: BOB.email,
          newFullName: 'Charlie',
          newEmail: CHARLIE_EMAIL
        }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(isCheckedFor(result, ALICE.email)).toBe(false)
      expect(isCheckedFor(result, BOB.email)).toBe(true)
    })
  })

  describe('save', () => {
    test('writes exactly the selection the operator was last shown', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        applicationWith([ALICE, BOB])
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'saveAndContinue', selectedEmails: BOB.email }
      })

      const emails = patchSpy.mock.calls[0][1].authorisers.map((a) => a.email)
      expect(emails).toEqual([BOB.email])
    })

    // Once the selection is in the backend the saved list IS the selection, so
    // a later visit must re-seed from it rather than replay a stale session
    // value. Asserted through behaviour rather than by inspecting the session.
    test('does not replay a stale selection after saving', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        applicationWith([ALICE, BOB])
      )
      vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const post = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'saveAndContinue', selectedEmails: BOB.email }
      })
      const cookie = sessionCookie(post)

      // the save dropped Alice, so the saved list is Bob alone
      vi.spyOn(apiClient, 'get').mockResolvedValue(applicationWith([BOB]))

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: cookie ? { ...operatorHeaders, cookie } : operatorHeaders
      })

      expect(isCheckedFor(result, BOB.email)).toBe(true)
    })
  })
})
