export type MapElementType = 'pin' | 'area' | 'route' | 'arc' | 'line'

export interface TimeRange {
  start: string // ISO date string
  end?: string // ISO date string, optional for ongoing events
}

export interface Article {
  title: string
  content: string
  images?: string[]
  sources?: string[]
}

interface BaseMapElement {
  id: string
  type: MapElementType
  title: string
  description: string
  article?: Article
  timeRange?: TimeRange
  visible: boolean
  color?: string
}

export interface PinElement extends BaseMapElement {
  type: 'pin'
  coordinates: [number, number] // [lng, lat]
}

export interface AreaElement extends BaseMapElement {
  type: 'area'
  coordinates: [number, number][][] // Polygon coordinates
}

export interface RouteElement extends BaseMapElement {
  type: 'route'
  coordinates: [number, number][] // LineString coordinates
}

export interface LineElement extends BaseMapElement {
  type: 'line'
  coordinates: [number, number][] // LineString coordinates
}

export interface ArcElement extends BaseMapElement {
  type: 'arc'
  source: [number, number] // [lng, lat]
  target: [number, number] // [lng, lat]
}

export type MapElement = PinElement | AreaElement | RouteElement | LineElement | ArcElement

export interface MapViewState {
  longitude: number
  latitude: number
  zoom: number
  pitch?: number
  bearing?: number
}
