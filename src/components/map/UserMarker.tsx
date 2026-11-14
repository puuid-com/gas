import { Marker } from 'react-map-gl/maplibre'
import type { Fix } from '#/stores/location'

/**
 * Where the user is: a dot with a heading cone, or, in drive mode with a
 * course, a navigation arrow lying on the map and pointing where it's going.
 */
export function UserMarker({ fix, driving }: { fix: Fix; driving: boolean }) {
  const arrow = driving && fix.heading != null

  return (
    <Marker
      longitude={fix.lng}
      latitude={fix.lat}
      anchor="center"
      rotationAlignment="map"
      pitchAlignment={arrow ? 'map' : 'viewport'}
      rotation={fix.heading ?? 0}
      style={{ zIndex: 1 }}
    >
      {arrow ? (
        <svg
          viewBox="0 0 48 48"
          aria-hidden
          className="pointer-events-none size-14 drop-shadow-[0_2px_4px_rgb(0_0_0/0.35)]"
        >
          <path
            d="M24 5 40 41 24 33 8 41Z"
            className="fill-user stroke-white"
            strokeWidth="4"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <div className="pointer-events-none relative size-6">
          {fix.heading != null && (
            <div
              className="absolute bottom-1/2 left-1/2 h-12 w-10 -translate-x-1/2"
              style={{
                background:
                  'linear-gradient(to top, color-mix(in oklab, var(--user) 55%, transparent), transparent)',
                clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
              }}
            />
          )}
          <span className="absolute -inset-2 rounded-full bg-user/20" />
          <span className="absolute inset-1 rounded-full border-[3px] border-white bg-user shadow-md shadow-black/30" />
        </div>
      )}
    </Marker>
  )
}
