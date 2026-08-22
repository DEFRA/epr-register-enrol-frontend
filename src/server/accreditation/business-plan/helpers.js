import {
  BUSINESS_PLAN_CATEGORY_FIELD_MAP,
  PERCENT_FIELD_TO_CATEGORY,
  DETAIL_FIELD_TO_CATEGORY
} from '../../common/constants/businessPlanCategories.js'

// Re-exported for backwards compatibility — CATEGORY_FIELD_MAP,
// PERCENT_FIELD_TO_CATEGORY and DETAIL_FIELD_TO_CATEGORY now derive from the
// single shared source of truth in common/constants/businessPlanCategories.js
// (see RA-456) rather than being declared here.
export const CATEGORY_FIELD_MAP = BUSINESS_PLAN_CATEGORY_FIELD_MAP
export { PERCENT_FIELD_TO_CATEGORY, DETAIL_FIELD_TO_CATEGORY }

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
