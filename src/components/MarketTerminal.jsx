// Market Terminal — Bloomberg-style crypto intelligence panel
// Data: CoinGecko (free) · Alternative.me F&G · CryptoCompare news

import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  bg:      '#080808',
  card:    '#0d0d0d',
  row:     '#101010',
  border:  '#1c1c1c',
  border2: '#242424',
  text:    '#d0d0d0',
  dim:     '#999999',
  muted:   '#555555',
  green:   '#00e676',
  red:     '#ff4545',
  amber:   '#f59e0b',
  blue:    '#60a5fa',
  purple:  '#a78bfa',
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtPrice(n) {
  if (n == null) return '—'
  if (n >= 100_000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (n >= 1_000)   return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (n >= 1)       return `$${n.toFixed(4)}`
  if (n >= 0.0001)  return `$${n.toFixed(6)}`
  return `$${n.toFixed(8)}`
}

function fmtBig(n) {
  if (n == null) return '—'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`
  return `$${n.toLocaleString()}`
}

function fmtPct(n) {
  if (n == null) return '—'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function pctColor(n) {
  if (n == null) return T.muted
  return n > 0 ? T.green : n < 0 ? T.red : T.muted
}

function fgColor(val) {
  const v = Number(val)
  if (v >= 75) return T.green
  if (v >= 55) return '#86efac'
  if (v >= 45) return T.amber
  if (v >= 25) return '#f97316'
  return T.red
}

function fgLabel(val) {
  const v = Number(val)
  if (v >= 75) return 'EXTREME GREED'
  if (v >= 55) return 'GREED'
  if (v >= 45) return 'NEUTRAL'
  if (v >= 25) return 'FEAR'
  return 'EXTREME FEAR'
}

// ─── Ticker scroll bar ────────────────────────────────────────────────────────

function Ticker({ coins }) {
  const items = (coins || []).slice(0, 15)
  if (items.length === 0) return null

  // Double items so it can loop seamlessly
  const all = [...items, ...items]

  return (
    <div
      style={{
        overflow: 'hidden',
        borderBottom: `1px solid ${T.border}`,
        background: T.card,
      }}
    >
      <div
        className="flex items-center gap-8 px-4 py-1.5"
        style={{ animation: 'none', overflowX: 'auto', scrollbarWidth: 'none' }}
      >
        {items.map((c, i) => {
          const pct = c.price_change_percentage_24h
          return (
            <span key={i} className="flex items-center gap-1.5 shrink-0 font-mono text-xs">
              <span style={{ color: T.muted }}>{c.symbol?.toUpperCase()}</span>
              <span style={{ color: T.text }}>{fmtPrice(c.current_price)}</span>
              <span style={{ color: pctColor(pct) }}>{fmtPct(pct)}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ─── Stats strip ──────────────────────────────────────────────────────────────

function StatsStrip({ global, fg }) {
  const btcD = global?.market_cap_percentage?.btc
  const ethD = global?.market_cap_percentage?.eth
  const mcap = global?.total_market_cap?.usd
  const mcapChg = global?.market_cap_change_percentage_24h_usd
  const vol = global?.total_volume?.usd

  const stats = [
    {
      label: 'TOTAL MARKET CAP',
      value: fmtBig(mcap),
      sub: mcapChg != null ? fmtPct(mcapChg) + ' 24h' : null,
      subColor: pctColor(mcapChg),
    },
    {
      label: '24H VOLUME',
      value: fmtBig(vol),
      sub: `${global?.active_cryptocurrencies?.toLocaleString() || '—'} coins`,
      subColor: T.muted,
    },
    {
      label: 'BTC DOMINANCE',
      value: btcD != null ? `${btcD.toFixed(1)}%` : '—',
      sub: ethD != null ? `ETH ${ethD.toFixed(1)}%` : null,
      subColor: T.muted,
    },
    fg ? {
      label: 'FEAR & GREED',
      value: fg.value,
      sub: fgLabel(fg.value),
      subColor: fgColor(fg.value),
      valueColor: fgColor(fg.value),
    } : null,
    {
      label: 'MARKETS',
      value: global?.markets?.toLocaleString() || '—',
      sub: 'exchanges',
      subColor: T.muted,
    },
    {
      label: 'DEFI MCap',
      value: fmtBig(global?.total_market_cap?.usd ? global.total_market_cap.usd * 0.055 : null),
      sub: '~5.5% of total',
      subColor: T.muted,
    },
  ].filter(Boolean)

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      {stats.map((s, i) => (
        <div
          key={i}
          className="px-4 py-3"
          style={{
            borderRight: i < stats.length - 1 ? `1px solid ${T.border}` : 'none',
            background: T.card,
          }}
        >
          <div
            className="font-mono tracking-widest mb-1"
            style={{ fontSize: 9, color: T.muted, letterSpacing: '0.08em' }}
          >
            {s.label}
          </div>
          <div
            className="font-mono font-bold"
            style={{ fontSize: 20, color: s.valueColor || T.text, lineHeight: 1.1 }}
          >
            {s.value}
          </div>
          {s.sub && (
            <div className="font-mono mt-0.5" style={{ fontSize: 10, color: s.subColor }}>
              {s.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Fear & Greed meter ───────────────────────────────────────────────────────

function FearGreedMeter({ fg }) {
  if (!fg) return null
  const val = Number(fg.value)
  const color = fgColor(val)

  return (
    <div
      className="px-4 py-4"
      style={{ background: T.card, border: `1px solid ${T.border}` }}
    >
      <div className="font-mono tracking-widest mb-3" style={{ fontSize: 9, color: T.muted }}>
        CRYPTO FEAR & GREED INDEX
      </div>
      {/* Gauge bar */}
      <div className="relative mb-2" style={{ height: 6, background: T.border, borderRadius: 3 }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${val}%`,
            background: `linear-gradient(90deg, ${T.red}, ${T.amber} 50%, ${T.green})`,
            borderRadius: 3,
            transition: 'width 0.5s',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: -3,
            left: `${val}%`,
            transform: 'translateX(-50%)',
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: color,
            border: `2px solid ${T.bg}`,
          }}
        />
      </div>
      <div className="flex justify-between font-mono mb-3" style={{ fontSize: 9, color: T.muted }}>
        <span>EXTREME FEAR</span>
        <span>FEAR</span>
        <span>NEUTRAL</span>
        <span>GREED</span>
        <span>EXTREME GREED</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono font-bold" style={{ fontSize: 32, color, lineHeight: 1 }}>
          {val}
        </span>
        <span className="font-mono font-bold" style={{ fontSize: 13, color }}>
          {fgLabel(val)}
        </span>
      </div>
      {fg.timestamp && (
        <div className="font-mono mt-1" style={{ fontSize: 9, color: T.muted }}>
          Updated {new Date(Number(fg.timestamp) * 1000).toLocaleDateString()}
        </div>
      )}
    </div>
  )
}

