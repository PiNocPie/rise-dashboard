// Hit this endpoint to preview the new digest format in Slack with sample data
export default async function handler(req, res) {
  const webhook = process.env.SLACK_WEBHOOK_URL
  if (!webhook) return res.status(500).json({ error: 'SLACK_WEBHOOK_URL not set in env vars' })

  const DIV = '─────────────────────'
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const text = [
    `🤖 *RISE Intel — Daily Digest · ${date}*`,
    '',
    `📊 *Activity Summary* — 8 of 11 posted`,
    `_Silent: 01 Exchange, RISE, RISEx_`,
    '',
    `• *MegaETH* — 3 posts · _Product Update_ · top: 2.4M views · <https://x.com/megaeth/status/1|best tweet>`,
    `• *Monad* — 2 posts · _Technical/Educational_ · top: 890k views · <https://x.com/monad/status/2|best tweet>`,
    `• *Base* — 5 posts · _Community_ · top: 890k views · <https://x.com/base/status/3|best tweet>`,
    `• *Arbitrum* — 4 posts · _Product Update_ · top: 340k views · <https://x.com/arbitrum/status/4|best tweet>`,
    `• *Starknet* — 2 posts · _Yap_ · top: 24k views · <https://x.com/Starknet/status/5|best tweet>`,
    `• *Ink* — 1 post · _Partnership_ · top: 18k views · <https://x.com/inkonchain/status/6|best tweet>`,
    `• *N1* — 1 post · _Technical/Educational_ · top: 45k views · <https://x.com/n1chain/status/7|best tweet>`,
    `• *Nado* — 2 posts · _Meme/Engagement Bait_ · top: 12k views · <https://x.com/Nadohq/status/8|best tweet>`,
    DIV,
    `🔥 *Viral* _(top by views)_`,
    '',
    `*1. MegaETH* · _Product Update_`,
    `> We just hit 1M TPS on testnet — and this is only the beginning. Parallel execution changes everything about how DeFi apps can be built. No more gas wars, no more frontrunning, no more waiting. Here's what that actually unlocks 🧵`,
    `👁 2.4M · ❤️ 12.1k · 🔁 3.2k · *ER: 0.64%*`,
    `<https://x.com/megaeth/status/1|View Tweet →>`,
    '',
    `*2. Base* · _Community_`,
    `> 1,000,000,000 transactions on Base. One billion. Thank you for building with us. This is only the beginning.`,
    `👁 890k · ❤️ 8.4k · 🔁 1.9k · *ER: 1.15%*`,
    `<https://x.com/base/status/3|View Tweet →>`,
    '',
    `*3. Monad* · _Technical/Educational_`,
    `> People keep asking how Monad achieves 10,000 TPS. Here's the full breakdown: pipelined execution, optimistic parallel execution, and MonadDB — a custom storage layer built from scratch for speed. Long post but worth your time.`,
    `👁 620k · ❤️ 5.1k · 🔁 1.4k · *ER: 1.05%*`,
    `<https://x.com/monad/status/2|View Tweet →>`,
    DIV,
    `⭐ *Stand Out* _(highest engagement rate)_`,
    '',
    `*1. Nado* · _Meme/Engagement Bait_`,
    `> cope`,
    `👁 12k · ❤️ 340 · 🔁 89 · *ER: 3.57%*`,
    `<https://x.com/Nadohq/status/8|View Tweet →>`,
    '',
    `*2. N1* · _Technical/Educational_`,
    `> Why execution layer parallelism matters more than you think — a breakdown no one asked for but everyone needed. If you're building on any L1/L2, this is the architecture decision that will define winners in 2026 🧵`,
    `👁 45k · ❤️ 890 · 🔁 234 · *ER: 2.50%*`,
    `<https://x.com/n1chain/status/7|View Tweet →>`,
    DIV,
    `📉 *Low Engagement* _(what didn't land — learn from it)_`,
    '',
    `*1. Starknet* · _Yap_`,
    `> gm everyone, big week ahead 🙏`,
    `👁 24k · ❤️ 89 · 🔁 12 · *ER: 0.42%*`,
    `<https://x.com/Starknet/status/5|View Tweet →>`,
    '',
    `*2. Arbitrum* · _Community_`,
    `> Join us for our weekly community call tomorrow at 3pm UTC. We'll be discussing the latest governance proposals and answering your questions.`,
    `👁 18k · ❤️ 72 · 🔁 9 · *ER: 0.45%*`,
    `<https://x.com/arbitrum/status/4|View Tweet →>`,
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
