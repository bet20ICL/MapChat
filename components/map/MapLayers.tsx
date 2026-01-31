'use client'

import { useMemo } from 'react'
import { Source, Layer } from 'react-map-gl/maplibre'
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

export function MapLayers() {
  const { elements, selectedElementId } = useMapStore()
  const { startDate, endDate, isEnabled } = useTimelineStore()

  const filteredElements = useMemo(() => {
    if (!isEnabled) return elements.filter((el) => el.visible)
    return elements.filter(
      (el) => el.visible && isDateInRange(el.timeRange?.start, startDate, endDate),
    )
  }, [elements, isEnabled, startDate, endDate])

  const pins = filteredElements.filter((el): el is PinElement => el.type === 'pin')
  const areas = filteredElements.filter((el): el is AreaElement => el.type === 'area')
  const routes = filteredElements.filter((el): el is RouteElement => el.type === 'route')
  const lines = filteredElements.filter((el): el is LineElement => el.type === 'line')
  const arcs = filteredElements.filter((el): el is ArcElement => el.type === 'arc')

  const pinsGeoJSON = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: pins.map((pin) => ({
        type: 'Feature' as const,
        properties: {
          id: pin.id,
          title: pin.title,
          color: pin.color || '#FF6B6B',
          selected: pin.id === selectedElementId,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: pin.coordinates,
        },
      })),
    }),
    [pins, selectedElementId],
  )

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
            'fill-color': ['get', 'color'],
            'fill-opacity': ['case', ['get', 'selected'], 0.6, 0.3],
          }}
        />
        <Layer
          id="areas-outline-layer"
          type="line"
          paint={{
            'line-color': ['get', 'color'],
            'line-width': ['case', ['get', 'selected'], 3, 1],
          }}
        />
      </Source>

      {/* Routes Layer */}
      <Source id="routes-source" type="geojson" data={routesGeoJSON}>
        <Layer
          id="routes-layer"
          type="line"
          paint={{
            'line-color': ['get', 'color'],
            'line-width': ['case', ['get', 'selected'], 5, 3],
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
            'line-color': ['get', 'color'],
            'line-width': ['case', ['get', 'selected'], 4, 2],
          }}
        />
      </Source>

      {/* Arcs Layer */}
      <Source id="arcs-source" type="geojson" data={arcsGeoJSON}>
        <Layer
          id="arcs-layer"
          type="line"
          paint={{
            'line-color': ['get', 'color'],
            'line-width': ['case', ['get', 'selected'], 4, 2],
          }}
        />
      </Source>

      {/* Pins Layer */}
      <Source id="pins-source" type="geojson" data={pinsGeoJSON}>
        <Layer
          id="pins-layer"
          type="circle"
          paint={{
            'circle-radius': ['case', ['get', 'selected'], 12, 8],
            'circle-color': ['get', 'color'],
            'circle-stroke-width': ['case', ['get', 'selected'], 3, 2],
            'circle-stroke-color': '#ffffff',
          }}
        />
      </Source>
    </>
  )
}
