import { COMPETITOR_COLORS, COMPETITOR_TWITTER, COMPETITOR_TWITTER_USERNAMES, CATEGORY_COLORS } from '../data/constants'
import { useTwitterFollowers } from '../hooks/useTwitterData'

function engagementRate(post) {
  if (!post.views) return 0
  return ((post.likes + post.retweets + post.replies) / post.views) * 100
}

function postsPerWeek(posts) {
  if (posts.length === 0) return '—'
  const dates = posts
    .map(p => new Date(p.postDate).getTime())
    .filter(d => !isNaN(d))
  if (dates.length < 2) return posts.length.toString()
  const minD = Math.min(...dates)
  const maxD = Math.max(...dates)
  const weeks = Math.max((maxD - minD) / (7 * 24 * 60 * 60 * 1000), 1)
  return (posts.length / weeks).toFixed(1)
}

function topCategories(posts) {
  if (!posts.length) return []
  const counts = {}
  posts.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1 })
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, n]) => ({ cat, pct: Math.round((n / posts.length) * 100) }))
}

function fmtNum(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded p-3" style={{ backgroundColor: '#1e1e1e', border: '1px solid #2d2d2d' }}>
      <div className="text-xs uppercase tracking-wider mb-1" style={{ color: '#555' }}>{label}</div>
      <div className="text-lg font-bold" style={{ color: accent || '#e8e8e8' }}>{value}</div>
    </div>
  )
}

function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  )
}

