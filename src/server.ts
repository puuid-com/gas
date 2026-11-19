import handler from '@tanstack/react-start/server-entry'
import { isSnapshotHour } from './lib/history'
import { paraglideMiddleware } from './paraglide/server'
import { runSnapshot } from './server/snapshot.server'
import { site } from './site'

const OLD_HOST = 'gas.odeschenes.dev'

export default {
  // Resolve the locale (cookie → Accept-Language → fr) for each SSR request.
  fetch(req: Request): Promise<Response> {
    // gas.puuid.com is canonical; the old domain sends visitors one hop over.
    // Other methods (the snapshot API) still work there, since a redirect
    // would drop their body.
    const url = new URL(req.url)
    if (url.hostname === OLD_HOST && ['GET', 'HEAD'].includes(req.method)) {
      url.hostname = new URL(site.url).hostname
      return Promise.resolve(Response.redirect(url.toString(), 301))
    }
    return paraglideMiddleware(req, ({ request }) => handler.fetch(request))
  },

  // 10 AM and 10 PM Quebec time (wrangler.jsonc triggers): save every
  // station's prices. The cron fires at the winter and summer UTC hours of
  // both; only the ones that are 10 o'clock in Quebec take a snapshot.
  async scheduled(controller) {
    if (!isSnapshotHour(controller.scheduledTime)) return
    await runSnapshot(Math.floor(controller.scheduledTime / 1000))
  },
} satisfies ExportedHandler<Env>
