// RA-697: the change requests the backend's dev seed (DevChangeRequestSeedService)
// gives org 50018's current-year accreditations, which the change-request stub
// starts with: every item status and type for the exporter, and tonnage band
// upgrades only for the reprocessor. Same ids, references and dates as the
// backend's, so the pages read the same in stub mode; keep the two in step.
// Org 50019 (RA-492's) and org 50020 (the empty states') have none. Org 50021
// (registration only) has five registration-only ORS updates on its registered
// ORSs, one item each and none In progress.

import { CHANGE_TYPES } from './constants/changeRequests.js'
import {
  MANAGE_EXPORTER_ORG_ID,
  REGISTRATION_ONLY_ORG_ID,
  REGISTRATION_ONLY_REGISTRATION_ID,
  seededApplicationId
} from './constants/test-orgs.js'

const {
  addOverseasSite: ADD,
  updateOverseasSite: UPDATE,
  upgradeTonnageBand: TONNAGE
} = CHANGE_TYPES

const SUBMITTED_HOURS_AFTER_CREATION = 2
const ID_ORG_DIGITS = 6
const ID_REQUEST_DIGITS = 6
const ID_ITEM_DIGITS = 4
const REFERENCE_REQUEST_DIGITS = 3

const SUBMITTER = {
  fullName: 'Sam Patel',
  jobTitle: 'Director',
  email: 'sam.patel@example.com'
}

const ors = (orsId, status, validFrom = null, withdrawnAt = null) => ({
  orsId,
  status,
  validFrom,
  withdrawnAt
})

const band = (requestedBand, status, validFrom = null) => ({
  requestedBand,
  status,
  validFrom,
  withdrawnAt: null
})

// [changeType, [month, day] created, items], oldest first. Dates are
// [month, day] in the accreditation's year. RA-697: Dragon's withdrawn New ORS
// accreditation has no validFrom, as its site is registered only.
const EXPORTER_REQUESTS = [
  [
    UPDATE,
    [2, 3],
    [ors('001', 'Approved', [3, 2]), ors('002', 'Approved', [3, 2])]
  ],
  [ADD, [2, 20], [ors('004', 'Rejected')]],
  [TONNAGE, [3, 10], [band('UpTo5000', 'Approved', [4, 1])]],
  [ADD, [4, 6], [ors('004', 'Withdrawn', null, [6, 15])]],
  [UPDATE, [5, 12], [ors('003', 'Rejected')]],
  [UPDATE, [6, 2], [ors('001', 'Withdrawn', [6, 22], [7, 10])]],
  [TONNAGE, [6, 25], [band('Over10000', 'Rejected')]],
  [UPDATE, [7, 14], [ors('001', 'Queried'), ors('002', 'Submitted')]],
  [UPDATE, [8, 20], [ors('003', 'Updated')]],
  [TONNAGE, [9, 8], [band('UpTo10000', 'DulyMade')]],
  [ADD, [10, 1], [ors('004', 'InProgress')]]
]

const REPROCESSOR_REQUESTS = [
  [TONNAGE, [3, 3], [band('UpTo5000', 'Approved', [4, 1])]],
  [TONNAGE, [5, 19], [band('Over10000', 'Rejected')]],
  [TONNAGE, [8, 4], [band('UpTo10000', 'Submitted')]]
]

const REGISTRATION_ONLY_REQUESTS = [
  [UPDATE, [2, 10], [ors('001', 'Rejected')]],
  [UPDATE, [3, 15], [ors('004', 'Approved', [4, 20])]],
  [UPDATE, [5, 6], [ors('003', 'DulyMade')]],
  [UPDATE, [6, 18], [ors('002', 'Queried')]],
  [UPDATE, [8, 25], [ors('001', 'Submitted')]]
]

const pad = (value, digits) => String(value).padStart(digits, '0')

