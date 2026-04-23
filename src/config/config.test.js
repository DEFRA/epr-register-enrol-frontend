import { describe, test, expect } from 'vitest'

import { config } from './config.js'

// convict's toString() serialises the config to JSON, replacing any field
// marked sensitive:true with the string "[Sensitive]". This is the mechanism
// that prevents secrets leaking into structured logs or debug output that
// calls JSON.stringify(config) or logs the full config object at startup.
describe('config sensitive field redaction', () => {
  // Parse once — toString() is the canonical convict serialisation path that
  // logging libraries and debug endpoints would use.
  const serialised = JSON.parse(config.toString())

  test('basicPasswd is redacted in serialised output', () => {
    // The password must never appear in logs. If sensitive:true is removed
    // from the config declaration the real value would be printed here.
    expect(serialised.auth.basicPasswd).toBe('[Sensitive]')
  })

  test('basicUsr is not redacted — it is not a secret', () => {
    // The username is not sensitive: knowing it does not grant access without
    // the password, and having it visible in logs aids debugging. This test
    // documents the intentional asymmetry between the two fields.
    expect(serialised.auth.basicUsr).not.toBe('[Sensitive]')
  })

  test('other sensitive fields are also redacted', () => {
    // Verify the pattern works for existing sensitive fields so we can be
    // confident the mechanism itself is functioning, not just our declaration.
    expect(serialised.auth.azureEntraId.clientSecret).toBe('[Sensitive]')
    expect(serialised.session.cookie.password).toBe('[Sensitive]')
  })
})
