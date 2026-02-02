import { generateId } from '@/lib/utils/id'

// ── Nominatim rate limiter (max 1 request per 1.1s) ──────────────────────────
let lastNominatimCall = 0

async function nominatimThrottle() {
  const now = Date.now()
  const elapsed = now - lastNominatimCall
  if (elapsed < 1100) {
    await new Promise((r) => setTimeout(r, 1100 - elapsed))
  }
  lastNominatimCall = Date.now()
}

// ── Data tool names ──────────────────────────────────────────────────────────
export const DATA_TOOL_NAMES = [
  'geocode',
  'reverseGeocode',
  'searchPlaces',
  'calculateRoute',
] as const

export type DataToolName = (typeof DATA_TOOL_NAMES)[number]

// ── geocode ──────────────────────────────────────────────────────────────────
async function geocode(args: Record<string, unknown>) {
  const query = args.query as string
  if (!query) return { error: 'query is required' }

  try {
    await nominatimThrottle()
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MapChat/1.0' },
    })
    if (!res.ok) return { error: `Nominatim error: ${res.status}` }

    const data = await res.json()
    if (!data || data.length === 0) return { results: [], message: 'No results found' }

    return {
      results: data.map((r: Record<string, unknown>) => ({
        lat: parseFloat(r.lat as string),
        lng: parseFloat(r.lon as string),
        displayName: r.display_name as string,
        type: r.type as string,
      })),
    }
  } catch (e) {
    return { error: `Geocode failed: ${(e as Error).message}` }
  }
}

// ── reverseGeocode ───────────────────────────────────────────────────────────
async function reverseGeocode(args: Record<string, unknown>) {
  const lat = args.lat as number
  const lng = args.lng as number
  if (lat == null || lng == null) return { error: 'lat and lng are required' }

  try {
    await nominatimThrottle()
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MapChat/1.0' },
    })
    if (!res.ok) return { error: `Nominatim error: ${res.status}` }

    const data = await res.json()
    if (data.error) return { error: data.error }

    return {
      displayName: data.display_name,
      address: data.address,
      lat: parseFloat(data.lat),
      lng: parseFloat(data.lon),
    }
  } catch (e) {
    return { error: `Reverse geocode failed: ${(e as Error).message}` }
  }
}

// ── searchPlaces ─────────────────────────────────────────────────────────────
async function searchPlaces(args: Record<string, unknown>) {
  const query = args.query as string
  const lat = args.lat as number
  const lng = args.lng as number
  const radiusMeters = (args.radiusMeters as number) || 1000
  if (!query || lat == null || lng == null)
    return { error: 'query, lat, and lng are required' }

  try {
    // Build Overpass QL: search amenity/tourism/shop/leisure tags + name regex
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const overpassQuery = `
[out:json][timeout:15];
(
  node["amenity"](around:${radiusMeters},${lat},${lng})["name"~"${escapedQuery}",i];
  node["tourism"](around:${radiusMeters},${lat},${lng})["name"~"${escapedQuery}",i];
  node["shop"](around:${radiusMeters},${lat},${lng})["name"~"${escapedQuery}",i];
  node["leisure"](around:${radiusMeters},${lat},${lng})["name"~"${escapedQuery}",i];
  node["amenity"~"${escapedQuery}",i](around:${radiusMeters},${lat},${lng});
  node["tourism"~"${escapedQuery}",i](around:${radiusMeters},${lat},${lng});
  node["shop"~"${escapedQuery}",i](around:${radiusMeters},${lat},${lng});
  node["leisure"~"${escapedQuery}",i](around:${radiusMeters},${lat},${lng});
);
out center body 20;`

    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(overpassQuery)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    if (!res.ok) return { error: `Overpass error: ${res.status}` }

    const data = await res.json()
    const results = (data.elements || [])
      .slice(0, 20)
      .map((el: Record<string, unknown>) => ({
        name: (el.tags as Record<string, string>)?.name || 'Unnamed',
        lat: el.lat as number,
        lng: el.lon as number,
        tags: el.tags,
      }))

    return { results }
  } catch (e) {
    return { error: `Search failed: ${(e as Error).message}` }
  }
}

// ── calculateRoute ───────────────────────────────────────────────────────────
type RouteMode = 'walking' | 'driving' | 'cycling'

const WALKING_MAX_DISTANCE = 3000
const CYCLING_MAX_DISTANCE = 15000

