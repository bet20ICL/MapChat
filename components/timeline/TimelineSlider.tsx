'use client'

import { useMemo, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTimelineStore } from '@/stores/timelineStore'
import { useMapStore } from '@/stores/mapStore'
import { getDateRange, formatDate } from '@/lib/utils/dates'
import { cn } from '@/lib/utils'
import { Clock, Play, Pause, X } from 'lucide-react'

const DAY_MS = 86400000
const HOUR_MS = 3600000
const MIN15_MS = 900000

function getGranularity(totalRange: number): { stepMs: number; dateFormat: string } {
  if (totalRange < 3 * DAY_MS) return { stepMs: MIN15_MS, dateFormat: 'MMM d, h:mm a' }
  if (totalRange < 7 * DAY_MS) return { stepMs: HOUR_MS, dateFormat: 'MMM d, h:mm a' }
  if (totalRange < 90 * DAY_MS) return { stepMs: 6 * HOUR_MS, dateFormat: 'MMM d, h:mm a' }
  return { stepMs: DAY_MS, dateFormat: 'MMM d, yyyy' }
}

export function TimelineSlider() {
  const { startDate, endDate, isEnabled, setRange, setEnabled, reset } = useTimelineStore()
  const { elements } = useMapStore()
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<'start' | 'end' | 'range' | null>(null)
  const [playing, setPlaying] = useState(false)
  const playRef = useRef({ start: 0, end: 0 })
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

  const { stepMs, dateFormat } = useMemo(() => getGranularity(totalRange), [totalRange])

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
      const snap = (t: number) => Math.round(t / stepMs) * stepMs

      if (ds.type === 'start') {
        const raw = snap(ds.origStart + timeDelta)
        const clamped = Math.max(minTime, Math.min(raw, ds.origEnd - stepMs))
        setRange(new Date(clamped).toISOString(), new Date(ds.origEnd).toISOString())
      } else if (ds.type === 'end') {
        const raw = snap(ds.origEnd + timeDelta)
        const clamped = Math.max(ds.origStart + stepMs, Math.min(raw, maxTime))
        setRange(new Date(ds.origStart).toISOString(), new Date(clamped).toISOString())
      } else {
        const windowSize = ds.origEnd - ds.origStart
        let newStart = snap(ds.origStart + timeDelta)
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
  }, [dragging, minTime, maxTime, totalRange, stepMs, setRange])

  // Clamp persisted values to current element range (needed by play effect, so before early return)
  const currentStart = dateRange && startDate
    ? Math.max(minTime, Math.min(new Date(startDate).getTime(), maxTime))
    : minTime
  const currentEnd = dateRange && endDate
    ? Math.max(minTime, Math.min(new Date(endDate).getTime(), maxTime))
    : maxTime

  // Keep play ref in sync for interval reads
  playRef.current = { start: currentStart, end: currentEnd }

  // Stop playing when user drags
  useEffect(() => {
    if (dragging) setPlaying(false)
  }, [dragging])

  // Pre-calculate event time ranges for the playback logic
  const eventRanges = useMemo(() => {
    return elements
      .filter((el) => el.timeRange?.start)
      .map((el) => ({
        start: new Date(el.timeRange!.start).getTime(),
        end: el.timeRange!.end
          ? new Date(el.timeRange!.end).getTime()
          : new Date(el.timeRange!.start).getTime(),
      }))
      .sort((a, b) => a.start - b.start)
  }, [elements])

  // Play animation: advance the window by stepMs each tick
  useEffect(() => {
    if (!playing) return

    const id = setInterval(() => {
      const { start, end } = playRef.current
      const windowSize = end - start

      // Check if we are currently "watching" an event
      // An event is visible if it overlaps with [start, end]
      const isWatchingEvent = eventRanges.some(
        (range) => range.start < end && range.end > start
      )

      let actualStep = stepMs

      if (!isWatchingEvent) {
        // We are in dead air. Find the NEXT event start that is after our current window end.
        const nextEvent = eventRanges.find((range) => range.start >= end)

        if (nextEvent) {
          // Distance to the next event
          const distanceToNext = nextEvent.start - end

          // We want to arrive exactly at (nextEvent.start - windowSize) so the event JUST enters the window on the right?
          // Actually, we usually want the event to enter smoothly. 
          // Let's speed up up to 20x, but ensure we slow down as we approach.

          // If we are very far, go fast.
          // If we are closer than 1 step, go normal.
          // We want to be careful not to overshoot the interaction start.

          // Let's cap the fast forwarding so we don't jump OVER an event.
          // We can jump at most distanceToNext.
          // But we want to see it slide in? 
          // If we jump `distanceToNext`, the event will be exactly at the right edge `end`.
          // That is fine. 

          const maxFastStep = stepMs * 20
          // If distance is large, take a big step. 
          // If distance is small, take the smaller of the two.
          // Subtract a small buffer (e.g. stepMs) so we slow down right before it enters?
          // Actually simplest is: move as fast as possible up to the next event.

          actualStep = Math.min(maxFastStep, Math.max(stepMs, distanceToNext - stepMs))
        } else {
          // No more events? Speed to the end.
          actualStep = stepMs * 20
        }
      }

      const newStart = start + actualStep
      const newEnd = newStart + windowSize

      if (newEnd >= maxTime) {
        setRange(new Date(maxTime - windowSize).toISOString(), new Date(maxTime).toISOString())
        setPlaying(false)
        return
      }

      setRange(new Date(newStart).toISOString(), new Date(newEnd).toISOString())
    }, 150)

    return () => clearInterval(id)
  }, [playing, stepMs, maxTime, setRange, eventRanges])

  if (!dateRange) return null

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
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 w-[min(44rem,calc(100%-2rem))] rounded-xl bg-background/80 backdrop-blur-md shadow-lg border px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Timeline</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              if (playing) {
                setPlaying(false)
                return
              }
              if (!isEnabled) setEnabled(true)
              // If window covers the full range, shrink to ~10% starting from the left
              if (currentStart <= minTime && currentEnd >= maxTime) {
                const windowSize = Math.max(stepMs, totalRange * 0.1)
                setRange(
                  new Date(minTime).toISOString(),
                  new Date(minTime + windowSize).toISOString(),
                )
              }
              setPlaying(true)
            }}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button
            variant={isEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setPlaying(false); setEnabled(!isEnabled) }}
          >
            {isEnabled ? 'Filtering Active' : 'Enable Filter'}
          </Button>
          {isEnabled && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setPlaying(false); reset() }}>
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
          <div className="absolute inset-x-0 h-2 rounded-full bg-secondary overflow-hidden">
            {/* Activity Indicators (Deadtime visualization) */}
            {eventRanges.map((range, i) => {
              // Simple merging of overlaps for display could be done, 
              // but opacity accumulation is also a nice effect.
              // Let's just render them. 
              const startP = totalRange > 0 ? ((range.start - minTime) / totalRange) * 100 : 0
              const endP = totalRange > 0 ? ((range.end - minTime) / totalRange) * 100 : 0
              const widthP = Math.max(0.5, endP - startP) // Ensure at least a thin line for point events

              return (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 bg-primary/20"
                  style={{
                    left: `${startP}%`,
                    width: `${widthP}%`,
                  }}
                />
              )
            })}
          </div>

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
          <span>{formatDate(startDate || dateRange.min, dateFormat)}</span>
          <span>{formatDate(endDate || dateRange.max, dateFormat)}</span>
        </div>
      </div>
    </div>
  )
}
