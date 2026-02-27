// Vercel Cron Job — runs daily at 2am UTC (9am Vietnam time)
// Analyzes RISE & RISEx Discord servers and stores snapshots to Firestore

import { getApps, initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const DISCORD_API = 'https://discord.com/api/v10'

function getDb() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    initializeApp({ credential: cert(serviceAccount) })
  }
  return getFirestore()
}

async function dfetch(path, token) {
  const r = await fetch(`${DISCORD_API}${path}`, {
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
  })
  if (!r.ok) {
    const text = await r.text().catch(() => r.statusText)
    throw new Error(`Discord ${r.status} on ${path}: ${text}`)
  }
  return r.json()
}

// Channel type 0 = GUILD_TEXT
const isTextChannel = (c) => c.type === 0

// Channels to always analyze (support/help/ticket)
function isTicketChannel(ch) {
  const n = (ch.name || '').toLowerCase()
  return n.startsWith('ticket-') || n.startsWith('ticket_') || n === 'tickets'
}

function isSupportChannel(ch) {
  const n = (ch.name || '').toLowerCase()
  return n.includes('help') || n.includes('support') || n.includes('question') || n.includes('faq')
}

// Extract top keywords from messages
const STOP = new Set([
  'the','a','an','is','it','in','on','at','to','for','of','and','or','but',
  'with','this','that','have','has','had','can','will','be','are','was',
  'were','not','if','by','from','your','you','we','i','my','our','they',
  'he','she','its','how','what','when','where','why','who','just','get',
  'got','yes','no','https','http','com','discord','rise','risex',
])

function extractKeywords(messages) {
  const freq = {}
  for (const msg of messages) {
    const words = (msg.content || '')
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, '')       // strip URLs
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
    for (const w of words) {
      if (w.length > 3 && !STOP.has(w)) {
        freq[w] = (freq[w] || 0) + 1
      }
    }
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([keyword, count]) => ({ keyword, count }))
}

