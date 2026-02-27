// Manual Discord sync trigger — proxies to the cron endpoint with CRON_SECRET
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET
  const headers = { 'Content-Type': 'application/json' }
  if (secret) headers['Authorization'] = `Bearer ${secret}`

  const host = req.headers.host
  const protocol = process.env.VERCEL ? 'https' : 'http'

  try {
    const resp = await fetch(`${protocol}://${host}/api/cron/sync-discord`, {
      method: 'POST',
      headers,
    })
    const data = await resp.json()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
