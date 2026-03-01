// Vercel Cron Job — runs daily at 8am Vietnam time (1am UTC)
// Fetches tweets from 24-48 hours ago for each competitor and auto-logs to Firestore

import { getApps, initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const COMPETITOR_USERNAMES = {
  MegaETH: 'megaeth',
  Monad: 'monad',
  N1: 'n1chain',
  Ink: 'inkonchain',
  Starknet: 'Starknet',
  Base: 'base',
  Arbitrum: 'arbitrum',
  Nado: 'Nadohq',
  '01 Exchange': 'o1_exchange',
  // Own accounts — synced for self-benchmarking
  RISE: 'risechain',
  RISEx: 'risextrade',
}

function getDb() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    initializeApp({ credential: cert(serviceAccount) })
  }
  return getFirestore()
}

function classifyTweet(text) {
  const t = text.toLowerCase()
  const hasLink = text.includes('http')

  if (/🧵|thread|\b1\/\d/.test(t)) return 'Thread'
  if (/\bvideo\b|\bwatch\b|\byoutube\b|youtu\.be|\bstream\b|\bclip\b/.test(t)) return 'Video'
  if (/partner|collab|integrat|excited to (work|partner|welcom)|teaming up|team up/.test(t)) return 'Partnership'
  if (/airdrop|points|reward|earn|claim|incentiv|season/.test(t)) return 'Points/Airdrop'
  if (/launch|ship|deploy|release|update|v\d+\.\d|mainnet|testnet|new feature/.test(t)) return 'Product Update'
  if (/how to|explain|breakdown|deep.?dive|learn|educat|blog|article/.test(t)) return 'Technical/Educational'
  if (/meme|lol|lmao|😂|🤣|gm |wagmi|ngmi|cope |ser |fren /.test(t)) return 'Meme/Engagement Bait'
  if (/community|event|hackathon|grant|bounty|meetup/.test(t)) return 'Community'
  if (/read more|full article|longform|research|report/.test(t)) return 'Article/Longform'

  // Yap = any personal opinion/commentary with no external link
  if (!hasLink) return 'Yap'

  return 'Other'
}

// ─── Mentions sync ─────────────────────────────────────────────────────────────
// Stores tweets mentioning @risechain / @risextrade (not from own accounts) to
// the `mentions` Firestore collection. Runs as part of the daily cron.

const MENTION_TARGETS = [
  { account: 'RISE',  username: 'risechain',   query: '(@risechain OR "rise chain") -from:risechain -from:risextrade -is:retweet' },
  { account: 'RISEx', username: 'risextrade',  query: '(@risextrade OR "risex") -from:risechain -from:risextrade -is:retweet' },
]

async function syncMentions(db, BEARER, startTime, endTime) {
  const added = { RISE: 0, RISEx: 0 }
  for (const target of MENTION_TARGETS) {
    try {
      const params = new URLSearchParams({
        query: target.query,
        'tweet.fields': 'public_metrics,created_at,text,author_id,referenced_tweets',
        'expansions': 'author_id',
        'user.fields': 'name,username,public_metrics',
        max_results: '100',
        start_time: startTime,
        end_time: endTime,
      })
      const resp = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
        headers: { Authorization: `Bearer ${BEARER}` },
      })
      const data = await resp.json()
      const tweets = data.data || []
      const users = (data.includes?.users || []).reduce((m, u) => { m[u.id] = u; return m }, {})

      for (const tweet of tweets) {
        const docId = `mention_${tweet.id}`
        const docRef = db.collection('mentions').doc(docId)
        const existing = await docRef.get()
        if (existing.exists) continue

        const author = users[tweet.author_id] || {}
        const m = tweet.public_metrics || {}
        await docRef.set({
          id: docId,
          tweetId: tweet.id,
          mentionedAccount: target.account,
          authorId: tweet.author_id,
          authorUsername: author.username || '',
          authorName: author.name || '',
          authorFollowers: author.public_metrics?.followers_count || 0,
          isReply: !!(tweet.referenced_tweets?.some(r => r.type === 'replied_to')),
          text: tweet.text,
          views: m.impression_count || 0,
          likes: m.like_count || 0,
          retweets: m.retweet_count || 0,
          replies: m.reply_count || 0,
          createdAt: tweet.created_at,
          syncedAt: new Date().toISOString(),
        })
        added[target.account]++
      }
    } catch (err) {
      console.error(`Mentions sync error for ${target.account}:`, err.message)
    }
  }
  return added
}

