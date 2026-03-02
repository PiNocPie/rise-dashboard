import { useState, useEffect, useMemo } from 'react'
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

function kolTier(followers) {
  if (followers >= 100_000) return { label: '100k+', color: '#f59e0b' }
  if (followers >= 50_000)  return { label: '50k+',  color: '#f59e0b' }
  if (followers >= 10_000)  return { label: '10k+',  color: '#888888' }
  return null
}

const SENT_COLOR = { positive: '#00e676', negative: '#ef4444', neutral: '#555555' }
const SENT_BG    = { positive: 'rgba(0,230,118,0.08)', negative: 'rgba(239,68,68,0.08)', neutral: 'rgba(255,255,255,0.04)' }

const MIN_FOLLOWERS_OPTIONS = [
  { k: 'all',  l: 'All',    min: 0 },
  { k: '1k',   l: '1k+',   min: 1_000 },
  { k: '10k',  l: '10k+',  min: 10_000 },
  { k: '50k',  l: '50k+',  min: 50_000 },
  { k: '100k', l: '100k+', min: 100_000 },
]

// ─── design tokens ────────────────────────────────────────────────────────────

const S = {
  surface: '#242424',
  inner:   '#1e1e1e',
  border:  '#2d2d2d',
  text:    '#e8e8e8',
  sub:     '#888888',
  muted:   '#555555',
  accent:  '#00e676',
}

function Card({ children, style = {} }) {
  return (
    <div className="rounded-lg p-5" style={{ background: S.surface, border: `1px solid ${S.border}`, ...style }}>
      {children}
    </div>
  )
}

// ─── mention card ─────────────────────────────────────────────────────────────

function MentionCard({ mention }) {
  const tweetUrl    = mention.tweetId
    ? `https://x.com/${mention.authorUsername}/status/${mention.tweetId}`
    : null
  const profileUrl  = mention.authorUsername
    ? `https://x.com/${mention.authorUsername}`
    : null
  const sent        = sentiment(mention.text)
  const erVal       = er(mention)
  const erColor     = erVal > 2 ? S.accent : erVal > 0.5 ? '#f59e0b' : S.muted
  const accountColor = mention.mentionedAccount === 'RISE' ? S.accent : '#6366f1'
  const followers   = mention.authorFollowers || 0
  const tier        = kolTier(followers)
  // isReply: use API field if available, fall back to text heuristic
  const isReply = mention.isReply ?? /^@\w/.test((mention.text || '').trimStart())

  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: S.inner,
        border: `1px solid ${S.border}`,
        borderLeft: `2px solid ${accountColor}`,
      }}
    >
      {/* Author row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {/* Author name + profile link */}
          <a
            href={profileUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold hover:underline"
            style={{ color: accountColor }}
          >
            @{mention.authorUsername || 'unknown'}
          </a>
          {mention.authorName && mention.authorName !== mention.authorUsername && (
            <span className="text-xs" style={{ color: S.muted }}>{mention.authorName}</span>
          )}

          {/* Follower count */}
          {followers > 0 && (
            <span className="text-xs" style={{ color: S.sub }}>
              {fmtNum(followers)} followers
            </span>
          )}

          {/* KOL tier badge */}
          {tier && (
            <span
              className="text-xs px-1.5 py-0.5 rounded font-semibold"
              style={{ background: `${tier.color}18`, color: tier.color, border: `1px solid ${tier.color}30` }}
            >
              KOL {tier.label}
            </span>
          )}

          {/* Mentioned account tag */}
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: `${accountColor}14`, color: accountColor }}
          >
            {mention.mentionedAccount}
          </span>

          {/* Reply vs Tweet */}
          <span
            className="text-xs px-2 py-0.5 rounded font-medium"
            style={{
              background: isReply ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.05)',
              color: isReply ? '#818cf8' : S.muted,
              border: `1px solid ${isReply ? 'rgba(99,102,241,0.2)' : S.border}`,
            }}
          >
            {isReply ? '↩ reply' : '✦ tweet'}
          </span>

          {/* Sentiment */}
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: SENT_BG[sent], color: SENT_COLOR[sent] }}
          >
            {sent === 'positive' ? '↑ pos' : sent === 'negative' ? '↓ neg' : '— neu'}
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
              className="text-xs px-2.5 py-1 rounded font-medium"
              style={{ background: `${accountColor}14`, border: `1px solid ${accountColor}25`, color: accountColor }}
            >
              View ↗
            </a>
          )}
        </div>
      </div>

      {/* Tweet text */}
      <p className="text-sm leading-relaxed line-clamp-3 mb-2" style={{ color: S.text }}>
        {mention.text}
      </p>

      {/* Metrics */}
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

