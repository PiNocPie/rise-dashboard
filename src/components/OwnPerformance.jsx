import { useMemo, useState } from 'react'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { OWN_ACCOUNTS, OWN_ACCOUNT_COLORS, CATEGORY_COLORS, COMPETITOR_TWITTER_USERNAMES } from '../data/constants'

// ─── helpers ─────────────────────────────────────────────────────────────────

function er(post) {
  if (!post.views) return 0
  return ((post.likes + post.retweets + post.replies) / post.views) * 100
}

function fmtNum(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(Math.round(n ?? 0))
}

function avgER(posts) {
  const withViews = posts.filter(p => p.views > 0)
  if (!withViews.length) return 0
  return withViews.reduce((s, p) => s + er(p), 0) / withViews.length
}

function getWeekStart(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  return mon.toISOString().slice(0, 10)
}

function weekLabel(ws) {
  if (!ws) return ''
  const d = new Date(ws)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function buildWeeklyERSeries(risePosts, risexPosts) {
  const weeks = {}
  for (const p of risePosts) {
    const ws = getWeekStart(p.postDate)
    if (!ws) continue
    if (!weeks[ws]) weeks[ws] = { date: weekLabel(ws), RISE_er: [], RISEx_er: [] }
    if (p.views > 0) weeks[ws].RISE_er.push(er(p))
  }
  for (const p of risexPosts) {
    const ws = getWeekStart(p.postDate)
    if (!ws) continue
    if (!weeks[ws]) weeks[ws] = { date: weekLabel(ws), RISE_er: [], RISEx_er: [] }
    if (p.views > 0) weeks[ws].RISEx_er.push(er(p))
  }
  return Object.entries(weeks)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([, v]) => ({
      date: v.date,
      RISE: v.RISE_er.length ? +(v.RISE_er.reduce((s, x) => s + x, 0) / v.RISE_er.length).toFixed(3) : null,
      RISEx: v.RISEx_er.length ? +(v.RISEx_er.reduce((s, x) => s + x, 0) / v.RISEx_er.length).toFixed(3) : null,
    }))
}

function buildCategoryBreakdown(posts) {
  const counts = {}
  for (const p of posts) {
    counts[p.category || 'Other'] = (counts[p.category || 'Other'] || 0) + 1
  }
  const total = posts.length || 1
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, n]) => ({ cat, n, pct: Math.round((n / total) * 100) }))
}

// ─── design tokens ────────────────────────────────────────────────────────────

const S = {
  surface: '#242424',
  border: '#2d2d2d',
  text: '#e8e8e8',
  sub: '#888888',
  muted: '#555555',
  accent: '#00e676',
}

// ─── components ───────────────────────────────────────────────────────────────

