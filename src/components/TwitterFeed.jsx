import { useState, useMemo } from 'react'
import { db } from '../firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { COMPETITOR_COLORS, COMPETITOR_TWITTER, COMPETITOR_TWITTER_USERNAMES } from '../data/constants'
import { CATEGORY_COLORS, CONTENT_CATEGORIES } from '../data/constants'

function fmtNum(n) {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function fmtDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function engRate(post) {
  if (!post.views) return null
  return (((post.likes + post.retweets + post.replies) / post.views) * 100).toFixed(2)
}

function TweetCard({ post, isLoggedIn, isViral }) {
  const [note, setNote] = useState(post.teamNote || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const color = COMPETITOR_COLORS[post.competitor] || '#6366f1'
  const twitterUrl = COMPETITOR_TWITTER[post.competitor]
  const catColor = CATEGORY_COLORS[post.category] || '#4b5563'
  const er = engRate(post)

  const username = COMPETITOR_TWITTER_USERNAMES[post.competitor]
  const tweetUrl = post.tweetId && username
    ? `https://x.com/${username}/status/${post.tweetId}`
    : null

  const saveNote = async () => {
    if (!post._docId) return
    setSaving(true)
    await updateDoc(doc(db, 'posts', post._docId), { teamNote: note })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ backgroundColor: '#11111e', border: `1px solid ${isViral ? '#00e67644' : '#1a1a2e'}` }}>
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="font-bold text-white text-sm">{post.competitor}</span>
        {twitterUrl && (
          <a href={twitterUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ color: '#6b7280', border: '1px solid #1a1a2e' }}
          >
            @{twitterUrl.split('/').pop()}
          </a>
        )}
        {post.isThread && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#14b8a622', color: '#14b8a6', border: '1px solid #14b8a644' }}>
            🧵 Thread · {post.threadCount} tweets
          </span>
        )}
        {isViral && (
          <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: '#00e67622', color: '#00e676', border: '1px solid #00e67644' }}>
            🔥 Viral
          </span>
        )}
        <span className="ml-auto text-xs" style={{ color: '#4b5563' }}>{fmtDate(post.postDate)}</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${catColor}22`, color: catColor, border: `1px solid ${catColor}44` }}>
          {post.category}
        </span>
      </div>

      {/* Tweet text */}
      <p className="text-sm leading-relaxed" style={{ color: '#d1d5db' }}>{post.postText}</p>

      {/* Metrics row */}
      <div className="flex items-center gap-4 flex-wrap">
        {[
          { label: 'Views', val: post.views },
          { label: 'Likes', val: post.likes },
          { label: 'Retweets', val: post.retweets },
          { label: 'Replies', val: post.replies },
        ].map(({ label, val }) => (
          <div key={label} className="flex flex-col items-center">
            <span className="text-sm font-bold text-white">{fmtNum(val)}</span>
            <span className="text-xs" style={{ color: '#4b5563' }}>{label}</span>
          </div>
        ))}
        {er !== null && (
          <div className="flex flex-col items-center">
            <span className="text-sm font-bold" style={{ color: '#00e676' }}>{er}%</span>
            <span className="text-xs" style={{ color: '#4b5563' }}>Eng. Rate</span>
          </div>
        )}
        {tweetUrl && (
          <a
            href={tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs px-2.5 py-1 rounded-lg font-medium"
            style={{ backgroundColor: '#1a1a2e', color: '#9ca3af', border: '1px solid #2a2a3e' }}
          >
            View Tweet ↗
          </a>
        )}
      </div>

      {/* Team notes */}
      <div className="flex flex-col gap-1.5">
        <div className="text-xs font-medium uppercase tracking-wider" style={{ color: '#4b5563' }}>Team Notes</div>
        <textarea
          value={note}
          onChange={e => { setNote(e.target.value); setSaved(false) }}
          placeholder="Summarise this tweet, add context, or note what we can learn from it…"
          rows={2}
          disabled={!isLoggedIn}
          className="w-full px-3 py-2 rounded-lg text-xs resize-none"
          style={{
            backgroundColor: '#0a0a12',
            border: '1px solid #1a1a2e',
            color: '#e2e8f0',
            outline: 'none',
            opacity: isLoggedIn ? 1 : 0.5,
          }}
        />
        {isLoggedIn && (
          <div className="flex items-center gap-2 justify-end">
            {saved && <span className="text-xs" style={{ color: '#00e676' }}>Saved</span>}
            <button
              onClick={saveNote}
              disabled={saving}
              className="px-3 py-1 text-xs font-medium rounded-lg"
              style={{ backgroundColor: '#00e676', color: '#000', opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Saving…' : 'Save Note'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest' },
  { id: 'views', label: 'Most Viewed' },
  { id: 'likes', label: 'Most Liked' },
  { id: 'er', label: 'Highest ER' },
]

export default function TwitterFeed({ posts, competitors, isLoggedIn }) {
  const [selectedCompetitor, setSelectedCompetitor] = useState('All')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [sortBy, setSortBy] = useState('newest')
  const [search, setSearch] = useState('')

  // Filter: auto-logged, has text, not a reply (text starting with @)
  const basePosts = posts.filter(p =>
    p.autoLogged && p.postText && !p.postText.trim().startsWith('@')
  )

  // Top 10% by views = viral
  const viralThreshold = useMemo(() => {
    const sorted = basePosts.map(p => p.views || 0).sort((a, b) => b - a)
    return sorted[Math.floor(sorted.length * 0.1)] || 0
  }, [basePosts])

  // Only show categories that actually exist in the data
  const activeCategories = useMemo(() => {
    const seen = new Set(basePosts.map(p => p.category).filter(Boolean))
    return CONTENT_CATEGORIES.filter(c => seen.has(c))
  }, [basePosts])

  const feedPosts = useMemo(() => {
    let filtered = basePosts
    if (selectedCompetitor !== 'All') filtered = filtered.filter(p => p.competitor === selectedCompetitor)
    if (selectedCategory !== 'All') filtered = filtered.filter(p => p.category === selectedCategory)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      filtered = filtered.filter(p =>
        p.postText?.toLowerCase().includes(q) || p.competitor?.toLowerCase().includes(q)
      )
    }
    switch (sortBy) {
      case 'views': return [...filtered].sort((a, b) => (b.views || 0) - (a.views || 0))
      case 'likes': return [...filtered].sort((a, b) => (b.likes || 0) - (a.likes || 0))
      case 'er': return [...filtered].sort((a, b) => {
        const erA = a.views ? (a.likes + a.retweets + a.replies) / a.views : 0
        const erB = b.views ? (b.likes + b.retweets + b.replies) / b.views : 0
        return erB - erA
      })
      default: return [...filtered].sort((a, b) => new Date(b.postDate) - new Date(a.postDate))
    }
  }, [basePosts, selectedCompetitor, selectedCategory, sortBy, search])

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Competitor Updates</h2>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>
            Auto-synced tweets · {feedPosts.length} showing
            {!isLoggedIn && <span className="ml-2" style={{ color: '#4b5563' }}>· Login to add notes</span>}
          </p>
        </div>
        {/* Sort */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setSortBy(opt.id)}
              className="px-3 py-1 text-xs font-medium rounded-full transition-all"
              style={sortBy === opt.id
                ? { backgroundColor: '#00e676', color: '#000' }
                : { border: '1px solid #1a1a2e', color: '#6b7280' }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search tweet content or competitor…"
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{ backgroundColor: '#11111e', border: '1px solid #1a1a2e', color: '#e2e8f0', outline: 'none' }}
        />
      </div>

      {/* Competitor filter */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {['All', ...competitors].map(c => {
          const active = selectedCompetitor === c
          const color = COMPETITOR_COLORS[c] || '#6366f1'
          return (
            <button
              key={c}
              onClick={() => setSelectedCompetitor(c)}
              className="px-3 py-1 text-xs font-medium rounded-full transition-all"
              style={active
                ? { backgroundColor: c === 'All' ? '#00e676' : color, color: '#000' }
                : { border: '1px solid #1a1a2e', color: '#6b7280' }
              }
            >
              {c}
            </button>
          )
        })}
      </div>

      {/* Category filter */}
      {activeCategories.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-6">
          {['All', ...activeCategories].map(cat => {
            const active = selectedCategory === cat
            const color = CATEGORY_COLORS[cat] || '#6b7280'
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className="px-2.5 py-0.5 text-xs font-medium rounded-full transition-all"
                style={active
                  ? { backgroundColor: cat === 'All' ? '#6b7280' : color, color: '#000' }
                  : { border: `1px solid ${color}55`, color: color }
                }
              >
                {cat}
              </button>
            )
          })}
        </div>
      )}

      {feedPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="text-4xl">🐦</div>
          <p className="text-sm" style={{ color: '#4b5563' }}>
            {search || selectedCompetitor !== 'All' || selectedCategory !== 'All'
              ? 'No tweets match your filters.'
              : 'No auto-synced tweets yet. The cron runs daily at 8am Vietnam time.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {feedPosts.map(p => (
            <TweetCard
              key={p.id}
              post={p}
              isLoggedIn={isLoggedIn}
              isViral={viralThreshold > 0 && (p.views || 0) >= viralThreshold}
            />
          ))}
        </div>
      )}
    </div>
  )
}
