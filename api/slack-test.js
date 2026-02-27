// Hit this endpoint to immediately test your Slack webhook
export default async function handler(req, res) {
  const webhook = process.env.SLACK_WEBHOOK_URL
  if (!webhook) return res.status(500).json({ error: 'SLACK_WEBHOOK_URL not set in env vars' })

  const resp = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: '🤖 *RISE Intel — Slack test*\nIf you can see this, your Slack webhook is working. Daily digests will post here every morning at 8am Vietnam time.\n👉 <https://rise-dashboard-bice.vercel.app|Open Dashboard>',
    }),
  })

  const text = await resp.text()
  if (resp.ok) {
    res.json({ ok: true, message: 'Test message sent to Slack' })
  } else {
    res.status(500).json({ ok: false, slackStatus: resp.status, slackResponse: text })
  }
}
