// RA-697: the change requests the backend's dev seed (DevChangeRequestSeedService)
// gives org 50018's current-year accreditations, which the change-request stub
// starts with: every item status and type for the exporter, and tonnage band
// upgrades only for the reprocessor. Same ids, references and dates as the
// backend's, so the pages read the same in stub mode; keep the two in step.
// Org 50019 (RA-492's) and org 50020 (the empty states') have none. Org 50021
// (registration only) has five registration-only ORS updates on its registered
// ORSs, one item each and none In progress. Org 50018's exporter registration
// also has one registration-only ORS update, which its accreditation's view
// merges in.

import { CHANGE_TYPES, ITEM_STATUSES } from './constants/changeRequests.js'
import { yearSuffix } from './helpers/currentYear.js'
import {
  MANAGE_EXPORTER_ORG,
  REGISTRATION_ONLY_ORG,
  seededApplicationId
} from './constants/test-orgs.js'

const {
  addOverseasSite: ADD,
  updateOverseasSite: UPDATE,
  upgradeTonnageBand: TONNAGE
} = CHANGE_TYPES
const {
  queried: QUERIED,
  inProgress: IN_PROGRESS,
  submitted: SUBMITTED,
  updated: UPDATED,
  dulyMade: DULY_MADE,
  approved: APPROVED,
  rejected: REJECTED,
  withdrawn: WITHDRAWN
} = ITEM_STATUSES

const SUBMITTED_HOURS_AFTER_CREATION = 2
const MS_PER_HOUR = 3_600_000
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

// [changeType, 'MM-DD' created, items], oldest first. Dates are 'MM-DD' in
// the accreditation's year, at 09:00 UTC. RA-697: Dragon's withdrawn New ORS
// accreditation has no validFrom, as its site is registered only.
const EXPORTER_REQUESTS = [
  [
    UPDATE,
    '02-03',
    [ors('001', APPROVED, '03-02'), ors('002', APPROVED, '03-02')]
  ],
  [ADD, '02-20', [ors('004', REJECTED)]],
  [TONNAGE, '03-10', [band('UpTo5000', APPROVED, '04-01')]],
  [ADD, '04-06', [ors('004', WITHDRAWN, null, '06-15')]],
  [UPDATE, '05-12', [ors('003', REJECTED)]],
  [UPDATE, '06-02', [ors('001', WITHDRAWN, '06-22', '07-10')]],
  [TONNAGE, '06-25', [band('Over10000', REJECTED)]],
  [UPDATE, '07-14', [ors('001', QUERIED), ors('002', SUBMITTED)]],
  [UPDATE, '08-20', [ors('003', UPDATED)]],
  [TONNAGE, '09-08', [band('UpTo10000', DULY_MADE)]],
  [ADD, '10-01', [ors('004', IN_PROGRESS)]]
]

const REPROCESSOR_REQUESTS = [
  [TONNAGE, '03-03', [band('UpTo5000', APPROVED, '04-01')]],
  [TONNAGE, '05-19', [band('Over10000', REJECTED)]],
  [TONNAGE, '08-04', [band('UpTo10000', SUBMITTED)]]
]

const REGISTRATION_ONLY_REQUESTS = [
  [UPDATE, '02-10', [ors('001', REJECTED)]],
  [UPDATE, '03-15', [ors('004', APPROVED, '04-20')]],
  [UPDATE, '05-06', [ors('003', DULY_MADE)]],
  [UPDATE, '06-18', [ors('002', QUERIED)]],
  [UPDATE, '08-25', [ors('001', SUBMITTED)]]
]

// RA-697 task 014: org 50018's exporter registration's, on Dragon (registered
// only). Keyed by the ORS id's integer value, as every registration-only item
// is, and Refused, as Dragon's draft is its one active item. Numbered after
// the exporter's requests.
const DRAGON = { siteId: 4, orsId: '004', siteName: 'Dragon Recyclers' }
const ACCREDITED_EXPORTER_REGISTRATION_ONLY_REQUESTS = [
  [UPDATE, '09-15', [ors('004', REJECTED)]]
]

const pad = (value, digits) => String(value).padStart(digits, '0')

// As the backend's FixedId, e.g. 00002026-0000-0001-a000-050018000001.
function fixedId(year, orgId, side, request, item) {
  return `0000${year}-0000-${pad(item, ID_ITEM_DIGITS)}-${side}000-${pad(orgId, ID_ORG_DIGITS)}${pad(request, ID_REQUEST_DIGITS)}`
}

function buildRequest(target, side, number, [changeType, created, items]) {
  const { year, orgId } = target
  const on = (date) =>
    date ? new Date(`${year}-${date}T09:00:00Z`).toISOString() : null
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
  const draft = seeded.some((item) => item.status === IN_PROGRESS)
  const createdAt = on(created)
  const submittedAt = draft
    ? null
    : new Date(
        Date.parse(createdAt) + SUBMITTED_HOURS_AFTER_CREATION * MS_PER_HOUR
      ).toISOString()
  const updatedAt = [
    submittedAt,
    ...seeded.flatMap((item) => [item.validFrom, item.withdrawnAt])
  ]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .at(-1)
  return {
    requestId: fixedId(year, orgId, side, number, 0),
    changeType,
    status: draft ? IN_PROGRESS : SUBMITTED,
    createdAt,
    updatedAt: updatedAt ?? createdAt,
    submittedAt,
    submittedBy: draft ? null : SUBMITTER,
    caseManagementReference: draft
      ? null
      : `CR${yearSuffix(year)}${pad(orgId, ID_ORG_DIGITS)}${side.toUpperCase()}${pad(number, REFERENCE_REQUEST_DIGITS)}`,
    sites: seeded.filter((item) => item.siteId),
    tonnageBandUpgrade: seeded.find((item) => item.requestedBand) ?? null
  }
}

/**
 * The seeded requests for `${orgId}/${appId}`, built from its stub
 * application, or none if it isn't one of org 50018's for that year.
 */
export function seededStubChangeRequests(orgId, appId, application) {
  if (String(orgId) !== String(MANAGE_EXPORTER_ORG.orgId)) {
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
    orgId: MANAGE_EXPORTER_ORG.orgId,
    sites: application.overseasSites?.sites ?? []
  }
  return requests.map((request, index) =>
    buildRequest(target, side, index + 1, request)
  )
}

/**
 * RA-697: the seeded registration-only requests for org 50021's registration
 * in `year`, on its registered ORSs (`sites`), or (task 014) org 50018's
 * exporter registration, or none for any other.
 */
export function seededStubRegistrationChangeRequests(
  orgId,
  registrationId,
  sites,
  year
) {
  if (
    String(orgId) === String(MANAGE_EXPORTER_ORG.orgId) &&
    registrationId === MANAGE_EXPORTER_ORG.registrationId
  ) {
    const exporterTarget = {
      year,
      orgId: MANAGE_EXPORTER_ORG.orgId,
      sites: [DRAGON]
    }
    return ACCREDITED_EXPORTER_REGISTRATION_ONLY_REQUESTS.map(
      (request, index) =>
        buildRequest(
          exporterTarget,
          'a',
          EXPORTER_REQUESTS.length + index + 1,
          request
        )
    )
  }
  if (
    String(orgId) !== String(REGISTRATION_ONLY_ORG.orgId) ||
    registrationId !== REGISTRATION_ONLY_ORG.registrationId
  ) {
    return []
  }
  const target = { year, orgId: REGISTRATION_ONLY_ORG.orgId, sites }
  return REGISTRATION_ONLY_REQUESTS.map((request, index) =>
    buildRequest(target, 'a', index + 1, request)
  )
}
