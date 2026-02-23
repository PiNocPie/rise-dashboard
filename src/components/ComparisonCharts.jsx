import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, Cell,
} from 'recharts'
import { COMPETITOR_COLORS } from '../data/constants'

function engRate(post) {
  if (!post.views) return 0
  return ((post.likes + post.retweets + post.replies) / post.views) * 100
}

function getWeekStart(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  const day = d.getDay() // 0 = Sun
  const diff = (day === 0 ? -6 : 1) - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  return mon.toISOString().split('T')[0]
}

const TICK_STYLE = { fill: '#4b5563', fontSize: 11 }
const AXIS_LINE = { stroke: '#1a1a2e' }
const GRID_COLOR = '#1a1a2e'

function ChartCard({ title, children }) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: '#11111e', border: '1px solid #1a1a2e' }}>
      <h3 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#6b7280' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function CustomTooltip({ active, payload, label, fmt }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg p-3 shadow-2xl text-xs"
      style={{ backgroundColor: '#11111e', border: '1px solid #2a2a3e' }}
    >
      <div className="mb-1.5 font-medium" style={{ color: '#9ca3af' }}>{label}</div>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
          <span style={{ color: '#9ca3af' }}>{entry.name}:</span>
          <span className="font-semibold" style={{ color: '#e2e8f0' }}>
            {fmt ? fmt(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function fmtK(v) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`
  return String(v)
}

export default function ComparisonCharts({ posts, competitors }) {
  if (!posts.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2" style={{ color: '#374151' }}>
        <div className="text-4xl">📊</div>
        <p className="text-sm">No data yet — log some posts first.</p>
      </div>
    )
  }

  // Per-competitor aggregates
  const barData = competitors.map(c => {
    const cp = posts.filter(p => p.competitor === c)
    if (!cp.length) return { name: c, views: 0, likes: 0, er: 0, count: 0 }
    return {
      name: c,
      views: Math.round(cp.reduce((s, p) => s + p.views, 0) / cp.length),
      likes: Math.round(cp.reduce((s, p) => s + p.likes, 0) / cp.length),
      retweets: Math.round(cp.reduce((s, p) => s + p.retweets, 0) / cp.length),
      er: parseFloat((cp.reduce((s, p) => s + engRate(p), 0) / cp.length).toFixed(2)),
      count: cp.length,
    }
  })

  // Weekly frequency data
  const weekMap = {}
  posts.forEach(p => {
    const w = getWeekStart(p.postDate)
    if (!w) return
    if (!weekMap[w]) weekMap[w] = {}
    weekMap[w][p.competitor] = (weekMap[w][p.competitor] || 0) + 1
  })
  const lineData = Object.entries(weekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, counts]) => ({
      week: week.slice(5), // MM-DD
      ...competitors.reduce((acc, c) => ({ ...acc, [c]: counts[c] || 0 }), {}),
    }))

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">Comparison Charts</h2>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Side-by-side metrics across competitors</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Avg Views */}
        <ChartCard title="Avg Views per Post">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="2 4" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="name" tick={TICK_STYLE} axisLine={AXIS_LINE} tickLine={false} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={fmtK} width={40} />
              <Tooltip content={<CustomTooltip fmt={v => v.toLocaleString()} />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="views" name="Avg Views" radius={[4, 4, 0, 0]}>
                {barData.map((entry) => (
                  <Cell key={entry.name} fill={COMPETITOR_COLORS[entry.name] || '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Avg Likes */}
        <ChartCard title="Avg Likes per Post">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="2 4" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="name" tick={TICK_STYLE} axisLine={AXIS_LINE} tickLine={false} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={fmtK} width={40} />
              <Tooltip content={<CustomTooltip fmt={v => v.toLocaleString()} />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="likes" name="Avg Likes" radius={[4, 4, 0, 0]}>
                {barData.map((entry) => (
                  <Cell key={entry.name} fill={COMPETITOR_COLORS[entry.name] || '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Avg Engagement Rate */}
        <ChartCard title="Avg Engagement Rate (%)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="2 4" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="name" tick={TICK_STYLE} axisLine={AXIS_LINE} tickLine={false} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={42} />
              <Tooltip content={<CustomTooltip fmt={v => `${v}%`} />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="er" name="Avg ER %" radius={[4, 4, 0, 0]}>
                {barData.map((entry) => (
                  <Cell key={entry.name} fill={COMPETITOR_COLORS[entry.name] || '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Posting Frequency Over Time */}
        <ChartCard title="Posting Frequency (Weekly)">
          {lineData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="2 4" stroke={GRID_COLOR} />
                <XAxis dataKey="week" tick={TICK_STYLE} axisLine={AXIS_LINE} tickLine={false} />
                <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#2a2a3e', strokeWidth: 1 }} />
                <Legend
                  wrapperStyle={{ paddingTop: 8 }}
                  formatter={v => <span style={{ color: '#6b7280', fontSize: 11 }}>{v}</span>}
                />
                {competitors.map(c => (
                  <Line
                    key={c}
                    type="monotone"
                    dataKey={c}
                    stroke={COMPETITOR_COLORS[c] || '#6366f1'}
                    strokeWidth={2}
                    dot={{ fill: COMPETITOR_COLORS[c] || '#6366f1', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-52 text-sm" style={{ color: '#4b5563' }}>
              Need posts across at least 2 different weeks to show trends.
            </div>
          )}
        </ChartCard>
      </div>

      {/* Summary table */}
      <div className="mt-5 rounded-xl overflow-hidden" style={{ border: '1px solid #1a1a2e' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#0d0d1a' }}>
              {['Competitor', 'Posts', 'Avg Views', 'Avg Likes', 'Avg RTs', 'Avg ER %'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#4b5563' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {barData.map((row, i) => (
              <tr
                key={row.name}
                style={{ backgroundColor: i % 2 === 0 ? '#11111e' : '#0f0f1b', borderTop: '1px solid #1a1a2e' }}
              >
                <td className="px-4 py-3 font-medium flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COMPETITOR_COLORS[row.name] || '#6366f1' }} />
                  {row.name}
                </td>
                <td className="px-4 py-3" style={{ color: '#9ca3af' }}>{row.count}</td>
                <td className="px-4 py-3" style={{ color: '#9ca3af' }}>{row.count ? row.views.toLocaleString() : '—'}</td>
                <td className="px-4 py-3" style={{ color: '#9ca3af' }}>{row.count ? row.likes.toLocaleString() : '—'}</td>
                <td className="px-4 py-3" style={{ color: '#9ca3af' }}>{row.count ? row.retweets?.toLocaleString() : '—'}</td>
                <td className="px-4 py-3 font-medium" style={{ color: row.er > 0 ? '#00e676' : '#4b5563' }}>
                  {row.count ? `${row.er}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
