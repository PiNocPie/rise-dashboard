import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtNum(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(Math.round(n ?? 0))
}

function er(m) {
  if (!m.views) return 0
  return ((m.likes + m.retweets + m.replies) / m.views) * 100
}

// Simple sentiment: count positive vs negative keywords
const POS_WORDS = ['great','amazing','best','love','bullish','fast','alpha','win','good','nice','solid','perfect','based','gm']
const NEG_WORDS = ['slow','bad','rug','scam','hate','worst','fail','dead','ghost','abandon','dump','fraud','fake']

function sentiment(text) {
  const t = (text || '').toLowerCase()
  const pos = POS_WORDS.filter(w => t.includes(w)).length
  const neg = NEG_WORDS.filter(w => t.includes(w)).length
  if (pos > neg) return 'positive'
  if (neg > pos) return 'negative'
  return 'neutral'
}

const SENT_COLOR = { positive: '#00e676', negative: '#ef4444', neutral: '#6b7280' }
const SENT_BG    = { positive: 'rgba(0,230,118,0.08)', negative: 'rgba(239,68,68,0.08)', neutral: 'rgba(107,114,128,0.08)' }

// ─── design tokens ────────────────────────────────────────────────────────────

const S = {
  surface: '#242424',
  border: '#2d2d2d',
  text: '#e8e8e8',
  sub: '#888888',
  muted: '#555555',
  accent: '#00e676',
}

