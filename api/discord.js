// Discord REST API proxy — returns raw data for manual lookups
// GET /api/discord?action=guild|channels|messages|members
// action=guild     → info + member count for both RISE & RISEx guilds
// action=channels  → channel list for a guild (?guildId=xxx)
// action=messages  → last 100 messages from a channel (?channelId=xxx)
// action=members   → member list for a guild (?guildId=xxx)

const DISCORD_API = 'https://discord.com/api/v10'

async function dfetch(path, token) {
  const r = await fetch(`${DISCORD_API}${path}`, {
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
  })
  if (!r.ok) {
    const text = await r.text().catch(() => r.statusText)
    throw new Error(`Discord ${r.status}: ${text}`)
  }
  return r.json()
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const TOKEN = process.env.DISCORD_BOT_TOKEN
  if (!TOKEN) return res.status(500).json({ error: 'DISCORD_BOT_TOKEN not configured' })

  const { action, guildId, channelId } = req.query

  try {
    if (action === 'guild') {
      const ids = [
        process.env.DISCORD_RISE_GUILD_ID,
        process.env.DISCORD_RISEX_GUILD_ID,
      ].filter(Boolean)
      if (ids.length === 0) return res.status(500).json({ error: 'No guild IDs configured' })
      const guilds = await Promise.all(ids.map(id => dfetch(`/guilds/${id}?with_counts=true`, TOKEN)))
      return res.json({ guilds })
    }

    if (action === 'channels') {
      if (!guildId) return res.status(400).json({ error: 'guildId required' })
      const channels = await dfetch(`/guilds/${guildId}/channels`, TOKEN)
      return res.json({ channels })
    }

    if (action === 'messages') {
      if (!channelId) return res.status(400).json({ error: 'channelId required' })
      const messages = await dfetch(`/channels/${channelId}/messages?limit=100`, TOKEN)
      return res.json({ messages })
    }

    if (action === 'members') {
      if (!guildId) return res.status(400).json({ error: 'guildId required' })
      const members = await dfetch(`/guilds/${guildId}/members?limit=1000`, TOKEN)
      return res.json({ members })
    }

    return res.status(400).json({ error: `Unknown action: ${action}` })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
