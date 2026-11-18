import { env } from 'cloudflare:workers'
import { fetchStations } from '#/lib/stations'
import { takeSnapshot } from './history'

/** Fetch the Régie feed and save it as a price snapshot. */
export async function runSnapshot(at?: number) {
  const result = await takeSnapshot(env.DB, await fetchStations(), at)
  console.log('price snapshot', result)
  return result
}

const digest = async (value: string) =>
  crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))

/**
 * Manual runs need `Authorization: Bearer <SNAPSHOT_TOKEN>`, a Worker secret
 * (`wrangler secret put SNAPSHOT_TOKEN`). Without the secret there is no
 * manual trigger at all.
 */
export async function isSnapshotAuthorized(request: Request) {
  const token = (env as { SNAPSHOT_TOKEN?: string }).SNAPSHOT_TOKEN
  const header = request.headers.get('Authorization') ?? ''
  if (!token || !header.startsWith('Bearer ')) return false
  const [given, expected] = await Promise.all([
    digest(header.slice('Bearer '.length)),
    digest(token),
  ])
  // Equal-length digests, compared without an early exit.
  const a = new Uint8Array(given)
  const b = new Uint8Array(expected)
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}
