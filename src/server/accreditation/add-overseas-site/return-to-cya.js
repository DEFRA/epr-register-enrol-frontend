const FROM_CYA = 'check-your-answers'
const WIZARD_STEP_PATH =
  /^(?:\/[a-z]{2})?\/accreditation\/add-overseas-site\/([^/]+)\/(?:site-name|site-location|site-contact-details|recycling-operation-details|basel-convention-and-oecd-code|repatriated-loads|conditions-of-export)$/

// RA-573: the check-your-answers Change links tag the step URL with ?from=check-your-answers
// (forms post back to the same URL, so the tag survives a validation re-render). When present,
// the step's Back link returns to check-your-answers instead of the previous wizard step.
export const addOverseasSiteReturnToCya = {
  plugin: {
    name: 'addOverseasSiteReturnToCya',
    register(server) {
      server.ext('onPreResponse', (request, h) => {
        const { response } = request
        if (
          request.query?.from !== FROM_CYA ||
          response.variety !== 'view' ||
          !response.source?.context
        ) {
          return h.continue
        }
        const match = WIZARD_STEP_PATH.exec(request.path)
        if (match) {
          response.source.context.backLink = `/accreditation/add-overseas-site/${match[1]}/check-your-answers`
        }
        return h.continue
      })
    }
  }
}

export function fromCyaQuery() {
  return `?from=${FROM_CYA}`
}
