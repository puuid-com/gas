import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl'
import type { MapPalette } from './palette'

export const SOURCE_ID = 'stations'
export const ROUTE_SOURCE_ID = 'route'
export const TARGET_SOURCE_ID = 'target'
export const INTERACTIVE_LAYERS = [
  'stations-circle',
  'stations-label',
  'stations-star',
  'stations-pick',
]

const FONT = ['Noto Sans Bold']
/** Labels take over from bare dots from this zoom. */
export const LABEL_MINZOOM = 10

type Circle = Omit<CircleLayerSpecification, 'source'>
type Symbol = Omit<SymbolLayerSpecification, 'source'>
type Line = Omit<LineLayerSpecification, 'source'>

const tier = ['get', 'tier'] as ExpressionSpecification
const priced = ['>=', tier, 0] as ExpressionSpecification
/** Stations outside the chosen region or trip corridor are faded. */
const focused = ['!', ['get', 'dim']] as ExpressionSpecification

export function pillImageId(theme: string, t: number | 'pick') {
  return `pill-${theme}-${t}`
}

/** Drive mode's recommended station has its own layer; keep it out of these. */
const notPick = (id: string | undefined): ExpressionSpecification => [
  '!=',
  ['get', 'id'],
  id ?? '',
]

export function circleLayer(p: MapPalette): Circle {
  return {
    id: 'stations-circle',
    type: 'circle',
    layout: {
      // Cheaper tiers draw on top of pricier ones.
      'circle-sort-key': ['case', priced, ['-', 10, tier], 0],
    },
    paint: {
      'circle-color': [
        'match',
        tier,
        0,
        p.tiers[0],
        1,
        p.tiers[1],
        2,
        p.tiers[2],
        3,
        p.tiers[3],
        4,
        p.tiers[4],
        p.none,
      ],
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        4,
        ['case', priced, ['case', ['==', tier, 0], 3.5, 2.5], 1.5],
        9,
        ['case', priced, ['case', ['<=', tier, 1], 6, 5], 3],
        13,
        ['case', priced, ['case', ['<=', tier, 1], 9, 7], 4],
      ],
      'circle-stroke-color': p.halo,
      'circle-stroke-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        4,
        0.5,
        10,
        1.5,
      ],
      'circle-opacity': ['case', focused, 1, 0.18],
      'circle-stroke-opacity': ['case', focused, 1, 0.18],
    },
  }
}

/** Price labels grow as the price drops; drive mode reads at arm's length. */
const LABEL_SIZE = {
  map: { cheapest: 18, cheap: 16, rest: 13 },
  drive: { cheapest: 28, cheap: 24, rest: 20 },
}
const PILL_PADDING: Record<'map' | 'drive', [number, number, number, number]> =
  {
    map: [3, 6, 2, 6],
    drive: [5, 9, 4, 9],
  }

export function labelLayer(
  p: MapPalette,
  theme: string,
  driving = false,
  pickId?: string,
): Symbol {
  const size = LABEL_SIZE[driving ? 'drive' : 'map']
  return {
    id: 'stations-label',
    type: 'symbol',
    minzoom: LABEL_MINZOOM,
    filter: [
      'all',
      priced,
      ['!', ['get', 'star']],
      focused,
      notPick(pickId),
      // On the road only the low prices get a label; the rest stay dots.
      ...(driving ? [['<=', tier, 1] as ExpressionSpecification] : []),
    ],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': FONT,
      'text-size': ['match', tier, 0, size.cheapest, 1, size.cheap, size.rest],
      'text-rotation-alignment': 'viewport',
      'icon-rotation-alignment': 'viewport',
      'text-anchor': 'bottom',
      'text-offset': [0, -0.9],
      'icon-image': ['concat', `pill-${theme}-`, ['to-string', tier]],
      'icon-text-fit': 'both',
      'icon-text-fit-padding': PILL_PADDING[driving ? 'drive' : 'map'],
      // Lower price = placed first, so the cheapest labels survive collisions.
      'symbol-sort-key': ['get', 'price'],
      'symbol-z-order': 'source',
    },
    paint: {
      'text-color': ['match', tier, 0, p.onTier[0], 1, p.onTier[1], p.text],
    },
  }
}