function Card({ children, className = '', style = {} }) {
  return (
    <div
      className={`rounded-lg p-5 ${className}`}
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

function GradientStat({ label, value, sub }) {
  return (
    <div
      className="rounded-lg p-5 flex flex-col gap-2"
      style={{
        background: '#242424',
        border: `1px solid ${S.border}`,
      }}
    >
      <div className="text-xs font-medium uppercase tracking-wider" style={{ color: S.muted }}>{label}</div>
      <div className="text-3xl font-bold" style={{ color: S.accent }}>{value}</div>
      {sub && <div className="text-xs" style={{ color: S.sub }}>{sub}</div>}
    </div>
  )
}

function PostRow({ post, rank, username }) {
  const tweetUrl = (post.tweetId && String(post.tweetId).length > 5 && username)
    ? `https://x.com/${username}/status/${post.tweetId}`
    : post.postUrl || null
  const erVal = er(post)
  const erColor = erVal > 2 ? '#00e676' : erVal > 1 ? '#f59e0b' : S.sub

  return (
    <div
      className="flex items-start gap-4 py-3"
      style={{ borderBottom: `1px solid ${S.border}` }}
    >
      <div className="w-5 text-xs font-bold shrink-0 pt-0.5" style={{ color: S.muted }}>{rank}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm leading-relaxed line-clamp-2 mb-2" style={{ color: S.text }}>
          {post.postText || '(no text)'}
        </div>
        <div className="flex items-center gap-4 text-xs" style={{ color: S.sub }}>
          <span>👁 {fmtNum(post.views)}</span>
          <span>❤️ {fmtNum(post.likes)}</span>
          <span>🔁 {fmtNum(post.retweets)}</span>
          <span style={{ color: erColor, fontWeight: 600 }}>ER {erVal.toFixed(2)}%</span>
          {tweetUrl && (
            <a
              href={tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto font-medium transition-opacity hover:opacity-70"
              style={{ color: OWN_ACCOUNT_COLORS[post.competitor] || '#6366f1' }}
            >
              View ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#2a2a2a',
    border: '1px solid #3a3a3a',
    borderRadius: 6,
    fontSize: 12,
    color: S.text,
  },
  labelStyle: { color: S.sub },
}

// ─── main component ───────────────────────────────────────────────────────────

export default function OwnPerformance({ allPosts, competitors }) {
  const [sortBy, setSortBy] = useState('er') // 'er' | 'views'

  const ownPosts = useMemo(() => allPosts.filter(p => OWN_ACCOUNTS.includes(p.competitor)), [allPosts])
  const risePosts = useMemo(() => ownPosts.filter(p => p.competitor === 'RISE'), [ownPosts])
  const risexPosts = useMemo(() => ownPosts.filter(p => p.competitor === 'RISEx'), [ownPosts])
  const competitorPosts = useMemo(
    () => allPosts.filter(p => !OWN_ACCOUNTS.includes(p.competitor) && competitors.includes(p.competitor)),
    [allPosts, competitors],
  )

  const riseER = avgER(risePosts)
  const risexER = avgER(risexPosts)
  const compER = avgER(competitorPosts)

  const weeklyER = useMemo(() => buildWeeklyERSeries(risePosts, risexPosts), [risePosts, risexPosts])

  const topPosts = useMemo(() => {
    const sorted = [...ownPosts].filter(p => p.views > 0)
    if (sortBy === 'er') sorted.sort((a, b) => er(b) - er(a))
    else sorted.sort((a, b) => (b.views || 0) - (a.views || 0))
    return sorted.slice(0, 10)
  }, [ownPosts, sortBy])

  const riseCats = useMemo(() => buildCategoryBreakdown(risePosts), [risePosts])
  const risexCats = useMemo(() => buildCategoryBreakdown(risexPosts), [risexPosts])

  // What categories perform best for competitors
  const compCatER = useMemo(() => {
    const bycat = {}
    for (const p of competitorPosts) {
      if (!p.views) continue
      const c = p.category || 'Other'
      if (!bycat[c]) bycat[c] = []
      bycat[c].push(er(p))
    }
    return Object.entries(bycat)
      .map(([cat, ers]) => ({ cat, avgER: +(ers.reduce((s, x) => s + x, 0) / ers.length).toFixed(3) }))
      .sort((a, b) => b.avgER - a.avgER)
      .slice(0, 8)
  }, [competitorPosts])

  if (ownPosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="text-5xl">📊</div>
        <div className="text-base font-bold" style={{ color: S.text }}>No RISE/RISEx posts yet</div>
        <div className="text-xs" style={{ color: S.muted }}>
          The daily cron syncs @risechain and @risextrade automatically
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold mb-1" style={{ color: S.text }}>
          Our Performance
        </h2>
        <p className="text-xs" style={{ color: S.muted }}>
          How @risechain and @risextrade are performing vs competitors
        </p>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-4 gap-3">
        <GradientStat
          label="RISE avg ER"
          value={`${riseER.toFixed(2)}%`}
          sub={riseER > compER ? `↑ ${(riseER - compER).toFixed(2)}% above comp avg` : `↓ ${(compER - riseER).toFixed(2)}% below comp avg`}
          gradient="linear-gradient(135deg, rgba(0,230,118,0.1) 0%, rgba(0,230,118,0.04) 100%)"
        />
        <GradientStat
          label="RISEx avg ER"
          value={`${risexER.toFixed(2)}%`}
          sub={risexER > compER ? `↑ ${(risexER - compER).toFixed(2)}% above comp avg` : `↓ ${(compER - risexER).toFixed(2)}% below comp avg`}
          gradient="linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(99,102,241,0.04) 100%)"
        />
        <GradientStat
          label="Total Posts"
          value={ownPosts.length}
          sub={`${risePosts.length} RISE · ${risexPosts.length} RISEx`}
          gradient="linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(245,158,11,0.03) 100%)"
        />
        <GradientStat
          label="Competitor avg ER"
          value={`${compER.toFixed(2)}%`}
          sub={`Across ${competitors.length} competitors`}
          gradient="linear-gradient(135deg, rgba(107,114,128,0.1) 0%, rgba(107,114,128,0.04) 100%)"
        />
      </div>

      {/* ER trend + what's working for competitors */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: S.muted }}>
            Engagement Rate Trend (weekly avg)
          </div>
          {weeklyER.length < 2 ? (
            <div className="h-40 flex items-center justify-center text-xs" style={{ color: S.muted }}>
              Not enough history yet — check back after more syncs
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={weeklyER} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fill: S.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: S.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={40} tickFormatter={v => `${v}%`} />
                <Tooltip {...TOOLTIP_STYLE} formatter={v => [`${v.toFixed(3)}%`, '']} />
                <Legend wrapperStyle={{ fontSize: 11, color: S.sub }} />
                <Line type="monotone" dataKey="RISE" stroke="#00e676" strokeWidth={2} dot={false} connectNulls name="RISE" />
                <Line type="monotone" dataKey="RISEx" stroke="#6366f1" strokeWidth={2} dot={false} connectNulls name="RISEx" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: S.muted }}>
            What content types work best (competitor avg ER)
          </div>
          {compCatER.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs" style={{ color: S.muted }}>No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={compCatER} layout="vertical" margin={{ left: 80, right: 16, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fill: S.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="cat" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={78} />
                <Tooltip {...TOOLTIP_STYLE} formatter={v => [`${v.toFixed(3)}%`, 'avg ER']} />
                <Bar dataKey="avgER" radius={[0, 4, 4, 0]}>
                  {compCatER.map((entry, i) => (
                    <rect key={i} fill={CATEGORY_COLORS[entry.cat] || '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Category mix: what you post */}
      <div className="grid grid-cols-2 gap-4">
        {[['RISE', riseCats], ['RISEx', risexCats]].map(([name, cats]) => (
          <Card key={name}>
            <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: S.muted }}>
              {name} content mix
            </div>
            {cats.length === 0 ? (
              <div className="text-xs" style={{ color: S.muted }}>No posts yet</div>
            ) : (
              <div className="flex flex-col gap-2">
                {cats.map(({ cat, n, pct }) => (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs" style={{ color: S.sub }}>{cat}</span>
                      <span className="text-xs font-medium" style={{ color: S.text }}>{n} · {pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%`, background: CATEGORY_COLORS[cat] || '#6366f1' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Top posts */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: S.muted }}>
            Top Posts
          </div>
          <div className="flex gap-1">
            {[['er', 'By ER'], ['views', 'By Views']].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setSortBy(k)}
                className="px-3 py-1 text-xs font-medium rounded-lg transition-all"
                style={
                  sortBy === k
                    ? { background: 'rgba(0,230,118,0.12)', color: '#00e676', border: '1px solid rgba(0,230,118,0.2)' }
                    : { color: S.muted, border: '1px solid rgba(255,255,255,0.06)' }
                }
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        {topPosts.length === 0 ? (
          <div className="text-xs" style={{ color: S.muted }}>No posts with view data yet</div>
        ) : (
          <div>
            {topPosts.map((post, i) => (
              <PostRow
                key={post._docId || i}
                post={post}
                rank={i + 1}
                username={COMPETITOR_TWITTER_USERNAMES[post.competitor]}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
