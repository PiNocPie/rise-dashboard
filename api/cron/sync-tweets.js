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

  // Send Slack digest if webhook is configured
  const slackWebhook = process.env.SLACK_WEBHOOK_URL
  if (slackWebhook) {
    try {
      function fmtNum(n) {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
        return String(n ?? 0)
      }

      // Pull top 3 tweets from last 48h directly from Firestore (no composite index needed)
      const allSnapshot = await db.collection('posts').get()
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      const top3 = allSnapshot.docs
        .map(d => d.data())
        .filter(p => p.autoLogged && p.postDate >= cutoff && p.postText && !p.postText.trim().startsWith('@'))
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, 3)

      const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

      let text = `*🤖 RISE Intel — Daily Update · ${date}*\n`
      text += `${results.added} new tweets synced · ${results.skipped} already tracked\n\n`
      text += `*🔥 Top Tweets Yesterday*\n\n`

      if (top3.length > 0) {
        top3.forEach((p, i) => {
          const username = COMPETITOR_USERNAMES[p.competitor]
          const tweetUrl = username ? `https://x.com/${username}/status/${p.tweetId}` : null
          const er = p.views ? (((p.likes + p.retweets + p.replies) / p.views) * 100).toFixed(2) : null
          const excerpt = p.postText?.length > 140 ? p.postText.slice(0, 140) + '…' : p.postText
          text += `*${i + 1}. ${p.competitor}* · _${p.category}_\n`
          text += `> ${excerpt}\n`
          text += `👁 ${fmtNum(p.views)} views · ❤️ ${fmtNum(p.likes)} · 🔁 ${fmtNum(p.retweets)}`
          if (er) text += ` · *ER: ${er}%*`
          if (tweetUrl) text += `\n<${tweetUrl}|View Tweet →>`
          text += '\n\n'
        })
      } else {
        text += '_No tweets from the last 48 hours yet._\n\n'
      }

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
