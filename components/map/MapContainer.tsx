'use client'

import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import Map, { NavigationControl, MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useMapStore } from '@/stores/mapStore'
import { useTimelineStore } from '@/stores/timelineStore'
import { isDateInRange } from '@/lib/utils/dates'
import { MapLayers } from './MapLayers'
import { ElementPopup } from './ElementPopup'
import { AddPinDialog } from './AddPinDialog'
import type { PinElement } from '@/types'

const OPENFREEMAP_LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/liberty'
const OPENFREEMAP_DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark'

interface PinData {
  title: string
  description: string
  icon: string
  color: string
}

function createPinElement(data: PinData, coordinates: [number, number]): PinElement {
  return {
    id: `pin_${Date.now()}`,
    type: 'pin',
    title: data.title,
    description: data.description,
    icon: data.icon,
    color: data.color,
    coordinates,
    visible: true,
    createdBy: 'user',
  }
}

export function MapContainer() {
  const mapRef = useRef<MapRef>(null)
  const {
    viewState,
    setViewState,
    selectedElementId,
    setSelectedElement,
    elements,
    addElement,
    requestScreenshot,
    setScreenshotResult
  } = useMapStore()
  const { startDate, endDate, isEnabled } = useTimelineStore()
  const [pendingPin, setPendingPin] = useState<PinData | null>(null)
  const [showPinDialog, setShowPinDialog] = useState(false)
  const [rightClickLngLat, setRightClickLngLat] = useState<[number, number] | null>(null)
  const [isDark, setIsDark] = useState(false)

  // Handle screenshot request
  useEffect(() => {
    if (requestScreenshot && mapRef.current) {
      try {
        const map = mapRef.current.getMap()
        const canvas = map.getCanvas()
        const dataUrl = canvas.toDataURL('image/png')
        setScreenshotResult(dataUrl)
      } catch (error) {
        console.error('Failed to take screenshot:', error)
        setScreenshotResult(null)
      }
    }
  }, [requestScreenshot, setScreenshotResult])

  // Watch for theme changes
  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }

    // Initial check
    checkTheme()

    // Watch for changes to the html element's class
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [])

  // Auto-focus map on in-range elements when timeline changes (throttled)
  const lastFitRef = useRef(0)

  // Compute maxZoom based on ALL visible elements (memoized)
  const maxZoom = useMemo(() => {
    let allMinLng = Infinity, allMaxLng = -Infinity
    let allMinLat = Infinity, allMaxLat = -Infinity

    const extendAll = (lng: number, lat: number) => {
      allMinLng = Math.min(allMinLng, lng)
      allMaxLng = Math.max(allMaxLng, lng)
      allMinLat = Math.min(allMinLat, lat)
      allMaxLat = Math.max(allMaxLat, lat)
    }

    const visibleElements = elements.filter((e) => e.visible)
    if (visibleElements.length === 0) return 18

    for (const el of visibleElements) {
      switch (el.type) {
        case 'pin':
          extendAll(el.coordinates[0], el.coordinates[1])
          break
        case 'area':
          el.coordinates[0]?.forEach((c) => extendAll(c[0], c[1]))
          break
        case 'route':
        case 'line':
          el.coordinates.forEach((c) => extendAll(c[0], c[1]))
          break
        case 'arc':
          extendAll(el.source[0], el.source[1])
          extendAll(el.target[0], el.target[1])
          break
      }
    }

    if (allMinLng === Infinity) return 18

    // Derive maxZoom: allow zooming ~2 levels beyond what fits the full scene
    const allLngSpan = allMaxLng - allMinLng
    const allLatSpan = allMaxLat - allMinLat
    const maxSpan = Math.max(allLngSpan, allLatSpan, 0.001)
    const sceneZoom = Math.log2(360 / maxSpan)
    return Math.min(sceneZoom + 2, 18)
  }, [elements])

  useEffect(() => {
    if (!isEnabled || !startDate || !endDate) return

    const doFit = () => {
      lastFitRef.current = Date.now()
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
        { padding: 80, duration: 300, maxZoom },
      )
    }

    const elapsed = Date.now() - lastFitRef.current
    if (elapsed >= 300) {
      doFit()
      return
    }

    const timer = setTimeout(doFit, 300 - elapsed)
    return () => clearTimeout(timer)
  }, [startDate, endDate, isEnabled, elements, maxZoom])

  const handleMove = useCallback(
    (evt: { viewState: typeof viewState }) => {
      setViewState(evt.viewState)
    },
    [setViewState],
  )

  const handleClick = useCallback(
    (evt: maplibregl.MapLayerMouseEvent) => {
      if (pendingPin) {
        addElement(createPinElement(pendingPin, [evt.lngLat.lng, evt.lngLat.lat]))
        setPendingPin(null)
        setRightClickLngLat(null)
        return
      }

      const features = evt.features
      if (features && features.length > 0) {
        const feature = features[0]
        if (feature.properties?.id) {
          setSelectedElement(feature.properties.id)
          return
        }
      }

      setSelectedElement(null)
    },
    [setSelectedElement, pendingPin, addElement],
  )

  // Right-click handler
  const handleContextMenu = useCallback((evt: maplibregl.MapLayerMouseEvent) => {
    evt.originalEvent.preventDefault()
    setShowPinDialog(true)
    setRightClickLngLat([evt.lngLat.lng, evt.lngLat.lat])
  }, [])

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-2 right-2 z-10">
        <AddPinDialog
          onAdd={(data) => {
            if (rightClickLngLat) {
              // Add pin directly at right-click location
              addElement({
                id: `pin_${Date.now()}`,
                type: 'pin',
                title: data.title,
                description: data.description,
                icon: data.icon,
                color: data.color,
                coordinates: rightClickLngLat,
                visible: true,
                createdBy: 'user',
              })
              setShowPinDialog(false)
              setRightClickLngLat(null)
            } else {
              setPendingPin(data)
            }
          }}
          open={showPinDialog}
          setOpen={setShowPinDialog}
        />
        {pendingPin && (
          <div className="mt-2 p-2 bg-white border rounded shadow text-sm">
            Click on the map to place your pin.
          </div>
        )}
      </div>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={handleMove}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        style={{ width: '100%', height: '100%' }}
        mapStyle={isDark ? OPENFREEMAP_DARK_STYLE : OPENFREEMAP_LIGHT_STYLE}
        interactiveLayerIds={['areas-layer', 'routes-layer', 'lines-layer', 'arcs-layer']}
        maxPitch={85}
        // @ts-expect-error preserveDrawingBuffer is forwarded to the underlying map instance
        preserveDrawingBuffer={true}
      >
        <NavigationControl position="top-left" visualizePitch={true} showCompass={true} />
        <MapLayers />
        {selectedElementId && <ElementPopup />}
      </Map>
    </div>
  )
}
