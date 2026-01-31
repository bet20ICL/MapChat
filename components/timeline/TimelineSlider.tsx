'use client'

import { useMemo, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTimelineStore } from '@/stores/timelineStore'
import { useMapStore } from '@/stores/mapStore'
import { getDateRange, formatDate } from '@/lib/utils/dates'
import { cn } from '@/lib/utils'
import { Clock, X } from 'lucide-react'

const DAY_MS = 86400000

export function TimelineSlider() {
  const { startDate, endDate, isEnabled, setRange, setEnabled, reset } = useTimelineStore()
  const { elements } = useMapStore()
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<'start' | 'end' | 'range' | null>(null)
  const dragStateRef = useRef<{
    type: 'start' | 'end' | 'range'
    startX: number
    origStart: number
    origEnd: number
  } | null>(null)

  // Calculate the date range from all elements
  const dateRange = useMemo(() => {
    const dates = elements.flatMap((el) => [el.timeRange?.start, el.timeRange?.end]).filter(Boolean)
    return getDateRange(dates)
  }, [elements])

  const minTime = dateRange ? new Date(dateRange.min).getTime() : 0
  const maxTime = dateRange ? new Date(dateRange.max).getTime() : 0
  const totalRange = maxTime - minTime || DAY_MS

  // Initialize timeline when elements with dates are added
  useEffect(() => {
    if (dateRange && !startDate && !endDate) {
      setRange(dateRange.min, dateRange.max)
    }
  }, [dateRange, startDate, endDate, setRange])

  // Document-level listeners for reliable drag tracking
  useEffect(() => {
    if (!dragging) return

    const onMove = (e: PointerEvent) => {
      const ds = dragStateRef.current
      if (!ds || !trackRef.current) return
      const trackWidth = trackRef.current.getBoundingClientRect().width
      const timeDelta = ((e.clientX - ds.startX) / trackWidth) * totalRange
      const snapToDay = (t: number) => Math.round(t / DAY_MS) * DAY_MS

      if (ds.type === 'start') {
        const raw = snapToDay(ds.origStart + timeDelta)
        const clamped = Math.max(minTime, Math.min(raw, ds.origEnd - DAY_MS))
        setRange(new Date(clamped).toISOString(), new Date(ds.origEnd).toISOString())
      } else if (ds.type === 'end') {
        const raw = snapToDay(ds.origEnd + timeDelta)
        const clamped = Math.max(ds.origStart + DAY_MS, Math.min(raw, maxTime))
        setRange(new Date(ds.origStart).toISOString(), new Date(clamped).toISOString())
      } else {
        const windowSize = ds.origEnd - ds.origStart
        let newStart = snapToDay(ds.origStart + timeDelta)
        let newEnd = newStart + windowSize
        if (newStart < minTime) {
          newStart = minTime
          newEnd = minTime + windowSize
        }
        if (newEnd > maxTime) {
          newEnd = maxTime
          newStart = maxTime - windowSize
        }
        setRange(new Date(newStart).toISOString(), new Date(newEnd).toISOString())
      }
    }

    const onUp = () => {
      setDragging(null)
      dragStateRef.current = null
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
  }, [dragging, minTime, maxTime, totalRange, setRange])

  if (!dateRange) {
    return (
      <div className="flex items-center justify-center h-16 px-4 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 mr-2" />
        Add elements with dates to enable timeline filtering
      </div>
    )
  }

  // Clamp persisted values to current element range
  const currentStart = startDate
    ? Math.max(minTime, Math.min(new Date(startDate).getTime(), maxTime))
    : minTime
  const currentEnd = endDate
    ? Math.max(minTime, Math.min(new Date(endDate).getTime(), maxTime))
    : maxTime

  const startPercent = totalRange > 0 ? ((currentStart - minTime) / totalRange) * 100 : 0
  const endPercent = totalRange > 0 ? ((currentEnd - minTime) / totalRange) * 100 : 100

  const handlePointerDown =
    (type: 'start' | 'end' | 'range') => (e: React.PointerEvent) => {
      if (!isEnabled) return
      e.preventDefault()
      dragStateRef.current = {
        type,
        startX: e.clientX,
        origStart: currentStart,
        origEnd: currentEnd,
      }
      setDragging(type)
    }

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Timeline</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => setEnabled(!isEnabled)}
          >
            {isEnabled ? 'Filtering Active' : 'Enable Filter'}
          </Button>
          {isEnabled && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={reset}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-1">
        {/* Custom slider with range dragging */}
        <div
          ref={trackRef}
          className="relative h-8 flex items-center select-none touch-none"
        >
          {/* Track background */}
          <div className="absolute inset-x-0 h-2 rounded-full bg-secondary" />

          {/* Active range bar (draggable) */}
          <div
            className={cn(
              'absolute h-2 rounded-full transition-colors',
              isEnabled ? 'bg-primary' : 'bg-primary/40',
            )}
            style={{
              left: `${startPercent}%`,
              width: `${endPercent - startPercent}%`,
              cursor: !isEnabled
                ? 'default'
                : dragging === 'range'
                  ? 'grabbing'
                  : 'grab',
            }}
            onPointerDown={handlePointerDown('range')}
          />

          {/* Start thumb */}
          <div
            className={cn(
              'absolute z-10 h-5 w-5 rounded-full border-2 border-primary bg-background -translate-x-1/2 transition-shadow',
              isEnabled
                ? 'cursor-ew-resize hover:ring-2 hover:ring-primary/30'
                : 'opacity-50',
            )}
            style={{ left: `${startPercent}%` }}
            onPointerDown={handlePointerDown('start')}
          />

          {/* End thumb */}
          <div
            className={cn(
              'absolute z-10 h-5 w-5 rounded-full border-2 border-primary bg-background -translate-x-1/2 transition-shadow',
              isEnabled
                ? 'cursor-ew-resize hover:ring-2 hover:ring-primary/30'
                : 'opacity-50',
            )}
            style={{ left: `${endPercent}%` }}
            onPointerDown={handlePointerDown('end')}
          />
        </div>

        {/* Date labels */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatDate(startDate || dateRange.min)}</span>
          <span>{formatDate(endDate || dateRange.max)}</span>
        </div>
      </div>
    </div>
  )
}
