import { useState, useEffect, useRef } from 'react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

const S = {
  bg:      '#1a1a1a',
  surface: '#242424',
  inner:   '#1e1e1e',
  border:  '#2d2d2d',
  text:    '#e8e8e8',
  sub:     '#888888',
  muted:   '#555555',
  accent:  '#00e676',
}

function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate() }
function getFirstDay(y, m)    { return new Date(y, m, 1).getDay() }

function toISO(date) {
  if (!date) return ''
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
}

function parseDateOnly(str) {
  if (!str) return null
  // handles "2026-02-23" or "2026-02-23T00:00"
  const parts = str.slice(0, 10).split('-')
  return new Date(+parts[0], +parts[1] - 1, +parts[2])
}

function formatDisplay(date) {
  if (!date) return null
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

export default function DateRangePicker({ dateFrom, dateTo, onFromChange, onToChange, onClear }) {
  const ref = useRef(null)
  const [open, setOpen]       = useState(false)
  const [phase, setPhase]     = useState('start') // 'start' | 'end'
  const [hover, setHover]     = useState(null)

  const today = new Date()
  const [viewYear, setViewYear]   = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const fromDate = parseDateOnly(dateFrom)
  const toDate   = parseDateOnly(dateTo)

  // Click outside to close
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setPhase('start')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Reset phase when picker opens
  function handleOpen() {
    setOpen(o => {
      if (!o) setPhase(fromDate ? 'end' : 'start')
      return !o
    })
  }

  function handleDayClick(date) {
    if (phase === 'start') {
      onFromChange(`${toISO(date)}T00:00`)
      onToChange('')
      setPhase('end')
    } else {
      // Swap if end < start
      if (fromDate && date < fromDate) {
        onToChange(`${toISO(fromDate)}T23:59`)
        onFromChange(`${toISO(date)}T00:00`)
      } else {
        onToChange(`${toISO(date)}T23:59`)
      }
      setPhase('start')
      setOpen(false)
      setHover(null)
    }
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  // Determine range display (preview while hovering)
  let rangeStart = fromDate
  let rangeEnd   = phase === 'end' && hover ? hover : toDate
  if (rangeStart && rangeEnd && rangeEnd < rangeStart) {
    [rangeStart, rangeEnd] = [rangeEnd, rangeStart]
  }

  const displayText = fromDate || toDate
    ? `${formatDisplay(fromDate) ?? '?'}  –  ${formatDisplay(toDate) ?? '?'}`
    : 'All time'

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay    = getFirstDay(viewYear, viewMonth)
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d))

  return (
    <div ref={ref} style={{ position: 'relative', userSelect: 'none' }}>
      {/* Trigger */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-1.5 rounded text-xs"
        style={{
          background: S.inner,
          border: `1px solid ${open ? S.accent : S.border}`,
          color: (dateFrom || dateTo) ? S.text : S.muted,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'border-color 0.15s',
        }}
      >
        <span>📅</span>
        <span>{displayText}</span>
        {(dateFrom || dateTo) && (
          <span
            onClick={e => { e.stopPropagation(); onClear(); setPhase('start') }}
            style={{ color: S.muted, marginLeft: 2, lineHeight: 1 }}
          >✕</span>
        )}
      </button>

      {/* Dropdown calendar */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 200,
            background: S.surface,
            border: `1px solid ${S.border}`,
            borderRadius: 10,
            padding: '14px 16px',
            width: 280,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {/* Phase hint */}
          <div className="text-xs mb-3" style={{ color: S.sub }}>
            {phase === 'start' ? 'Select start date' : 'Select end date'}
          </div>

          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} style={{ color: S.sub, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>‹</button>
            <span className="text-sm font-medium" style={{ color: S.text }}>
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button onClick={nextMonth} style={{ color: S.sub, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>›</button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DAYS.map(d => (
              <div key={d} className="text-center" style={{ fontSize: 10, color: S.muted, padding: '2px 0' }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((date, i) => {
              if (!date) return <div key={`empty-${i}`} />

              const iso = toISO(date)
              const isStart   = fromDate && toISO(fromDate) === iso
              const isEnd     = rangeEnd && toISO(rangeEnd) === iso
              const inRange   = rangeStart && rangeEnd && date > rangeStart && date < rangeEnd
              const isToday   = toISO(today) === iso
              const isEndpoint = isStart || isEnd

              return (
                <div
                  key={iso}
                  onClick={() => handleDayClick(date)}
                  onMouseEnter={() => phase === 'end' && setHover(date)}
                  onMouseLeave={() => phase === 'end' && setHover(null)}
                  style={{
                    textAlign: 'center',
                    padding: '5px 0',
                    borderRadius: isEndpoint ? 6 : (inRange ? 0 : 6),
                    background: isEndpoint
                      ? S.accent
                      : inRange
                        ? 'rgba(0,230,118,0.15)'
                        : 'transparent',
                    color: isEndpoint ? '#000' : (inRange ? S.accent : S.text),
                    fontWeight: isEndpoint ? 700 : isToday ? 600 : 400,
                    fontSize: 12,
                    cursor: 'pointer',
                    outline: isToday && !isEndpoint ? `1px solid ${S.muted}` : 'none',
                    transition: 'background 0.1s',
                  }}
                >
                  {date.getDate()}
                </div>
              )
            })}
          </div>

          {/* Quick presets */}
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {[
              { label: 'Today',    days: 0 },
              { label: '7d',       days: 7 },
              { label: '30d',      days: 30 },
              { label: 'This month', days: -1 },
            ].map(({ label, days }) => (
              <button
                key={label}
                onClick={() => {
                  const end = new Date(); end.setHours(23, 59, 0, 0)
                  let start
                  if (days === 0) {
                    start = new Date(); start.setHours(0, 0, 0, 0)
                  } else if (days === -1) {
                    start = new Date(today.getFullYear(), today.getMonth(), 1)
                  } else {
                    start = new Date(Date.now() - days * 86400000); start.setHours(0, 0, 0, 0)
                  }
                  onFromChange(`${toISO(start)}T00:00`)
                  onToChange(`${toISO(end)}T23:59`)
                  setPhase('start')
                  setOpen(false)
                }}
                style={{
                  fontSize: 10,
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: S.inner,
                  border: `1px solid ${S.border}`,
                  color: S.sub,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
