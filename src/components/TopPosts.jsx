import { useState, useMemo } from 'react'
import { CONTENT_CATEGORIES, COMPETITOR_COLORS, CATEGORY_COLORS } from '../data/constants'

function engRate(post) {
  if (!post.views) return 0
  return ((post.likes + post.retweets + post.replies) / post.views) * 100
}

function fmtNum(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

const SORT_OPTIONS = [
  { value: 'views', label: 'Views' },
  { value: 'er', label: 'Eng. Rate' },
  { value: 'likes', label: 'Likes' },
  { value: 'retweets', label: 'Retweets' },
  { value: 'postDate', label: 'Date' },
]

function SortBtn({ field, current, dir, onClick, children }) {
  const active = current === field
  return (
    <button
      onClick={() => onClick(field)}
      className="flex items-center gap-1 text-xs font-medium transition-colors"
      style={{ color: active ? '#00e676' : '#6b7280' }}
    >
      {children}
      {active && <span style={{ fontSize: 9 }}>{dir === 'desc' ? '▼' : '▲'}</span>}
    </button>
  )
}

export default function TopPosts({ posts, allCompetitors, onDeletePost, isLoggedIn }) {
  const [sortField, setSortField] = useState('views')
  const [sortDir, setSortDir] = useState('desc')
  const [filterCompetitor, setFilterCompetitor] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const processed = useMemo(() => {
    let filtered = posts.map(p => ({ ...p, _er: engRate(p) }))

    if (filterCompetitor !== 'all') {
      filtered = filtered.filter(p => p.competitor === filterCompetitor)
    }
    if (filterCategory !== 'all') {
      filtered = filtered.filter(p => p.category === filterCategory)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter(p =>
        p.postText?.toLowerCase().includes(q) ||
        p.competitor?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      )
    }

    filtered.sort((a, b) => {
      let aVal, bVal
      if (sortField === 'er') {
        aVal = a._er; bVal = b._er
      } else if (sortField === 'postDate') {
        aVal = new Date(a.postDate).getTime() || 0
        bVal = new Date(b.postDate).getTime() || 0
      } else {
        aVal = Number(a[sortField]) || 0
        bVal = Number(b[sortField]) || 0
      }
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal
    })

    return filtered
  }, [posts, filterCompetitor, filterCategory, search, sortField, sortDir])

  const usedCategories = useMemo(() => {
    const cats = new Set(posts.map(p => p.category).filter(Boolean))
    return CONTENT_CATEGORIES.filter(c => cats.has(c))
  }, [posts])

  const selectStyle = {
    backgroundColor: '#11111e',
    border: '1px solid #1a1a2e',
    borderRadius: '8px',
    padding: '7px 10px',
    fontSize: '13px',
    color: '#9ca3af',
    outline: 'none',
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">All Posts</h2>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>
            {processed.length} of {posts.length} posts
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search posts…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...selectStyle, minWidth: 160 }}
          />
          <select value={filterCompetitor} onChange={e => setFilterCompetitor(e.target.value)} style={selectStyle}>
            <option value="all">All Competitors</option>
            {allCompetitors.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={selectStyle}>
            <option value="all">All Categories</option>
            {usedCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Sort bar */}
      <div
        className="flex items-center gap-4 px-4 py-2.5 rounded-t-xl text-xs"
        style={{ backgroundColor: '#0d0d1a', border: '1px solid #1a1a2e', borderBottom: 'none' }}
      >
        <span style={{ color: '#374151', marginRight: 4 }}>Sort by:</span>
        {SORT_OPTIONS.map(opt => (
          <SortBtn key={opt.value} field={opt.value} current={sortField} dir={sortDir} onClick={handleSort}>
            {opt.label}
          </SortBtn>
        ))}
      </div>

      {/* Table */}
      {processed.length === 0 ? (
        <div
          className="flex items-center justify-center py-16 rounded-b-xl text-sm"
          style={{ backgroundColor: '#11111e', border: '1px solid #1a1a2e', color: '#374151' }}
        >
          {posts.length === 0 ? 'No posts logged yet.' : 'No posts match the current filters.'}
        </div>
      ) : (
        <div className="rounded-b-xl overflow-hidden" style={{ border: '1px solid #1a1a2e' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#11111e', borderBottom: '1px solid #1a1a2e' }}>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#4b5563', width: 90 }}>Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#4b5563', width: 110 }}>Competitor</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#4b5563' }}>Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#4b5563' }}>Post</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: '#4b5563', width: 80 }}>Views</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: '#4b5563', width: 70 }}>Likes</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: '#4b5563', width: 70 }}>RTs</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: '#4b5563', width: 80 }}>ER %</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: '#4b5563', width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {processed.map((post, i) => {
                const isExpanded = expandedId === post.id
                const catColor = CATEGORY_COLORS[post.category] || '#4b5563'
                const compColor = COMPETITOR_COLORS[post.competitor] || '#6366f1'
                return (
                  <tr
                    key={post.id}
                    style={{
                      backgroundColor: i % 2 === 0 ? '#11111e' : '#0f0f1b',
                      borderTop: '1px solid #1a1a2e',
                    }}
                  >
                    <td className="px-4 py-3 text-xs tabular-nums" style={{ color: '#6b7280' }}>
                      {post.postDate || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: compColor }} />
                        <span className="font-medium text-xs" style={{ color: '#e2e8f0' }}>{post.competitor}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {post.category && (
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: `${catColor}22`, color: catColor }}
                        >
                          {post.category}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {post.postText ? (
                        <div>
                          <p
                            className="text-xs leading-relaxed cursor-pointer"
                            style={{ color: '#9ca3af' }}
                            onClick={() => setExpandedId(isExpanded ? null : post.id)}
                          >
                            {isExpanded
                              ? post.postText
                              : post.postText.length > 80
                                ? post.postText.slice(0, 80) + '…'
                                : post.postText}
                          </p>
                          {post.postUrl && (
                            <a
                              href={post.postUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs mt-0.5 inline-block"
                              style={{ color: '#3b82f6' }}
                            >
                              ↗ View post
                            </a>
                          )}
                        </div>
                      ) : post.postUrl ? (
                        <a
                          href={post.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs"
                          style={{ color: '#3b82f6' }}
                        >
                          ↗ View post
                        </a>
                      ) : (
                        <span style={{ color: '#374151' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums font-medium" style={{ color: '#e2e8f0' }}>
                      {fmtNum(post.views)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums" style={{ color: '#9ca3af' }}>
                      {fmtNum(post.likes)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums" style={{ color: '#9ca3af' }}>
                      {fmtNum(post.retweets)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums font-semibold" style={{ color: '#00e676' }}>
                      {post._er > 0 ? `${post._er.toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isLoggedIn && (confirmDelete === post.id ? (
                        <div className="flex items-center gap-1.5 justify-center">
                          <button
                            onClick={() => { onDeletePost(post.id); setConfirmDelete(null) }}
                            className="text-xs px-2 py-0.5 rounded font-medium"
                            style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171' }}
                          >
                            Del
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ color: '#4b5563' }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(post.id)}
                          className="text-xs transition-colors"
                          style={{ color: '#374151' }}
                          onMouseEnter={e => (e.target.style.color = '#f87171')}
                          onMouseLeave={e => (e.target.style.color = '#374151')}
                        >
                          ✕
                        </button>
                      ))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
