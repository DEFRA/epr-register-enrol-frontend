import { getGlobalDispatcher } from 'undici'

// cdp-uploader's /upload-and-scan responds with a redirect meant for an end-user's
// browser to follow to the app's own "redirect" page. This is a server-to-server
// proxy upload though, not a browser request, so that redirect must not be followed —
// it resolves against cdp-uploader's own host, not ours, and 404s there. A redirect
// response here means the upload itself was accepted; only a genuine failure response
// means the upload didn't go through.
//
// A spec-compliant `fetch()` with `redirect: 'manual'` collapses a 3xx response into
// an opaque-redirect response (`type: 'opaqueredirect'`, `status: 0`), but in CDP that
// conversion doesn't happen reliably once the request is routed through the
// platform's mandatory outbound proxy — the real 3xx status comes through instead.
// Checking the status range directly, rather than relying on `type`, is correct
// whichever shape the runtime returns. `dispatcher` is passed explicitly (rather than
// relying on undici's global dispatcher being picked up implicitly) so the upload is
// deterministically routed through the same proxy as everything else in CDP.
export async function proxyUploadToCdp({
  uploadUrl,
  payload,
  filename,
  contentType
}) {
  const proxyResponse = await fetch(uploadUrl, {
    method: 'POST',
    body: payload,
    duplex: 'half',
    redirect: 'manual',
    dispatcher: getGlobalDispatcher(),
    headers: {
      'x-filename': filename,
      'Content-Type': contentType
    }
  })

  const isRedirect = proxyResponse.status >= 300 && proxyResponse.status < 400
  const isAccepted =
    proxyResponse.ok || proxyResponse.type === 'opaqueredirect' || isRedirect

  if (!isAccepted) {
    throw new Error(`CDP proxy upload failed: ${proxyResponse.status}`)
  }
}
