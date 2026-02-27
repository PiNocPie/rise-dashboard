// Hit this endpoint to preview the new digest format in Slack with sample data
export default async function handler(req, res) {
  const webhook = process.env.SLACK_WEBHOOK_URL
  if (!webhook) return res.status(500).json({ error: 'SLACK_WEBHOOK_URL not set in env vars' })

  const DIV = '─────────────────────'
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const text = [
    `🤖 *RISE Intel — Daily Digest · ${date}*`,
    '',
    `📊 *Activity Summary*`,
    `8 of 11 posted in the last 24h`,
    `*Active:* MegaETH · Monad · Base · Arbitrum · Starknet · Ink · N1 · Nado`,
    `*Silent:* 01 Exchange · RISE · RISEx`,
    DIV,
    `🔥 *Viral* _(top by views)_`,
    '',
    `*1. MegaETH* · _Product Update_`,
    `> We just hit 1M TPS on testnet — and this is only the beginning. Here's what parallel execution actually unlocks for DeFi…`,
    `👁 2.4M · ❤️ 12.1k · 🔁 3.2k · *ER: 0.64%*`,
    `<https://x.com/megaeth/status/1|View Tweet →>`,
    '',
    `*2. Base* · _Community_`,
    `> 1,000,000,000 transactions on Base. Thank you for building with us.`,
    `👁 890k · ❤️ 8.4k · 🔁 1.9k · *ER: 1.15%*`,
    `<https://x.com/base/status/2|View Tweet →>`,
    DIV,
    `⭐ *Stand Out* _(highest engagement rate)_`,
    '',
    `*1. N1* · _Technical/Educational_`,
    `> Why execution layer parallelism matters more than you think — a breakdown no one asked for but everyone needed 🧵`,
    `👁 45k · ❤️ 890 · 🔁 234 · *ER: 2.50%*`,
    `<https://x.com/n1chain/status/3|View Tweet →>`,
    '',
    `*2. Nado* · _Meme/Engagement Bait_`,
    `> cope`,
    `👁 12k · ❤️ 340 · 🔁 89 · *ER: 3.57%*`,
    `<https://x.com/Nadohq/status/4|View Tweet →>`,
    DIV,
    `📉 *Low Engagement* _(what didn't land — learn from it)_`,
    '',
    `*1. Starknet* · _Yap_`,
    `> gm everyone, big week ahead 🙏`,
    `👁 24k · ❤️ 89 · 🔁 12 · *ER: 0.42%*`,
    `<https://x.com/Starknet/status/5|View Tweet →>`,
    '',
    `*2. Arbitrum* · _Community_`,
    `> Join us for our weekly community call tomorrow at 3pm UTC`,
    `👁 18k · ❤️ 72 · 🔁 9 · *ER: 0.45%*`,
    `<https://x.com/arbitrum/status/6|View Tweet →>`,
    DIV,
    `👉 <https://rise-dashboard-bice.vercel.app|Open Dashboard>`,
  ].join('\n')

  const resp = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })

  const body = await resp.text()
  if (resp.ok) {
    res.json({ ok: true, message: 'Sample digest sent to Slack' })
  } else {
    res.status(500).json({ ok: false, slackStatus: resp.status, slackResponse: body })
  }
}
