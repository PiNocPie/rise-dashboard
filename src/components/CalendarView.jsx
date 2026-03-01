import { useState, useMemo } from 'react'
import { COMPETITOR_COLORS, CATEGORY_COLORS } from '../data/constants'

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAYS_FULL  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

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

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate() }
function getFirstDayOfMonth(year, month) { return new Date(year, month, 1).getDay() }
function toDateKey(dateStr) { return dateStr?.slice(0, 10) || '' }

function er(post) {
  if (!post.views) return 0
  return ((post.likes + post.retweets + post.replies) / post.views) * 100
}

// ── interpolate dark → accent based on 0..1 ratio ──────────────────────────
function heatColor(ratio) {
  if (ratio <= 0) return S.inner
  // dark green → bright green
  const r = Math.round(0 + ratio * 0)
  const g = Math.round(80 + ratio * 150)
  const b = Math.round(50 + ratio * 68)
  const a = 0.2 + ratio * 0.8
  return `rgba(${r},${g},${b},${a})`
}

// ── Heatmap component ───────────────────────────────────────────────────────
function PostingHeatmap({ posts }) {
  const [metric, setMetric] = useState('er') // 'er' | 'count'
  const [hoveredCell, setHoveredCell] = useState(null) // {dow, hour}

  // Build 7×24 grid
  const grid = useMemo(() => {
    const g = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ posts: [], erSum: 0 }))
    )
    posts.forEach(p => {
      const d = new Date(p.postDate)
      if (isNaN(d)) return
      const dow  = d.getUTCDay()
      const hour = d.getUTCHours()
      g[dow][hour].posts.push(p)
      g[dow][hour].erSum += er(p)
    })
    return g.map(row => row.map(cell => ({
      count: cell.posts.length,
      avgER: cell.posts.length > 0 ? cell.erSum / cell.posts.length : 0,
      posts: cell.posts,
    })))
  }, [posts])

  // Find max for normalization
  const maxCount = useMemo(() => Math.max(...grid.flat().map(c => c.count), 1), [grid])
  const maxER    = useMemo(() => Math.max(...grid.flat().map(c => c.avgER), 0.01), [grid])

  // Best slot
  const bestSlot = useMemo(() => {
    let best = null
    grid.forEach((row, dow) => row.forEach((cell, hour) => {
      if (cell.count < 2) return // need at least 2 posts to be meaningful
      if (!best || cell.avgER > best.avgER) best = { dow, hour, ...cell }
    }))
    return best
  }, [grid])

  const hovered = hoveredCell ? grid[hoveredCell.dow][hoveredCell.hour] : null

  return (
    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: S.surface, border: `1px solid ${S.border}` }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
        <div>
          <span className="text-sm font-semibold" style={{ color: S.text }}>Posting Time Heatmap</span>
          <span className="text-xs ml-2" style={{ color: S.muted }}>UTC — hover a cell for details</span>
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded" style={{ background: S.inner, border: `1px solid ${S.border}` }}>
          {[['er', 'Best ER'], ['count', 'Volume']].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setMetric(k)}
              className="px-3 py-1 text-xs font-medium rounded transition-all"
              style={metric === k
                ? { background: S.accent, color: '#000' }
                : { color: S.muted }
              }
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Best slot callout */}
      {bestSlot && (
        <div className="px-5 py-2.5 flex items-center gap-2" style={{ borderBottom: `1px solid ${S.border}`, background: 'rgba(0,230,118,0.05)' }}>
          <span style={{ color: S.accent, fontSize: 13 }}>★</span>
          <span className="text-xs" style={{ color: S.sub }}>
            Best slot by ER:
          </span>
          <span className="text-xs font-semibold" style={{ color: S.text }}>
            {DAYS_FULL[bestSlot.dow]}s at {String(bestSlot.hour).padStart(2, '0')}:00 UTC
          </span>
          <span className="text-xs" style={{ color: S.accent }}>
            {bestSlot.avgER.toFixed(2)}% avg ER
          </span>
          <span className="text-xs" style={{ color: S.muted }}>
            ({bestSlot.count} posts)
          </span>
        </div>
      )}

      <div className="px-5 py-4 overflow-x-auto">
        {/* Hour labels */}
        <div className="flex mb-1" style={{ marginLeft: 36 }}>
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              style={{ width: 28, flexShrink: 0, textAlign: 'center', fontSize: 10, color: S.muted }}
            >
              {h % 3 === 0 ? `${String(h).padStart(2,'0')}` : ''}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {grid.map((row, dow) => (
          <div key={dow} className="flex items-center mb-1">
            {/* Day label */}
            <div style={{ width: 36, flexShrink: 0, fontSize: 11, color: S.muted, textAlign: 'right', paddingRight: 8 }}>
              {DAYS_SHORT[dow]}
            </div>

            {/* Hour cells */}
            {row.map((cell, hour) => {
              const val   = metric === 'er' ? cell.avgER : cell.count
              const max   = metric === 'er' ? maxER : maxCount
              const ratio = max > 0 ? val / max : 0
              const isHovered = hoveredCell?.dow === dow && hoveredCell?.hour === hour

              return (
                <div
                  key={hour}
                  onMouseEnter={() => setHoveredCell({ dow, hour })}
                  onMouseLeave={() => setHoveredCell(null)}
                  style={{
                    width: 28,
                    height: 22,
                    flexShrink: 0,
                    borderRadius: 3,
                    backgroundColor: cell.count === 0 ? S.inner : heatColor(ratio),
                    border: isHovered ? `1px solid ${S.accent}` : `1px solid transparent`,
                    cursor: cell.count > 0 ? 'pointer' : 'default',
                    transition: 'border-color 0.1s',
                    position: 'relative',
                  }}
                />
              )
            })}
          </div>
        ))}

        {/* Color scale legend */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs" style={{ color: S.muted }}>Low</span>
          <div className="flex gap-0.5">
            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map(r => (
              <div key={r} style={{ width: 20, height: 12, borderRadius: 2, backgroundColor: r === 0 ? S.inner : heatColor(r) }} />
            ))}
          </div>
          <span className="text-xs" style={{ color: S.muted }}>High</span>
          <span className="text-xs ml-4" style={{ color: S.muted }}>
            {metric === 'er' ? 'avg ER %' : 'post count'}
          </span>
        </div>
      </div>

      {/* Hover tooltip panel */}
      {hovered && hoveredCell && (
        <div className="px-5 py-3 flex items-center gap-4" style={{ borderTop: `1px solid ${S.border}`, background: S.inner }}>
          <span className="text-xs font-semibold" style={{ color: S.text }}>
            {DAYS_FULL[hoveredCell.dow]} {String(hoveredCell.hour).padStart(2,'0')}:00–{String(hoveredCell.hour + 1).padStart(2,'0')}:00 UTC
          </span>
          {hovered.count > 0 ? (
            <>
              <span className="text-xs" style={{ color: S.sub }}>{hovered.count} post{hovered.count !== 1 ? 's' : ''}</span>
              <span className="text-xs font-medium" style={{ color: S.accent }}>{hovered.avgER.toFixed(3)}% avg ER</span>
              <span className="text-xs" style={{ color: S.muted }}>
                Top: {hovered.posts.sort((a,b) => er(b)-er(a))[0]?.competitor || '—'}
              </span>
            </>
          ) : (
            <span className="text-xs" style={{ color: S.muted }}>No posts at this time</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Calendar component ──────────────────────────────────────────────────────
export default function CalendarView({ posts, competitors }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [filterCompetitor, setFilterCompetitor] = useState('all')
  const [selectedDay, setSelectedDay] = useState(null)
  const [view, setView] = useState('calendar') // 'calendar' | 'heatmap'

  const filteredPosts = filterCompetitor === 'all'
    ? posts
    : posts.filter(p => p.competitor === filterCompetitor)

  // Group posts by date key
  const postsByDate = useMemo(() => {
    const map = {}
    filteredPosts.forEach(p => {
      const key = toDateKey(p.postDate)
      if (!key) return
      if (!map[key]) map[key] = []
      map[key].push(p)
    })
    return map
  }, [filteredPosts])

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const selectedKey = selectedDay
    ? `${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`
    : null
  const selectedPosts = selectedKey ? (postsByDate[selectedKey] || []) : []

  const selectStyle = {
    backgroundColor: S.surface,
    border: `1px solid ${S.border}`,
    borderRadius: 6,
    padding: '5px 10px',
    fontSize: 12,
    color: S.sub,
    outline: 'none',
    cursor: 'pointer',
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: S.text }}>Activity Calendar</h2>
          <p className="text-xs mt-0.5" style={{ color: S.sub }}>Competitor content logged per day · times in UTC</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center p-0.5 rounded" style={{ background: S.inner, border: `1px solid ${S.border}` }}>
            <button
              onClick={() => setView('calendar')}
              className="px-3 py-1.5 text-xs font-medium rounded transition-all"
              style={view === 'calendar'
                ? { background: 'rgba(0,230,118,0.12)', color: S.accent, border: `1px solid rgba(0,230,118,0.25)` }
                : { color: S.muted }
              }
            >
              Calendar
            </button>
            <button
              onClick={() => setView('heatmap')}
              className="px-3 py-1.5 text-xs font-medium rounded transition-all"
              style={view === 'heatmap'
                ? { background: 'rgba(0,230,118,0.12)', color: S.accent, border: `1px solid rgba(0,230,118,0.25)` }
                : { color: S.muted }
              }
            >
              Heatmap
            </button>
          </div>

          <select
            value={filterCompetitor}
            onChange={e => { setFilterCompetitor(e.target.value); setSelectedDay(null) }}
            style={selectStyle}
          >
            <option value="all">All Competitors</option>
            {competitors.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {view === 'heatmap' ? (
        <PostingHeatmap posts={filteredPosts} />
      ) : (
        <>
          {/* Calendar card */}
          <div className="rounded-lg overflow-hidden" style={{ backgroundColor: S.surface, border: `1px solid ${S.border}` }}>
            {/* Month nav */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
              <button
                onClick={prevMonth}
                className="w-8 h-8 flex items-center justify-center rounded text-sm transition-colors"
                style={{ color: S.sub, backgroundColor: S.inner, border: `1px solid ${S.border}` }}
                onMouseEnter={e => e.currentTarget.style.color = S.text}
                onMouseLeave={e => e.currentTarget.style.color = S.sub}
              >
                ‹
              </button>
              <span className="font-semibold text-sm" style={{ color: S.text }}>{MONTHS[month]} {year}</span>
              <button
                onClick={nextMonth}
                className="w-8 h-8 flex items-center justify-center rounded text-sm transition-colors"
                style={{ color: S.sub, backgroundColor: S.inner, border: `1px solid ${S.border}` }}
                onMouseEnter={e => e.currentTarget.style.color = S.text}
                onMouseLeave={e => e.currentTarget.style.color = S.sub}
              >
                ›
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 px-3 pt-3 pb-1">
              {DAYS_SHORT.map(d => (
                <div key={d} className="text-center text-xs font-medium uppercase tracking-wider py-1" style={{ color: S.muted }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px px-3 pb-3" style={{ backgroundColor: S.border }}>
              {cells.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} style={{ backgroundColor: S.surface, minHeight: 80 }} />

                const dateKey = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                const dayPosts  = postsByDate[dateKey] || []
                const isToday   = dateKey === todayKey
                const isSelected = selectedDay === day
                const uniqueComps = [...new Set(dayPosts.map(p => p.competitor))].slice(0, 4)

                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className="flex flex-col p-1.5 cursor-pointer"
                    style={{
                      backgroundColor: isSelected ? '#2d2d2d' : S.surface,
                      minHeight: 80,
                      outline: isSelected ? `1px solid ${S.accent}` : isToday ? '1px solid #3d3d3d' : 'none',
                      outlineOffset: '-1px',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#2a2a2a' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = S.surface }}
                  >
                    <span
                      className="text-xs font-medium self-end mb-1 w-6 h-6 flex items-center justify-center rounded-full"
                      style={{
                        color: isToday ? '#000' : dayPosts.length > 0 ? S.text : S.muted,
                        backgroundColor: isToday ? S.accent : 'transparent',
                        fontWeight: isToday ? 700 : 500,
                      }}
                    >
                      {day}
                    </span>

                    {uniqueComps.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-auto">
                        {uniqueComps.map(comp => (
                          <div
                            key={comp}
                            className="rounded-sm px-1 py-0.5"
                            style={{
                              backgroundColor: `${COMPETITOR_COLORS[comp] || '#6366f1'}22`,
                              borderLeft: `2px solid ${COMPETITOR_COLORS[comp] || '#6366f1'}`,
                            }}
                            title={comp}
                          >
                            <span className="leading-none" style={{ color: COMPETITOR_COLORS[comp] || '#6366f1', fontSize: 10 }}>
                              {comp}
                            </span>
                          </div>
                        ))}
                        {dayPosts.length > uniqueComps.length && (
                          <span style={{ color: S.muted, fontSize: 10 }}>+{dayPosts.length - uniqueComps.length}</span>
                        )}
                      </div>
                    )}

                    {dayPosts.length > 1 && (
                      <div className="mt-0.5">
                        <span style={{ color: S.muted, fontSize: 10 }}>{dayPosts.length} posts</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Selected day detail */}
          {selectedDay && (
            <div className="mt-4 rounded-lg overflow-hidden" style={{ backgroundColor: S.surface, border: `1px solid ${S.border}` }}>
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${S.border}` }}>
                <span className="font-semibold text-sm" style={{ color: S.text }}>
                  {MONTHS[month]} {selectedDay}, {year}
                </span>
                <span className="text-xs" style={{ color: S.sub }}>
                  {selectedPosts.length} post{selectedPosts.length !== 1 ? 's' : ''}
                </span>
              </div>

              {selectedPosts.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm" style={{ color: S.muted }}>
                  No posts logged for this day
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: S.border }}>
                  {selectedPosts
                    .slice()
                    .sort((a, b) => new Date(a.postDate) - new Date(b.postDate))
                    .map((post, i) => {
                      const compColor = COMPETITOR_COLORS[post.competitor] || '#6366f1'
                      const catColor  = CATEGORY_COLORS[post.category]    || S.muted
                      const d = new Date(post.postDate)
                      const timeStr = isNaN(d)
                        ? ''
                        : `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')} UTC`
                      const postER = er(post)

                      return (
                        <div key={post.id || i} className="px-5 py-3 flex items-start gap-3">
                          <div className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: compColor }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-semibold" style={{ color: compColor }}>
                                {post.competitor}
                              </span>
                              {timeStr && (
                                <span className="text-xs font-mono" style={{ color: S.accent }}>
                                  {timeStr}
                                </span>
                              )}
                              {post.category && (
                                <span
                                  className="inline-block px-1.5 py-0.5 rounded text-xs font-medium"
                                  style={{ backgroundColor: `${catColor}22`, color: catColor }}
                                >
                                  {post.category}
                                </span>
                              )}
                              {post.postUrl && (
                                <a href={post.postUrl} target="_blank" rel="noopener noreferrer"
                                  className="text-xs" style={{ color: '#3b82f6' }}>
                                  ↗ View
                                </a>
                              )}
                            </div>
                            {post.postText && (
                              <p className="text-xs leading-relaxed" style={{ color: S.sub }}>
                                {post.postText.length > 200 ? post.postText.slice(0, 200) + '…' : post.postText}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5 text-xs" style={{ color: S.muted }}>
                              {post.views   > 0 && <span>{post.views.toLocaleString()} views</span>}
                              {post.likes   > 0 && <span>{post.likes.toLocaleString()} likes</span>}
                              {post.retweets > 0 && <span>{post.retweets.toLocaleString()} RTs</span>}
                              {postER > 0 && (
                                <span style={{ color: S.accent, fontWeight: 600 }}>
                                  {postER.toFixed(2)}% ER
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
