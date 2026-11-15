import { useEffect, useMemo, useRef, useState } from 'react'
import Map, {
  AttributionControl,
  Layer,
  Marker,
  ScaleControl,
  Source,
} from 'react-map-gl/maplibre'
import { IconMapPinFilled } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre'
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { Feature, FeatureCollection, LineString, Point } from 'geojson'

import { useAppSearch, useSetSearch } from '#/hooks/use-app-search'
import { useDriveAhead } from '#/hooks/use-drive'
import { getFuelStats, useStations } from '#/hooks/use-stations'
import { useTrip, useTripProgress } from '#/hooks/use-trip'
import { formatPrice } from '#/lib/format'
import { angleDiff, bearingDeg, distanceKm } from '#/lib/geo'
import { mapPadding, mapStore } from '#/stores/map'
import { locationStore, setFollow } from '#/stores/location'
import { themeStore } from '#/stores/theme'
import { getLocale } from '#/paraglide/runtime'
import type { Bounds, LngLat } from '#/lib/geo'
import {
  TIERS,
  rateAhead,
  stationsAheadByHeading,
  stationsAheadOnRoute,
} from '#/lib/pricing'
import type { Tier } from '#/lib/pricing'
import type { Fix } from '#/stores/location'

import {
  INTERACTIVE_LAYERS,
  ROUTE_SOURCE_ID,
  SOURCE_ID,
  TARGET_SOURCE_ID,
  circleLayer,
  labelLayer,
  pickLayer,
  pillImageId,
  routeLayers,
  selectedLayer,
  starLayer,
  targetLayer,
} from './layers'
import { drawPill, readPalette } from './palette'
import { styleHighways } from './highways'
import { UserMarker } from './UserMarker'

const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}

/** Southern Quebec, where nearly every station is. */
const INITIAL_BOUNDS: Bounds = [
  [-79.6, 45.0],
  [-64.2, 49.2],
]

export const MAP_ID = 'main'

/** Drive mode tilts the map so more of the road ahead fits on screen. */
const DRIVE_PITCH = 45
const DRIVE_ZOOM = { min: 9.5, max: 15.5, idle: 13 }

type Padding = ReturnType<typeof mapPadding>

/** Looking ahead matters more than behind: keep the car low in the frame. */
function drivePadding(height: number): Padding {
  const base = mapPadding()
  const free = Math.max(0, height - base.top - base.bottom)
  return { ...base, top: base.top + free / 2 }
}

/**
 * The closest zoom that still shows both the car and `target`, so the map
 * always answers "where is it" without a pinch. Stepped, so it doesn't creep.
 */
function driveZoom(
  { clientWidth: width, clientHeight: height }: HTMLElement,
  fix: Fix,
  target: LngLat | null,
) {
  if (!target) return DRIVE_ZOOM.idle
  const pad = drivePadding(height)
  const carY = pad.top + (height - pad.top - pad.bottom) / 2
  // Room around the car, less what a price pill needs to stay on screen.
  const ahead = Math.max(60, carY - mapPadding().top - 64)
  const behind = Math.max(60, height - pad.bottom - carY)
  const side = Math.max(60, (width - pad.left - pad.right) / 2 - 40)

  const metres = distanceKm(fix, target) * 1000
  let metresPerPx: number
  if (fix.heading == null) {
    // North-up: the station could be anywhere around the car.
    metresPerPx = metres / Math.min(ahead, behind, side)
  } else {
    const off = (angleDiff(fix.heading, bearingDeg(fix, target)) * Math.PI) / 180
    metresPerPx = Math.max(
      (metres * Math.cos(off)) / ahead,
      (metres * -Math.cos(off)) / behind,
      (metres * Math.sin(off)) / side,
    )
  }
  // MapLibre's zoom 0 fits the world in 512 px.
  const zoom = Math.log2(
    (78271.517 * Math.cos((fix.lat * Math.PI) / 180)) /
      Math.max(metresPerPx, 0.01),
  )
  return Math.min(
    DRIVE_ZOOM.max,
    Math.max(DRIVE_ZOOM.min, Math.floor(zoom * 4) / 4),
  )
}

const linear = (t: number) => t