function fmtFollowers(n) {
  if (!n && n !== 0) return null
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function CompetitorCard({ competitor, posts, color }) {
  const twitterUrl = COMPETITOR_TWITTER[competitor]
  const { metrics: twMetrics, loading: twLoading } = useTwitterFollowers(competitor)
  const avgER = posts.length
    ? (posts.reduce((s, p) => s + engagementRate(p), 0) / posts.length).toFixed(2)
    : '—'
  const avgViews = posts.length
    ? fmtNum(Math.round(posts.reduce((s, p) => s + p.views, 0) / posts.length))
    : '—'
  const avgLikes = posts.length
    ? fmtNum(Math.round(posts.reduce((s, p) => s + p.likes, 0) / posts.length))
    : '—'
  const freq = postsPerWeek(posts)
  const cats = topCategories(posts)

  return (
    <div
      className="rounded-lg p-5 flex flex-col gap-4"
      style={{ backgroundColor: '#242424', border: '1px solid #2d2d2d' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="font-semibold text-sm" style={{ color: '#e8e8e8' }}>{competitor}</span>
        {twitterUrl && (
          <a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
            style={{ color: '#555', border: '1px solid #2d2d2d' }}
          >
            <XIcon />
            <span>Profile</span>
          </a>
        )}
        <span
          className="ml-auto text-xs px-2 py-0.5 rounded"
          style={{ backgroundColor: '#1e1e1e', border: '1px solid #2d2d2d', color: '#555' }}
        >
          {posts.length} posts
        </span>
      </div>

      {/* Twitter followers */}
      {(twLoading || twMetrics) && (
        <div className="flex items-center gap-3 px-3 py-2 rounded" style={{ backgroundColor: '#1e1e1e', border: '1px solid #2d2d2d' }}>
          <XIcon />
          {twLoading ? (
            <span className="text-xs" style={{ color: '#555' }}>Loading…</span>
          ) : (
            <>
              <span className="text-sm font-bold" style={{ color: '#e8e8e8' }}>{fmtFollowers(twMetrics.followers_count)}</span>
              <span className="text-xs" style={{ color: '#555' }}>followers</span>
              <span className="ml-auto text-xs" style={{ color: '#555' }}>
                {fmtFollowers(twMetrics.tweet_count)} tweets
              </span>
            </>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Avg Views" value={avgViews} />
        <Stat label="Avg Likes" value={avgLikes} />
        <Stat label="Avg ER" value={posts.length ? `${avgER}%` : '—'} accent={posts.length ? '#00e676' : undefined} />
        <Stat label="Posts / wk" value={freq} />
      </div>

      {/* Top categories */}
      {cats.length > 0 ? (
        <div>
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: '#555' }}>Content Mix</div>
          <div className="space-y-2">
            {cats.map(({ cat, pct }) => (
              <div key={cat} className="flex items-center gap-2">
                <div className="flex-1 rounded-full overflow-hidden" style={{ height: '3px', backgroundColor: '#2d2d2d' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[cat] || color }}
                  />
                </div>
                <span className="text-xs truncate max-w-[110px]" style={{ color: '#888' }}>{cat}</span>
                <span className="text-xs w-8 text-right" style={{ color: '#555' }}>{pct}%</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs italic" style={{ color: '#444' }}>No posts logged yet</p>
      )}
    </div>
  )
}

function HotThisWeek({ posts }) {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recent = posts
    .filter(p => p.autoLogged && p.postText && new Date(p.postDate) >= cutoff)
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 5)

  if (recent.length === 0) return null

  return (
    <div className="mb-8">
      <div className="text-xs uppercase tracking-wider mb-3 font-medium" style={{ color: '#555' }}>
        Hot This Week — top tweets by views
      </div>
      <div className="flex flex-col gap-2">
        {recent.map((post, i) => {
          const color = COMPETITOR_COLORS[post.competitor] || '#6366f1'
          const username = COMPETITOR_TWITTER_USERNAMES[post.competitor]
          const tweetUrl = (post.tweetId && String(post.tweetId).length > 5 && username)
            ? `https://x.com/${username}/status/${post.tweetId}`
            : post.postUrl || null
          const er = post.views
            ? (((post.likes + post.retweets + post.replies) / post.views) * 100).toFixed(2)
            : null
          return (
            <div
              key={post.id || i}
              className="flex items-start gap-3 px-4 py-3 rounded-lg"
              style={{ backgroundColor: '#242424', border: '1px solid #2d2d2d' }}
            >
              <span className="text-sm font-bold w-5 text-center flex-shrink-0" style={{ color: i === 0 ? '#00e676' : '#444' }}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs font-semibold" style={{ color: '#e8e8e8' }}>{post.competitor}</span>
                  <span className="text-xs" style={{ color: '#555' }}>{new Date(post.postDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                </div>
                <p className="text-xs leading-relaxed line-clamp-2" style={{ color: '#888' }}>{post.postText}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0 text-right">
                <span className="text-sm font-bold" style={{ color: '#e8e8e8' }}>{fmtNum(post.views)}</span>
                <span className="text-xs" style={{ color: '#555' }}>views</span>
                {er && <span className="text-xs font-medium" style={{ color: '#00e676' }}>{er}% ER</span>}
              </div>
              {tweetUrl && (
                <a
                  href={tweetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 rounded flex-shrink-0 self-center"
                  style={{ backgroundColor: '#1e1e1e', color: '#888', border: '1px solid #2d2d2d' }}
                >
                  ↗
                </a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function GlobalStat({ label, value, sub, accent }) {
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-1"
      style={{ backgroundColor: '#242424', border: '1px solid #2d2d2d' }}
    >
      <div className="text-xs uppercase tracking-wider" style={{ color: '#555' }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color: accent || '#e8e8e8' }}>{value}</div>
      {sub && <div className="text-xs" style={{ color: '#888' }}>{sub}</div>}
    </div>
  )
}

export default function Dashboard({ posts, competitors }) {
  const totalPosts = posts.length
  const avgER = totalPosts
    ? (posts.reduce((s, p) => s + engagementRate(p), 0) / totalPosts).toFixed(2)
    : '0'
  const avgViews = totalPosts
    ? fmtNum(Math.round(posts.reduce((s, p) => s + p.views, 0) / totalPosts))
    : '—'
  const topCompetitor = (() => {
    if (!totalPosts) return '—'
    const byCount = {}
    posts.forEach(p => { byCount[p.competitor] = (byCount[p.competitor] || 0) + 1 })
    return Object.entries(byCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
  })()
  const mostViral = (() => {
    if (!totalPosts) return '—'
    const top = posts.filter(p => p.views).sort((a, b) => b.views - a.views)[0]
    return top ? `${fmtNum(top.views)} views` : '—'
  })()
  const viralCompetitor = (() => {
    const top = posts.filter(p => p.views).sort((a, b) => b.views - a.views)[0]
    return top?.competitor || ''
  })()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#e8e8e8' }}>Overview</h2>
          <p className="text-xs mt-0.5" style={{ color: '#888' }}>
            {competitors.length} competitors tracked
          </p>
        </div>
      </div>

      {/* Global stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <GlobalStat label="Total Posts" value={totalPosts} />
        <GlobalStat label="Avg Views" value={avgViews} />
        <GlobalStat label="Avg Eng. Rate" value={`${avgER}%`} accent="#00e676" />
        <GlobalStat label="Most Viral Tweet" value={mostViral} sub={viralCompetitor} accent="#f59e0b" />
      </div>

      {/* Hot this week */}
      <HotThisWeek posts={posts} />

      {/* Competitor cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {competitors.map(c => (
          <CompetitorCard
            key={c}
            competitor={c}
            posts={posts.filter(p => p.competitor === c)}
            color={COMPETITOR_COLORS[c] || '#6366f1'}
          />
        ))}
      </div>
    </div>
  )
}
