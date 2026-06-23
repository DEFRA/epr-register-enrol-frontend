import { config } from '../../config/config.js'
import { createApiClient } from './api-client.js'

const STUB_OVERSEAS_SITES_DATA = {
  // Delta Green Recycling Co — glass reprocessor with one overseas site
  50003: {
    100: {
      name: 'Berlin Glass GmbH',
      country: 'Germany',
      address: { line1: 'Recyclingstraße 12', townOrCity: 'Berlin' },
      coordinates: null,
      validFrom: '2026-01-01'
    }
  },
  // Export Steel Ltd. — steel exporter, two overseas sites
  50004: {
    100: {
      name: 'Rotterdam Recycling BV',
      country: 'Netherlands',
      address: { line1: 'Industrieweg 44', townOrCity: 'Rotterdam' },
      coordinates: null,
      validFrom: '2026-01-01'
    },
    101: {
      name: 'Tokyo Metal Recycling Co.',
      country: 'Japan',
      address: { line1: '1-2-3 Konan', townOrCity: 'Minato' },
      coordinates: null,
      validFrom: '2026-02-01'
    }
  },
  // Plastic Exports Ltd. — one overseas site
  50005: {
    100: {
      name: 'Rotterdam Recycling BV',
      country: 'Netherlands',
      address: { line1: 'Industrieweg 44', townOrCity: 'Rotterdam' },
      coordinates: null,
      validFrom: '2026-01-01'
    }
  },
  // Global Glass Exports Co. — three overseas sites
  50006: {
    100: {
      name: 'Rotterdam Recycling BV',
      country: 'Netherlands',
      address: { line1: 'Industrieweg 44', townOrCity: 'Rotterdam' },
      coordinates: null,
      validFrom: '2026-01-01'
    },
    101: {
      name: 'Berlin Glass GmbH',
      country: 'Germany',
      address: { line1: 'Recyclingstraße 12', townOrCity: 'Berlin' },
      coordinates: null,
      validFrom: '2026-03-01'
    },
    102: {
      name: 'Paris Verre SAS',
      country: 'France',
      address: { line1: '8 Rue du Recyclage', townOrCity: 'Paris' },
      coordinates: null,
      validFrom: '2026-06-01'
    }
  }
}

const OVERSEAS_SITES_PATH_RE =
  /\/v1\/organisations\/([^/]+)\/registrations\/([^/]+)\/accreditations\/([^/]+)\/overseas-sites$/

export const stubReexOverseasSitesClient = {
  get(endpoint) {
    const match = endpoint.match(OVERSEAS_SITES_PATH_RE)
    if (!match) return Promise.resolve({})
    const [, organisationId] = match
    return Promise.resolve(
      STUB_OVERSEAS_SITES_DATA[String(organisationId)] ?? {}
    )
  }
}

export const reexOverseasSitesClient = config.get('api.stubEnabled')
  ? stubReexOverseasSitesClient
  : createApiClient()
