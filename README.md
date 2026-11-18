# Plein

Live Quebec gas prices on a map, built for checking from the car.

Data comes from the Régie de l'énergie du Québec's public feed
(`https://regieessencequebec.ca/stations.geojson.gz`, ~2,460 stations,
refreshed every few minutes).

## What it does

- **Map** — every station, coloured by how its price ranks _within its
  administrative region_ (green = cheapest 10 %, red = priciest 10 %). From
  zoom 10 prices appear as pills, larger and filled in for the low prices; when
  they overlap, the cheapest wins. A ★ marks each region's lowest price at
  every zoom.
- **Fuel** — Regular by default; switch to Premium or Diesel.
- **Near me** — locate once to see the cheapest stations within 5 / 10 / 25 km
  and the local median.
- **Drive mode** — starts by itself once you move at car speed (or tap Drive):
  the map turns to face the way you're going, keeps the screen on, and labels
  only the low prices _ahead_ of you. Pan to look around; it recentres on its
  own after a few seconds of driving, or tap Recenter.
- **List** — every station sorted by price or distance, with search and a
  region filter.
- **Trip** — pick a destination (and optionally a start other than your
  location) to see the cheapest stations within 1 / 2 / 5 km of the driving
  route, coloured against each other, with how far along the trip each one is
  and the real extra driving time to stop there (for the ten cheapest; the
  rest show their straight-line distance off the route). Sort by price or by
  route order. A strip shows the prices over the whole drive. In drive mode the
  card looks all the way to the destination (or a shorter range you pick),
  counts down the distance to stations still ahead and offers to reroute if
  you leave the route. Addresses you navigate to are saved on the device and
  offered again in the search fields.
- **Regions** — each region on one province-wide scale (range, median, lowest
  price) against the Quebec median; tap one to frame it on the map.
- **Directions** — one tap opens the station in Waze; the menu switches to
  Google Maps or Apple Maps. On a trip, Google Maps and Apple Maps get the
  station as a stop on the way to the destination; Waze links take one
  destination, so they go to the station.
- **Price history** — a Worker cron saves every station's prices twice a day
  (6 AM and 6 PM, Quebec winter time) to D1. The history page (`/history`, also
  in the menu and on each station) charts the median for Quebec or a region,
  compares regions over 7 days to a year, and shows any station's prices
  against its regional median with every change.
- **Probably not updated** — a station whose prices haven't changed in 7 days
  (`STALE_DAYS` in `src/lib/history.ts`) is flagged in the list, on its card
  and on the history page, and its low price is no longer highlighted. The feed
  has no per-station timestamp, so this needs the saved history: nothing is
  flagged until a week after the first snapshot.
- French (default) and English, light and dark themes, installable to the home
  screen.

Fuel, view, tab, region, selected station and trip endpoints live in the URL, so
any view can be shared or bookmarked. A trip from "your location" keeps that
position out of the URL.

Trips use two free, keyless public services straight from the browser: Komoot's
Photon for place search and the OSRM demo server for driving routes. Both are
fair-use with no uptime guarantee; `src/lib/places.ts` and `src/lib/routing.ts`
are the only files to change to swap providers.

## Stack

TanStack Start (React 19, file routes, Cloudflare Workers), TanStack Query
(feed), Router (URL state), Store (location, map, theme), Table v9 + Virtual
(list), MapLibre GL via react-map-gl with OpenFreeMap basemaps (no API key),
shadcn/ui + Tailwind 4, Paraglide (i18n), Vitest.

The browser fetches the feed directly: it is CDN-cached and CORS-enabled, so
there is no server proxy. Only the history goes through the Worker (TanStack
Start server functions over D1).

## Price history

- `wrangler.jsonc` — the `DB` D1 binding (`gas-history`) and the cron
  (`0 11,23 * * *` UTC).
- `migrations/` — the schema. `snapshots` has one row per run, `stations` each
  station's current prices and when they last changed, `price_changes` a row
  only when a station's prices differ from its previous snapshot, and
  `region_stats` the spread per fuel and region at each run.
- `bun run deploy` applies new migrations before deploying.
- To take a snapshot outside the schedule (seed a new database, fill a missed
  run), set a Worker secret once with `wrangler secret put SNAPSHOT_TOKEN`,
  then `curl -X POST -H "Authorization: Bearer <token>" https://gas.odeschenes.dev/api/snapshot`.
  Without the secret the endpoint doesn't exist.

## Develop

```bash
bun install
bun run dev        # http://localhost:3000
bun run db:migrate:local  # once, and after adding a migration
bun run cf-typegen        # Worker types, after changing wrangler.jsonc
bun run test       # unit tests (normalization, pricing, geo, history)
bun run lint
bun run build
```

Geolocation needs a secure context. `localhost` works on the desktop; to try
location and drive mode on a phone, deploy (`bun run deploy`) or use an HTTPS
tunnel.

## Layout

- `src/lib/stations.ts` — feed fetch, validation and normalization
- `src/lib/pricing.ts` — regional stats, tiers, nearby/ahead and along-route
  ranking
- `src/lib/geo.ts` — distances, bearings, route indexing and projection
- `src/lib/places.ts`, `src/lib/routing.ts` — place search and driving routes
- `src/lib/history.ts` — staleness rule, region stats, history types
- `src/server/history.ts` — D1 snapshot job and history queries; exposed as
  server functions in `src/lib/history.functions.ts`
- `src/routes/history.tsx`, `src/components/history/` — the history page
- `src/hooks/use-trip.ts` — the trip in the URL, its route and corridor
- `src/stores/location.ts` — live position, drive mode, follow, radius
- `src/stores/trip.ts` — corridor width, trip start
- `src/components/map/` — MapLibre map, layers, price pills, user marker
- `src/components/` — header, cards, station list, regions view
- `messages/{fr,en}.json` — UI strings
