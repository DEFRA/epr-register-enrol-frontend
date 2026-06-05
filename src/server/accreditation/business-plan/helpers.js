export const CATEGORY_FIELD_MAP = {
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
  newUses: { percent: 'newUsesPercent', detail: 'newUsesDetail' }
}

export const PERCENT_FIELD_TO_CATEGORY = Object.fromEntries(
  Object.entries(CATEGORY_FIELD_MAP).map(([cat, { percent }]) => [percent, cat])
)

export const DETAIL_FIELD_TO_CATEGORY = Object.fromEntries(
  Object.entries(CATEGORY_FIELD_MAP).map(([cat, { detail }]) => [detail, cat])
)

/**
 * Finds one businessPlan item by category.
 * Handles both the new `{ sectionStatus, items: [...] }` format and the
 * legacy flat format `{ newInfrastructurePercent, newInfrastructureDetail, ... }`.
 */
export function findBpItem(businessPlan, category) {
  if (businessPlan?.items !== undefined) {
    return businessPlan.items.find((i) => i.category === category) ?? {}
  }
  if (!businessPlan) return {}
  const fields = CATEGORY_FIELD_MAP[category]
  if (!fields) return {}
  return {
    category,
    percentSpent: businessPlan[fields.percent],
    detailedDescription: businessPlan[fields.detail] ?? ''
  }
}
