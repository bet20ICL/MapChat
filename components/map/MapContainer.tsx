'use client'

import { useCallback, useEffect, useRef } from 'react'
import Map, { NavigationControl, MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useMapStore } from '@/stores/mapStore'
import { useTimelineStore } from '@/stores/timelineStore'
import { isDateInRange } from '@/lib/utils/dates'
import { MapLayers } from './MapLayers'
import { ElementPopup } from './ElementPopup'

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

export function MapContainer() {
  const mapRef = useRef<MapRef>(null)
  const { viewState, setViewState, selectedElementId, setSelectedElement, elements } = useMapStore()
  const { startDate, endDate, isEnabled } = useTimelineStore()

  // Auto-focus map on in-range elements when timeline changes (debounced)
  useEffect(() => {
    if (!isEnabled || !startDate || !endDate) return

    const timer = setTimeout(() => {
      if (!mapRef.current) return

      const inRange = elements.filter((el) => {
        if (!el.visible || !el.timeRange?.start) return false
        return isDateInRange(el.timeRange.start, startDate, endDate)
      })

      if (inRange.length === 0) return

      let minLng = Infinity
      let maxLng = -Infinity
      let minLat = Infinity
      let maxLat = -Infinity

      const extend = (lng: number, lat: number) => {
        minLng = Math.min(minLng, lng)
        maxLng = Math.max(maxLng, lng)
        minLat = Math.min(minLat, lat)
        maxLat = Math.max(maxLat, lat)
      }

      for (const el of inRange) {
        switch (el.type) {
          case 'pin':
            extend(el.coordinates[0], el.coordinates[1])
            break
          case 'area':
            el.coordinates[0]?.forEach((c) => extend(c[0], c[1]))
            break
          case 'route':
          case 'line':
            el.coordinates.forEach((c) => extend(c[0], c[1]))
            break
          case 'arc':
            extend(el.source[0], el.source[1])
            extend(el.target[0], el.target[1])
            break
        }
      }

      if (minLng === Infinity) return

      mapRef.current.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 80, duration: 500 },
      )
    }, 300)

    return () => clearTimeout(timer)
  }, [startDate, endDate, isEnabled, elements])

  const handleMove = useCallback(
    (evt: { viewState: typeof viewState }) => {
      setViewState(evt.viewState)
    },
    [setViewState],
  )

  const handleClick = useCallback(
    (evt: maplibregl.MapLayerMouseEvent) => {
      // Check if clicked on a feature
      const features = evt.features
      if (features && features.length > 0) {
        const feature = features[0]
        if (feature.properties?.id) {
          setSelectedElement(feature.properties.id)
          return
        }
      }
      // Clicked on empty space
      setSelectedElement(null)
    },
    [setSelectedElement],
  )

  return (
    <Map
      ref={mapRef}
      {...viewState}
      onMove={handleMove}
      onClick={handleClick}
      style={{ width: '100%', height: '100%' }}
      mapStyle={OPENFREEMAP_STYLE}
      interactiveLayerIds={[
        'areas-layer',
        'routes-layer',
        'lines-layer',
        'arcs-layer',
      ]}
    >
      <NavigationControl position="top-left" />
      <MapLayers />
      {selectedElementId && <ElementPopup />}
    </Map>
  )
}