async function analyzeGuild(guildId, guildName, token, db) {
  // 1. Guild info (member count, online)
  const guild = await dfetch(`/guilds/${guildId}?with_counts=true`, token)

  // 2. Channel list
  const allChannels = await dfetch(`/guilds/${guildId}/channels`, token)
  const textChannels = allChannels.filter(isTextChannel)

  const ticketChannels = textChannels.filter(isTicketChannel)
  const supportChannels = textChannels.filter(isSupportChannel)
  // Mix: ticket + support first, then the rest (sorted by position)
  const priorityIds = new Set([...ticketChannels, ...supportChannels].map(c => c.id))
  const otherChannels = textChannels
    .filter(c => !priorityIds.has(c.id))
    .sort((a, b) => (a.position || 0) - (b.position || 0))
  const channelsToAnalyze = [
    ...ticketChannels,
    ...supportChannels,
    ...otherChannels,
  ].slice(0, 45) // max 45 channels to stay under rate limits

  const now = Date.now()
  const since24h = now - 24 * 60 * 60 * 1000

  const authorCounts = {}     // { userId: { id, username, displayName, avatar, count } }
  const channelCounts = {}    // { channelId: { id, name, count } }
  const allRecentMsgs = []    // messages in last 24h across all channels
  const pendingTickets = []

  for (const channel of channelsToAnalyze) {
    let messages = []
    try {
      messages = await dfetch(`/channels/${channel.id}/messages?limit=100`, token)
      // Small delay to respect Discord rate limits (50 req/sec)
      await new Promise(r => setTimeout(r, 150))
    } catch {
      continue
    }

    const recent = messages.filter(m => new Date(m.timestamp).getTime() > since24h)

    channelCounts[channel.id] = { id: channel.id, name: channel.name, count: recent.length }

    for (const msg of recent) {
      if (!msg.author || msg.author.bot) continue
      const uid = msg.author.id
      if (!authorCounts[uid]) {
        authorCounts[uid] = {
          id: uid,
          username: msg.author.username,
          displayName: msg.member?.nick || msg.author.global_name || msg.author.username,
          avatar: msg.author.avatar,
          count: 0,
        }
      }
      authorCounts[uid].count++
    }

    allRecentMsgs.push(...recent)

    // Ticket detection — unanswered messages older than 1h in ticket/support channels
    if (isTicketChannel(channel) || isSupportChannel(channel)) {
      for (const msg of messages.slice(0, 20)) {
        if (msg.author?.bot) continue
        const ageHours = (now - new Date(msg.timestamp).getTime()) / 3_600_000
        if (ageHours < 1 || ageHours > 72) continue
        // Flag if no subsequent message from another user (simple heuristic)
        const idx = messages.indexOf(msg)
        const replies = messages.slice(0, idx).filter(m =>
          m.author?.id !== msg.author?.id && !m.author?.bot
        )
        if (replies.length === 0) {
          pendingTickets.push({
            id: msg.id,
            channelId: channel.id,
            channelName: channel.name,
            authorId: msg.author?.id,
            authorName: msg.member?.nick || msg.author?.global_name || msg.author?.username || 'Unknown',
            preview: (msg.content || '').slice(0, 150),
            createdAt: msg.timestamp,
            ageHours: Math.round(ageHours),
            isTicketChannel: isTicketChannel(channel),
            url: `https://discord.com/channels/${guildId}/${channel.id}/${msg.id}`,
          })
          break // one per channel is enough
        }
      }
    }
  }

  const activeMembers = Object.values(authorCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 25)

  const activeChannels = Object.values(channelCounts)
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  const topicsKeywords = extractKeywords(allRecentMsgs)

  // Member count delta vs previous snapshot
  const memberCount = guild.approximate_member_count || guild.member_count || 0
  const onlineCount = guild.approximate_presence_count || 0

  const prevSnaps = await db
    .collection('discord_snapshots')
    .where('guildId', '==', guildId)
    .orderBy('syncedAt', 'desc')
    .limit(2)
    .get()

  const prevCount = prevSnaps.docs.length >= 1
    ? prevSnaps.docs[0].data().memberCount
    : null
  const netChange = prevCount !== null ? memberCount - prevCount : 0

  // Recent joins via member list (requires SERVER MEMBERS INTENT in Discord Dev Portal)
  let recentJoins = []
  try {
    const members = await dfetch(`/guilds/${guildId}/members?limit=1000`, token)
    const sevenDaysAgo = now - 7 * 24 * 3_600_000
    recentJoins = members
      .filter(m => m.joined_at && new Date(m.joined_at).getTime() > sevenDaysAgo)
      .map(m => ({
        id: m.user?.id,
        username: m.user?.username,
        displayName: m.nick || m.user?.global_name || m.user?.username,
        avatar: m.user?.avatar,
        joinedAt: m.joined_at,
      }))
      .sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt))
      .slice(0, 30)
  } catch {
    // SERVER MEMBERS INTENT not enabled — skipped
  }

  const today = new Date().toISOString().slice(0, 10)
  const docId = `${guildId}_${today}`

  const snapshot = {
    guildId,
    guildName,
    date: today,
    memberCount,
    onlineCount,
    netChange,
    previousMemberCount: prevCount,
    messageCount24h: allRecentMsgs.length,
    totalChannels: textChannels.length,
    analyzedChannels: channelsToAnalyze.length,
    activeChannels,
    activeMembers,
    topicsKeywords,
    pendingTickets: pendingTickets.slice(0, 25),
    recentJoins,
    syncedAt: new Date().toISOString(),
  }

  await db.collection('discord_snapshots').doc(docId).set(snapshot, { merge: true })
  return snapshot
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Vercel Cron sends Authorization: Bearer {CRON_SECRET}
  const auth = (req.headers.authorization || '').replace('Bearer ', '')
  if (process.env.CRON_SECRET && auth !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const TOKEN = process.env.DISCORD_BOT_TOKEN
  if (!TOKEN) return res.status(500).json({ error: 'DISCORD_BOT_TOKEN not set' })

  const RISE_ID = process.env.DISCORD_RISE_GUILD_ID
  const RISEX_ID = process.env.DISCORD_RISEX_GUILD_ID
  if (!RISE_ID && !RISEX_ID) {
    return res.status(500).json({ error: 'No Discord guild IDs configured (DISCORD_RISE_GUILD_ID / DISCORD_RISEX_GUILD_ID)' })
  }

  const db = getDb()
  const results = []

  if (RISE_ID) {
    try {
      const snap = await analyzeGuild(RISE_ID, 'RISE', TOKEN, db)
      results.push({ server: 'RISE', ok: true, members: snap.memberCount, messages24h: snap.messageCount24h, tickets: snap.pendingTickets.length })
    } catch (err) {
      results.push({ server: 'RISE', ok: false, error: err.message })
    }
  }

  if (RISEX_ID) {
    try {
      const snap = await analyzeGuild(RISEX_ID, 'RISEx', TOKEN, db)
      results.push({ server: 'RISEx', ok: true, members: snap.memberCount, messages24h: snap.messageCount24h, tickets: snap.pendingTickets.length })
    } catch (err) {
      results.push({ server: 'RISEx', ok: false, error: err.message })
    }
  }

  return res.json({ ok: true, results, syncedAt: new Date().toISOString() })
}
