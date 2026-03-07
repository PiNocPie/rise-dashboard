// GET /api/twitter-trends?hours=6
// Fetches recent crypto tweets, extracts trending hashtags, mindshare, and top posts

export default async function handler(req, res) {
  const BEARER = process.env.TWITTER_BEARER_TOKEN
  if (!BEARER) return res.status(500).json({ error: 'TWITTER_BEARER_TOKEN not set' })

  const hours = Math.min(parseInt(req.query.hours || '6'), 24)
  const since = new Date(Date.now() - hours * 3_600_000).toISOString()

  // Custom topic — supports @username (→ from:user) or keyword search
  const CRYPTO_ANCHOR = '(crypto OR blockchain OR web3 OR defi OR ethereum OR bitcoin OR solana OR nft OR token OR layer2 OR l2 OR altcoin OR dex OR dao OR airdrop OR mainnet OR testnet OR protocol)'
  const customQ = (req.query.q || '').trim()

  let baseQuery
  if (!customQ) {
    baseQuery = '(crypto OR bitcoin OR ethereum OR defi OR web3 OR solana OR altcoin OR nft OR blockchain) lang:en -is:retweet'
  } else if (customQ.startsWith('@')) {
    // Explicit @username → scan that account's tweets directly (no crypto anchor needed)
    const handle = customQ.replace(/^@/, '').trim()
    baseQuery = `from:${handle} -is:retweet`
  } else {
    // Keyword search anchored to crypto context
    baseQuery = `(${customQ}) ${CRYPTO_ANCHOR} lang:en -is:retweet`
  }

  const params = new URLSearchParams({
    query: baseQuery,
    'tweet.fields': 'public_metrics,created_at,entities,author_id',
    'user.fields': 'name,username,public_metrics',
    expansions: 'author_id',
    max_results: '100',
    start_time: since,
  })

  let tweets = [], users = {}
  try {
    const r = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
      headers: { Authorization: `Bearer ${BEARER}` },
    })
    const data = await r.json()
    if (!r.ok) return res.status(r.status).json({ error: data.detail || data.title || 'Twitter API error' })
    tweets = data.data || []
    users = (data.includes?.users || []).reduce((m, u) => { m[u.id] = u; return m }, {})
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  // ── Trending hashtags ──────────────────────────────────────────────────────
  const hashFreq = {}
  for (const tweet of tweets) {
    for (const tag of tweet.entities?.hashtags || []) {
      const key = '#' + tag.tag.toLowerCase()
      hashFreq[key] = (hashFreq[key] || 0) + 1
    }
  }
  const trending = Object.entries(hashFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([tag, count]) => ({ tag, count }))

  // ── Mindshare (project mentions) ──────────────────────────────────────────
  const PROJECTS = [
    'bitcoin', 'ethereum', 'solana', 'bnb', 'xrp', 'cardano', 'avalanche',
    'polygon', 'chainlink', 'uniswap', 'aave', 'arbitrum', 'optimism',
    'base', 'starknet', 'monad', 'megaeth', 'rise', 'risex', 'sui', 'aptos',
    'near', 'cosmos', 'injective', 'hyperliquid', 'sei', 'berachain',
  ]
  const mentionCount = {}
  for (const tweet of tweets) {
    const text = (tweet.text || '').toLowerCase()
    for (const proj of PROJECTS) {
      if (text.includes(proj)) mentionCount[proj] = (mentionCount[proj] || 0) + 1
    }
  }
  const mindshare = Object.entries(mentionCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({
      name,
      count,
      pct: tweets.length ? Math.round((count / tweets.length) * 100) : 0,
    }))

  // ── Top tweets by engagement ───────────────────────────────────────────────
  const topTweets = tweets
    .map(t => {
      const author = users[t.author_id] || {}
      const m = t.public_metrics || {}
      return {
        id: t.id,
        text: t.text,
        createdAt: t.created_at,
        views: m.impression_count || 0,
        likes: m.like_count || 0,
        retweets: m.retweet_count || 0,
        replies: m.reply_count || 0,
        authorUsername: author.username || '',
        authorName: author.name || '',
        authorFollowers: author.public_metrics?.followers_count || 0,
      }
    })
    .sort((a, b) => (b.views || b.likes * 10) - (a.views || a.likes * 10))
    .slice(0, 20)

  const totalEngagement = tweets.reduce((s, t) => {
    const m = t.public_metrics || {}
    return s + (m.like_count || 0) + (m.retweet_count || 0)
  }, 0)

  return res.json({
    ok: true,
    trending,
    topTweets,
    mindshare,
    totalTweets: tweets.length,
    totalEngagement,
    hours,
    fetchedAt: new Date().toISOString(),
  })
}
