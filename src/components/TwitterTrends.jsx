import { useState, useEffect, useCallback } from 'react'

// ── Design tokens ──────────────────────────────────────────────────────────────
const T = {
  bg:      '#0a0a0a',
  surface: '#111111',
  card:    '#161616',
  border:  '#252525',
  accent:  '#f59e0b',
  accentD: 'rgba(245,158,11,0.12)',
  accentB: 'rgba(245,158,11,0.3)',
  text:    '#e8e8e8',
  sub:     '#888888',
  muted:   '#444444',
  pos:     '#22c55e',
  neg:     '#ef4444',
  neu:     '#888888',
}

// ── Sentiment ─────────────────────────────────────────────────────────────────
const POS = ['bullish','moon','pump','ath','buy','great','amazing','excited','launch','win',
             'good','up','surge','rally','huge','massive','grow','positive','breakthrough',
             'successful','gm','wagmi','liq','rekt','listing','partnership','adoption']
const NEG = ['bearish','dump','crash','rug','scam','fud','down','fear','sell','fail',
             'broken','dead','ngmi','liquidat','exploit','hack','fraud','sue','ban',
             'concern','worry','bad','pain','loss','drop','plunge','collapse']

function sentiment(text) {
  const t = (text || '').toLowerCase()
  const p = POS.filter(w => t.includes(w)).length
  const n = NEG.filter(w => t.includes(w)).length
  if (p > n) return 'pos'
  if (n > p) return 'neg'
  return 'neu'
}

function fmtNum(n) {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso)) / 1000
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatBar({ totalTweets, totalEngagement, hours, fetchedAt, topic }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 text-xs font-mono"
      style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, color: T.sub }}
    >
      <span style={{ color: T.text }}>
        <span style={{ color: T.accent }}>{fmtNum(totalTweets)}</span> tweets
      </span>
      <span>
        <span style={{ color: T.accent }}>{fmtNum(totalEngagement)}</span> engagement
      </span>
      <span>window: <span style={{ color: T.text }}>{hours < 1 ? `${Math.round(hours * 60)}m` : `${hours}h`}</span></span>
      {topic && (
        <span>
          topic: <span style={{ color: T.accent }}>"{topic}"</span>
        </span>
      )}
      {fetchedAt && (
        <span className="ml-auto">fetched {timeAgo(fetchedAt)}</span>
      )}
    </div>
  )
}

function HashtagCloud({ tags }) {
  if (!tags?.length) return null
  const max = tags[0]?.count || 1
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: T.sub }}>
        Trending Hashtags
      </h2>
      <div className="flex flex-wrap gap-2">
        {tags.slice(0, 30).map(({ tag, count }) => {
          const size = 10 + Math.round((count / max) * 10)
          const opacity = 0.4 + (count / max) * 0.6
          return (
            <span
              key={tag}
              className="px-2.5 py-1 rounded cursor-default transition-all hover:opacity-100"
              style={{
                fontSize: size,
                opacity,
                background: T.card,
                border: `1px solid ${T.border}`,
                color: count === max ? T.accent : T.text,
                fontFamily: 'monospace',
              }}
              title={`${count} mentions`}
            >
              {tag}
              <span style={{ fontSize: 9, color: T.muted, marginLeft: 4 }}>{count}</span>
            </span>
          )
        })}
      </div>
    </section>
  )
}

