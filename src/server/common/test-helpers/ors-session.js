const FORM = 'application/x-www-form-urlencoded'

// Every answer a fresh add of a Plastic/Glass-style overseas reprocessing site
// needs, one wizard step per entry, in the order the wizard asks for them.
// Check-your-answers refuses to save a site without all of them, so a test that
// needs "a site that has just been saved" starts from here.
export const COMPLETE_ORS_ANSWERS = [
  ['site-name', 'siteName=Acme+Recyclers+GmbH'],
  [
    'site-location',
    'addressLine1=Unit+1&townOrCity=Rotterdam&country=Netherlands&coordinates=51.9225%2C+4.4792'
  ],
  [
    'site-contact-details',
    'siteContactName=Jane+Smith&siteContactEmail=jane%40example.com&siteContactPhone=%2B441234567890'
  ],
  ['recycling-operation-details', 'recyclingOperationCodes=R3'],
  [
    'basel-convention-and-oecd-code',
    'action=continue&visibleCount=1&code-0=A1181'
  ],
  ['repatriated-loads', 'repatriatedLoads=Returned+within+30+days']
]

/**
 * Posts each add-overseas-site wizard step with valid answers and returns the
 * session cookie holding them. The caller must have mocked the application
 * lookup the wizard guard makes, as the wizard's own tests do.
 *
 * @param {import('@hapi/hapi').Server} server
 * @param {string} applicationId
 * @param {string} [startCookie] - continue an existing session
 * @returns {Promise<string>} cookie header value for the next request
 */
export function fillCompleteOrsAnswers(
  server,
  applicationId,
  startCookie = ''
) {
  const postStep = async (previousCookie, [step, payload]) => {
    const cookie = await previousCookie
    const response = await server.inject({
      method: 'POST',
      url: `/accreditation/add-overseas-site/${applicationId}/${step}`,
      headers: {
        'x-test-user-type': 'operator',
        'content-type': FORM,
        ...(cookie ? { cookie } : {})
      },
      payload
    })
    const raw = response.headers['set-cookie']
    return raw ? (Array.isArray(raw) ? raw[0] : raw).split(';')[0] : cookie
  }

  // One step after the other: each answer lands in the session the previous
  // response set up.
  return COMPLETE_ORS_ANSWERS.reduce(postStep, Promise.resolve(startCookie))
}
