'use client'

import { useChatStore } from '@/stores/chatStore'
import { useMapStore } from '@/stores/mapStore'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { toast } from 'sonner'
import { generateId } from '@/lib/utils/id'
import type { MapElement, PinElement, AreaElement, RouteElement, LineElement, ArcElement } from '@/types'

interface ToolCall {
  name: string
  args: Record<string, unknown>
}

interface ChatResponse {
  content: string
  toolCalls: ToolCall[]
}

interface OSRMResponse {
  code: string
  routes: Array<{
    geometry: {
      coordinates: [number, number][]
      type: string
    }
    distance: number
    duration: number
  }>
}

type RouteMode = 'walking' | 'driving' | 'cycling'

interface RouteResult {
  coordinates: [number, number][]
  distance: number // meters
  duration: number // seconds
  mode: RouteMode
}

// Distance thresholds for auto mode selection (in meters)
const WALKING_MAX_DISTANCE = 3000    // 3km - beyond this, suggest cycling
const CYCLING_MAX_DISTANCE = 15000   // 15km - beyond this, suggest driving

// Fetch route from OSRM with distance info
async function fetchOSRMRoute(
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number,
  mode: RouteMode = 'walking'
): Promise<RouteResult | null> {
  try {
    // OSRM profile names
    const profile = mode === 'walking' ? 'foot' : mode === 'cycling' ? 'bike' : 'car'
    const url = `https://routing.openstreetmap.de/routed-${profile}/route/v1/${mode}/${startLng},${startLat};${endLng},${endLat}?geometries=geojson&overview=full`
    console.log(`Fetching OSRM ${mode} route:`, url)

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`OSRM API error: ${response.status}`)
    }

    const data: OSRMResponse = await response.json()

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.error('OSRM returned no routes:', data)
      return null
    }

    const route = data.routes[0]
    console.log(`OSRM ${mode} route: ${route.geometry.coordinates.length} points, ${(route.distance / 1000).toFixed(1)}km, ${Math.round(route.duration / 60)}min`)

    return {
      coordinates: route.geometry.coordinates,
      distance: route.distance,
      duration: route.duration,
      mode,
    }
  } catch (error) {
    console.error(`Failed to fetch OSRM ${mode} route:`, error)
    return null
  }
}

// Smart routing: auto-select best mode based on actual route distance
async function fetchSmartRoute(
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number,
  preferredMode?: RouteMode
): Promise<RouteResult | null> {
  // If user specified a mode, use it directly
  if (preferredMode) {
    console.log(`Using user-specified mode: ${preferredMode}`)
    return fetchOSRMRoute(startLng, startLat, endLng, endLat, preferredMode)
  }

  // Try walking first
  console.log('Smart routing: trying walking first...')
  const walkingRoute = await fetchOSRMRoute(startLng, startLat, endLng, endLat, 'walking')

  if (!walkingRoute) {
    // Walking failed, try driving as fallback
    console.log('Walking route failed, falling back to driving')
    return fetchOSRMRoute(startLng, startLat, endLng, endLat, 'driving')
  }

  // Check if walking distance is reasonable
  if (walkingRoute.distance <= WALKING_MAX_DISTANCE) {
    console.log(`Walking distance ${(walkingRoute.distance / 1000).toFixed(1)}km is reasonable, using walking`)
    return walkingRoute
  }

  // Too far for walking, try cycling
  console.log(`Walking distance ${(walkingRoute.distance / 1000).toFixed(1)}km exceeds ${WALKING_MAX_DISTANCE / 1000}km, trying cycling...`)
  const cyclingRoute = await fetchOSRMRoute(startLng, startLat, endLng, endLat, 'cycling')

  if (!cyclingRoute) {
    // Cycling failed, try driving
    console.log('Cycling route failed, falling back to driving')
    return fetchOSRMRoute(startLng, startLat, endLng, endLat, 'driving')
  }

  // Check if cycling distance is reasonable
  if (cyclingRoute.distance <= CYCLING_MAX_DISTANCE) {
    console.log(`Cycling distance ${(cyclingRoute.distance / 1000).toFixed(1)}km is reasonable, using cycling`)
    return cyclingRoute
  }

  // Too far for cycling, use driving
  console.log(`Cycling distance ${(cyclingRoute.distance / 1000).toFixed(1)}km exceeds ${CYCLING_MAX_DISTANCE / 1000}km, using driving...`)
  const drivingRoute = await fetchOSRMRoute(startLng, startLat, endLng, endLat, 'driving')

  return drivingRoute || cyclingRoute // Fall back to cycling if driving fails
}

