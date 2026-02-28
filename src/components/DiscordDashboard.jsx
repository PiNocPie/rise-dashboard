import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, query, orderBy, limit, onSnapshot, doc, setDoc, arrayUnion } from 'firebase/firestore'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const DC = '#5865F2'        // Discord blurple
const DC_DIM = 'rgba(88,101,242,0.15)'
const DC_BORDER = 'rgba(88,101,242,0.3)'

const TABS = [
  { id: 'overview',    label: 'Overview' },
  { id: 'members',     label: 'Members' },
  { id: 'channels',    label: 'Channels' },
  { id: 'discussions', label: 'Discussions' },
  { id: 'trends',      label: 'Trends' },
  { id: 'tickets',     label: 'Tickets' },
]

// ─── tiny helpers ───────────────────────────────────────────────────────────

function Card({ children, className = '' }) {
  return (
    <div
      className={`rounded-lg p-5 ${className}`}
      style={{ backgroundColor: '#242424', border: '1px solid #2d2d2d' }}
    >
      {children}
    </div>
  )
}

function StatBox({ label, value, sub, color = '#e8e8e8' }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-medium" style={{ color: '#888888' }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>{value ?? '—'}</div>
      {sub && <div className="text-xs" style={{ color: '#555555' }}>{sub}</div>}
    </div>
  )
}

function ServerToggle({ selected, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      {[['both', 'Both'], ['rise', 'RISE'], ['risex', 'RISEx']].map(([k, l]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
          style={
            selected === k
              ? { backgroundColor: DC_DIM, color: DC, border: `1px solid ${DC_BORDER}` }
              : { color: '#888888', border: '1px solid #2d2d2d' }
          }
        >
          {l}
        </button>
      ))}
    </div>
  )
}

function TwoServerToggle({ selected, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      {[['rise', 'RISE'], ['risex', 'RISEx']].map(([k, l]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
          style={
            selected === k
              ? { backgroundColor: DC_DIM, color: DC, border: `1px solid ${DC_BORDER}` }
              : { color: '#888888', border: '1px solid #2d2d2d' }
          }
        >
          {l}
        </button>
      ))}
    </div>
  )
}

