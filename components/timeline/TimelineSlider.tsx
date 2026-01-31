'use client'

import { useMemo, useEffect } from 'react'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { useTimelineStore } from '@/stores/timelineStore'
import { useMapStore } from '@/stores/mapStore'
import { getDateRange, formatDate } from '@/lib/utils/dates'
import { Clock, X } from 'lucide-react'

export function TimelineSlider() {
  const { startDate, endDate, isEnabled, setRange, setEnabled, reset } = useTimelineStore()
  const { elements } = useMapStore()

  // Calculate the date range from all elements
  const dateRange = useMemo(() => {
    const dates = elements.flatMap((el) => [el.timeRange?.start, el.timeRange?.end]).filter(Boolean)
    return getDateRange(dates)
  }, [elements])

  // Initialize timeline when elements with dates are added
  useEffect(() => {
    if (dateRange && !startDate && !endDate) {
      setRange(dateRange.min, dateRange.max)
    }
  }, [dateRange, startDate, endDate, setRange])

  const hasTimeData = dateRange !== null

  if (!hasTimeData) {
    return (
      <div className="flex items-center justify-center h-16 px-4 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 mr-2" />
        Add elements with dates to enable timeline filtering
      </div>
    )
  }

  const minTime = new Date(dateRange.min).getTime()
  const maxTime = new Date(dateRange.max).getTime()
  const currentStart = startDate ? new Date(startDate).getTime() : minTime
  const currentEnd = endDate ? new Date(endDate).getTime() : maxTime

  const handleValueChange = (values: number[]) => {
    const newStart = new Date(values[0]).toISOString()
    const newEnd = new Date(values[1]).toISOString()
    setRange(newStart, newEnd)
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
        <Slider
          value={[currentStart, currentEnd]}
          min={minTime}
          max={maxTime}
          step={86400000} // 1 day in ms
          onValueChange={handleValueChange}
          disabled={!isEnabled}
          className="py-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatDate(startDate || dateRange.min)}</span>
          <span>{formatDate(endDate || dateRange.max)}</span>
        </div>
      </div>
    </div>
  )
}