export function starLayer(
  p: MapPalette,
  theme: string,
  driving = false,
  pickId?: string,
): Symbol {
  const size = LABEL_SIZE[driving ? 'drive' : 'map']
  return {
    id: 'stations-star',
    type: 'symbol',
    filter: ['all', ['get', 'star'], focused, notPick(pickId)],
    layout: {
      'text-field': ['concat', '★ ', ['get', 'label']],
      'text-font': FONT,
      'text-size': driving
        ? size.cheapest
        : ['interpolate', ['linear'], ['zoom'], 4, 13, 10, size.cheapest],
      'text-rotation-alignment': 'viewport',
      'icon-rotation-alignment': 'viewport',
      'text-anchor': 'bottom',
      'text-offset': [0, -0.9],
      'icon-image': pillImageId(theme, 0),
      'icon-text-fit': 'both',
      'icon-text-fit-padding': PILL_PADDING[driving ? 'drive' : 'map'],
      'symbol-sort-key': ['get', 'price'],
      'symbol-z-order': 'source',
    },
    paint: { 'text-color': p.onTier[0] },
  }
}

/**
 * Drive mode's answer to "where do I fill up": one inverted pill, larger than
 * the rest and never hidden by a collision.
 */
export function pickLayer(
  p: MapPalette,
  theme: string,
  id: string | undefined,
): Symbol {
  return {
    id: 'stations-pick',
    type: 'symbol',
    filter: ['==', ['get', 'id'], id ?? ''],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': FONT,
      'text-size': 32,
      'text-rotation-alignment': 'viewport',
      'icon-rotation-alignment': 'viewport',
      'text-anchor': 'bottom',
      'text-offset': [0, -0.8],
      'icon-image': pillImageId(theme, 'pick'),
      'icon-text-fit': 'both',
      'icon-text-fit-padding': [6, 12, 5, 12],
      'text-allow-overlap': true,
      'icon-allow-overlap': true,
    },
    paint: { 'text-color': p.halo },
  }
}

export function selectedLayer(p: MapPalette, id: string | undefined): Circle {
  return {
    id: 'stations-selected',
    type: 'circle',
    filter: ['==', ['get', 'id'], id ?? ''],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 8, 13, 13],
      'circle-color': 'transparent',
      'circle-stroke-color': p.user,
      'circle-stroke-width': 3,
    },
  }
}

const routeWidth = (extra: number): ExpressionSpecification => [
  'interpolate',
  ['linear'],
  ['zoom'],
  5,
  3 + extra,
  10,
  4.5 + extra,
  15,
  7 + extra,
]

/** Route casing then line, drawn under the stations. */
export function routeLayers(p: MapPalette): [Line, Line] {
  const layout = { 'line-join': 'round', 'line-cap': 'round' } as const
  return [
    {
      id: 'route-casing',
      type: 'line',
      layout,
      paint: { 'line-color': p.halo, 'line-width': routeWidth(3) },
    },
    {
      id: 'route-line',
      type: 'line',
      layout,
      paint: {
        'line-color': p.user,
        'line-width': routeWidth(0),
        'line-opacity': 0.85,
      },
    },
  ]
}

/** Dotted line from the car to the recommended station when no route leads there. */
export function targetLayer(p: MapPalette): Line {
  return {
    id: 'target-line',
    type: 'line',
    layout: { 'line-cap': 'round' },
    paint: {
      'line-color': p.text,
      'line-width': 3.5,
      'line-dasharray': [0.1, 2.2],
      'line-opacity': 0.75,
    },
  }
}
