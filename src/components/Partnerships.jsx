import { useMemo, useState } from 'react'
import { COMPETITOR_COLORS, COMPETITOR_TWITTER_USERNAMES, OWN_ACCOUNTS, OWN_ACCOUNT_COLORS, OWN_ACCOUNT_USERNAMES } from '../data/constants'

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtNum(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(Math.round(n ?? 0))
}

function er(post) {
  if (!post.views) return 0
  return ((post.likes + post.retweets + post.replies) / post.views) * 100
}

// Extract potential project/protocol names from tweet text:
// capitalised words that aren't common English words
const SKIP_WORDS = new Set([
  'The','A','An','I','We','Our','Your','This','That','It','Is','Are','Was',
  'Will','To','For','On','At','By','With','From','In','Of','And','Or','But',
  'Very','Just','Now','Not','So','New','All','Can','Has','Have','Had',
  'More','Been','One','Two','Three','Be','Do','Up','Down','Out','Off',
  'Here','There','Today','Tomorrow','Network','Chain','Exchange','Protocol',
  'Team','Dev','Block','Crypto','Token','Market','Trade','Trading',
])

function extractProjects(text) {
  const words = (text || '').match(/\b[A-Z][a-zA-Z0-9]{2,}\b/g) || []
  return [...new Set(words.filter(w => !SKIP_WORDS.has(w)))].slice(0, 5)
}

// ─── design tokens ────────────────────────────────────────────────────────────

const S = {
  surface: '#0a0a0f',
  border: 'rgba(255,255,255,0.06)',
  text: '#f0f4ff',
  sub: '#9ca3af',
  muted: '#4b5563',
}

