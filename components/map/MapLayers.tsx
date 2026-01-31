'use client'

import { useMemo } from 'react'
import { Source, Layer, Marker } from 'react-map-gl/maplibre'
import { useMapStore } from '@/stores/mapStore'
import { useTimelineStore } from '@/stores/timelineStore'
import { isDateInRange } from '@/lib/utils/dates'
import type {
  MapElement,
  PinElement,
  AreaElement,
  RouteElement,
  LineElement,
  ArcElement,
} from '@/types'

function generateArcCoordinates(
  source: [number, number],
  target: [number, number],
  numPoints: number = 50,
): [number, number][] {
  const coords: [number, number][] = []
  const [lng1, lat1] = source
  const [lng2, lat2] = target

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints
    const lng = lng1 + (lng2 - lng1) * t
    const lat = lat1 + (lat2 - lat1) * t
    // Add curvature
    const arc = Math.sin(Math.PI * t) * 0.2 * Math.abs(lng2 - lng1)
    coords.push([lng, lat + arc])
  }

  return coords
}

type WithRange<T> = T & { inRange: boolean }

export function MapLayers() {
  const { elements, selectedElementId, setSelectedElement } = useMapStore()
  const { startDate, endDate, isEnabled } = useTimelineStore()

  const visibleElements = useMemo(() => {
    return elements
      .filter((el) => el.visible)
      .map((el) => ({
        ...el,
        inRange: !isEnabled || isDateInRange(el.timeRange?.start, startDate, endDate),
      }))
  }, [elements, isEnabled, startDate, endDate])

  const pins = visibleElements.filter((el): el is WithRange<PinElement> => el.type === 'pin')
  const areas = visibleElements.filter((el): el is WithRange<AreaElement> => el.type === 'area')
  const routes = visibleElements.filter((el): el is WithRange<RouteElement> => el.type === 'route')
  const lines = visibleElements.filter((el): el is WithRange<LineElement> => el.type === 'line')
  const arcs = visibleElements.filter((el): el is WithRange<ArcElement> => el.type === 'arc')

  const areasGeoJSON = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: areas.map((area) => ({
        type: 'Feature' as const,
        properties: {
          id: area.id,
          title: area.title,
          color: area.color || '#4ECDC4',
          selected: area.id === selectedElementId,
          inRange: area.inRange,
        },
        geometry: {
          type: 'Polygon' as const,
          coordinates: area.coordinates,
        },
      })),
    }),
    [areas, selectedElementId],
  )

  const routesGeoJSON = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: routes.map((route) => ({
        type: 'Feature' as const,
        properties: {
          id: route.id,
          title: route.title,
          color: route.color || '#45B7D1',
          selected: route.id === selectedElementId,
          inRange: route.inRange,
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: route.coordinates,
        },
      })),
    }),
    [routes, selectedElementId],
  )

  const linesGeoJSON = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: lines.map((line) => ({
        type: 'Feature' as const,
        properties: {
          id: line.id,
          title: line.title,
          color: line.color || '#96CEB4',
          selected: line.id === selectedElementId,
          inRange: line.inRange,
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: line.coordinates,
        },
      })),
    }),
    [lines, selectedElementId],
  )

  const arcsGeoJSON = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: arcs.map((arc) => ({
        type: 'Feature' as const,
        properties: {
          id: arc.id,
          title: arc.title,
          color: arc.color || '#DDA0DD',
          selected: arc.id === selectedElementId,
          inRange: arc.inRange,
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: generateArcCoordinates(arc.source, arc.target),
        },
      })),
    }),
    [arcs, selectedElementId],
  )

  return (
    <>
      {/* Areas Layer */}
      <Source id="areas-source" type="geojson" data={areasGeoJSON}>
        <Layer
          id="areas-layer"
          type="fill"
          paint={{
            'fill-color': ['case', ['get', 'inRange'], ['get', 'color'], '#9CA3AF'],
            'fill-opacity': ['case', ['get', 'selected'], 0.6, ['get', 'inRange'], 0.3, 0.08],
          }}
        />
        <Layer
          id="areas-outline-layer"
          type="line"
          paint={{
            'line-color': ['case', ['get', 'inRange'], ['get', 'color'], '#9CA3AF'],
            'line-width': ['case', ['get', 'selected'], 3, ['get', 'inRange'], 1, 0.5],
            'line-opacity': ['case', ['get', 'inRange'], 1, 0.3],
          }}
        />
      </Source>

      {/* Routes Layer */}
      <Source id="routes-source" type="geojson" data={routesGeoJSON}>
        <Layer
          id="routes-layer"
          type="line"
          paint={{
            'line-color': ['case', ['get', 'inRange'], ['get', 'color'], '#9CA3AF'],
            'line-width': ['case', ['get', 'selected'], 5, ['get', 'inRange'], 3, 1.5],
            'line-opacity': ['case', ['get', 'inRange'], 1, 0.3],
            'line-dasharray': [2, 1],
          }}
        />
      </Source>

      {/* Lines Layer */}
      <Source id="lines-source" type="geojson" data={linesGeoJSON}>
        <Layer
          id="lines-layer"
          type="line"
          paint={{
            'line-color': ['case', ['get', 'inRange'], ['get', 'color'], '#9CA3AF'],
            'line-width': ['case', ['get', 'selected'], 4, ['get', 'inRange'], 2, 1],
            'line-opacity': ['case', ['get', 'inRange'], 1, 0.3],
          }}
        />
      </Source>

      {/* Arcs Layer */}
      <Source id="arcs-source" type="geojson" data={arcsGeoJSON}>
        <Layer
          id="arcs-layer"
          type="line"
          paint={{
            'line-color': ['case', ['get', 'inRange'], ['get', 'color'], '#9CA3AF'],
            'line-width': ['case', ['get', 'selected'], 4, ['get', 'inRange'], 2, 1],
            'line-opacity': ['case', ['get', 'inRange'], 1, 0.3],
          }}
        />
      </Source>

      {/* Pins - HTML Markers for color emoji support */}
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          longitude={pin.coordinates[0]}
          latitude={pin.coordinates[1]}
          anchor="center"
        >
          <div
            className="flex flex-col items-center cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              setSelectedElement(pin.id)
            }}
            style={{
              transform: pin.id === selectedElementId
                ? 'scale(1.2)'
                : pin.inRange ? 'scale(1)' : 'scale(0.6)',
              opacity: pin.inRange ? 1 : 0.35,
              filter: pin.inRange ? 'none' : 'grayscale(100%)',
              transition: 'all 0.3s ease',
            }}
          >
            <div
              className="flex items-center justify-center rounded-full bg-white shadow-lg"
              style={{
                width: 36,
                height: 36,
                border: `3px solid ${pin.inRange ? (pin.color || '#FF6B6B') : '#9CA3AF'}`,
                fontSize: 20,
              }}
            >
              {pin.icon || '📍'}
            </div>
            {pin.inRange && (
              <div
                className="mt-1 px-1 text-xs font-medium text-center bg-white/90 rounded shadow-sm max-w-[100px] truncate"
                style={{ color: '#333' }}
              >
                {pin.title}
              </div>
            )}
          </div>
        </Marker>
      ))}
    </>
  )
}
