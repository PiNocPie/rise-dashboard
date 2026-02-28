import { useState, useMemo } from 'react'
import { COMPETITOR_COLORS, CATEGORY_COLORS } from '../data/constants'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

function toDateKey(dateStr) {
  // Normalize "2025-01-15" → "2025-01-15"
  return dateStr?.slice(0, 10) || ''
}

export default function CalendarView({ posts, competitors }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [filterCompetitor, setFilterCompetitor] = useState('all')
  const [selectedDay, setSelectedDay] = useState(null)

  // Group posts by date key
  const postsByDate = useMemo(() => {
    const map = {}
    const filtered = filterCompetitor === 'all'
      ? posts
      : posts.filter(p => p.competitor === filterCompetitor)
    filtered.forEach(p => {
      const key = toDateKey(p.postDate)
      if (!key) return
      if (!map[key]) map[key] = []
      map[key].push(p)
    })
    return map
  }, [posts, filterCompetitor])

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
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const selectedKey = selectedDay
    ? `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    : null
  const selectedPosts = selectedKey ? (postsByDate[selectedKey] || []) : []

  const selectStyle = {
    backgroundColor: '#242424',
    border: '1px solid #2d2d2d',
    borderRadius: '8px',
    padding: '6px 10px',
    fontSize: '13px',
    color: '#888888',
    outline: 'none',
    cursor: 'pointer',
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Activity Calendar</h2>
          <p className="text-sm mt-0.5" style={{ color: '#888888' }}>
            Competitor content logged per day
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Calendar card */}
      <div className="rounded-lg overflow-hidden" style={{ backgroundColor: '#242424', border: '1px solid #2d2d2d' }}>
        {/* Month nav */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #2d2d2d' }}>
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors"
            style={{ color: '#888888', backgroundColor: '#1e1e1e', border: '1px solid #2d2d2d' }}
            onMouseEnter={e => e.currentTarget.style.color = '#e8e8e8'}
            onMouseLeave={e => e.currentTarget.style.color = '#888888'}
          >
            ‹
          </button>
          <span className="font-semibold text-white">
            {MONTHS[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors"
            style={{ color: '#888888', backgroundColor: '#1e1e1e', border: '1px solid #2d2d2d' }}
            onMouseEnter={e => e.currentTarget.style.color = '#e8e8e8'}
            onMouseLeave={e => e.currentTarget.style.color = '#888888'}
          >
            ›
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 px-3 pt-3 pb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-xs font-medium uppercase tracking-wider py-1" style={{ color: '#555555' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px px-3 pb-3" style={{ backgroundColor: '#2d2d2d' }}>
          {cells.map((day, i) => {
            if (!day) {
              return <div key={`empty-${i}`} style={{ backgroundColor: '#242424', minHeight: 80 }} />
            }
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayPosts = postsByDate[dateKey] || []
            const isToday = dateKey === todayKey
            const isSelected = selectedDay === day
            const hasPost = dayPosts.length > 0

            // Get unique competitors for dot display (max 4)
            const uniqueComps = [...new Set(dayPosts.map(p => p.competitor))].slice(0, 4)

            return (
              <div
                key={day}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className="flex flex-col p-1.5 cursor-pointer transition-all"
                style={{
                  backgroundColor: isSelected ? '#2d2d2d' : '#242424',
                  minHeight: 80,
                  outline: isSelected ? '1px solid #00e676' : isToday ? '1px solid #3d3d3d' : 'none',
                  outlineOffset: '-1px',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#2a2a2a' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#242424' }}
              >
                <span
                  className="text-xs font-medium self-end mb-1 w-6 h-6 flex items-center justify-center rounded-full"
                  style={{
                    color: isToday ? '#000' : hasPost ? '#e8e8e8' : '#555555',
                    backgroundColor: isToday ? '#00e676' : 'transparent',
                    fontWeight: isToday ? 700 : 500,
                  }}
                >
                  {day}
                </span>

                {/* Competitor dots */}
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
                        <span className="text-xs leading-none" style={{ color: COMPETITOR_COLORS[comp] || '#6366f1', fontSize: 10 }}>
                          {comp}
                        </span>
                      </div>
                    ))}
                    {dayPosts.length > uniqueComps.length && (
                      <span className="text-xs" style={{ color: '#555555', fontSize: 10 }}>+{dayPosts.length - uniqueComps.length}</span>
                    )}
                  </div>
                )}

                {/* Post count badge */}
                {dayPosts.length > 1 && (
                  <div className="mt-0.5">
                    <span className="text-xs" style={{ color: '#555555', fontSize: 10 }}>
                      {dayPosts.length} posts
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected day detail panel */}
      {selectedDay && (
        <div className="mt-4 rounded-lg overflow-hidden" style={{ backgroundColor: '#242424', border: '1px solid #2d2d2d' }}>
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #2d2d2d' }}>
            <span className="font-semibold text-white text-sm">
              {MONTHS[month]} {selectedDay}, {year}
            </span>
            <span className="text-xs" style={{ color: '#888888' }}>
              {selectedPosts.length} post{selectedPosts.length !== 1 ? 's' : ''}
            </span>
          </div>

          {selectedPosts.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm" style={{ color: '#555555' }}>
              No posts logged for this day
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#2d2d2d' }}>
              {selectedPosts.map((post, i) => {
                const compColor = COMPETITOR_COLORS[post.competitor] || '#6366f1'
                const catColor = CATEGORY_COLORS[post.category] || '#555555'
                return (
                  <div key={post.id || i} className="px-5 py-3 flex items-start gap-3">
                    <div className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: compColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-semibold" style={{ color: compColor }}>
                          {post.competitor}
                        </span>
                        {post.category && (
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-xs font-medium"
                            style={{ backgroundColor: `${catColor}22`, color: catColor }}
                          >
                            {post.category}
                          </span>
                        )}
                        {post.postUrl && (
                          <a
                            href={post.postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs"
                            style={{ color: '#3b82f6' }}
                          >
                            ↗ View
                          </a>
                        )}
                      </div>
                      {post.postText && (
                        <p className="text-xs leading-relaxed" style={{ color: '#888888' }}>
                          {post.postText.length > 200 ? post.postText.slice(0, 200) + '…' : post.postText}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-xs" style={{ color: '#555555' }}>
                        {post.views > 0 && <span>{post.views.toLocaleString()} views</span>}
                        {post.likes > 0 && <span>{post.likes.toLocaleString()} likes</span>}
                        {post.retweets > 0 && <span>{post.retweets.toLocaleString()} RTs</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