export function ChatPanel() {
  const { addMessage, setLoading, messages } = useChatStore()
  const { elements, addElement, updateElement, removeElement, setViewState } = useMapStore()

  const handleToolCall = async (toolCall: ToolCall): Promise<{ type: string; success: boolean; mode?: RouteMode; distance?: number; duration?: number }> => {
    console.log('Executing tool:', toolCall.name, toolCall.args)

    switch (toolCall.name) {
      case 'addMapElement': {
        const { elementType, coordinates, properties } = toolCall.args
        try {
          const coords = JSON.parse(coordinates as string)
          const props = JSON.parse(properties as string)
          const id = `${elementType}_${generateId(6)}`

          let element: MapElement

          if (elementType === 'pin') {
            element = {
              id,
              type: 'pin',
              coordinates: coords as [number, number],
              title: props.title || 'Untitled',
              description: props.description || '',
              color: props.color,
              visible: true,
              timeRange: props.timeRange,
              article: props.article,
            } as PinElement
          } else if (elementType === 'area') {
            element = {
              id,
              type: 'area',
              coordinates: coords as [number, number][][],
              title: props.title || 'Untitled',
              description: props.description || '',
              color: props.color,
              visible: true,
              timeRange: props.timeRange,
              article: props.article,
            } as AreaElement
          } else if (elementType === 'route') {
            element = {
              id,
              type: 'route',
              coordinates: coords as [number, number][],
              title: props.title || 'Untitled',
              description: props.description || '',
              color: props.color,
              visible: true,
              timeRange: props.timeRange,
              article: props.article,
            } as RouteElement
          } else if (elementType === 'line') {
            element = {
              id,
              type: 'line',
              coordinates: coords as [number, number][],
              title: props.title || 'Untitled',
              description: props.description || '',
              color: props.color,
              visible: true,
              timeRange: props.timeRange,
              article: props.article,
            } as LineElement
          } else if (elementType === 'arc') {
            element = {
              id,
              type: 'arc',
              source: coords.source as [number, number],
              target: coords.target as [number, number],
              title: props.title || 'Untitled',
              description: props.description || '',
              color: props.color,
              visible: true,
              timeRange: props.timeRange,
              article: props.article,
            } as ArcElement
          } else {
            console.error('Unknown element type:', elementType)
            return { type: 'add', success: false }
          }

          addElement(element)
          console.log('Added element:', element)
          return { type: 'add', success: true }
        } catch (error) {
          console.error('Failed to add element:', error)
          return { type: 'add', success: false }
        }
      }

      case 'updateMapElement': {
        const { elementId, newProperties } = toolCall.args
        try {
          const props = JSON.parse(newProperties as string)
          updateElement(elementId as string, props)
          console.log('Updated element:', elementId, props)
          return { type: 'update', success: true }
        } catch (error) {
          console.error('Failed to update element:', error)
          return { type: 'update', success: false }
        }
      }

      case 'removeMapElement': {
        const { elementId } = toolCall.args
        removeElement(elementId as string)
        console.log('Removed element:', elementId)
        return { type: 'remove', success: true }
      }

      case 'setMapView': {
        const { longitude, latitude, zoom } = toolCall.args
        setViewState({
          longitude: longitude as number,
          latitude: latitude as number,
          zoom: zoom as number,
        })
        console.log('Set map view:', { longitude, latitude, zoom })
        return { type: 'view', success: true }
      }

      case 'getRoute': {
        const { startLng, startLat, endLng, endLat, mode, properties } = toolCall.args
        try {
          const props = JSON.parse(properties as string)
          // If user specified a mode, pass it; otherwise let smart routing decide
          const preferredMode = mode ? (mode as RouteMode) : undefined

          // Use smart routing to auto-select best mode
          const routeResult = await fetchSmartRoute(
            startLng as number,
            startLat as number,
            endLng as number,
            endLat as number,
            preferredMode
          )

          if (!routeResult) {
            toast.error('Could not find a route between these locations')
            return { type: 'route', success: false }
          }

          const { coordinates, distance, duration, mode: selectedMode } = routeResult
          const distanceKm = (distance / 1000).toFixed(1)
          const durationMin = Math.round(duration / 60)

          const id = `route_${generateId(6)}`
          const modeLabel = selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1)
          const element: RouteElement = {
            id,
            type: 'route',
            coordinates,
            title: props.title || `${modeLabel} Route`,
            description: props.description || `${distanceKm}km, ~${durationMin} min`,
            color: props.color || '#3b82f6',
            visible: true,
          }

          addElement(element)
          console.log(`Added ${selectedMode} route: ${coordinates.length} points, ${distanceKm}km, ${durationMin}min`)

          // Show toast with route info
          toast.success(`${modeLabel} route: ${distanceKm}km, ~${durationMin} min`)

          // Auto-zoom to show the route
          const allLngs = coordinates.map(c => c[0])
          const allLats = coordinates.map(c => c[1])
          const centerLng = (Math.min(...allLngs) + Math.max(...allLngs)) / 2
          const centerLat = (Math.min(...allLats) + Math.max(...allLats)) / 2

          // Calculate appropriate zoom based on route extent
          const lngSpan = Math.max(...allLngs) - Math.min(...allLngs)
          const latSpan = Math.max(...allLats) - Math.min(...allLats)
          const maxSpan = Math.max(lngSpan, latSpan)
          const zoom = Math.max(4, Math.min(12, 8 - Math.log2(maxSpan)))

          setViewState({ longitude: centerLng, latitude: centerLat, zoom })

          return { type: 'route', success: true, mode: selectedMode, distance, duration }
        } catch (error) {
          console.error('Failed to get route:', error)
          return { type: 'route', success: false }
        }
      }

      default:
        console.warn('Unknown tool call:', toolCall.name)
        return { type: 'unknown', success: false }
    }
  }

  const handleSend = async (content: string) => {
    addMessage('user', content)
    setLoading(true)

    try {
      // Send message with current map state
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content },
          ],
          mapState: JSON.stringify(elements),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get chat response')
      }

      const data: ChatResponse = await response.json()

      // Execute any tool calls
      if (data.toolCalls && data.toolCalls.length > 0) {
        let addedCount = 0
        let updatedCount = 0
        let removedCount = 0
        let routeCount = 0

        for (const toolCall of data.toolCalls) {
          const result = await handleToolCall(toolCall)
          if (result.success) {
            if (result.type === 'add') addedCount++
            if (result.type === 'update') updatedCount++
            if (result.type === 'remove') removedCount++
            if (result.type === 'route') routeCount++
          }
        }

        // Show toast summary
        const actions = []
        if (addedCount > 0) actions.push(`Added ${addedCount} element${addedCount > 1 ? 's' : ''}`)
        if (routeCount > 0) actions.push(`Added ${routeCount} route${routeCount > 1 ? 's' : ''}`)
        if (updatedCount > 0) actions.push(`Updated ${updatedCount} element${updatedCount > 1 ? 's' : ''}`)
        if (removedCount > 0) actions.push(`Removed ${removedCount} element${removedCount > 1 ? 's' : ''}`)
        if (actions.length > 0) {
          toast.success(actions.join(', '))
        }
      }

      // Add assistant message
      const responseContent = data.content || (data.toolCalls?.length > 0 ? 'Done! I\'ve updated the map for you.' : '')
      if (responseContent) {
        addMessage('assistant', responseContent)
      }
    } catch (error) {
      console.error('Chat error:', error)
      addMessage('assistant', 'Sorry, I encountered an error. Please try again.')
      toast.error('Failed to process your request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-4 py-3 border-b">
        <h2 className="font-semibold">Chat</h2>
        <p className="text-xs text-muted-foreground">{elements.length} elements on map</p>
      </div>
      <MessageList />
      <ChatInput onSend={handleSend} />
    </div>
  )
}