// MapLibre resolves its worker relative to its own module, which breaks once
// Vite pre-bundles it; point it at the emitted asset instead.
maplibregl.setWorkerUrl(workerUrl)

interface StationProps {
  id: string
  region: string
  price: number
  label: string
  tier: Tier | -1
  star: boolean
  /** Outside the chosen region or trip corridor. */
  dim: boolean
}

export function StationMap() {
  const { stations, byId } = useStations()
  const { fuel, region, station } = useAppSearch()
  const setSearch = useSetSearch()
  const theme = useSelector(themeStore, (s) => s.resolved)
  const locale = getLocale()
  const mapRef = useRef<MapRef | null>(null)
  const clickedRef = useRef<string | undefined>(undefined)
  const [hovering, setHovering] = useState(false)
  // Symbol layers wait for their pill images so no tile is laid out without them.
  const [pillsFor, setPillsFor] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const fix = useSelector(locationStore, (s) => s.fix)
  const driving = useSelector(locationStore, (s) => s.driving)
  const follow = useSelector(locationStore, (s) => s.follow)
  const aheadKm = useSelector(locationStore, (s) => s.aheadKm)
  const tripRange = useSelector(locationStore, (s) => s.tripRange)
  const place = useSelector(mapStore, (s) => s.place)
  // The card resizing (collapsed, expanded, a station opened) moves the car.
  const insetBottom = useSelector(mapStore, (s) => s.insets.bottom)
  const followingRef = useRef(false)
  const lastFixRef = useRef(0)

  // CSS tokens change with the theme class; re-read them when it flips.
  const palette = useMemo(() => readPalette(), [theme])

  const stats = getFuelStats(stations, fuel)
  const trip = useTrip()
  const { along, route } = trip
  const line = route.data?.line ?? null
  // Whole km, so driving rebuilds the features once per km rather than per fix.
  const { travelledKm } = useTripProgress(trip)
  const passedKm = travelledKm == null ? null : Math.floor(travelledKm)
  const onRoute = along != null && passedKm != null

  // Drive mode's recommended station: its own pin, and the camera frames it.
  const pick = useDriveAhead(trip)?.decision?.pick.station ?? null
  const pickLng = pick?.lng
  const pickLat = pick?.lat

  // Driving, colour only what's ahead, against each other: down the route on
  // a trip, else in the direction of travel. A coarse position and course keep
  // the pins from flickering on every fix.
  const spot = driving && !onRoute ? fix : null
  const cellLat = spot ? Math.round(spot.lat * 400) / 400 : null
  const cellLng = spot ? Math.round(spot.lng * 280) / 280 : null
  const cellHeading =
    spot?.heading == null ? null : (Math.round(spot.heading / 15) * 15) % 360
  const driveTiers = useMemo(() => {
    const tiered = (stops: Parameters<typeof rateAhead>[0]) =>
      new globalThis.Map(rateAhead(stops).map((s) => [s.station.id, s.tier]))
    if (along && passedKm != null) {
      const rangeKm = tripRange === 'trip' ? Infinity : tripRange
      return tiered(stationsAheadOnRoute(along, passedKm, rangeKm))
    }
    if (cellLat == null || cellLng == null) return null
    const pool = region ? stations.filter((s) => s.region === region) : stations
    return tiered(
      stationsAheadByHeading(
        pool,
        fuel,
        { lat: cellLat, lng: cellLng },
        cellHeading,
        aheadKm,
      ),
    )
  }, [
    along,
    passedKm,
    tripRange,
    cellLat,
    cellLng,
    cellHeading,
    stations,
    fuel,
    region,
    aheadKm,
  ])

  const data = useMemo<FeatureCollection<Point, StationProps>>(() => {
    return {
      type: 'FeatureCollection',
      features: stations.map((s) => {
        const price = s.prices[fuel]
        const rank = stats.ranks.get(s.id)
        // On a trip, rank against the corridor instead of the region.
        const routeTier = along?.tiers.get(s.id)
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
          properties: {
            id: s.id,
            region: s.region,
            price: price ?? 9999,
            label: price == null ? '' : formatPrice(price, locale),
            tier: driveTiers
              ? (driveTiers.get(s.id) ?? -1)
              : along
                ? (routeTier ?? -1)
                : (rank?.tier ?? -1),
            star: driveTiers
              ? driveTiers.get(s.id) === 0
              : along
                ? along.cheapestIds.has(s.id)
                : (rank?.regionCheapest ?? false),
            dim: driveTiers
              ? !driveTiers.has(s.id)
              : along
                ? routeTier == null
                : region != null && s.region !== region,
          },
        }
      }),
    }
  }, [stations, fuel, stats, locale, along, driveTiers, region])

  const routeData = useMemo<Feature<LineString> | null>(
    () =>
      line && {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: line.coords as Array<[number, number]>,
        },
        properties: {},
      },
    [line],
  )

  // No route to follow: point from the car straight at the recommended station.
  const targetData =
    driving && fix && !line && pickLng != null && pickLat != null
      ? ({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [fix.lng, fix.lat],
              [pickLng, pickLat],
            ],
          },
          properties: {},
        } satisfies Feature<LineString>)
      : null

  // Fly to a station picked outside the map (list, nearby card, deep link).
  useEffect(() => {
    const map = mapRef.current
    const target = station ? byId.get(station) : undefined
    if (!loaded || !map || !target || clickedRef.current === station) return
    // Drive mode's camera stays on the car; the card shows the station.
    if (locationStore.state.driving && locationStore.state.follow) return
    map.flyTo({
      center: [target.lng, target.lat],
      zoom: Math.max(map.getZoom(), 13),
      padding: mapPadding(),
      duration: 900,
    })
  }, [loaded, station, byId])

  // Frame the chosen region.
  useEffect(() => {
    const map = mapRef.current
    const bounds = region ? stats.byRegion.get(region)?.bounds : undefined
    if (!loaded || !map || !bounds) return
    map.fitBounds(bounds, { padding: mapPadding(), maxZoom: 12, duration: 900 })
    // Re-frame only when the region itself changes, not on fuel switches.
  }, [loaded, region])

  // Frame a new route, unless drive mode is following the user.
  useEffect(() => {
    const map = mapRef.current
    if (!loaded || !map || !line || locationStore.state.follow) return
    map.fitBounds(line.bounds, {
      padding: mapPadding(),
      maxZoom: 14,
      duration: 900,
    })
  }, [loaded, line])

  // Drive mode: heading-up and tilted once moving, the car low in the frame,
  // zoomed so the recommended station is in view.
  useEffect(() => {
    const map = mapRef.current
    const tracking = loaded && driving && follow && fix != null
    const started = tracking && !followingRef.current
    followingRef.current = tracking
    if (!map || !tracking) return
    const target =
      pickLng != null && pickLat != null ? { lng: pickLng, lat: pickLat } : null
    const container = map.getContainer()
    // Glide for as long as fixes are apart, so the map turns and rolls
    // continuously instead of lurching to each new position and waiting.
    const gap = fix.ts - lastFixRef.current
    lastFixRef.current = fix.ts
    const glide = gap > 0 ? Math.min(2500, Math.max(600, gap)) : 1000
    map.easeTo({
      center: [fix.lng, fix.lat],
      zoom: driveZoom(container, fix, target),
      bearing: fix.heading ?? map.getBearing(),
      pitch: fix.heading == null ? 0 : DRIVE_PITCH,
      padding: drivePadding(container.clientHeight),
      essential: true,
      ...(started ? { duration: 1200 } : { duration: glide, easing: linear }),
    })
  }, [loaded, driving, follow, fix, pickLng, pickLat, insetBottom])

  // The credit stays behind its (i) while driving; the road needs the room.
  useEffect(() => {
    if (!loaded || !driving) return
    const credit = mapRef.current
      ?.getContainer()
      .querySelector('.maplibregl-ctrl-attrib')
    credit?.classList.remove('maplibregl-compact-show')
    credit?.removeAttribute('open')
  }, [loaded, driving])

  // Back to a flat, north-up map when leaving drive mode.
  useEffect(() => {
    const map = mapRef.current
    if (
      loaded &&
      map &&
      !driving &&
      (map.getBearing() !== 0 || map.getPitch() !== 0)
    ) {
      map.easeTo({ bearing: 0, pitch: 0, duration: 600 })
    }
  }, [loaded, driving])

  const syncView = (e: { target: MapLibreMap }) => {
    const map = e.target
    const b = map.getBounds()
    mapStore.setState((s) => ({
      ...s,
      bounds: [
        [b.getWest(), b.getSouth()],
        [b.getEast(), b.getNorth()],
      ],
      zoom: map.getZoom(),
    }))
  }

  const onClick = (e: MapLayerMouseEvent) => {
    const id = e.features?.[0]?.properties.id as string | undefined
    clickedRef.current = id
    setSearch({ station: id })
  }

  // A pinch or wheel zoom is the driver taking over, like a drag.
  const onZoomStart = (e: { originalEvent?: unknown }) => {
    if (e.originalEvent) setFollow(false)
  }

  const addPills = (map: MapLibreMap) => {
    const current = themeStore.state.resolved
    const colors = readPalette()
    for (const t of [...TIERS, 'pick' as const]) {
      const id = pillImageId(current, t)
      if (map.hasImage(id)) continue
      const pill = drawPill(t, colors)
      map.addImage(id, pill.data, pill.options)
    }
    setPillsFor(current)
  }

  return (
    <Map
      id={MAP_ID}
      mapLib={maplibregl}
      ref={mapRef}
      initialViewState={{
        bounds: INITIAL_BOUNDS,
        // Chrome isn't measured yet on first paint; approximate its footprint.
        fitBoundsOptions: {
          padding: matchMedia('(min-width: 1024px)').matches
            ? mapPadding()
            : { top: 150, bottom: 190, left: 16, right: 16 },
        },
      }}
      mapStyle={STYLES[theme]}
      style={{ position: 'absolute', inset: 0 }}
      attributionControl={false}
      dragRotate={false}
      pitchWithRotate={false}
      touchPitch={false}
      interactiveLayerIds={INTERACTIVE_LAYERS}
      cursor={hovering ? 'pointer' : undefined}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={onClick}
      onLoad={(e) => {
        // Bearing is ours to set (heading-up); two-finger twists only zoom.
        e.target.touchZoomRotate.disableRotation()
        addPills(e.target)
        styleHighways(e.target)
        // A theme switch swaps the style, which drops custom images and paint.
        e.target.on('style.load', () => {
          addPills(e.target)
          styleHighways(e.target)
        })
        syncView(e)
        setLoaded(true)
      }}
      onMoveEnd={syncView}
      // Every touch of the map pushes drive mode's automatic recentre back.
      onMove={(e) => {
        if (e.originalEvent) setFollow(false)
      }}
      onDragStart={() => setFollow(false)}
      onZoomStart={onZoomStart}
    >
      <AttributionControl compact position="bottom-left" />
      <ScaleControl position="bottom-left" unit="metric" maxWidth={96} />
      <Source id={SOURCE_ID} type="geojson" data={data}>
        <Layer {...circleLayer(palette)} />
        <Layer {...selectedLayer(palette, station)} />
        {pillsFor === theme && (
          <Layer {...labelLayer(palette, theme, driving, pick?.id)} />
        )}
        {pillsFor === theme && (
          <Layer {...starLayer(palette, theme, driving, pick?.id)} />
        )}
        {pillsFor === theme && (
          <Layer {...pickLayer(palette, theme, pick?.id)} />
        )}
      </Source>
      {targetData && (
        <Source id={TARGET_SOURCE_ID} type="geojson" data={targetData}>
          <Layer {...targetLayer(palette)} beforeId="stations-circle" />
        </Source>
      )}
      {routeData && (
        // Declared after the stations so they exist to slot under on re-add.
        <Source id={ROUTE_SOURCE_ID} type="geojson" data={routeData}>
          {routeLayers(palette).map((layer) => (
            <Layer key={layer.id} {...layer} beforeId="stations-circle" />
          ))}
        </Source>
      )}
      {place && (
        <Marker longitude={place.lng} latitude={place.lat} anchor="bottom">
          <IconMapPinFilled
            aria-label={place.name}
            className="size-9 text-foreground drop-shadow-[0_1px_2px_rgb(0_0_0/0.4)]"
          />
        </Marker>
      )}
      {fix && <UserMarker fix={fix} driving={driving} />}
    </Map>
  )
}
