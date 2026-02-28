export const RISE_COMPETITORS = [
  'MegaETH', 'Monad', 'N1', 'Ink',
  'Starknet', 'Base', 'Arbitrum', 'Nado', '01 Exchange',
]

export const CONTENT_CATEGORIES = [
  'Product Update',
  'Points/Airdrop',
  'Partnership',
  'Technical/Educational',
  'Article/Longform',
  'Community',
  'Meme/Engagement Bait',
  'Founder Post',
  'Thread',
  'Yap',
  'Video',
  'Other',
]

export const CATEGORY_COLORS = {
  'Product Update': '#6366f1',
  'Points/Airdrop': '#f59e0b',
  'Partnership': '#10b981',
  'Technical/Educational': '#3b82f6',
  'Article/Longform': '#a78bfa',
  'Community': '#8b5cf6',
  'Meme/Engagement Bait': '#ec4899',
  'Founder Post': '#f97316',
  'Thread': '#14b8a6',
  'Yap': '#fb7185',
  'Video': '#22d3ee',
  'Other': '#4b5563',
}

export const COMPETITOR_COLORS = {
  MegaETH: '#6366f1',
  Monad: '#a855f7',
  N1: '#10b981',
  Ink: '#f59e0b',
  Starknet: '#7c3aed',
  Base: '#0052ff',
  Arbitrum: '#12aaff',
  Nado: '#06b6d4',
  '01 Exchange': '#f43f5e',
}

export const COMPETITOR_TWITTER = {
  MegaETH: 'https://x.com/megaeth',
  Monad: 'https://x.com/monad',
  N1: 'https://x.com/n1chain',
  Ink: 'https://x.com/inkonchain',
  Starknet: 'https://x.com/Starknet',
  Base: 'https://x.com/base',
  Arbitrum: 'https://x.com/arbitrum',
  Nado: 'https://x.com/Nadohq',
  '01 Exchange': 'https://x.com/o1_exchange',
}

export const COMPETITOR_TWITTER_USERNAMES = {
  MegaETH: 'megaeth',
  Monad: 'monad',
  N1: 'n1chain',
  Ink: 'inkonchain',
  Starknet: 'Starknet',
  Base: 'base',
  Arbitrum: 'arbitrum',
  Nado: 'Nadohq',
  '01 Exchange': 'o1_exchange',
}

// Discord server config — add guild IDs to Vercel env vars:
//   DISCORD_BOT_TOKEN      — your bot's token
//   DISCORD_RISE_GUILD_ID  — right-click RISE server → Copy Server ID
//   DISCORD_RISEX_GUILD_ID — right-click RISEx server → Copy Server ID
export const DISCORD_SERVERS = [
  { key: 'RISE',  label: 'RISE',  envKey: 'DISCORD_RISE_GUILD_ID' },
  { key: 'RISEx', label: 'RISEx', envKey: 'DISCORD_RISEX_GUILD_ID' },
]

// Our own accounts — shown in Activity tab for self-benchmarking
export const OWN_ACCOUNTS = ['RISE', 'RISEx']

export const OWN_ACCOUNT_COLORS = {
  RISE: '#FF7700',
  RISEx: '#6366f1',
}

export const OWN_ACCOUNT_TWITTER = {
  RISE: 'https://x.com/risechain',
  RISEx: 'https://x.com/risextrade',
}

export const OWN_ACCOUNT_USERNAMES = {
  RISE: 'risechain',
  RISEx: 'risextrade',
}
