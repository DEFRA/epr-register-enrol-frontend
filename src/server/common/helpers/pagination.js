import nunjucks from 'nunjucks'

export const PAGE_SIZE = 10

// `?page=` isn't validated by the routes, so anything that isn't a whole
// number in range lands on the nearest valid page instead of erroring.
function clampPage(requested, totalPages) {
  const page = /^\d+$/.test(String(requested)) ? Number(requested) : 1
  return Math.min(Math.max(page, 1), totalPages)
}

export function paginate(rows, requestedPage, pageSize = PAGE_SIZE) {
  const totalCount = rows.length
  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1)
  const page = clampPage(requestedPage, totalPages)
  const offset = (page - 1) * pageSize
  const pageRows = rows.slice(offset, offset + pageSize)
  return {
    rows: pageRows,
    page,
    totalPages,
    totalCount,
    rangeStart: pageRows.length ? offset + 1 : 0,
    rangeEnd: offset + pageRows.length
  }
}

const PAGINATION_KEYS = 'common.pagination'

// Ported from case management's work-items list. The labels are passed in
// because the GOV.UK macro's defaults are English only.
export function buildPagination({ page, totalPages, baseUrl, query = {}, t }) {
  if (totalPages <= 1) {
    return null
  }

  const hrefFor = (target) => {
    const params = new URLSearchParams()
    for (const [name, value] of Object.entries(query)) {
      if (value) {
        params.append(name, value)
      }
    }
    params.append('page', String(target))
    return `${baseUrl}?${params}`
  }

  // RA-697: passing our own label drops the macro's visually hidden " page",
  // so screen readers would hear just "Next". Put it back.
  const escapeHtml = nunjucks.lib.escape
  const hiddenPage = escapeHtml(t(`${PAGINATION_KEYS}.visuallyHiddenPage`))
  const linkHtml = (key) => {
    const label = escapeHtml(t(`${PAGINATION_KEYS}.${key}`))
    return `${label}<span class="govuk-visually-hidden"> ${hiddenPage}</span>`
  }

  return {
    landmarkLabel: t(`${PAGINATION_KEYS}.landmarkLabel`),
    previous:
      page > 1 ? { href: hrefFor(page - 1), html: linkHtml('previous') } : null,
    next:
      page < totalPages
        ? { href: hrefFor(page + 1), html: linkHtml('next') }
        : null,
    items: Array.from({ length: totalPages }, (_, index) => ({
      number: index + 1,
      href: hrefFor(index + 1),
      current: index + 1 === page,
      visuallyHiddenText: t(`${PAGINATION_KEYS}.page`, { number: index + 1 })
    }))
  }
}