function MemberAvatar({ member, size = 7 }) {
  const initial = (member.displayName || member.username || '?')[0].toUpperCase()
  if (member.avatar && member.id) {
    return (
      <img
        src={`https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.png?size=64`}
        alt={initial}
        className={`w-${size} h-${size} rounded-full object-cover`}
        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
      />
    )
  }
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center text-xs font-bold`}
      style={{ backgroundColor: '#1e1e1e', color: DC }}
    >
      {initial}
    </div>
  )
}

// ─── Overview tab ────────────────────────────────────────────────────────────

function OverviewTab({ rise, risex }) {
  const totalMembers = (rise?.memberCount || 0) + (risex?.memberCount || 0)
  const totalMsgs    = (rise?.messageCount24h || 0) + (risex?.messageCount24h || 0)
  const totalOnline  = (rise?.onlineCount || 0) + (risex?.onlineCount || 0)
  const totalTickets = (rise?.pendingTickets?.length || 0) + (risex?.pendingTickets?.length || 0)

  return (
    <div className="flex flex-col gap-5">
      {/* Combined stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card><StatBox label="Total Members" value={totalMembers.toLocaleString()} sub="Both servers" /></Card>
        <Card><StatBox label="Messages (24h)" value={totalMsgs.toLocaleString()} sub="Across all channels" /></Card>
        <Card><StatBox label="Online Now" value={totalOnline.toLocaleString()} sub="Approximate" color={DC} /></Card>
        <Card>
          <StatBox
            label="Open Tickets"
            value={totalTickets.toString()}
            sub={totalTickets > 0 ? 'Need attention' : 'All clear'}
            color={totalTickets > 0 ? '#ef4444' : '#00e676'}
          />
        </Card>
      </div>

      {/* Per-server cards */}
      <div className="grid grid-cols-2 gap-4">
        {[['RISE', rise], ['RISEx', risex]].map(([name, snap]) => (
          <Card key={name}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-bold text-white">{name} Discord</div>
                {snap && (
                  <div className="text-xs" style={{ color: '#555555' }}>
                    Synced {new Date(snap.syncedAt).toLocaleString()}
                  </div>
                )}
              </div>
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                style={{ backgroundColor: DC_DIM, border: `1px solid ${DC_BORDER}` }}
              >
                💬
              </div>
            </div>
            {snap ? (
              <>
                <div className="grid grid-cols-2 gap-y-4 gap-x-3">
                  <StatBox label="Members" value={snap.memberCount?.toLocaleString()} />
                  <StatBox label="Online" value={snap.onlineCount?.toLocaleString() || '—'} color={DC} />
                  <StatBox
                    label="Net Change"
                    value={snap.previousMemberCount != null
                      ? (snap.netChange > 0 ? `+${snap.netChange}` : snap.netChange.toString())
                      : '—'}
                    color={snap.netChange > 0 ? '#00e676' : snap.netChange < 0 ? '#ef4444' : '#888888'}
                    sub="vs yesterday"
                  />
                  <StatBox label="Messages (24h)" value={snap.messageCount24h?.toLocaleString()} />
                </div>
                {snap.pendingTickets?.length > 0 && (
                  <div
                    className="mt-4 px-3 py-2 rounded-lg text-xs font-medium"
                    style={{
                      backgroundColor: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      color: '#f87171',
                    }}
                  >
                    ⚠️ {snap.pendingTickets.length} item{snap.pendingTickets.length > 1 ? 's' : ''} pending in support channels
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm" style={{ color: '#555555' }}>No data yet</div>
            )}
          </Card>
        ))}
      </div>

      {/* Recent joins */}
      {((rise?.recentJoins?.length || 0) + (risex?.recentJoins?.length || 0) > 0) && (
        <Card>
          <div className="text-sm font-bold text-white mb-4">Recent Joins (Last 7 Days)</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {[
              ...(rise?.recentJoins || []).map(m => ({ ...m, server: 'RISE' })),
              ...(risex?.recentJoins || []).map(m => ({ ...m, server: 'RISEx' })),
            ]
              .sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt))
              .slice(0, 20)
              .map((m, i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <MemberAvatar member={m} size={6} />
                    <div className="text-sm text-white">{m.displayName || m.username}</div>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: DC_DIM, color: DC }}
                    >
                      {m.server}
                    </span>
                  </div>
                  <div className="text-xs" style={{ color: '#555555' }}>
                    {new Date(m.joinedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── Members tab ─────────────────────────────────────────────────────────────

function MembersTab({ rise, risex }) {
  const [server, setServer] = useState('both')

  let members = []
  if (server === 'rise') {
    members = (rise?.activeMembers || []).map(m => ({ ...m, server: 'RISE' }))
  } else if (server === 'risex') {
    members = (risex?.activeMembers || []).map(m => ({ ...m, server: 'RISEx' }))
  } else {
    const seen = new Set()
    const merged = []
    for (const m of [
      ...(rise?.activeMembers || []).map(m => ({ ...m, server: 'RISE' })),
      ...(risex?.activeMembers || []).map(m => ({ ...m, server: 'RISEx' })),
    ]) {
      const key = `${m.server}-${m.id}`
      if (!seen.has(key)) { seen.add(key); merged.push(m) }
    }
    members = merged.sort((a, b) => b.count - a.count)
  }

  const topN = members.slice(0, 30)
  const maxCount = topN[0]?.count || 1

  return (
    <div className="flex flex-col gap-4">
      <ServerToggle selected={server} onChange={setServer} />

      <Card>
        <div className="text-sm font-bold text-white mb-4">
          Most Active Members (24h) — {topN.length} shown
        </div>
        {topN.length === 0 ? (
          <div className="text-sm" style={{ color: '#888888' }}>No activity data yet</div>
        ) : (
          <div className="flex flex-col gap-1">
            {topN.map((m, i) => {
              const pct = (m.count / maxCount) * 100
              return (
                <div key={`${m.server}-${m.id}`} className="flex items-center gap-3 py-2">
                  <div className="w-5 text-xs text-right shrink-0" style={{ color: '#555555' }}>
                    {i + 1}
                  </div>
                  <MemberAvatar member={m} size={7} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <div className="text-sm text-white truncate">
                        {m.displayName || m.username}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {server === 'both' && (
                          <span
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ backgroundColor: DC_DIM, color: '#818cf8' }}
                          >
                            {m.server}
                          </span>
                        )}
                        <span className="text-xs font-medium text-white">
                          {m.count} msg{m.count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="h-1 rounded-full" style={{ backgroundColor: '#2d2d2d' }}>
                      <div
                        className="h-1 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: i < 3 ? '#00e676' : DC }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Channels tab ─────────────────────────────────────────────────────────────

function ChannelsTab({ rise, risex }) {
  const [server, setServer] = useState('rise')
  const snap = server === 'rise' ? rise : risex
  const channels = snap?.activeChannels || []

  const chartData = channels.slice(0, 10).map(c => ({ name: `#${c.name}`, count: c.count }))

  return (
    <div className="flex flex-col gap-4">
      <TwoServerToggle selected={server} onChange={setServer} />

      <div className="grid grid-cols-2 gap-4">
        {/* Bar list */}
        <Card>
          <div className="text-sm font-bold text-white mb-4">Most Active Channels (24h)</div>
          {channels.length === 0 ? (
            <div className="text-sm" style={{ color: '#888888' }}>No data yet</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {channels.slice(0, 12).map((ch, i) => {
                const maxC = channels[0].count || 1
                const pct = (ch.count / maxC) * 100
                return (
                  <div key={ch.id || i}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-white">#{ch.name}</span>
                      <span className="text-xs" style={{ color: '#888888' }}>{ch.count}</span>
                    </div>
                    <div className="h-1 rounded-full" style={{ backgroundColor: '#2d2d2d' }}>
                      <div
                        className="h-1 rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: i === 0 ? '#00e676' : DC }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Chart */}
        <Card>
          <div className="text-sm font-bold text-white mb-4">Activity Chart</div>
          {chartData.length === 0 ? (
            <div className="text-sm" style={{ color: '#888888' }}>No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 70, right: 16, top: 4, bottom: 4 }}>
                <XAxis
                  type="number"
                  tick={{ fill: '#888888', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#888888', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={68}
                />
                <Tooltip
                  contentStyle={{
                    background: '#2a2a2a',
                    border: '1px solid #3a3a3a',
                    borderRadius: 6,
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: '#e8e8e8' }}
                  itemStyle={{ color: DC }}
                  formatter={v => [v, 'messages']}
                />
                <Bar dataKey="count" fill={DC} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {snap && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid #2d2d2d' }}>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-lg font-bold" style={{ color: DC }}>{snap.totalChannels ?? '—'}</div>
                  <div className="text-xs" style={{ color: '#888888' }}>Text Channels</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-white">{snap.messageCount24h ?? '—'}</div>
                  <div className="text-xs" style={{ color: '#888888' }}>Messages (24h)</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-white">{snap.analyzedChannels ?? '—'}</div>
                  <div className="text-xs" style={{ color: '#888888' }}>Analyzed</div>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

// ─── Discussions tab ──────────────────────────────────────────────────────────

function DiscussionsTab({ rise, risex }) {
  const [server, setServer] = useState('rise')
  const snap = server === 'rise' ? rise : risex
  const keywords = snap?.topicsKeywords || []
  const maxKw = keywords[0]?.count || 1

  return (
    <div className="flex flex-col gap-4">
      <TwoServerToggle selected={server} onChange={setServer} />

      <Card>
        <div className="text-sm font-bold text-white mb-1">Top Keywords in Last 24h</div>
        <div className="text-xs mb-4" style={{ color: '#555555' }}>
          Extracted from all analyzed channels. Bigger = mentioned more often.
        </div>
        {keywords.length === 0 ? (
          <div className="text-sm" style={{ color: '#888888' }}>No data yet — run a sync to populate</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw, i) => {
              const alpha = 0.1 + (kw.count / maxKw) * 0.5
              const fontSize = i < 3 ? 14 : i < 8 ? 12 : 11
              return (
                <div
                  key={kw.keyword}
                  className="px-3 py-1.5 rounded-full font-medium"
                  style={{
                    backgroundColor: `rgba(88,101,242,${alpha})`,
                    border: `1px solid rgba(88,101,242,${alpha * 1.5})`,
                    color: alpha > 0.35 ? '#c7d2fe' : '#818cf8',
                    fontSize,
                  }}
                >
                  {kw.keyword}
                  <span className="ml-1 opacity-50 text-xs">×{kw.count}</span>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Top active members as quick reference */}
      <Card>
        <div className="text-sm font-bold text-white mb-4">Most Discussed By (Top 5)</div>
        {(snap?.activeMembers || []).slice(0, 5).length === 0 ? (
          <div className="text-sm" style={{ color: '#888888' }}>No data yet</div>
        ) : (
          <div className="flex gap-4 flex-wrap">
            {(snap?.activeMembers || []).slice(0, 5).map((m, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <MemberAvatar member={m} size={10} />
                <div className="text-xs text-white text-center max-w-16 truncate">
                  {m.displayName || m.username}
                </div>
                <div className="text-xs font-bold" style={{ color: DC }}>{m.count} msgs</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Trends tab ──────────────────────────────────────────────────────────────

function TrendsTab({ snapshots }) {
  // Build combined daily series sorted chronologically
  const byDate = {}
  for (const s of [...snapshots].sort((a, b) => new Date(a.syncedAt) - new Date(b.syncedAt))) {
    const date = new Date(s.syncedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (!byDate[date]) byDate[date] = { date }
    byDate[date][s.guildName + '_members']  = s.memberCount
    byDate[date][s.guildName + '_messages'] = s.messageCount24h
  }
  const chartData = Object.values(byDate).slice(-30)

  if (chartData.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <div className="text-sm font-medium text-white">Not enough history yet</div>
        <div className="text-xs" style={{ color: '#888888' }}>
          Trends populate after a few daily syncs. Check back tomorrow.
        </div>
      </div>
    )
  }

  const tooltipStyle = {
    contentStyle: { background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: 6, fontSize: '12px' },
    labelStyle: { color: '#e8e8e8' },
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Member growth */}
      <Card>
        <div className="text-sm font-bold text-white mb-4">Member Growth Over Time</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
            <XAxis dataKey="date" tick={{ fill: '#888888', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#888888', fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#888888' }} />
            <Line type="monotone" dataKey="RISE_members"  stroke="#00e676" strokeWidth={2} dot={false} name="RISE" />
            <Line type="monotone" dataKey="RISEx_members" stroke={DC}       strokeWidth={2} dot={false} name="RISEx" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Message volume */}
      <Card>
        <div className="text-sm font-bold text-white mb-4">Daily Message Volume (24h window)</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
            <XAxis dataKey="date" tick={{ fill: '#888888', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#888888', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#888888' }} />
            <Bar dataKey="RISE_messages"  fill="#00e676" name="RISE"  radius={[2, 2, 0, 0]} />
            <Bar dataKey="RISEx_messages" fill={DC}      name="RISEx" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Net change table */}
      <Card>
        <div className="text-sm font-bold text-white mb-4">Daily Net Member Change</div>
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {[...chartData].reverse().map((d, i) => {
            const riseNet = chartData.indexOf(d) > 0
              ? (d.RISE_members  || 0) - (chartData[chartData.indexOf(d) - 1].RISE_members  || 0)
              : 0
            const risexNet = chartData.indexOf(d) > 0
              ? (d.RISEx_members || 0) - (chartData[chartData.indexOf(d) - 1].RISEx_members || 0)
              : 0
            return (
              <div key={i} className="flex items-center justify-between py-1.5 text-xs" style={{ borderBottom: '1px solid #2d2d2d' }}>
                <span style={{ color: '#888888' }}>{d.date}</span>
                <div className="flex gap-6">
                  <span>
                    <span style={{ color: '#555555' }}>RISE </span>
                    <span style={{ color: riseNet > 0 ? '#00e676' : riseNet < 0 ? '#ef4444' : '#888888' }}>
                      {riseNet > 0 ? `+${riseNet}` : riseNet}
                    </span>
                  </span>
                  <span>
                    <span style={{ color: '#555555' }}>RISEx </span>
                    <span style={{ color: risexNet > 0 ? '#00e676' : risexNet < 0 ? '#ef4444' : '#888888' }}>
                      {risexNet > 0 ? `+${risexNet}` : risexNet}
                    </span>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

// ─── Tickets tab ─────────────────────────────────────────────────────────────

function TicketsTab({ rise, risex, resolvedIds, onResolve, isLoggedIn }) {
  const all = [
    ...(rise?.pendingTickets || []).map(t => ({ ...t, server: 'RISE' })),
    ...(risex?.pendingTickets || []).map(t => ({ ...t, server: 'RISEx' })),
  ]
    .filter(t => !resolvedIds.has(`${t.server}-${t.channelId}-${t.id}`))
    .sort((a, b) => (a.hasStaffReply ? 1 : 0) - (b.hasStaffReply ? 1 : 0) || (b.idleHours || b.ageHours || 0) - (a.idleHours || a.ageHours || 0))

  if (all.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-56 gap-3">
        <div className="text-4xl">✅</div>
        <div className="text-base font-bold text-white">No pending tickets</div>
        <div className="text-xs" style={{ color: '#888888' }}>
          All support channels look clear right now
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-white">
          {all.length} Item{all.length !== 1 ? 's' : ''} Need Attention
        </div>
        <div
          className="text-xs px-2.5 py-1 rounded-lg font-medium"
          style={{
            backgroundColor: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#f87171',
          }}
        >
          ⚠️ Action Required
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {all.map((t, i) => {
          const idleH = t.idleHours ?? t.ageHours ?? 0
          const urgency = !t.hasStaffReply && idleH > 24
            ? 'rgba(239,68,68,0.25)'
            : idleH > 6
            ? 'rgba(245,158,11,0.15)'
            : '#2d2d2d'
          const idleColor = idleH > 24 ? '#ef4444' : idleH > 6 ? '#f59e0b' : '#888888'

          return (
            <div
              key={`${t.server}-${t.id}-${i}`}
              className="rounded-lg p-4"
              style={{ backgroundColor: '#242424', border: `1px solid ${urgency}` }}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-xs px-2 py-0.5 rounded font-medium"
                    style={{ backgroundColor: DC_DIM, color: '#818cf8' }}
                  >
                    {t.server}
                  </span>
                  <span className="text-xs" style={{ color: '#888888' }}>
                    #{t.channelName}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={
                      t.hasStaffReply
                        ? { backgroundColor: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.2)', color: '#00e676' }
                        : { backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }
                    }
                  >
                    {t.hasStaffReply ? '✅ Replied' : '🔴 No reply'}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-medium" style={{ color: idleColor }}>
                    idle {idleH}h
                  </span>
                  {t.url && (
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-2.5 py-1 rounded-lg font-medium transition-all"
                      style={{ backgroundColor: DC_DIM, border: `1px solid ${DC_BORDER}`, color: DC }}
                    >
                      View ↗
                    </a>
                  )}
                  {isLoggedIn && (
                    <button
                      onClick={() => onResolve(`${t.server}-${t.channelId}-${t.id}`)}
                      className="text-xs px-2.5 py-1 rounded-lg font-medium transition-all"
                      style={{ backgroundColor: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.25)', color: '#00e676' }}
                    >
                      ✓ Resolve
                    </button>
                  )}
                </div>
              </div>
              <div className="text-xs font-semibold mb-1" style={{ color: '#888888' }}>
                {t.authorName}
              </div>
              <div className="text-sm leading-relaxed" style={{ color: '#e8e8e8' }}>
                {t.preview || <span style={{ color: '#555555' }}>(no text)</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main DiscordDashboard ────────────────────────────────────────────────────

export default function DiscordDashboard({ isLoggedIn, onRefresh, refreshing, dateFrom, dateTo }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)
  const [resolvedIds, setResolvedIds] = useState(new Set())

  useEffect(() => {
    const q = query(
      collection(db, 'discord_snapshots'),
      orderBy('syncedAt', 'desc'),
      limit(60),
    )
    const unsub = onSnapshot(q, (snap) => {
      setSnapshots(snap.docs.map(d => ({ ...d.data(), _docId: d.id })))
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // Listen to resolved tickets
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'discord_meta', 'resolved_tickets'), (snap) => {
      if (snap.exists()) setResolvedIds(new Set(snap.data().ids || []))
    })
    return () => unsub()
  }, [])

  const handleResolve = async (ticketKey) => {
    await setDoc(doc(db, 'discord_meta', 'resolved_tickets'), { ids: arrayUnion(ticketKey) }, { merge: true })
  }

  // Filter snapshots by date range, then pick latest per server within that window
  const filtered = snapshots.filter(s => {
    const t = new Date(s.syncedAt).getTime()
    if (dateFrom && t < new Date(dateFrom).getTime()) return false
    if (dateTo) {
      const to = new Date(dateTo)
      to.setSeconds(59, 999)
      if (t > to.getTime()) return false
    }
    return true
  })

  const pool = (dateFrom || dateTo) ? filtered : snapshots
  const rise  = pool.find(s => s.guildName === 'RISE')
  const risex = pool.find(s => s.guildName === 'RISEx')

  const totalTickets =
    (rise?.pendingTickets?.length || 0) + (risex?.pendingTickets?.length || 0)

  const lastSync = rise || risex
    ? new Date(Math.max(
        rise?.syncedAt  ? new Date(rise.syncedAt).getTime()  : 0,
        risex?.syncedAt ? new Date(risex.syncedAt).getTime() : 0,
      )).toLocaleString()
    : null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: '#888888' }}>Loading Discord intelligence…</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-tab bar + refresh */}
      <div className="flex items-center justify-between">
        <div className="flex gap-0.5">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-1.5"
              style={
                activeTab === tab.id
                  ? { backgroundColor: DC_DIM, color: DC, border: `1px solid ${DC_BORDER}` }
                  : { color: '#888888', border: '1px solid transparent' }
              }
            >
              {tab.label}
              {tab.id === 'tickets' && totalTickets > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                  style={{ backgroundColor: '#ef4444', color: '#fff' }}
                >
                  {totalTickets}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {lastSync && (
            <div className="text-xs" style={{ color: '#555555' }}>
              Updated: {lastSync}
            </div>
          )}
          {isLoggedIn && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
              style={{
                backgroundColor: refreshing ? 'transparent' : DC_DIM,
                border: `1px solid ${DC_BORDER}`,
                color: refreshing ? '#555555' : DC,
                cursor: refreshing ? 'not-allowed' : 'pointer',
              }}
            >
              {refreshing ? '⟳ Syncing…' : '⟳ Refresh'}
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!rise && !risex ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="text-5xl">💬</div>
          <div className="text-base font-bold text-white">No Discord data yet</div>
          <div
            className="text-xs text-center max-w-sm leading-relaxed"
            style={{ color: '#888888' }}
          >
            Add these to your Vercel environment variables, then click Refresh:
            <br />
            <code className="mt-1 block" style={{ color: '#888888' }}>
              DISCORD_BOT_TOKEN · DISCORD_RISE_GUILD_ID · DISCORD_RISEX_GUILD_ID
            </code>
          </div>
          {isLoggedIn && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="mt-2 px-5 py-2.5 text-sm font-bold rounded-lg"
              style={{ backgroundColor: DC, color: '#fff', cursor: refreshing ? 'not-allowed' : 'pointer' }}
            >
              {refreshing ? 'Syncing…' : 'Sync Discord Now'}
            </button>
          )}
        </div>
      ) : (
        <>
          {activeTab === 'overview'    && <OverviewTab    rise={rise} risex={risex} />}
          {activeTab === 'members'     && <MembersTab     rise={rise} risex={risex} />}
          {activeTab === 'channels'    && <ChannelsTab    rise={rise} risex={risex} />}
          {activeTab === 'discussions' && <DiscussionsTab rise={rise} risex={risex} />}
          {activeTab === 'trends'      && <TrendsTab      snapshots={snapshots} />}
          {activeTab === 'tickets'     && <TicketsTab     rise={rise} risex={risex} resolvedIds={resolvedIds} onResolve={handleResolve} isLoggedIn={isLoggedIn} />}
        </>
      )}
    </div>
  )
}