function Card({ children, style = {} }) {
  return (
    <div
      className="rounded-lg p-5"
      style={{
        background: S.surface,
        border: `1px solid ${S.border}`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function MentionCard({ mention }) {
  const tweetUrl = mention.tweetId
    ? `https://x.com/${mention.authorUsername}/status/${mention.tweetId}`
    : null
  const sent = sentiment(mention.text)
  const erVal = er(mention)
  const erColor = erVal > 2 ? '#00e676' : erVal > 0.5 ? '#f59e0b' : S.sub
  const accountColor = mention.mentionedAccount === 'RISE' ? '#00e676' : '#6366f1'

  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: '#1e1e1e',
        border: `1px solid ${S.border}`,
        borderLeft: `2px solid ${accountColor}`,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold" style={{ color: accountColor }}>
            @{mention.authorUsername || 'unknown'}
          </span>
          {mention.authorName && mention.authorName !== mention.authorUsername && (
            <span className="text-xs" style={{ color: S.muted }}>{mention.authorName}</span>
          )}
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: `${accountColor}18`, color: accountColor }}
          >
            mentions {mention.mentionedAccount}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: SENT_BG[sent], color: SENT_COLOR[sent] }}
          >
            {sent === 'positive' ? '↑ positive' : sent === 'negative' ? '↓ negative' : '— neutral'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs" style={{ color: S.muted }}>
            {new Date(mention.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
          {tweetUrl && (
            <a
              href={tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-2.5 py-1 rounded-lg font-medium"
              style={{ background: `${accountColor}18`, border: `1px solid ${accountColor}30`, color: accountColor }}
            >
              View ↗
            </a>
          )}
        </div>
      </div>

      <p className="text-sm leading-relaxed line-clamp-3 mb-2" style={{ color: S.text }}>
        {mention.text}
      </p>

      {mention.views > 0 && (
        <div className="flex items-center gap-4 text-xs" style={{ color: S.muted }}>
          <span>👁 {fmtNum(mention.views)}</span>
          <span>❤️ {fmtNum(mention.likes)}</span>
          <span>🔁 {fmtNum(mention.retweets)}</span>
          {erVal > 0 && <span style={{ color: erColor, fontWeight: 600 }}>ER {erVal.toFixed(2)}%</span>}
        </div>
      )}
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function Mentions({ dateFrom, dateTo }) {
  const [mentions, setMentions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterAccount, setFilterAccount] = useState('both') // 'both' | 'RISE' | 'RISEx'
  const [sortBy, setSortBy] = useState('date')               // 'date' | 'views' | 'er'

  useEffect(() => {
    const q = query(collection(db, 'mentions'), orderBy('createdAt', 'desc'), limit(200))
    const unsub = onSnapshot(q, snap => {
      setMentions(snap.docs.map(d => ({ ...d.data(), _docId: d.id })))
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const filtered = mentions
    .filter(m => {
      if (filterAccount !== 'both' && m.mentionedAccount !== filterAccount) return false
      const t = new Date(m.createdAt).getTime()
      if (dateFrom && t < new Date(dateFrom).getTime()) return false
      if (dateTo) {
        const to = new Date(dateTo)
        to.setSeconds(59, 999)
        if (t > to.getTime()) return false
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'views') return (b.views || 0) - (a.views || 0)
      if (sortBy === 'er') return er(b) - er(a)
      return new Date(b.createdAt) - new Date(a.createdAt)
    })

  // Stats
  const riseCount  = mentions.filter(m => m.mentionedAccount === 'RISE').length
  const risexCount = mentions.filter(m => m.mentionedAccount === 'RISEx').length
  const posCount   = filtered.filter(m => sentiment(m.text) === 'positive').length
  const negCount   = filtered.filter(m => sentiment(m.text) === 'negative').length
  const sentRatio  = filtered.length ? Math.round((posCount / filtered.length) * 100) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: S.muted }}>Loading mentions…</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold mb-1" style={{ color: S.text }}>
          Mentions & Sentiment
        </h2>
        <p className="text-xs" style={{ color: S.muted }}>
          How people talk about RISE outside your own channels — organic buzz & objections
        </p>
      </div>

      {mentions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-56 gap-3">
          <div className="text-5xl">📡</div>
          <div className="text-base font-bold" style={{ color: S.text }}>No mentions synced yet</div>
          <div className="text-xs max-w-sm text-center leading-relaxed" style={{ color: S.muted }}>
            The daily cron will search Twitter for @risechain and @risextrade mentions.
            Trigger a manual sync to fetch the first batch.
          </div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <Card>
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: S.muted }}>RISE Mentions</div>
              <div className="text-3xl font-bold" style={{ color: '#00e676' }}>{riseCount}</div>
            </Card>
            <Card>
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: S.muted }}>RISEx Mentions</div>
              <div className="text-3xl font-bold" style={{ color: '#6366f1' }}>{risexCount}</div>
            </Card>
            <Card>
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: S.muted }}>Sentiment Score</div>
              <div className="text-3xl font-bold" style={{ color: sentRatio > 60 ? '#00e676' : sentRatio > 40 ? '#f59e0b' : '#ef4444' }}>
                {sentRatio}%
              </div>
              <div className="text-xs mt-1" style={{ color: S.sub }}>positive of {filtered.length}</div>
            </Card>
            <Card>
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: S.muted }}>Negative Flags</div>
              <div className="text-3xl font-bold" style={{ color: negCount > 0 ? '#ef4444' : '#00e676' }}>{negCount}</div>
              <div className="text-xs mt-1" style={{ color: S.sub }}>need attention</div>
            </Card>
          </div>

          {/* Filters + sort */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {[['both', 'All'], ['RISE', 'RISE'], ['RISEx', 'RISEx']].map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setFilterAccount(k)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                  style={
                    filterAccount === k
                      ? { background: 'rgba(0,230,118,0.1)', color: S.accent, border: '1px solid rgba(0,230,118,0.25)' }
                      : { color: S.muted, border: `1px solid ${S.border}` }
                  }
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              {[['date', 'Latest'], ['views', 'Most Views'], ['er', 'Best ER']].map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setSortBy(k)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                  style={
                    sortBy === k
                      ? { background: '#2a2a2a', color: S.text, border: `1px solid ${S.border}` }
                      : { color: S.muted, border: '1px solid transparent' }
                  }
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Feed */}
          <div className="flex flex-col gap-3">
            {filtered.length === 0 ? (
              <div className="text-xs text-center py-8" style={{ color: S.muted }}>
                No mentions match the selected filters
              </div>
            ) : (
              filtered.map((m, i) => <MentionCard key={m._docId || i} mention={m} />)
            )}
          </div>
        </>
      )}
    </div>
  )
}
