// Vercel serverless function — proxies Twitter API v2
// Bearer token stays server-side, never exposed to the browser

const cache = new Map() // in-memory, resets on cold start
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export default async function handler(req, res) {
  const { username } = req.query
  const BEARER = process.env.TWITTER_BEARER_TOKEN

  if (!BEARER) {
    return res.status(500).json({ error: 'TWITTER_BEARER_TOKEN not configured' })
  }
  if (!username) {
    return res.status(400).json({ error: 'username param required' })
  }

  const cacheKey = `user:${username.toLowerCase()}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return res.json(cached.data)
  }

  const url = `https://api.twitter.com/2/users/by/username/${username}?user.fields=public_metrics,profile_image_url`
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${BEARER}` },
  })

  const data = await resp.json()

  if (resp.ok) {
    cache.set(cacheKey, { data, ts: Date.now() })
  }

  res.status(resp.ok ? 200 : resp.status).json(data)
}