interface OSRMResponse {
  code: string
  routes: Array<{
    geometry: { coordinates: [number, number][]; type: string }
    distance: number
    duration: number
  }>
}

async function fetchOSRM(
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number,
  mode: RouteMode,
): Promise<{ coordinates: [number, number][]; distance: number; duration: number; mode: RouteMode } | null> {
  const profile = mode === 'walking' ? 'foot' : mode === 'cycling' ? 'bike' : 'car'
  const url = `https://routing.openstreetmap.de/routed-${profile}/route/v1/${mode}/${startLng},${startLat};${endLng},${endLat}?geometries=geojson&overview=full`

  const res = await fetch(url)
  if (!res.ok) return null

  const data: OSRMResponse = await res.json()
  if (data.code !== 'Ok' || !data.routes?.length) return null

  const route = data.routes[0]
  return {
    coordinates: route.geometry.coordinates,
    distance: route.distance,
    duration: route.duration,
    mode,
  }
}

async function smartRoute(
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number,
  preferredMode?: RouteMode,
) {
  if (preferredMode) {
    return fetchOSRM(startLng, startLat, endLng, endLat, preferredMode)
  }

  const walking = await fetchOSRM(startLng, startLat, endLng, endLat, 'walking')
  if (!walking) return fetchOSRM(startLng, startLat, endLng, endLat, 'driving')
  if (walking.distance <= WALKING_MAX_DISTANCE) return walking

  const cycling = await fetchOSRM(startLng, startLat, endLng, endLat, 'cycling')
  if (!cycling) return fetchOSRM(startLng, startLat, endLng, endLat, 'driving')
  if (cycling.distance <= CYCLING_MAX_DISTANCE) return cycling

  return (await fetchOSRM(startLng, startLat, endLng, endLat, 'driving')) || cycling
}

async function calculateRoute(args: Record<string, unknown>) {
  const startLng = args.startLng as number
  const startLat = args.startLat as number
  const endLng = args.endLng as number
  const endLat = args.endLat as number
  const mode = args.mode as RouteMode | undefined
  const properties = args.properties as string | undefined

  if (startLng == null || startLat == null || endLng == null || endLat == null)
    return { dataResult: { error: 'startLng, startLat, endLng, endLat are required' }, actionToolCall: null }

  try {
    const result = await smartRoute(startLng, startLat, endLng, endLat, mode || undefined)
    if (!result) {
      return { dataResult: { error: 'Could not find a route between these locations' }, actionToolCall: null }
    }

    const distanceKm = +(result.distance / 1000).toFixed(1)
    const durationMinutes = Math.round(result.duration / 60)

    let props: Record<string, unknown> = {}
    try {
      if (properties) props = JSON.parse(properties)
    } catch { /* use defaults */ }

    const modeLabel = result.mode.charAt(0).toUpperCase() + result.mode.slice(1)
    const id = `route_${generateId(6)}`

    const actionToolCall = {
      name: 'addMapElement',
      args: {
        elementType: 'route',
        coordinates: JSON.stringify(result.coordinates),
        properties: JSON.stringify({
          title: props.title || `${modeLabel} Route`,
          description: props.description || `${distanceKm}km, ~${durationMinutes} min (${result.mode})`,
          color: props.color || '#3b82f6',
          id,
        }),
      },
    }

    return {
      dataResult: {
        mode: result.mode,
        distanceKm,
        durationMinutes,
        routeId: id,
      },
      actionToolCall,
    }
  } catch (e) {
    return { dataResult: { error: `Route calculation failed: ${(e as Error).message}` }, actionToolCall: null }
  }
}

// ── Dispatcher ───────────────────────────────────────────────────────────────
export async function executeDataTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ dataResult: unknown; actionToolCall?: { name: string; args: Record<string, unknown> } | null }> {
  switch (name) {
    case 'geocode': {
      const result = await geocode(args)
      return { dataResult: result }
    }
    case 'reverseGeocode': {
      const result = await reverseGeocode(args)
      return { dataResult: result }
    }
    case 'searchPlaces': {
      const result = await searchPlaces(args)
      return { dataResult: result }
    }
    case 'calculateRoute': {
      return await calculateRoute(args)
    }
    default:
      return { dataResult: { error: `Unknown data tool: ${name}` } }
  }
}
