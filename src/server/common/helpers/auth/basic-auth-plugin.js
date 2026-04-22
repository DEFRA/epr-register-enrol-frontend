import crypto from 'crypto'

import { config } from '../../../../config/config.js'

// Prevents timing attacks where a naive string comparison (===) returns faster
// for an early mismatch, leaking credential length/content via response time.
function safeCompare(a, b) {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)
}

export const basicAuthExcludedPaths = ['/health']

// A generic realm avoids advertising that Basic Auth is active or revealing
// anything about the application to an unauthenticated caller.
export const WWW_AUTHENTICATE = 'Basic realm="Secure"'

export const basicAuthPlugin = {
  plugin: {
    name: 'basicAuth',
    async register(server) {
      if (!config.get('auth.basicEnabled')) {
        return
      }

      const validUsername = config.get('auth.basicUsr')
      const validPassword = config.get('auth.basicPasswd')

      if (!validUsername || !validPassword) {
        throw new Error(
          'Basic auth enabled but username or password not set in config'
        )
      }

      server.ext('onPreAuth', (request, h) => {
        if (basicAuthExcludedPaths.includes(request.path)) {
          return h.continue
        }

        const authHeader = request.headers.authorization
        if (!authHeader?.startsWith('Basic ')) {
          return h
            .response()
            .code(401)
            .header('WWW-Authenticate', WWW_AUTHENTICATE)
            .takeover()
        }

        const decoded = Buffer.from(authHeader.slice(6), 'base64').toString()
        const colonIndex = decoded.indexOf(':')
        const username = decoded.slice(0, colonIndex)
        const password = decoded.slice(colonIndex + 1)

        const isValid =
          safeCompare(username, validUsername) &&
          safeCompare(password, validPassword)
        if (!isValid) {
          return h
            .response()
            .code(401)
            .header('WWW-Authenticate', WWW_AUTHENTICATE)
            .takeover()
        }

        return h.continue
      })
    }
  }
}
