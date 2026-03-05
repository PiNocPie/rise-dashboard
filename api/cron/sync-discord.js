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

// TicketTool creates private channels named ticket-XXXX (e.g. ticket-0309)
// Channel existence = open ticket (TicketTool deletes the channel on close)
const TICKETTOOL_RE = /^ticket-\d+/i

function isTicketToolChannel(ch) {
  return TICKETTOOL_RE.test(ch.name || '')
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

  const ticketToolChannels = allChannels.filter(isTicketToolChannel) // includes private channels
  const supportChannels = textChannels.filter(isSupportChannel)
  // Mix: support first, then the rest (sorted by position); ticket channels handled separately
  const priorityIds = new Set(supportChannels.map(c => c.id))
  const otherChannels = textChannels
    .filter(c => !priorityIds.has(c.id))
    .sort((a, b) => (a.position || 0) - (b.position || 0))
  const channelsToAnalyze = [
    ...supportChannels,
    ...otherChannels,
  ].slice(0, 40) // max 40 activity channels (leave room for ticket fetches)

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
  }

  // TicketTool ticket detection — each ticket-XXXX channel = 1 open ticket
  for (const channel of ticketToolChannels.slice(0, 50)) {
    let messages = []
    try {
      messages = await dfetch(`/channels/${channel.id}/messages?limit=50`, token)
      await new Promise(r => setTimeout(r, 150))
    } catch {
      continue // bot may not have access yet
    }
    if (!messages.length) continue

    // Messages are returned newest-first; reverse to get chronological order
    const chronological = [...messages].reverse()

    // First non-bot message = ticket opener
    const opener = chronological.find(m => m.author && !m.author.bot)
    if (!opener) continue

    // Last message in channel (newest-first[0])
    const lastMsg = messages[0]
    const idleMs = now - new Date(lastMsg.timestamp).getTime()
    const idleHours = Math.round(idleMs / 3_600_000)

    // Has any non-opener, non-bot replied?
    const hasStaffReply = chronological.some(
      m => !m.author?.bot && m.author?.id !== opener.author?.id
    )

    pendingTickets.push({
      id: opener.id,
      channelId: channel.id,
      channelName: channel.name,
      authorId: opener.author?.id,
      authorName: opener.member?.nick || opener.author?.global_name || opener.author?.username || 'Unknown',
      preview: (opener.content || '').slice(0, 150),
      createdAt: opener.timestamp,
      idleHours,
      hasStaffReply,
      isTicketChannel: true,
      url: `https://discord.com/channels/${guildId}/${channel.id}`,
    })
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
    pendingTickets: pendingTickets
      .sort((a, b) => (a.hasStaffReply ? 1 : 0) - (b.hasStaffReply ? 1 : 0) || b.idleHours - a.idleHours)
      .slice(0, 25),
    recentJoins,
    syncedAt: new Date().toISOString(),
  }

  await db.collection('discord_snapshots').doc(docId).set(snapshot, { merge: true })
  return snapshot
}

function buildDigestLines(snapshots) {
  const bold = (t) => `**${t}**`
  const lines = [`📊 ${bold('RISE Discord Daily Report')}`, '━━━━━━━━━━━━━━━━━━━━', '']

  for (const s of snapshots) {
    const net = s.netChange > 0 ? `+${s.netChange}` : s.netChange < 0 ? `${s.netChange}` : '±0'
    const netIcon = s.netChange > 0 ? '📈' : s.netChange < 0 ? '📉' : '➡️'
    lines.push(`💬 ${bold(s.guildName + ' Discord')}`)
    lines.push(`Members: ${bold(s.memberCount.toLocaleString())} ${s.previousMemberCount != null ? `${netIcon} ${net} vs yesterday` : ''}`)
    lines.push(`Online: ~${s.onlineCount.toLocaleString()}`)
    lines.push(`Messages (24h): ${bold(s.messageCount24h.toLocaleString())}`)
    if (s.activeChannels[0]) {
      lines.push(`Most Active: #${s.activeChannels[0].name} (${s.activeChannels[0].count} msgs)`)
    }
    if (s.activeMembers[0]) {
      lines.push(`Top Member: ${s.activeMembers[0].displayName || s.activeMembers[0].username} (${s.activeMembers[0].count} msgs)`)
    }
    if (s.topicsKeywords?.length > 0) {
      lines.push(`🔥 Hot topics: ${s.topicsKeywords.slice(0, 5).map(k => k.keyword).join(', ')}`)
    }
    if (s.pendingTickets?.length > 0) {
      lines.push(`⚠️ ${bold(s.pendingTickets.length + ' ticket' + (s.pendingTickets.length > 1 ? 's' : '') + ' need attention')}`)
      for (const t of s.pendingTickets.slice(0, 3)) {
        const replyFlag = t.hasStaffReply ? '✅' : '🔴'
        const link = t.url ? ` [view](${t.url})` : ''
        lines.push(`  • ${replyFlag} #${t.channelName} — ${t.authorName}: "${(t.preview || '').slice(0, 60)}…" (idle ${t.idleHours}h)${link}`)
      }
    }
    lines.push('')
  }

  const dashUrl = process.env.DASHBOARD_URL || 'https://rise-dashboard-bice.vercel.app'
  lines.push(`[🔗 Open Dashboard](${dashUrl})`)
  return lines.join('\n')
}

async function sendDiscordDigest(snapshots) {
  const webhook = process.env.DISCORD_DIGEST_WEBHOOK_URL
  if (!webhook) return
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: buildDigestLines(snapshots) }),
    })
  } catch {
    // Discord digest failure is non-fatal
  }
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
  const successSnapshots = []

  if (RISE_ID) {
    try {
      const snap = await analyzeGuild(RISE_ID, 'RISE', TOKEN, db)
      results.push({ server: 'RISE', ok: true, members: snap.memberCount, messages24h: snap.messageCount24h, tickets: snap.pendingTickets.length })
      successSnapshots.push(snap)
    } catch (err) {
      results.push({ server: 'RISE', ok: false, error: err.message })
    }
  }

  if (RISEX_ID) {
    try {
      const snap = await analyzeGuild(RISEX_ID, 'RISEx', TOKEN, db)
      results.push({ server: 'RISEx', ok: true, members: snap.memberCount, messages24h: snap.messageCount24h, tickets: snap.pendingTickets.length })
      successSnapshots.push(snap)
    } catch (err) {
      results.push({ server: 'RISEx', ok: false, error: err.message })
    }
  }

  if (successSnapshots.length > 0) {
    await sendDiscordDigest(successSnapshots)
  }

  return res.json({ ok: true, results, syncedAt: new Date().toISOString() })
}
