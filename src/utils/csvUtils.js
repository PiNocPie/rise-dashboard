const FIELDS = ['id', 'competitor', 'postUrl', 'postDate', 'postText', 'likes', 'retweets', 'replies', 'views', 'category']

function escapeCSVValue(val) {
  const str = String(val ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else if ((ch === '\r') && !inQuotes) {
      // skip CR
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

export function exportToCSV(posts) {
  const header = FIELDS.join(',')
  const rows = posts.map(post =>
    FIELDS.map(f => escapeCSVValue(post[f])).join(',')
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `rise-intel-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function importFromCSV(file, onData, onError) {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const text = e.target.result
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) {
        onError?.('CSV file has no data rows.')
        return
      }
      const headers = parseCSVLine(lines[0])
      const posts = []
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i])
        const post = {}
        headers.forEach((h, idx) => {
          post[h.trim()] = values[idx] ?? ''
        })
        // Coerce numeric fields
        for (const f of ['likes', 'retweets', 'replies', 'views']) {
          post[f] = Number(post[f]) || 0
        }
        // Ensure id exists
        if (!post.id) post.id = `import-${Date.now()}-${i}`
        posts.push(post)
      }
      onData(posts)
    } catch (err) {
      onError?.(`Parse error: ${err.message}`)
    }
  }
  reader.onerror = () => onError?.('Failed to read file.')
  reader.readAsText(file)
}
