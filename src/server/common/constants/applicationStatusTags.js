const GREY = 'govuk-tag--grey'
const BLUE = 'govuk-tag--blue'
const GREEN = 'govuk-tag--green'
const TURQUOISE = 'govuk-tag--turquoise'

// Shared so a status looks the same on every page that shows one.
export const APPLICATION_STATUS_TAGS = {
  Saved: { tagClass: GREY },
  Started: { tagClass: BLUE },
  NotStarted: { tagClass: GREY },
  InProgress: { tagClass: BLUE },
  Submitted: { tagClass: GREEN },
  DulyMade: { tagClass: TURQUOISE },
  Queried: { tagClass: 'govuk-tag--orange' },
  Updated: { tagClass: TURQUOISE },
  AwaitingDecision: { tagClass: 'govuk-tag--purple' },
  Approved: { tagClass: GREEN },
  Rejected: { tagClass: 'govuk-tag--red' },
  Withdrawn: { tagClass: GREY }
}

export function applicationStatusTag(status, t) {
  return {
    text: t(`common.applicationStatuses.${status}`),
    classes: APPLICATION_STATUS_TAGS[status]?.tagClass ?? ''
  }
}