// ─── Movers panel ─────────────────────────────────────────────────────────────

function MoversPanel({ coins }) {
  const valid = (coins || []).filter(c => c.price_change_percentage_24h != null)
  const gainers = [...valid].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h).slice(0, 10)
  const losers  = [...valid].sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h).slice(0, 10)

  const Col = ({ title, data, color }) => (
    <div style={{ flex: 1, borderRight: `1px solid ${T.border}` }}>
      <div
        className="px-3 py-2 font-mono tracking-widest"
        style={{ fontSize: 9, color: T.muted, borderBottom: `1px solid ${T.border}`, letterSpacing: '0.08em' }}
      >
        {title}
      </div>
      {data.map((c, i) => (
        <div
          key={c.id}
          className="flex items-center justify-between px-3 py-1.5"
          style={{ borderBottom: `1px solid ${T.border}30`, background: i % 2 === 0 ? T.card : T.row }}
        >
          <div className="flex items-center gap-2 font-mono text-xs">
            <span style={{ color: T.muted, width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
            {c.image && <img src={c.image} alt="" style={{ width: 14, height: 14, borderRadius: '50%' }} />}
            <span style={{ color: T.text }}>{c.symbol?.toUpperCase()}</span>
            <span style={{ color: T.muted, fontSize: 10 }}>{fmtPrice(c.current_price)}</span>
          </div>
          <span className="font-mono text-xs font-bold" style={{ color }}>
            {fmtPct(c.price_change_percentage_24h)}
          </span>
        </div>
      ))}
    </div>
  )

  return (
    <div className="flex" style={{ border: `1px solid ${T.border}` }}>
      <Col title="TOP GAINERS — 24H" data={gainers} color={T.green} />
      <Col title="TOP LOSERS — 24H"  data={losers}  color={T.red}   />
    </div>
  )
}

// ─── Trending panel ───────────────────────────────────────────────────────────

function TrendingPanel({ trending }) {
  if (!trending || trending.length === 0) return null
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}` }}>
      <div
        className="px-3 py-2 font-mono tracking-widest"
        style={{ fontSize: 9, color: T.muted, borderBottom: `1px solid ${T.border}` }}
      >
        🔥 TRENDING NOW
      </div>
      {trending.slice(0, 10).map((item, i) => {
        const c = item.item
        const pct = c.data?.price_change_percentage_24h?.usd
        return (
          <div
            key={c.id}
            className="flex items-center justify-between px-3 py-1.5"
            style={{ borderBottom: `1px solid ${T.border}30`, background: i % 2 === 0 ? T.card : T.row }}
          >
            <div className="flex items-center gap-2 font-mono text-xs">
              <span style={{ color: T.muted, width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
              {c.small && <img src={c.small} alt="" style={{ width: 14, height: 14, borderRadius: '50%' }} />}
              <span style={{ color: T.text }}>{c.symbol}</span>
              {c.market_cap_rank && (
                <span style={{ color: T.muted, fontSize: 10 }}>#{c.market_cap_rank}</span>
              )}
            </div>
            {pct != null ? (
              <span className="font-mono text-xs font-bold" style={{ color: pctColor(pct) }}>
                {fmtPct(pct)}
              </span>
            ) : (
              <span style={{ color: T.amber, fontSize: 10, fontFamily: 'monospace' }}>TRENDING</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Market table ─────────────────────────────────────────────────────────────

const TABLE_COLS = [
  { key: 'market_cap_rank',                          label: '#',       w: 40,  right: true },
  { key: 'name',                                     label: 'NAME',    w: 170, right: false, special: 'name' },
  { key: 'current_price',                            label: 'PRICE',   w: 110, right: true, fmt: fmtPrice },
  { key: 'price_change_percentage_1h_in_currency',   label: '1H%',     w: 72,  right: true, pct: true },
  { key: 'price_change_percentage_24h',              label: '24H%',    w: 72,  right: true, pct: true },
  { key: 'price_change_percentage_7d_in_currency',   label: '7D%',     w: 72,  right: true, pct: true },
  { key: 'total_volume',                             label: 'VOLUME',  w: 105, right: true, fmt: fmtBig },
  { key: 'market_cap',                               label: 'MCAP',    w: 105, right: true, fmt: fmtBig },
  { key: 'ath_change_percentage',                    label: 'ATH%',    w: 72,  right: true, pct: true },
]

function MarketTable({ coins }) {
  const [sortKey, setSortKey] = useState('market_cap_rank')
  const [sortDir, setSortDir] = useState(1)

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => -d)
    else { setSortKey(key); setSortDir(key === 'market_cap_rank' ? 1 : -1) }
  }

  const sorted = [...(coins || [])].sort((a, b) => {
    const av = a[sortKey] ?? (sortDir === 1 ? Infinity : -Infinity)
    const bv = b[sortKey] ?? (sortDir === 1 ? Infinity : -Infinity)
    return (av < bv ? -1 : av > bv ? 1 : 0) * sortDir
  })

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}` }}>
      <div
        className="flex items-center justify-between px-4 py-2 font-mono"
        style={{ fontSize: 9, color: T.muted, borderBottom: `1px solid ${T.border}`, letterSpacing: '0.08em' }}
      >
        <span>MARKETS — TOP {coins?.length || 0} ASSETS</span>
        <span style={{ color: T.muted }}>CLICK COLUMN TO SORT</span>
      </div>

      <div className="overflow-x-auto" style={{ maxHeight: 480, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr style={{ background: '#111' }}>
              {TABLE_COLS.map(col => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  style={{
                    padding: '6px 12px',
                    textAlign: col.right ? 'right' : 'left',
                    fontSize: 9,
                    color: sortKey === col.key ? T.text : T.muted,
                    letterSpacing: '0.08em',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                    borderBottom: `1px solid ${T.border}`,
                    background: '#111',
                    userSelect: 'none',
                  }}
                >
                  {col.label}{sortKey === col.key ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((coin, i) => (
              <tr
                key={coin.id}
                style={{
                  borderBottom: `1px solid ${T.border}22`,
                  background: i % 2 === 0 ? T.card : T.row,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#181818' }}
                onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? T.card : T.row }}
              >
                {TABLE_COLS.map(col => {
                  if (col.special === 'name') {
                    return (
                      <td key={col.key} style={{ padding: '5px 12px', textAlign: 'left' }}>
                        <div className="flex items-center gap-2">
                          {coin.image && (
                            <img src={coin.image} alt="" style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0 }} />
                          )}
                          <span style={{ fontSize: 12, color: T.text, fontFamily: 'monospace' }}>{coin.name}</span>
                          <span style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace' }}>{coin.symbol?.toUpperCase()}</span>
                        </div>
                      </td>
                    )
                  }
                  if (col.pct) {
                    const v = coin[col.key]
                    return (
                      <td key={col.key} style={{ padding: '5px 12px', textAlign: 'right', fontSize: 11, fontFamily: 'monospace', color: pctColor(v), fontWeight: v != null ? 600 : 400 }}>
                        {v != null ? fmtPct(v) : <span style={{ color: T.muted }}>—</span>}
                      </td>
                    )
                  }
                  const v = col.fmt ? col.fmt(coin[col.key]) : (coin[col.key] ?? '—')
                  return (
                    <td key={col.key} style={{ padding: '5px 12px', textAlign: col.right ? 'right' : 'left', fontSize: 11, color: T.text, fontFamily: 'monospace' }}>
                      {v}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── News panel ───────────────────────────────────────────────────────────────

function NewsPanel({ news }) {
  if (!news || news.length === 0) return null

  const CATEGORIES = ['All', 'BTC', 'ETH', 'DeFi', 'Altcoin', 'Blockchain']
  const [cat, setCat] = useState('All')

  const filtered = cat === 'All'
    ? news
    : news.filter(n => (n.categories || '').toUpperCase().includes(cat.toUpperCase()))

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}` }}>
      {/* Header + filters */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderBottom: `1px solid ${T.border}` }}
      >
        <span className="font-mono tracking-widest" style={{ fontSize: 9, color: T.muted }}>
          CRYPTO NEWS
        </span>
        <div className="flex items-center gap-1">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className="font-mono"
              style={{
                fontSize: 9,
                padding: '2px 8px',
                borderRadius: 3,
                border: `1px solid ${cat === c ? T.border2 : 'transparent'}`,
                background: cat === c ? T.border : 'transparent',
                color: cat === c ? T.text : T.muted,
                cursor: 'pointer',
                letterSpacing: '0.05em',
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 3-column news grid */}
      <div className="grid grid-cols-3" style={{ gap: 1, background: T.border }}>
        {filtered.slice(0, 12).map((item, i) => (
          <a
            key={i}
            href={item.url || item.guid}
            target="_blank"
            rel="noopener noreferrer"
            style={{ background: i % 2 === 0 ? T.card : T.row, textDecoration: 'none', display: 'block', padding: '12px 14px' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#161616' }}
            onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? T.card : T.row }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              {item.imageurl && (
                <img
                  src={item.imageurl}
                  alt=""
                  style={{ width: 14, height: 14, borderRadius: 2, objectFit: 'cover', flexShrink: 0 }}
                />
              )}
              <span className="font-mono" style={{ fontSize: 9, color: T.blue, letterSpacing: '0.05em' }}>
                {item.source_info?.name || item.source || 'NEWS'}
              </span>
              <span className="font-mono" style={{ fontSize: 9, color: T.muted }}>
                {item.published_on
                  ? new Date(item.published_on * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : ''}
              </span>
            </div>
            <div style={{ fontSize: 12, color: T.text, lineHeight: 1.5, fontFamily: 'monospace' }}>
              {item.title}
            </div>
            {item.body && (
              <div style={{ fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.5, fontFamily: 'monospace' }}>
                {item.body.slice(0, 120)}…
              </div>
            )}
          </a>
        ))}
      </div>
    </div>
  )
}

// ─── Recently listed (TGE / new coins) ───────────────────────────────────────

function NewListingsPanel({ newCoins }) {
  if (!newCoins || newCoins.length === 0) return null
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}` }}>
      <div
        className="font-mono tracking-widest px-3 py-2"
        style={{ fontSize: 9, color: T.muted, borderBottom: `1px solid ${T.border}` }}
      >
        NEW LISTINGS — RECENTLY ADDED
      </div>
      {newCoins.slice(0, 12).map((c, i) => (
        <div
          key={c.id}
          className="flex items-center justify-between px-3 py-1.5"
          style={{ borderBottom: `1px solid ${T.border}25`, background: i % 2 === 0 ? T.card : T.row }}
        >
          <div className="flex items-center gap-2 font-mono text-xs">
            {c.image && <img src={c.image} alt="" style={{ width: 14, height: 14, borderRadius: '50%' }} />}
            <span style={{ color: T.text }}>{c.name}</span>
            <span style={{ color: T.muted, fontSize: 10 }}>{c.symbol?.toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span style={{ color: T.text }}>{fmtPrice(c.current_price)}</span>
            <span style={{ color: pctColor(c.price_change_percentage_24h) }}>
              {fmtPct(c.price_change_percentage_24h)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MarketTerminal() {
  const [coins, setCoins]       = useState([])
  const [global, setGlobal]     = useState(null)
  const [trending, setTrending] = useState([])
  const [fg, setFg]             = useState(null)
  const [news, setNews]         = useState([])
  const [newCoins, setNewCoins] = useState([])
  const [lastUpdate, setLastUpdate] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [errors, setErrors]     = useState([])

  const fetchAll = useCallback(async () => {
    const errs = []

    const safe = async (label, fn) => {
      try { return await fn() }
      catch (e) { errs.push(`${label}: ${e.message}`); return null }
    }

    const [coinsData, globalData, trendData, fgData, newsData, newCoinsData] = await Promise.all([
      safe('markets', () =>
        fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=1h,24h,7d')
          .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })
      ),
      safe('global', () =>
        fetch('https://api.coingecko.com/api/v3/global')
          .then(r => r.json()).then(d => d.data)
      ),
      safe('trending', () =>
        fetch('https://api.coingecko.com/api/v3/search/trending')
          .then(r => r.json()).then(d => d.coins)
      ),
      safe('f&g', () =>
        fetch('https://api.alternative.me/fng/?limit=1')
          .then(r => r.json()).then(d => d.data?.[0])
      ),
      safe('news', () =>
        fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=BTC,ETH,Altcoin,Blockchain,DeFi&sortOrder=latest')
          .then(r => r.json()).then(d => d.Data || [])
      ),
      safe('new-listings', () =>
        fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=id_desc&per_page=20&page=1&sparkline=false')
          .then(r => r.json())
      ),
    ])

    if (coinsData)   setCoins(coinsData)
    if (globalData)  setGlobal(globalData)
    if (trendData)   setTrending(trendData)
    if (fgData)      setFg(fgData)
    if (newsData)    setNews(newsData)
    if (newCoinsData) setNewCoins(newCoinsData)

    setErrors(errs)
    setLastUpdate(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, 90_000) // refresh every 90s
    return () => clearInterval(id)
  }, [fetchAll])

  return (
    <div style={{ background: T.bg, minHeight: '100%' }}>
      {/* Terminal header */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ background: T.card, borderBottom: `1px solid ${T.border}` }}
      >
        <div className="flex items-center gap-4">
          <span
            className="font-mono font-bold tracking-widest"
            style={{ color: T.text, fontSize: 11, letterSpacing: '0.15em' }}
          >
            RISE INTEL — MARKET TERMINAL
          </span>
          <span className="flex items-center gap-1.5 font-mono" style={{ fontSize: 9 }}>
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: loading ? T.amber : T.green,
              }}
            />
            <span style={{ color: loading ? T.amber : T.green }}>
              {loading ? 'LOADING' : 'LIVE'}
            </span>
          </span>
          {errors.length > 0 && (
            <span className="font-mono" style={{ fontSize: 9, color: T.amber }}>
              ⚠ {errors.length} source{errors.length > 1 ? 's' : ''} unavailable
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {lastUpdate && (
            <span className="font-mono" style={{ fontSize: 9, color: T.muted }}>
              {lastUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={fetchAll}
            className="font-mono"
            style={{
              fontSize: 10,
              padding: '3px 10px',
              border: `1px solid ${T.border2}`,
              background: 'transparent',
              color: T.dim,
              cursor: 'pointer',
              borderRadius: 2,
              letterSpacing: '0.05em',
            }}
          >
            ⟳ REFRESH
          </button>
        </div>
      </div>

      {loading ? (
        <div
          className="flex items-center justify-center font-mono"
          style={{ height: 300, color: T.muted, fontSize: 11, letterSpacing: '0.1em' }}
        >
          CONNECTING TO MARKET DATA…
        </div>
      ) : (
        <div className="flex flex-col gap-px" style={{ background: T.border }}>
          {/* Ticker */}
          <Ticker coins={coins} />

          {/* Stats strip */}
          <StatsStrip global={global} fg={fg} />

          {/* Movers + Fear&Greed + Trending — 3 col */}
          <div className="grid grid-cols-3 gap-px">
            <div className="col-span-1">
              <FearGreedMeter fg={fg} />
            </div>
            <div className="col-span-1">
              <MoversPanel coins={coins} />
            </div>
            <div className="col-span-1">
              <TrendingPanel trending={trending} />
            </div>
          </div>

          {/* Market table */}
          <MarketTable coins={coins} />

          {/* News + New listings — 3:1 split */}
          <div className="grid gap-px" style={{ gridTemplateColumns: '2fr 1fr' }}>
            <NewsPanel news={news} />
            <NewListingsPanel newCoins={newCoins} />
          </div>
        </div>
      )}
    </div>
  )
}