// As the backend's FixedId, e.g. 00002026-0000-0001-a000-050018000001.
function fixedId(year, orgId, side, request, item) {
  return `0000${year}-0000-${pad(item, ID_ITEM_DIGITS)}-${side}000-${pad(orgId, ID_ORG_DIGITS)}${pad(request, ID_REQUEST_DIGITS)}`
}

function buildRequest(target, side, number, [changeType, created, items]) {
  const { year, orgId } = target
  const on = (date) =>
    date
      ? new Date(Date.UTC(year, date[0] - 1, date[1], 9)).toISOString()
      : null
  const sitesByOrsId = new Map(target.sites.map((site) => [site.orsId, site]))
  const seeded = items.map((item, index) => {
    const fields = {
      itemId: fixedId(year, orgId, side, number, index + 1),
      changeType,
      status: item.status,
      validFrom: on(item.validFrom),
      withdrawnAt: on(item.withdrawnAt)
    }
    if (item.requestedBand) {
      return { ...fields, requestedBand: item.requestedBand }
    }
    const site = sitesByOrsId.get(item.orsId)
    return {
      ...fields,
      siteId: site.siteId,
      orsId: site.orsId,
      siteName: site.siteName
    }
  })
  const draft = seeded.some((item) => item.status === 'InProgress')
  const createdAt = on(created)
  const submittedAt = draft
    ? null
    : new Date(
        Date.parse(createdAt) + SUBMITTED_HOURS_AFTER_CREATION * 3_600_000
      ).toISOString()
  const updatedAt = [
    submittedAt,
    ...seeded.flatMap((item) => [item.validFrom, item.withdrawnAt])
  ]
    .filter(Boolean)
    .sort()
    .at(-1)
  return {
    requestId: fixedId(year, orgId, side, number, 0),
    changeType,
    status: draft ? 'InProgress' : 'Submitted',
    createdAt,
    updatedAt: updatedAt ?? createdAt,
    submittedAt,
    submittedBy: draft ? null : SUBMITTER,
    caseManagementReference: draft
      ? null
      : `CR${String(year).slice(-2)}${pad(orgId, ID_ORG_DIGITS)}${side.toUpperCase()}${pad(number, REFERENCE_REQUEST_DIGITS)}`,
    sites: seeded.filter((item) => item.siteId),
    tonnageBandUpgrade: seeded.find((item) => item.requestedBand) ?? null
  }
}

/**
 * The seeded requests for `${orgId}/${appId}`, built from its stub
 * application, or none if it isn't one of org 50018's for that year.
 */
export function seededStubChangeRequests(orgId, appId, application) {
  if (String(orgId) !== String(MANAGE_EXPORTER_ORG_ID)) {
    return []
  }
  const seeds = {
    [seededApplicationId('a', application.year, orgId)]: [
      'a',
      EXPORTER_REQUESTS
    ],
    [seededApplicationId('b', application.year, orgId)]: [
      'b',
      REPROCESSOR_REQUESTS
    ]
  }[appId]
  if (!seeds) {
    return []
  }
  const [side, requests] = seeds
  const target = {
    year: application.year,
    orgId: MANAGE_EXPORTER_ORG_ID,
    sites: application.overseasSites?.sites ?? []
  }
  return requests.map((request, index) =>
    buildRequest(target, side, index + 1, request)
  )
}

/**
 * RA-697: the seeded registration-only requests for org 50021's registration
 * in `year`, on its registered ORSs (`sites`), or none for any other.
 */
export function seededStubRegistrationChangeRequests(
  orgId,
  registrationId,
  sites,
  year
) {
  if (
    String(orgId) !== String(REGISTRATION_ONLY_ORG_ID) ||
    registrationId !== REGISTRATION_ONLY_REGISTRATION_ID
  ) {
    return []
  }
  const target = { year, orgId: REGISTRATION_ONLY_ORG_ID, sites }
  return REGISTRATION_ONLY_REQUESTS.map((request, index) =>
    buildRequest(target, 'a', index + 1, request)
  )
}
