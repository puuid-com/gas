import { createFileRoute } from '@tanstack/react-router'
import { isSnapshotAuthorized, runSnapshot } from '#/server/snapshot.server'

/**
 * Take a price snapshot now, outside the twice-daily schedule: to seed a new
 * database or fill in a missed run.
 */
export const Route = createFileRoute('/api/snapshot')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isSnapshotAuthorized(request))) {
          return new Response('Not found', { status: 404 })
        }
        return Response.json(await runSnapshot())
      },
    },
  },
})
