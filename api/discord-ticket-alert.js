// POST /api/discord-ticket-alert
// Sends unanswered Discord tickets to the Slack webhook for immediate review

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const webhook = process.env.SLACK_WEBHOOK_URL
  if (!webhook) return res.status(500).json({ error: 'SLACK_WEBHOOK_URL not set' })

  const { tickets } = req.body || {}
  if (!Array.isArray(tickets) || tickets.length === 0) {
    return res.json({ ok: true, sent: 0, message: 'No unanswered tickets to alert' })
  }

  const dashUrl = process.env.DASHBOARD_URL || 'https://rise-dashboard-bice.vercel.app'

  const lines = [
    `🔴 *${tickets.length} unanswered Discord ticket${tickets.length !== 1 ? 's' : ''} need attention*`,
    '',
  ]

  for (const t of tickets) {
    const idleH = t.idleHours ?? 0
    const preview = (t.preview || '(no text)').slice(0, 90)
    const link = t.url ? ` — <${t.url}|view>` : ''
    lines.push(`• *[${t.server}]* #${t.channelName} · ${t.authorName}: "${preview}…" _(idle ${idleH}h)_${link}`)
  }

  lines.push('')
  lines.push(`<${dashUrl}|🔗 Open Discord Dashboard → Tickets>`)

  try {
    const r = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: lines.join('\n') }),
    })
    if (!r.ok) {
      const text = await r.text().catch(() => r.statusText)
      return res.status(502).json({ error: `Slack ${r.status}: ${text}` })
    }
    return res.json({ ok: true, sent: tickets.length })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
