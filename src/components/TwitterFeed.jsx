import { useState } from 'react'
import { db } from '../firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { COMPETITOR_COLORS, COMPETITOR_TWITTER } from '../data/constants'
import { CATEGORY_COLORS } from '../data/constants'

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

function TweetCard({ post, isLoggedIn }) {
  const [note, setNote] = useState(post.teamNote || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const color = COMPETITOR_COLORS[post.competitor] || '#6366f1'
  const twitterUrl = COMPETITOR_TWITTER[post.competitor]
  const catColor = CATEGORY_COLORS[post.category] || '#4b5563'

  const saveNote = async () => {
    if (!post._docId) return
    setSaving(true)
    await updateDoc(doc(db, 'posts', post._docId), { teamNote: note })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ backgroundColor: '#11111e', border: '1px solid #1a1a2e' }}>
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
        <span className="ml-auto text-xs" style={{ color: '#4b5563' }}>{fmtDate(post.postDate)}</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${catColor}22`, color: catColor, border: `1px solid ${catColor}44` }}>
          {post.category}
        </span>
      </div>

      {/* Tweet text */}
      <p className="text-sm leading-relaxed" style={{ color: '#d1d5db' }}>{post.postText}</p>

      {/* Metrics */}
      <div className="flex items-center gap-4">
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

export default function TwitterFeed({ posts, competitors, isLoggedIn }) {
  const [selectedCompetitor, setSelectedCompetitor] = useState('All')

  // Only show auto-logged tweets, newest first
  const feedPosts = posts
    .filter(p => p.autoLogged && p.postText)
    .filter(p => selectedCompetitor === 'All' || p.competitor === selectedCompetitor)
    .sort((a, b) => new Date(b.postDate) - new Date(a.postDate))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Twitter Updates</h2>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>
            Auto-synced tweets — {feedPosts.length} posts
            {!isLoggedIn && <span className="ml-2" style={{ color: '#4b5563' }}>· Login to add notes</span>}
          </p>
        </div>
      </div>

      {/* Competitor filter chips */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
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

      {feedPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="text-4xl">🐦</div>
          <p className="text-sm" style={{ color: '#4b5563' }}>No auto-synced tweets yet. The cron runs daily at 8am Vietnam time.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {feedPosts.map(p => (
            <TweetCard key={p.id} post={p} isLoggedIn={isLoggedIn} />
          ))}
        </div>
      )}
    </div>
  )
}