async function fetchTweets(username, startTime, endTime) {
  const params = new URLSearchParams({
    query: `from:${username} -is:retweet -is:reply`,
    'tweet.fields': 'public_metrics,created_at,text,conversation_id',
    max_results: '100',
    start_time: startTime,
    end_time: endTime,
  })

  const resp = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
    headers: { Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}` },
  })

  const data = await resp.json()
  const tweets = data.data || []

  // Group thread tweets by conversation_id → merge into one record
  const byConv = {}
  for (const t of tweets) {
    const key = t.conversation_id || t.id
    if (!byConv[key]) byConv[key] = []
    byConv[key].push(t)
  }

  return Object.values(byConv).map(group => {
    if (group.length === 1) return group[0]
    // Sort oldest→newest so thread reads in order
    group.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    const first = group[0]
    // Sum metrics across all tweets in thread
    const m = group.reduce((acc, t) => ({
      impression_count: acc.impression_count + (t.public_metrics.impression_count || 0),
      like_count: acc.like_count + (t.public_metrics.like_count || 0),
      retweet_count: acc.retweet_count + (t.public_metrics.retweet_count || 0),
      reply_count: acc.reply_count + (t.public_metrics.reply_count || 0),
    }), { impression_count: 0, like_count: 0, retweet_count: 0, reply_count: 0 })
    return {
      ...first,
      text: group.map(t => t.text).join('\n\n'),
      public_metrics: m,
      isThread: true,
      threadCount: group.length,
    }
  })
}

export default async function handler(req, res) {
  // Verify this is called by Vercel cron (or allow GET for manual trigger with secret)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const BEARER = process.env.TWITTER_BEARER_TOKEN
  const SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT

  if (!BEARER || !SERVICE_ACCOUNT) {
    return res.status(500).json({ error: 'Missing env vars: TWITTER_BEARER_TOKEN or FIREBASE_SERVICE_ACCOUNT' })
  }

  // Fetch tweets from 48h ago → 24h ago (metrics have had time to settle)
  const now = new Date()
  const endTime = new Date(now - 24 * 60 * 60 * 1000).toISOString()   // 24h ago
  const startTime = new Date(now - 48 * 60 * 60 * 1000).toISOString() // 48h ago

  const db = getDb()
  const results = { added: 0, skipped: 0, errors: [] }
  const newTweets = [] // collect for Slack digest — no extra Firestore query needed

  for (const [competitor, username] of Object.entries(COMPETITOR_USERNAMES)) {
    try {
      const tweets = await fetchTweets(username, startTime, endTime)

      for (const tweet of tweets) {
        const docId = `tw_${tweet.id}`
        const docRef = db.collection('posts').doc(docId)
        const existing = await docRef.get()

        if (existing.exists) {
          results.skipped++
          continue
        }

        const m = tweet.public_metrics
        const record = {
          id: docId,
          tweetId: tweet.id,
          competitor,
          postDate: tweet.created_at,
          category: classifyTweet(tweet.text),
          views: m.impression_count ?? 0,
          likes: m.like_count ?? 0,
          retweets: m.retweet_count ?? 0,
          replies: m.reply_count ?? 0,
          postText: tweet.text,
          isThread: tweet.isThread || false,
          threadCount: tweet.threadCount || 1,
          autoLogged: true,
          syncedAt: new Date().toISOString(),
        }
        await docRef.set(record)
        newTweets.push({ ...record, username })
        results.added++
      }
    } catch (err) {
      results.errors.push(`${competitor}: ${err.message}`)
    }
  }

  console.log('Tweet sync complete:', results)

  // Sync RISE/RISEx mentions from external accounts
  const mentionsAdded = await syncMentions(db, BEARER, startTime, endTime)
  console.log('Mentions sync complete:', mentionsAdded)

  // Send Slack digest if webhook is configured
  const slackWebhook = process.env.SLACK_WEBHOOK_URL
  if (slackWebhook) {
    try {
      function fmtNum(n) {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
        return String(n ?? 0)
      }

      function erVal(p) {
        if (!p.views) return 0
        return (p.likes + p.retweets + p.replies) / p.views
      }

      function fmtTweet(p, i) {
        const username = COMPETITOR_USERNAMES[p.competitor]
        const tweetUrl = username ? `https://x.com/${username}/status/${p.tweetId}` : null
        const er = p.views ? (erVal(p) * 100).toFixed(2) : null
        // Show full tweet text — replace newlines with space to keep Slack quote single-block
        const fullText = (p.postText || '').replace(/\n+/g, ' ')
        let s = `*${i + 1}. ${p.competitor}* · _${p.category}_\n`
        s += `> ${fullText}\n`
        s += `👁 ${fmtNum(p.views)} · ❤️ ${fmtNum(p.likes)} · 🔁 ${fmtNum(p.retweets)}`
        if (er) s += ` · *ER: ${er}%*`
        if (tweetUrl) s += `\n<${tweetUrl}|View Tweet →>`
        return s
      }

      const DIV = '─────────────────────'

      // Pull all posts from last 48h (metrics settled)
      const allSnapshot = await db.collection('posts').get()
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      const recent = allSnapshot.docs
        .map(d => d.data())
        .filter(p => p.autoLogged && p.postDate >= cutoff && p.postText && !p.postText.trim().startsWith('@'))

      // Activity summary — who posted vs silent
      const ALL_ACCOUNTS = Object.keys(COMPETITOR_USERNAMES)
      const postedSet = new Set(recent.map(p => p.competitor))
      const active = ALL_ACCOUNTS.filter(c => postedSet.has(c))
      const silent = ALL_ACCOUNTS.filter(c => !postedSet.has(c))

      // Per-competitor highlight: post count + top category + best tweet views
      const competitorHighlights = active.map(name => {
        const posts = recent.filter(p => p.competitor === name)
        const best = [...posts].sort((a, b) => (b.views || 0) - (a.views || 0))[0]
        const categories = posts.map(p => p.category).filter(Boolean)
        const topCat = categories.length
          ? [...categories.reduce((m, c) => m.set(c, (m.get(c) || 0) + 1), new Map())]
              .sort((a, b) => b[1] - a[1])[0][0]
          : '—'
        const username = COMPETITOR_USERNAMES[name]
        const bestUrl = best?.tweetId && username ? `https://x.com/${username}/status/${best.tweetId}` : null
        const bestViews = best ? ` · top: ${fmtNum(best.views || 0)} views` : ''
        const bestLink = bestUrl ? ` · <${bestUrl}|best tweet>` : ''
        return `• *${name}* — ${posts.length} post${posts.length > 1 ? 's' : ''} · _${topCat}_${bestViews}${bestLink}`
      })

      // Viral — top 3 by views
      const viral = [...recent].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 3)
      const viralIds = new Set(viral.map(p => p.tweetId))

      // Stand out — top 3 by ER (min 500 views, not already viral)
      const standOut = [...recent]
        .filter(p => (p.views || 0) >= 500 && !viralIds.has(p.tweetId))
        .sort((a, b) => erVal(b) - erVal(a))
        .slice(0, 3)

      // Low engagement — bottom 3 by ER (min 1000 views to filter noise)
      const lowEng = [...recent]
        .filter(p => (p.views || 0) >= 1000)
        .sort((a, b) => erVal(a) - erVal(b))
        .slice(0, 3)

      const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

      let text = `🤖 *RISE Intel — Daily Digest · ${date}*\n\n`

      // Section 1: Activity summary + per-competitor highlights
      text += `📊 *Activity Summary* — ${active.length} of ${ALL_ACCOUNTS.length} posted\n`
      if (silent.length) text += `_Silent: ${silent.join(', ')}_\n`
      text += '\n'
      if (competitorHighlights.length) {
        text += competitorHighlights.join('\n') + '\n'
      }
      text += `${DIV}\n`

      // Section 2: Viral
      text += `🔥 *Viral* _(top by views)_\n\n`
      if (viral.length) {
        text += viral.map((p, i) => fmtTweet(p, i)).join('\n\n') + '\n'
      } else {
        text += '_No data yet._\n'
      }
      text += `${DIV}\n`

      // Section 3: Stand Out
      text += `⭐ *Stand Out* _(highest engagement rate)_\n\n`
      if (standOut.length) {
        text += standOut.map((p, i) => fmtTweet(p, i)).join('\n\n') + '\n'
      } else {
        text += '_Not enough data._\n'
      }
      text += `${DIV}\n`

      // Section 4: Low Engagement
      text += `📉 *Low Engagement* _(what didn't land — learn from it)_\n\n`
      if (lowEng.length) {
        text += lowEng.map((p, i) => fmtTweet(p, i)).join('\n\n') + '\n'
      } else {
        text += '_No low-engagement posts with enough reach._\n'
      }
      text += `${DIV}\n`

      text += `👉 <https://rise-dashboard-bice.vercel.app|Open Dashboard>`

      const slackResp = await fetch(slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (!slackResp.ok) {
        const errText = await slackResp.text()
        console.error('Slack error:', slackResp.status, errText)
      } else {
        console.log('Slack digest sent')
      }
    } catch (err) {
      console.error('Slack notify failed:', err.message)
    }
  }

  res.json({ ok: true, ...results })
}
