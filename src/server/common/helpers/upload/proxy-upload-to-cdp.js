// cdp-uploader's /upload-and-scan responds with a redirect meant for an end-user's
// browser to follow to the app's own "redirect" page. This is a server-to-server
// proxy upload though, not a browser request, so that redirect must not be followed —
// it resolves against cdp-uploader's own host, not ours, and 404s there. A redirect
// response here means the upload itself was accepted; only a genuine failure response
// means the upload didn't go through.
//
// The WHATWG Fetch spec says a `redirect: 'manual'` request should collapse a 3xx
// response into an opaque-redirect response (`type: 'opaqueredirect'`, `status: 0`),
// but Node's native `fetch()` doesn't do that conversion — it returns the real status
// and a normal `type` (e.g. 'basic'). Checking the status range directly, rather than
// relying on `type`, is what actually works against Node's fetch implementation.
//
// RA-619: the file goes up as a multipart form rather than a raw body with the name in an
// `x-filename` header. A request header value must be Latin-1, so any filename holding a
// character above U+00FF (Vietnamese diacritics, CJK, emoji) made fetch() throw before the
// request was sent. In a multipart body the filename is part of the content, written as
// UTF-8, so it has no such limit and cdp-uploader records the name exactly as chosen. The
// single part must be called `file` because that is the key the upload status reads back.
export async function proxyUploadToCdp({
  uploadUrl,
  payload,
  filename,
  contentType
}) {
  const form = new FormData()
  form.append('file', new Blob([payload], { type: contentType }), filename)

  // No headers: fetch sets the multipart Content-Type itself, because it owns the boundary.
  const proxyResponse = await fetch(uploadUrl, {
    method: 'POST',
    body: form,
    redirect: 'manual'
  })

  const isRedirect = proxyResponse.status >= 300 && proxyResponse.status < 400
  const isAccepted =
    proxyResponse.ok || proxyResponse.type === 'opaqueredirect' || isRedirect

  if (!isAccepted) {
    throw new Error(`CDP proxy upload failed: ${proxyResponse.status}`)
  }
}
