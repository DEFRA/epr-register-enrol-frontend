// Returns the authenticated user from the request, or null
export function getUser(request) {
  return request.auth?.credentials ?? null
}

// Returns true if the authenticated user is an operator
export function isOperator(request) {
  return request.auth?.credentials?.userType === 'operator'
}
