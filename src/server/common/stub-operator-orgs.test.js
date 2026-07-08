import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  STUB_OPERATOR_ORGS,
  STUB_DEFRA_LINKS,
  STUB_OPERATOR_RELATIONSHIPS,
  STUB_OPERATOR_CURRENT_RELATIONSHIP_ID
} from './stub-operator-orgs.js'

describe('STUB_DEFRA_LINKS', () => {
  test('maps each ReEx org id to its linked Defra org id', () => {
    expect(STUB_DEFRA_LINKS['50002']).toBe(50002)
    expect(STUB_DEFRA_LINKS['6a2fcd74e16883c137d01188']).toBe(
      '67b9e8fc-2235-431a-a7b9-80663c81b6ff'
    )
  })

  test('has one entry per org', () => {
    expect(Object.keys(STUB_DEFRA_LINKS)).toHaveLength(
      STUB_OPERATOR_ORGS.length
    )
  })
})

describe('STUB_OPERATOR_RELATIONSHIPS', () => {
  test('derives relationshipId:organisationId:organisationName per org', () => {
    expect(STUB_OPERATOR_RELATIONSHIPS).toContain(
      'stub-rel-50001:50001:NEWDEV RECYCLING LIMITED'
    )
    expect(STUB_OPERATOR_RELATIONSHIPS).toContain(
      'stub-rel-67b9e8fc-2235-431a-a7b9-80663c81b6ff:67b9e8fc-2235-431a-a7b9-80663c81b6ff:Bednar - Frami Limited xTklApuT'
    )
  })

  test('every relationship org id is authorised by the defra-link map', () => {
    // The org id is the middle segment; splitting on ':' keeps the UUID intact
    // because it has no colons.
    for (const relationship of STUB_OPERATOR_RELATIONSHIPS) {
      const orgId = relationship.split(':')[1]
      const linkedId = Object.values(STUB_DEFRA_LINKS).map(String)
      expect(linkedId).toContain(orgId)
    }
  })

  test('current relationship id points at the first org', () => {
    expect(STUB_OPERATOR_CURRENT_RELATIONSHIP_ID).toBe('stub-rel-50001')
  })
})

describe('operator page drift guard', () => {
  test('every org id linked on the operator page has a fixture entry', () => {
    const njk = readFileSync(
      fileURLToPath(new URL('../operator/index.njk', import.meta.url)),
      'utf8'
    )

    const linkedOrgIds = [
      ...njk.matchAll(/\/operator-accreditation\/([^/]+)\//g)
    ].map((m) => m[1])

    expect(linkedOrgIds.length).toBeGreaterThan(0)

    for (const orgId of linkedOrgIds) {
      expect(
        STUB_DEFRA_LINKS,
        `operator page links to /operator-accreditation/${orgId}/… but there is no STUB_OPERATOR_ORGS entry for it — the stub operator would get a 403. Add it to src/server/common/stub-operator-orgs.js.`
      ).toHaveProperty(orgId)
    }
  })
})
