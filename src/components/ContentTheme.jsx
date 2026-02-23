import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { CATEGORY_COLORS, CONTENT_CATEGORIES, COMPETITOR_COLORS } from '../data/constants'

function buildPieData(posts) {
  const counts = {}
  posts.forEach(p => {
    const cat = p.category || 'Other'
    counts[cat] = (counts[cat] || 0) + 1
  })
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value, pct: Math.round((value / posts.length) * 100) }))
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value, pct } = payload[0].payload
  return (
    <div
      className="rounded-lg p-3 text-xs shadow-2xl"
      style={{ backgroundColor: '#11111e', border: '1px solid #2a2a3e' }}
    >
      <div className="font-semibold mb-0.5" style={{ color: '#e2e8f0' }}>{name}</div>
      <div style={{ color: '#9ca3af' }}>{value} posts · {pct}%</div>
    </div>
  )
}

function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, pct }) {
  if (pct < 8) return null
  const RADIAN = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 11, fill: '#000', fontWeight: 700 }}>
      {pct}%
    </text>
  )
}

function CompetitorPie({ competitor, posts, color }) {
  const pieData = buildPieData(posts)

  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: '#11111e', border: '1px solid #1a1a2e' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-bold text-white">{competitor}</span>
        <span className="ml-auto text-xs" style={{ color: '#4b5563' }}>{posts.length} posts</span>
      </div>

      {pieData.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                labelLine={false}
                label={<CustomLabel />}
              >
                {pieData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={CATEGORY_COLORS[entry.name] || '#4b5563'}
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="mt-3 grid grid-cols-1 gap-1.5">
            {pieData.map(({ name, pct }) => (
              <div key={name} className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[name] || '#4b5563' }}
                />
                <span className="text-xs flex-1 truncate" style={{ color: '#9ca3af' }}>{name}</span>
                <span className="text-xs font-medium" style={{ color: '#6b7280' }}>{pct}%</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-48 text-xs" style={{ color: '#374151' }}>
          No posts logged yet
        </div>
      )}
    </div>
  )
}

function CategoryHeatmap({ posts, competitors }) {
  // Build matrix: competitors × categories
  const matrix = competitors.map(c => {
    const cp = posts.filter(p => p.competitor === c)
    const row = { competitor: c, total: cp.length }
    CONTENT_CATEGORIES.forEach(cat => {
      row[cat] = cp.filter(p => p.category === cat).length
    })
    return row
  })

  const usedCats = CONTENT_CATEGORIES.filter(cat =>
    matrix.some(row => row[cat] > 0)
  )

  if (!usedCats.length) return null

  return (
    <div className="mt-6 rounded-xl overflow-hidden" style={{ border: '1px solid #1a1a2e' }}>
      <div className="px-4 py-3" style={{ backgroundColor: '#0d0d1a', borderBottom: '1px solid #1a1a2e' }}>
        <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#6b7280' }}>
          Category Heatmap
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ backgroundColor: '#0d0d1a' }}>
              <th className="px-4 py-2.5 text-left font-medium" style={{ color: '#4b5563', minWidth: 100 }}>Competitor</th>
              {usedCats.map(cat => (
                <th key={cat} className="px-3 py-2.5 text-center font-medium" style={{ color: '#4b5563', minWidth: 80 }}>
                  <div
                    className="inline-block w-2 h-2 rounded-sm mr-1"
                    style={{ backgroundColor: CATEGORY_COLORS[cat] || '#4b5563', verticalAlign: 'middle' }}
                  />
                  {cat}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr
                key={row.competitor}
                style={{ backgroundColor: i % 2 === 0 ? '#11111e' : '#0f0f1b', borderTop: '1px solid #1a1a2e' }}
              >
                <td className="px-4 py-2.5 font-medium flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COMPETITOR_COLORS[row.competitor] || '#6366f1' }}
                  />
                  {row.competitor}
                </td>
                {usedCats.map(cat => {
                  const count = row[cat]
                  const pct = row.total ? Math.round((count / row.total) * 100) : 0
                  return (
                    <td key={cat} className="px-3 py-2.5 text-center">
                      {count > 0 ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor: `${CATEGORY_COLORS[cat]}22`,
                            color: CATEGORY_COLORS[cat] || '#9ca3af',
                          }}
                        >
                          {count} <span style={{ opacity: 0.6 }}>({pct}%)</span>
                        </span>
                      ) : (
                        <span style={{ color: '#1f2937' }}>—</span>
                      )}
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

export default function ContentTheme({ posts, competitors }) {
  if (!posts.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2" style={{ color: '#374151' }}>
        <div className="text-4xl">🥧</div>
        <p className="text-sm">No posts logged yet.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">Content Themes</h2>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>
          Category breakdown per competitor
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {competitors.map(c => (
          <CompetitorPie
            key={c}
            competitor={c}
            posts={posts.filter(p => p.competitor === c)}
            color={COMPETITOR_COLORS[c] || '#6366f1'}
          />
        ))}
      </div>

      <CategoryHeatmap posts={posts} competitors={competitors} />
    </div>
  )
}
