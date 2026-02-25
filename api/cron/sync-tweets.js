// Vercel Cron Job — runs daily at noon UTC
// Fetches tweets from 24-48 hours ago for each competitor and auto-logs to Firestore

import { getApps, initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const COMPETITOR_USERNAMES = {
  MegaETH: 'megaeth',
  Monad: 'monad',
  N1: 'n1chain',
  Hyperliquid: 'HyperliquidX',
  Ink: 'inkonchain',
  Starknet: 'Starknet',
  Base: 'base',
  Arbitrum: 'arbitrum',
  Nado: 'Nadohq',
  '01 Exchange': 'o1_exchange',
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

  if (/🧵|thread|\b1\/\d/.test(t)) return 'Thread'
  if (/\bvideo\b|\bwatch\b|\byoutube\b|youtu\.be|\bstream\b|\bclip\b/.test(t)) return 'Video'
  if (/partner|collab|integrat|excited to (work|partner|welcom)|teaming up|team up/.test(t)) return 'Partnership'
  if (/airdrop|points|reward|earn|claim|incentiv|season/.test(t)) return 'Points/Airdrop'
  if (/launch|ship|deploy|release|update|v\d+\.\d|mainnet|testnet|new feature/.test(t)) return 'Product Update'
  if (/how to|explain|breakdown|deep.?dive|learn|educat|blog|article/.test(t)) return 'Technical/Educational'
  if (/meme|lol|lmao|😂|🤣|gm |wagmi|ngmi|cope |ser |fren /.test(t)) return 'Meme/Engagement Bait'
  if (/community|event|hackathon|grant|bounty|meetup/.test(t)) return 'Community'
  if (/read more|full article|longform|research|report/.test(t)) return 'Article/Longform'

  // Yap = long personal opinion with no links
  if (text.length > 220 && !text.includes('http')) return 'Yap'

  return 'Other'
}

async function fetchTweets(username, startTime, endTime) {
  const params = new URLSearchParams({
    query: `from:${username} -is:retweet`,
    'tweet.fields': 'public_metrics,created_at,text',
    max_results: '100',
    start_time: startTime,
    end_time: endTime,
  })

  const resp = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
    headers: { Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}` },
  })

  const data = await resp.json()
  return data.data || []
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
        await docRef.set({
          id: docId,
          tweetId: tweet.id,
          competitor,
          postDate: tweet.created_at,
          category: classifyTweet(tweet.text),
          views: m.impression_count ?? 0,
          likes: m.like_count ?? 0,
          retweets: m.retweet_count ?? 0,
          replies: m.reply_count ?? 0,
          tweetText: tweet.text,
          autoLogged: true,
          syncedAt: new Date().toISOString(),
        })
        results.added++
      }
    } catch (err) {
      results.errors.push(`${competitor}: ${err.message}`)
    }
  }

  console.log('Tweet sync complete:', results)
  res.json({ ok: true, ...results })
}
