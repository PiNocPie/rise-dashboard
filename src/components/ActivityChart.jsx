import { useMemo } from 'react'
import {
  COMPETITOR_COLORS,
  COMPETITOR_TWITTER,
  COMPETITOR_TWITTER_USERNAMES,
  OWN_ACCOUNTS,
  OWN_ACCOUNT_COLORS,
  OWN_ACCOUNT_TWITTER,
  OWN_ACCOUNT_USERNAMES,
} from '../data/constants'

// Build daily post counts for the last N days
function buildDailySeries(posts, name, days = 60) {
  const now = Date.now()
  const buckets = Array(days).fill(0)
  posts
    .filter(p => p.competitor === name)
    .forEach(p => {
      const age = Math.floor((now - new Date(p.postDate).getTime()) / (1000 * 60 * 60 * 24))
      if (age >= 0 && age < days) buckets[days - 1 - age]++
    })
  return buckets
}

// Smooth SVG area path using Catmull-Rom → cubic bezier
function smoothAreaPath(data, w, h, padY = 6) {
  if (!data || data.length < 2) return ''
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: padY + (1 - v / max) * (h - padY * 2),
  }))

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(i + 2, pts.length - 1)]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }

  const lastX = pts[pts.length - 1].x.toFixed(1)
  d += ` L ${lastX} ${h} L ${pts[0].x.toFixed(1)} ${h} Z`
  return d
}

function Sparkline({ data, color, gradId }) {
  const W = 240
  const H = 72
  const path = smoothAreaPath(data, W, H)
  const max = Math.max(...data, 1)
  const linePts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * W,
    y: 6 + (1 - v / max) * (H - 12),
  }))
  let linePath = `M ${linePts[0].x.toFixed(1)} ${linePts[0].y.toFixed(1)}`
  for (let i = 0; i < linePts.length - 1; i++) {
    const p0 = linePts[Math.max(i - 1, 0)]
    const p1 = linePts[i]
    const p2 = linePts[i + 1]
    const p3 = linePts[Math.min(i + 2, linePts.length - 1)]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    linePath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function fmtNum(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function AccountRow({ name, posts, color, twitterUrl, username, isOwn, idx }) {
  const series = useMemo(() => buildDailySeries(posts, name), [posts, name])
  const total = posts.filter(p => p.competitor === name).length
  const lastDate = posts
    .filter(p => p.competitor === name)
    .sort((a, b) => new Date(b.postDate) - new Date(a.postDate))[0]?.postDate
  const dateStr = lastDate
    ? new Date(lastDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  return (
    <div
      className="flex items-center gap-6 px-6 py-5"
      style={{ borderBottom: '1px solid #111' }}
    >
      {/* Left: name + handle */}
      <div style={{ width: 200, flexShrink: 0 }}>
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="font-bold text-white text-base">{name}</span>
          {isOwn && (
            <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}44` }}>
              us
            </span>
          )}
          <span className="text-xs" style={{ color: '#555' }}>{dateStr}</span>
        </div>
        {twitterUrl && (
          <a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs ml-4"
            style={{ color: '#444' }}
          >
            @{username}
          </a>
        )}
      </div>

      {/* Chart */}
      <div className="flex-1">
        <Sparkline data={series} color={color} gradId={`grad-${name.replace(/\s/g, '-')}-${idx}`} />
      </div>

      {/* Right: post count */}
      <div style={{ width: 100, flexShrink: 0, textAlign: 'right' }}>
        <div className="text-xs uppercase tracking-widest mb-1" style={{ color: '#444' }}>Posts</div>
        <div className="font-bold text-white" style={{ fontSize: 22 }}>{fmtNum(total)}</div>
      </div>
    </div>
  )
}

export default function ActivityChart({ posts, competitors }) {
  // Sort competitors by post count descending
  const sorted = useMemo(() => (
    [...competitors].sort((a, b) => {
      const ca = posts.filter(p => p.competitor === a).length
      const cb = posts.filter(p => p.competitor === b).length
      return cb - ca
    })
  ), [posts, competitors])

  return (
    <div style={{ backgroundColor: '#000', minHeight: '100vh', margin: '-2rem', padding: '2rem' }}>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-white mb-1">Posting Activity</h2>
        <p className="text-sm" style={{ color: '#555' }}>60-day volume · sorted by total posts</p>
      </div>

      {/* Competitor rows */}
      <div style={{ border: '1px solid #111', borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' }}>
        <div className="px-6 py-3 flex items-center gap-6" style={{ borderBottom: '1px solid #111' }}>
          <div style={{ width: 200, flexShrink: 0 }}>
            <span className="text-xs uppercase tracking-widest" style={{ color: '#444' }}>Competitor</span>
          </div>
          <div className="flex-1">
            <span className="text-xs uppercase tracking-widest" style={{ color: '#444' }}>Activity (60 days)</span>
          </div>
          <div style={{ width: 100, flexShrink: 0, textAlign: 'right' }}>
            <span className="text-xs uppercase tracking-widest" style={{ color: '#444' }}>Total</span>
          </div>
        </div>

        {sorted.map((name, i) => (
          <AccountRow
            key={name}
            idx={i}
            name={name}
            posts={posts}
            color={COMPETITOR_COLORS[name] || '#6366f1'}
            twitterUrl={COMPETITOR_TWITTER[name]}
            username={COMPETITOR_TWITTER_USERNAMES[name]}
            isOwn={false}
          />
        ))}
      </div>

      {/* Our Accounts section */}
      <div className="mt-10 mb-4">
        <h3 className="text-base font-bold text-white mb-1">Our Accounts</h3>
        <p className="text-sm" style={{ color: '#555' }}>Benchmark against our own performance</p>
      </div>

      <div style={{ border: '1px solid #111', borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' }}>
        <div className="px-6 py-3 flex items-center gap-6" style={{ borderBottom: '1px solid #111' }}>
          <div style={{ width: 200, flexShrink: 0 }}>
            <span className="text-xs uppercase tracking-widest" style={{ color: '#444' }}>Account</span>
          </div>
          <div className="flex-1">
            <span className="text-xs uppercase tracking-widest" style={{ color: '#444' }}>Activity (60 days)</span>
          </div>
          <div style={{ width: 100, flexShrink: 0, textAlign: 'right' }}>
            <span className="text-xs uppercase tracking-widest" style={{ color: '#444' }}>Total</span>
          </div>
        </div>

        {OWN_ACCOUNTS.map((name, i) => (
          <AccountRow
            key={name}
            idx={1000 + i}
            name={name}
            posts={posts}
            color={OWN_ACCOUNT_COLORS[name]}
            twitterUrl={OWN_ACCOUNT_TWITTER[name]}
            username={OWN_ACCOUNT_USERNAMES[name]}
            isOwn={true}
          />
        ))}
      </div>
    </div>
  )
}