// ─── top accounts to engage ──────────────────────────────────────────────────

function TopAccountsPanel({ mentions }) {
  // Dedupe by author, keep highest follower snapshot, count their mentions
  const accounts = useMemo(() => {
    const map = {}
    mentions.forEach(m => {
      const u = m.authorUsername
      if (!u) return
      if (!map[u]) map[u] = { username: u, name: m.authorName, followers: 0, count: 0, erSum: 0, posCount: 0, bestMention: null }
      map[u].followers = Math.max(map[u].followers, m.authorFollowers || 0)
      map[u].count++
      map[u].erSum += er(m)
      if (sentiment(m.text) === 'positive') map[u].posCount++
      // Track best mention by views
      if (!map[u].bestMention || (m.views || 0) > (map[u].bestMention.views || 0)) {
        map[u].bestMention = m
      }
    })
    return Object.values(map)
      .filter(a => a.followers >= 1000)
      .sort((a, b) => b.followers - a.followers)
      .slice(0, 8)
  }, [mentions])

  if (accounts.length === 0) return null

  return (
    <Card>
      <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: S.muted }}>
        Top Accounts to Engage
      </div>
      <div className="flex flex-col gap-2">
        {accounts.map((a, i) => {
          const tier = kolTier(a.followers)
          const avgER = a.count > 0 ? (a.erSum / a.count).toFixed(2) : '—'
          const sentimentPct = a.count > 0 ? Math.round((a.posCount / a.count) * 100) : 0
          return (
            <div
              key={a.username}
              className="py-2 px-3 rounded"
              style={{ background: S.inner, border: `1px solid ${S.border}` }}
            >
              {/* Row 1: account info + engage */}
              <div className="flex items-center gap-3">
                <span className="text-xs w-4 flex-shrink-0" style={{ color: S.muted }}>{i + 1}</span>
                <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                  <a
                    href={`https://x.com/${a.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold hover:underline"
                    style={{ color: S.accent }}
                  >
                    @{a.username}
                  </a>
                  {tier && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-semibold"
                      style={{ background: `${tier.color}18`, color: tier.color }}
                    >
                      {tier.label}
                    </span>
                  )}
                  <span className="text-xs" style={{ color: S.muted }}>{fmtNum(a.followers)} followers</span>
                </div>
                <div className="flex items-center gap-3 text-xs shrink-0">
                  <span style={{ color: S.sub }}>{a.count} mention{a.count !== 1 ? 's' : ''}</span>
                  <span style={{ color: sentimentPct > 50 ? S.accent : S.muted }}>{sentimentPct}% pos</span>
                  <a
                    href={a.bestMention?.tweetId
                      ? `https://x.com/${a.username}/status/${a.bestMention.tweetId}`
                      : `https://x.com/${a.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded text-xs font-medium"
                    style={{ background: 'rgba(0,230,118,0.1)', color: S.accent, border: `1px solid rgba(0,230,118,0.25)` }}
                  >
                    Engage ↗
                  </a>
                </div>
              </div>
              {/* Row 2: best tweet snippet */}
              {a.bestMention?.text && (
                <div className="mt-1.5 ml-7">
                  <a
                    href={a.bestMention.tweetId
                      ? `https://x.com/${a.username}/status/${a.bestMention.tweetId}`
                      : `https://x.com/${a.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs hover:underline"
                    style={{ color: S.sub, display: 'block', lineHeight: 1.5 }}
                  >
                    "{a.bestMention.text.slice(0, 120)}{a.bestMention.text.length > 120 ? '…' : ''}"
                    {a.bestMention.views > 0 && (
                      <span style={{ color: S.muted, marginLeft: 6 }}>
                        👁 {fmtNum(a.bestMention.views)}
                      </span>
                    )}
                  </a>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function Mentions({ dateFrom, dateTo }) {
  const [mentions, setMentions]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [filterAccount, setFilterAccount] = useState('both')
  const [minFollowers, setMinFollowers] = useState('all')
  const [filterType, setFilterType]     = useState('all')         // 'all'|'reply'|'tweet'
  const [sortBy, setSortBy]             = useState('followers')  // 'date'|'views'|'er'|'followers'

  useEffect(() => {
    const q = query(collection(db, 'mentions'), orderBy('createdAt', 'desc'), limit(500))
    const unsub = onSnapshot(q, snap => {
      setMentions(snap.docs.map(d => ({ ...d.data(), _docId: d.id })))
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const minF = MIN_FOLLOWERS_OPTIONS.find(o => o.k === minFollowers)?.min ?? 0

  const filtered = useMemo(() => mentions
    .filter(m => {
      if (filterAccount !== 'both' && m.mentionedAccount !== filterAccount) return false
      if ((m.authorFollowers || 0) < minF) return false
      const isReply = m.isReply ?? /^@\w/.test((m.text || '').trimStart())
      if (filterType === 'reply' && !isReply) return false
      if (filterType === 'tweet' && isReply) return false
      const t = new Date(m.createdAt).getTime()
      if (dateFrom && t < new Date(dateFrom).getTime()) return false
      if (dateTo) {
        const to = new Date(dateTo); to.setSeconds(59, 999)
        if (t > to.getTime()) return false
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'views')     return (b.views || 0) - (a.views || 0)
      if (sortBy === 'er')        return er(b) - er(a)
      if (sortBy === 'followers') return (b.authorFollowers || 0) - (a.authorFollowers || 0)
      return new Date(b.createdAt) - new Date(a.createdAt)
    }),
  [mentions, filterAccount, minF, filterType, sortBy, dateFrom, dateTo])

  // Stats
  const riseCount  = mentions.filter(m => m.mentionedAccount === 'RISE').length
  const risexCount = mentions.filter(m => m.mentionedAccount === 'RISEx').length
  const kolCount   = mentions.filter(m => (m.authorFollowers || 0) >= 10_000).length
  const posCount   = filtered.filter(m => sentiment(m.text) === 'positive').length
  const negMentions = filtered.filter(m => sentiment(m.text) === 'negative')
  const negCount   = negMentions.length
  const sentRatio  = filtered.length ? Math.round((posCount / filtered.length) * 100) : 0
  const [showNeg, setShowNeg] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xs" style={{ color: S.muted }}>Loading mentions…</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold mb-1" style={{ color: S.text }}>Mentions & Sentiment</h2>
        <p className="text-xs" style={{ color: S.muted }}>
          Who talks about RISE — filter by reach to find KOLs worth engaging
        </p>
      </div>

      {mentions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-56 gap-3">
          <div className="text-5xl">📡</div>
          <div className="text-base font-bold" style={{ color: S.text }}>No mentions synced yet</div>
          <div className="text-xs max-w-sm text-center leading-relaxed" style={{ color: S.muted }}>
            The daily cron searches Twitter for @risechain and @risextrade mentions.
          </div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <Card>
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: S.muted }}>RISE Mentions</div>
              <div className="text-3xl font-bold" style={{ color: S.accent }}>{riseCount}</div>
            </Card>
            <Card>
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: S.muted }}>RISEx Mentions</div>
              <div className="text-3xl font-bold" style={{ color: '#6366f1' }}>{risexCount}</div>
            </Card>
            <Card>
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: S.muted }}>KOL Mentions</div>
              <div className="text-3xl font-bold" style={{ color: '#f59e0b' }}>{kolCount}</div>
              <div className="text-xs mt-1" style={{ color: S.sub }}>10k+ followers</div>
            </Card>
            <Card style={{ gridColumn: negCount > 0 ? 'span 1' : undefined }}>
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: S.muted }}>Positive Sentiment</div>
              <div className="text-3xl font-bold" style={{ color: S.accent }}>{sentRatio}%</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs" style={{ color: sentRatio < 40 ? '#ef4444' : sentRatio < 60 ? '#f59e0b' : S.sub }}>
                  {sentRatio < 40 ? '⚠ low — worth monitoring' : sentRatio < 60 ? 'neutral range' : 'healthy'}
                </span>
                {negCount > 0 && (
                  <button
                    onClick={() => setShowNeg(v => !v)}
                    className="text-xs font-medium px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
                  >
                    {negCount} negative {showNeg ? '▲' : '▼'}
                  </button>
                )}
              </div>
              {showNeg && negCount > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {negMentions.slice(0, 5).map(m => {
                    const tweetUrl = m.tweetId && m.authorUsername
                      ? `https://x.com/${m.authorUsername}/status/${m.tweetId}`
                      : m.authorUsername ? `https://x.com/${m.authorUsername}` : null
                    return (
                      <div key={m._docId} className="rounded p-2" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xs font-semibold" style={{ color: '#ef4444' }}>@{m.authorUsername}</span>
                          {m.authorFollowers > 0 && (
                            <span className="text-xs" style={{ color: S.muted }}>{fmtNum(m.authorFollowers)} followers</span>
                          )}
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: S.sub }}>{(m.text || '').slice(0, 160)}</p>
                        {tweetUrl && (
                          <a href={tweetUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs mt-1 inline-block hover:underline" style={{ color: S.muted }}>
                            View tweet ↗
                          </a>
                        )}
                      </div>
                    )
                  })}
                  {negCount > 5 && (
                    <div className="text-xs text-center" style={{ color: S.muted }}>+{negCount - 5} more — use Type filter to see all</div>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* Top accounts to engage */}
          <TopAccountsPanel mentions={mentions} />

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Account filter */}
            <div className="flex items-center gap-1">
              {[['both', 'All'], ['RISE', 'RISE'], ['RISEx', 'RISEx']].map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setFilterAccount(k)}
                  className="px-3 py-1.5 text-xs font-medium rounded transition-all"
                  style={
                    filterAccount === k
                      ? { background: 'rgba(0,230,118,0.1)', color: S.accent, border: `1px solid rgba(0,230,118,0.25)` }
                      : { color: S.muted, border: `1px solid ${S.border}` }
                  }
                >
                  {l}
                </button>
              ))}
            </div>

            <div className="h-4 w-px" style={{ background: S.border }} />

            {/* Follower filter */}
            <div className="flex items-center gap-1">
              <span className="text-xs mr-1" style={{ color: S.muted }}>Followers:</span>
              {MIN_FOLLOWERS_OPTIONS.map(({ k, l }) => (
                <button
                  key={k}
                  onClick={() => setMinFollowers(k)}
                  className="px-3 py-1.5 text-xs font-medium rounded transition-all"
                  style={
                    minFollowers === k
                      ? { background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: `1px solid rgba(245,158,11,0.3)` }
                      : { color: S.muted, border: `1px solid ${S.border}` }
                  }
                >
                  {l}
                </button>
              ))}
            </div>

            <div className="h-4 w-px" style={{ background: S.border }} />

            {/* Type filter */}
            <div className="flex items-center gap-1">
              <span className="text-xs mr-1" style={{ color: S.muted }}>Type:</span>
              {[['all', 'All'], ['tweet', '✦ Tweet'], ['reply', '↩ Reply']].map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setFilterType(k)}
                  className="px-3 py-1.5 text-xs font-medium rounded transition-all"
                  style={
                    filterType === k
                      ? { background: 'rgba(99,102,241,0.12)', color: '#a78bfa', border: `1px solid rgba(99,102,241,0.3)` }
                      : { color: S.muted, border: `1px solid ${S.border}` }
                  }
                >
                  {l}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-1">
              <span className="text-xs mr-1" style={{ color: S.muted }}>Sort:</span>
              {[['followers', 'Top Followers'], ['date', 'Latest'], ['views', 'Most Views'], ['er', 'Best ER']].map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setSortBy(k)}
                  className="px-3 py-1.5 text-xs font-medium rounded transition-all"
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

          {/* Result count */}
          <div className="text-xs" style={{ color: S.muted }}>
            Showing {filtered.length} of {mentions.length} mentions
            {minF > 0 && ` · authors with ${fmtNum(minF)}+ followers`}
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
