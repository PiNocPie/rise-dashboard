import { useState, useEffect } from 'react'
import { COMPETITOR_TWITTER_USERNAMES } from '../data/constants'

const memCache = new Map()

export function useTwitterFollowers(competitor) {
  const username = COMPETITOR_TWITTER_USERNAMES[competitor]
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(!!username)

  useEffect(() => {
    if (!username) return

    if (memCache.has(username)) {
      setMetrics(memCache.get(username))
      setLoading(false)
      return
    }

    fetch(`/api/twitter?username=${username}`)
      .then(r => r.json())
      .then(d => {
        const m = d.data?.public_metrics || null
        if (m) memCache.set(username, m)
        setMetrics(m)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [username])

  return { metrics, loading }
}

export function useAllTwitterFollowers(competitors) {
  const [allMetrics, setAllMetrics] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const results = {}
    const promises = competitors.map(async (c) => {
      const username = COMPETITOR_TWITTER_USERNAMES[c]
      if (!username) return
      if (memCache.has(username)) {
        results[c] = memCache.get(username)
        return
      }
      try {
        const r = await fetch(`/api/twitter?username=${username}`)
        const d = await r.json()
        const m = d.data?.public_metrics || null
        if (m) {
          memCache.set(username, m)
          results[c] = m
        }
      } catch {}
    })

    Promise.all(promises).then(() => {
      if (active) {
        setAllMetrics(results)
        setLoading(false)
      }
    })

    return () => { active = false }
  }, [competitors.join(',')])

  return { allMetrics, loading }
}
