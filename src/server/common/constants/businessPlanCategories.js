// Single source of truth for the business-plan PRN-income categories.
//
// RA-456: previously this list was independently declared in ~9 places
// across the codebase (controllers, the stub API client, and the
// accreditation API normalisation layer), which is how a legally-required
// 7th category ("other") had to be hunted down and added by hand. Every
// call site below should derive its field list from this map rather than
// hardcoding the category names again.
export const BUSINESS_PLAN_CATEGORY_FIELD_MAP = {
  newInfrastructure: {
    percent: 'newInfrastructurePercent',
    detail: 'newInfrastructureDetail'
  },
  priceSupport: {
    percent: 'priceSupportPercent',
    detail: 'priceSupportDetail'
  },
  businessCollections: {
    percent: 'businessCollectionsPercent',
    detail: 'businessCollectionsDetail'
  },
  communications: {
    percent: 'communicationsPercent',
    detail: 'communicationsDetail'
  },
  newMarkets: { percent: 'newMarketsPercent', detail: 'newMarketsDetail' },
  newUses: { percent: 'newUsesPercent', detail: 'newUsesDetail' },
  other: { percent: 'otherPercent', detail: 'otherDetail' }
}

export const BUSINESS_PLAN_CATEGORIES = Object.keys(
  BUSINESS_PLAN_CATEGORY_FIELD_MAP
)

export const BUSINESS_PLAN_PERCENT_FIELDS = BUSINESS_PLAN_CATEGORIES.map(
  (category) => BUSINESS_PLAN_CATEGORY_FIELD_MAP[category].percent
)

export const BUSINESS_PLAN_DETAIL_FIELDS = BUSINESS_PLAN_CATEGORIES.map(
  (category) => BUSINESS_PLAN_CATEGORY_FIELD_MAP[category].detail
)

export const PERCENT_FIELD_TO_CATEGORY = Object.fromEntries(
  Object.entries(BUSINESS_PLAN_CATEGORY_FIELD_MAP).map(
    ([category, { percent }]) => [percent, category]
  )
)

export const DETAIL_FIELD_TO_CATEGORY = Object.fromEntries(
  Object.entries(BUSINESS_PLAN_CATEGORY_FIELD_MAP).map(
    ([category, { detail }]) => [detail, category]
  )
)