function MindshareChart({ mindshare }) {
  if (!mindshare?.length) return null
  const max = mindshare[0]?.count || 1
  const COLORS = [T.accent, '#60a5fa', '#a78bfa', '#34d399', '#f87171', '#fbbf24', '#38bdf8']
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: T.sub }}>
        Mindshare — % of tweets mentioning
      </h2>
      <div className="flex flex-col gap-1.5">
        {mindshare.slice(0, 12).map(({ name, count, pct }, i) => {
          const barW = `${Math.max(2, (count / max) * 100)}%`
          const color = COLORS[i % COLORS.length]
          return (
            <div key={name} className="flex items-center gap-3 text-xs font-mono">
              <span className="w-24 text-right" style={{ color: T.sub }}>
                {name}
              </span>
              <div
                className="flex-1 relative"
                style={{ height: 18, background: T.card, borderRadius: 2, border: `1px solid ${T.border}` }}
              >
                <div
                  style={{
                    width: barW,
                    height: '100%',
                    background: color,
                    opacity: 0.25,
                    borderRadius: 2,
                    transition: 'width 0.6s ease',
                  }}
                />
                <span
                  className="absolute inset-0 flex items-center px-2"
                  style={{ color, fontSize: 10 }}
                >
                  {count} mentions
                </span>
              </div>
              <span className="w-10 text-right" style={{ color }}>
                {pct}%
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function SentimentBadge({ text }) {
  const s = sentiment(text)
  if (s === 'pos') return <span style={{ color: T.pos, fontSize: 10 }}>▲ POS</span>
  if (s === 'neg') return <span style={{ color: T.neg, fontSize: 10 }}>▼ NEG</span>
  return <span style={{ color: T.neu, fontSize: 10 }}>― NEU</span>
}

function TweetCard({ tweet }) {
  const url = tweet.authorUsername
    ? `https://x.com/${tweet.authorUsername}/status/${tweet.id}`
    : null
  return (
    <div
      className="rounded p-3 flex flex-col gap-2 transition-all"
      style={{ background: T.card, border: `1px solid ${T.border}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          {tweet.authorUsername && (
            <span style={{ color: T.accent, fontFamily: 'monospace' }}>@{tweet.authorUsername}</span>
          )}
          {tweet.authorFollowers > 0 && (
            <span style={{ color: T.muted, fontSize: 10 }}>
              {fmtNum(tweet.authorFollowers)} followers
            </span>
          )}
          <span style={{ color: T.muted }}>{timeAgo(tweet.createdAt)}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SentimentBadge text={tweet.text} />
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs hover:opacity-70 transition-opacity"
              style={{ color: T.muted }}
            >
              ↗
            </a>
          )}
        </div>
      </div>

      <p
        className="text-xs leading-relaxed"
        style={{ color: T.text, wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {tweet.text}
      </p>

      <div className="flex items-center gap-4 text-xs font-mono" style={{ color: T.sub }}>
        <span title="Views">👁 {fmtNum(tweet.views)}</span>
        <span title="Likes">❤ {fmtNum(tweet.likes)}</span>
        <span title="Retweets">↺ {fmtNum(tweet.retweets)}</span>
        <span title="Replies">💬 {fmtNum(tweet.replies)}</span>
      </div>
    </div>
  )
}

function SentimentSummary({ tweets }) {
  if (!tweets?.length) return null
  const counts = { pos: 0, neg: 0, neu: 0 }
  for (const t of tweets) counts[sentiment(t.text)]++
  const total = tweets.length
  const pct = (k) => Math.round((counts[k] / total) * 100)
  return (
    <div
      className="rounded px-4 py-3 flex items-center gap-6 text-xs font-mono"
      style={{ background: T.card, border: `1px solid ${T.border}` }}
    >
      <span style={{ color: T.sub }}>Sentiment (top {total}):</span>
      <span>
        <span style={{ color: T.pos }}>▲ Positive</span>
        <span style={{ color: T.text, marginLeft: 6 }}>{pct('pos')}%</span>
      </span>
      <span>
        <span style={{ color: T.neg }}>▼ Negative</span>
        <span style={{ color: T.text, marginLeft: 6 }}>{pct('neg')}%</span>
      </span>
      <span>
        <span style={{ color: T.neu }}>― Neutral</span>
        <span style={{ color: T.text, marginLeft: 6 }}>{pct('neu')}%</span>
      </span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

const SUGGESTED = ['Paradex TGE', 'RISE chain', 'Monad mainnet', 'Hyperliquid', 'Berachain']

export default function TwitterTrends() {
  const [hours, setHours] = useState(6)   // fractional: 5m = 0.083
  const [topicInput, setTopicInput] = useState('')
  const [activeTopic, setActiveTopic] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchTrends = useCallback(async (h, topic) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ hours: h })
      if (topic) params.set('q', topic)
      const resp = await fetch(`/api/twitter-trends?${params}`)
      const json = await resp.json()
      if (!resp.ok || !json.ok) throw new Error(json.error || 'API error')
      setData(json)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTrends(hours, activeTopic)
  }, [hours, activeTopic, fetchTrends])

  const handleMonitor = () => {
    const t = topicInput.trim()
    setActiveTopic(t)
    fetchTrends(hours, t)
  }

  const handleSuggestion = (s) => {
    setTopicInput(s)
    setActiveTopic(s)
    fetchTrends(hours, s)
  }

  const handleClearTopic = () => {
    setTopicInput('')
    setActiveTopic('')
    fetchTrends(hours, '')
  }

  return (
    <div className="min-h-screen" style={{ background: T.bg, color: T.text, fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Hero header ─────────────────────────────────────────────────────── */}
      <div
        className="px-6 py-8"
        style={{
          background: 'linear-gradient(180deg, #0f0a00 0%, #0a0a0a 100%)',
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        <div className="max-w-screen-xl mx-auto">
          <div className="flex flex-col gap-1 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: T.accentD, border: `1px solid ${T.accentB}`, color: T.accent }}>
                LIVE
              </span>
              <span className="text-xs font-mono" style={{ color: T.muted }}>Twitter Sentiment Terminal</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: T.text }}>
              Monitoring the Situation
            </h1>
            <p className="text-sm" style={{ color: T.sub }}>
              Track real-time Twitter sentiment, trending topics, and mindshare for any crypto event.
            </p>
          </div>

          {/* Topic search */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div
                className="flex items-center flex-1 max-w-lg gap-2 px-3 py-2 rounded"
                style={{ background: '#0f0f0f', border: `1px solid ${T.border}` }}
              >
                <span style={{ color: T.muted, fontSize: 12 }}>⌕</span>
                <input
                  type="text"
                  value={topicInput}
                  onChange={e => setTopicInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleMonitor()}
                  placeholder="Type a topic to monitor (e.g. Paradex TGE, Monad launch…)"
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: T.text, caretColor: T.accent }}
                />
                {topicInput && (
                  <button onClick={() => setTopicInput('')} style={{ color: T.muted, fontSize: 14 }}>×</button>
                )}
              </div>
              <button
                onClick={handleMonitor}
                disabled={loading}
                className="px-4 py-2 rounded text-sm font-semibold transition-all"
                style={{
                  background: loading ? T.muted : T.accent,
                  color: '#000',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                Monitor
              </button>
              {activeTopic && (
                <button
                  onClick={handleClearTopic}
                  className="px-3 py-2 rounded text-xs"
                  style={{ border: `1px solid ${T.border}`, color: T.sub }}
                >
                  ✕ Clear
                </button>
              )}
            </div>

            {/* Suggested topics */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs" style={{ color: T.muted }}>Quick:</span>
              {SUGGESTED.map(s => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  className="text-xs px-2.5 py-1 rounded transition-all hover:opacity-80"
                  style={{
                    background: activeTopic === s ? T.accentD : T.surface,
                    border: `1px solid ${activeTopic === s ? T.accentB : T.border}`,
                    color: activeTopic === s ? T.accent : T.sub,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Time window + refresh */}
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1 p-0.5 rounded" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                {[
                  { value: 5/60, label: '5m' },
                  { value: 1,    label: '1h' },
                  { value: 2,    label: '2h' },
                  { value: 3,    label: '3h' },
                  { value: 4,    label: '4h' },
                  { value: 6,    label: '6h' },
                  { value: 24,   label: '24h' },
                ].map(({ value, label }) => (
                  <button
                    key={label}
                    onClick={() => setHours(value)}
                    className="px-2.5 py-1 rounded text-xs font-mono transition-all"
                    style={
                      hours === value
                        ? { background: T.accent, color: '#000', fontWeight: 600 }
                        : { color: T.sub }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => fetchTrends(hours, activeTopic)}
                disabled={loading}
                className="px-3 py-1 rounded text-xs font-mono transition-all"
                style={{ border: `1px solid ${T.border}`, color: loading ? T.muted : T.sub, background: T.surface }}
              >
                {loading ? '⟳ Fetching…' : '⟳ Refresh'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Status bar ───────────────────────────────────────────────────────── */}
      {data && (
        <StatBar
          totalTweets={data.totalTweets}
          totalEngagement={data.totalEngagement}
          hours={data.hours}
          fetchedAt={data.fetchedAt}
          topic={activeTopic}
        />
      )}

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {error && (
        <div className="max-w-screen-xl mx-auto px-6 pt-4">
          <div className="px-4 py-3 rounded text-xs font-mono" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
            Error: {error}
          </div>
        </div>
      )}

      {/* ── Loading skeleton ─────────────────────────────────────────────────── */}
      {loading && !data && (
        <div className="flex items-center justify-center py-24">
          <div className="text-xs font-mono" style={{ color: T.muted }}>
            <span style={{ color: T.accent }}>⟳</span> Querying Twitter API…
          </div>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      {data && !loading && (
        <div className="max-w-screen-xl mx-auto px-6 py-6 flex flex-col gap-8">

          {/* Hashtags + Mindshare side by side */}
          <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div
              className="rounded p-4"
              style={{ background: T.surface, border: `1px solid ${T.border}` }}
            >
              <HashtagCloud tags={data.trending} />
            </div>
            <div
              className="rounded p-4"
              style={{ background: T.surface, border: `1px solid ${T.border}` }}
            >
              <MindshareChart mindshare={data.mindshare} />
            </div>
          </div>

          {/* Sentiment summary */}
          {data.topTweets?.length > 0 && (
            <SentimentSummary tweets={data.topTweets} />
          )}

          {/* Top tweets */}
          {data.topTweets?.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: T.sub }}>
                Top Tweets — sorted by reach
              </h2>
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}
              >
                {data.topTweets.map(tweet => (
                  <TweetCard key={tweet.id} tweet={tweet} />
                ))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {(!data.topTweets?.length && !data.trending?.length) && (
            <div className="text-center py-16">
              <p className="text-sm" style={{ color: T.sub }}>No tweets found for this query in the last {hours < 1 ? `${Math.round(hours * 60)}m` : `${hours}h`}.</p>
              <p className="text-xs mt-1" style={{ color: T.muted }}>Try a different topic or a longer time window.</p>
            </div>
          )}

          {/* Footer note */}
          <p className="text-xs text-center pb-4" style={{ color: T.muted }}>
            Data via Twitter API v2 · Free tier max 100 tweets per query · Sentiment is keyword-based estimation
          </p>
        </div>
      )}
    </div>
  )
}
