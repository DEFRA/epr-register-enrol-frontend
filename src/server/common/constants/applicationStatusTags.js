// Shared so a status looks the same on every page that shows one.
export const APPLICATION_STATUS_TAGS = {
  Saved: { tagClass: 'govuk-tag--grey' },
  Started: { tagClass: 'govuk-tag--blue' },
  NotStarted: { tagClass: 'govuk-tag--grey' },
  InProgress: { tagClass: 'govuk-tag--blue' },
  Submitted: { tagClass: 'govuk-tag--green' },
  DulyMade: { tagClass: 'govuk-tag--turquoise' },
  Queried: { tagClass: 'govuk-tag--orange' },
  Updated: { tagClass: 'govuk-tag--turquoise' },
  AwaitingDecision: { tagClass: 'govuk-tag--purple' },
  Approved: { tagClass: 'govuk-tag--green' },
  Rejected: { tagClass: 'govuk-tag--red' },
  Withdrawn: { tagClass: 'govuk-tag--grey' }
}

export function applicationStatusTag(status, t) {
  return {
    text: t(`common.applicationStatuses.${status}`),
    classes: APPLICATION_STATUS_TAGS[status]?.tagClass ?? ''
  }
}
