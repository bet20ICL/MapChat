'use client'

import { useCallback, useRef } from 'react'
import Map, { NavigationControl, MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useMapStore } from '@/stores/mapStore'
import { MapLayers } from './MapLayers'
import { ElementPopup } from './ElementPopup'

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

export function MapContainer() {
  const mapRef = useRef<MapRef>(null)
  const { viewState, setViewState, selectedElementId, setSelectedElement } = useMapStore()

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
        'pins-layer',
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
