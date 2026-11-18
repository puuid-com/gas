import handler from '@tanstack/react-start/server-entry'
import { paraglideMiddleware } from './paraglide/server'
import { runSnapshot } from './server/snapshot.server'

export default {
  // Resolve the locale (cookie → Accept-Language → fr) for each SSR request.
  fetch(req: Request): Promise<Response> {
    return paraglideMiddleware(req, ({ request }) => handler.fetch(request))
  },

  // Twice a day (wrangler.jsonc triggers): save every station's prices.
  async scheduled(controller) {
    await runSnapshot(Math.floor(controller.scheduledTime / 1000))
  },
} satisfies ExportedHandler<Env>
