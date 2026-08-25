/**
 * A GDS styled example home page controller.
 * Provided as an example, remove or modify as required.
 */
import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'
import { isRegulator } from '../common/helpers/auth/get-user.js'
import { isRegulatorAccessDisabled } from '../common/helpers/auth/regulator-access.js'

export const homeController = {
  handler(request, h) {
    const { currentLocale, t } = getLocaleAndTranslator(request)

    // RA-427: an already-authenticated regulator session can still exist
    // after the flag is switched on (new regulator logins are blocked, but
    // this doesn't tear down existing sessions) — don't bounce them into
    // the now-404 regulator page.
    if (isRegulator(request) && !isRegulatorAccessDisabled()) {
      const isLanguagePrefixed = request.path.startsWith(`/${currentLocale}`)
      return h.redirect(
        isLanguagePrefixed ? `/${currentLocale}/regulator` : '/regulator'
      )
    }

    const pageTitle = t('pages.home.title')
    const heading = t('pages.home.heading')

    return h.view('home/index', {
      pageTitle,
      heading
    })
  }
}
