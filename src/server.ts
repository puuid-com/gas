import handler from '@tanstack/react-start/server-entry'
import { isSnapshotHour } from './lib/history'
import { paraglideMiddleware } from './paraglide/server'
import { runSnapshot } from './server/snapshot.server'
import { site } from './site'

const OLD_HOST = 'gas.odeschenes.dev'

// Until 1.1.0 the language was kept in this cookie. Someone who had picked
// English lands on the French URL once: send them to the English one and
// clear the cookie, so picking French later sticks.
const OLD_LOCALE_COOKIE = 'PARAGLIDE_LOCALE'

function englishCookieRedirect(req: Request, url: URL) {
  if (req.method !== 'GET') return null
  if (!req.headers.get('accept')?.includes('text/html')) return null
  if (url.pathname === '/en' || url.pathname.startsWith('/en/')) return null
  const cookies = req.headers.get('cookie') ?? ''
  if (!new RegExp(`(?:^|;\\s*)${OLD_LOCALE_COOKIE}=en(?:;|$)`).test(cookies))
    return null
  url.pathname = url.pathname === '/' ? '/en' : `/en${url.pathname}`
  return new Response(null, {
    status: 302,
    headers: {
      location: url.toString(),
      'set-cookie': `${OLD_LOCALE_COOKIE}=; Path=/; Max-Age=0`,
    },
  })
}

export default {
  // The locale comes from the URL: French at /, English under /en.
  fetch(req: Request): Promise<Response> {
    // gas.puuid.com is canonical; the old domain sends visitors one hop over.
    // Other methods (the snapshot API) still work there, since a redirect
    // would drop their body.
    const url = new URL(req.url)
    if (url.hostname === OLD_HOST && ['GET', 'HEAD'].includes(req.method)) {
      url.hostname = new URL(site.url).hostname
      return Promise.resolve(Response.redirect(url.toString(), 301))
    }
    const moved = englishCookieRedirect(req, url)
    if (moved) return Promise.resolve(moved)
    // The router strips the locale prefix itself, so it gets the original
    // request, not the middleware's de-localized one.
    return paraglideMiddleware(req, () => handler.fetch(req))
  },

  // 10 AM and 10 PM Quebec time (wrangler.jsonc triggers): save every
  // station's prices. The cron fires at the winter and summer UTC hours of
  // both; only the ones that are 10 o'clock in Quebec take a snapshot.
  async scheduled(controller) {
    if (!isSnapshotHour(controller.scheduledTime)) return
    await runSnapshot(Math.floor(controller.scheduledTime / 1000))
  },
} satisfies ExportedHandler<Env>