function Card({ children, style = {} }) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: S.surface,
        border: `1px solid ${S.border}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function PartnershipCard({ post }) {
  const isOwn = OWN_ACCOUNTS.includes(post.competitor)
  const usernames = isOwn ? OWN_ACCOUNT_USERNAMES : COMPETITOR_TWITTER_USERNAMES
  const colors = isOwn ? OWN_ACCOUNT_COLORS : COMPETITOR_COLORS
  const username = usernames[post.competitor]
  const color = colors[post.competitor] || '#6366f1'

  const tweetUrl = (post.tweetId && String(post.tweetId).length > 5 && username)
    ? `https://x.com/${username}/status/${post.tweetId}`
    : post.postUrl || null

  const projects = extractProjects(post.postText)
  const erVal = er(post)

  return (
    <div
      className="rounded-xl p-4 transition-all"
      style={{
        background: '#0d0d14',
        border: `1px solid ${S.border}`,
        borderLeft: `2px solid ${color}`,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
            style={{ background: `${color}18`, color }}
          >
            {post.competitor}
          </span>
          {isOwn && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(0,230,118,0.1)', color: '#00e676', border: '1px solid rgba(0,230,118,0.2)' }}
            >
              ours
            </span>
          )}
          <span className="text-xs" style={{ color: S.muted }}>
            {new Date(post.postDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {post.views > 0 && (
            <span className="text-xs" style={{ color: S.muted }}>
              👁 {fmtNum(post.views)} · ER {erVal.toFixed(2)}%
            </span>
          )}
          {tweetUrl && (
            <a
              href={tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-2.5 py-1 rounded-lg font-medium"
              style={{ background: `${color}18`, border: `1px solid ${color}30`, color }}
            >
              View ↗
            </a>
          )}
        </div>
      </div>

      <p className="text-sm leading-relaxed line-clamp-3 mb-3" style={{ color: S.text }}>
        {post.postText}
      </p>

      {projects.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {projects.map(p => (
            <span
              key={p}
              className="text-xs px-2 py-0.5 rounded-md font-medium"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: S.sub }}
            >
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function Partnerships({ allPosts, competitors }) {
  const [filterComp, setFilterComp] = useState('all')
  const [showOwn, setShowOwn] = useState(true)

  const allAccounts = useMemo(
    () => [...competitors, ...OWN_ACCOUNTS],
    [competitors],
  )

  const partnershipPosts = useMemo(() =>
    allPosts.filter(p =>
      p.category === 'Partnership' &&
      (allAccounts.includes(p.competitor))
    ),
    [allPosts, allAccounts],
  )

  const filtered = useMemo(() => {
    let r = partnershipPosts
    if (!showOwn) r = r.filter(p => !OWN_ACCOUNTS.includes(p.competitor))
    if (filterComp !== 'all') r = r.filter(p => p.competitor === filterComp)
    return r.sort((a, b) => new Date(b.postDate) - new Date(a.postDate))
  }, [partnershipPosts, filterComp, showOwn])

  // per-account partnership count
  const countByCompetitor = useMemo(() => {
    const counts = {}
    for (const p of partnershipPosts) {
      counts[p.competitor] = (counts[p.competitor] || 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [partnershipPosts])

  // all unique project mentions
  const allProjects = useMemo(() => {
    const freq = {}
    for (const p of partnershipPosts) {
      for (const proj of extractProjects(p.postText)) {
        freq[proj] = (freq[proj] || 0) + 1
      }
    }
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20)
  }, [partnershipPosts])

  const accountsWithPartnerships = allAccounts.filter(a => partnershipPosts.some(p => p.competitor === a))

  if (partnershipPosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="text-5xl">🤝</div>
        <div className="text-base font-bold" style={{ color: S.text }}>No partnership posts found</div>
        <div className="text-xs" style={{ color: S.muted }}>
          Posts categorised as "Partnership" will appear here after syncing
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2
          className="text-xl font-bold mb-1"
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Ecosystem & Partnerships
        </h2>
        <p className="text-xs" style={{ color: S.muted }}>
          Who is integrating with whom — track the ecosystem being built around each chain
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: S.muted }}>Total Partnership Posts</div>
          <div className="text-3xl font-bold" style={{ color: S.text }}>{partnershipPosts.length}</div>
          <div className="text-xs mt-1" style={{ color: S.sub }}>across {accountsWithPartnerships.length} accounts</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: S.muted }}>Most Active</div>
          {countByCompetitor[0] && (
            <>
              <div className="text-2xl font-bold" style={{ color: COMPETITOR_COLORS[countByCompetitor[0][0]] || OWN_ACCOUNT_COLORS[countByCompetitor[0][0]] || '#6366f1' }}>
                {countByCompetitor[0][0]}
              </div>
              <div className="text-xs mt-1" style={{ color: S.sub }}>{countByCompetitor[0][1]} partnership posts</div>
            </>
          )}
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: S.muted }}>Top Mentioned Project</div>
          {allProjects[0] && (
            <>
              <div className="text-2xl font-bold" style={{ color: S.text }}>{allProjects[0][0]}</div>
              <div className="text-xs mt-1" style={{ color: S.sub }}>mentioned {allProjects[0][1]}× across posts</div>
            </>
          )}
        </Card>
      </div>

      {/* Leaderboard + Project radar side by side */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: S.muted }}>
            Partnership Activity by Account
          </div>
          <div className="flex flex-col gap-2">
            {countByCompetitor.map(([name, count]) => {
              const maxC = countByCompetitor[0][1] || 1
              const isOwn = OWN_ACCOUNTS.includes(name)
              const color = isOwn ? (OWN_ACCOUNT_COLORS[name] || '#00e676') : (COMPETITOR_COLORS[name] || '#6366f1')
              return (
                <div key={name}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: S.text }}>{name}</span>
                      {isOwn && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,230,118,0.1)', color: '#00e676' }}>us</span>}
                    </div>
                    <span className="text-xs font-medium" style={{ color }}>{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${(count / maxC) * 100}%`, background: color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: S.muted }}>
            Projects Mentioned in Partnerships
          </div>
          <div className="flex flex-wrap gap-2">
            {allProjects.map(([proj, count]) => {
              const maxC = allProjects[0][1] || 1
              const alpha = 0.1 + (count / maxC) * 0.4
              return (
                <span
                  key={proj}
                  className="px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{
                    background: `rgba(6,182,212,${alpha})`,
                    border: `1px solid rgba(6,182,212,${alpha * 1.5})`,
                    color: alpha > 0.3 ? '#a5f3fc' : '#67e8f9',
                  }}
                >
                  {proj} <span className="opacity-60 ml-0.5">×{count}</span>
                </span>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Feed */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: S.muted }}>
            Partnership Posts ({filtered.length})
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOwn(v => !v)}
              className="text-xs px-3 py-1 rounded-lg font-medium transition-all"
              style={
                showOwn
                  ? { background: 'rgba(0,230,118,0.1)', color: '#00e676', border: '1px solid rgba(0,230,118,0.2)' }
                  : { color: S.muted, border: '1px solid rgba(255,255,255,0.06)' }
              }
            >
              {showOwn ? '✓ Incl. ours' : 'Excl. ours'}
            </button>
            <select
              value={filterComp}
              onChange={e => setFilterComp(e.target.value)}
              className="text-xs px-3 py-1 rounded-lg"
              style={{ background: '#0d0d14', border: '1px solid rgba(255,255,255,0.08)', color: S.sub, outline: 'none' }}
            >
              <option value="all">All accounts</option>
              {accountsWithPartnerships.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <div className="text-xs text-center py-8" style={{ color: S.muted }}>No posts match your filters</div>
          ) : (
            filtered.map((post, i) => (
              <PartnershipCard key={post._docId || i} post={post} />
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
