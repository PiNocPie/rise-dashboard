import { useState, useEffect, useRef } from 'react'
import { db } from './firebase'
import { collection, addDoc, deleteDoc, doc, onSnapshot, writeBatch } from 'firebase/firestore'
import { RISE_COMPETITORS } from './data/constants'
import { exportToCSV, importFromCSV } from './utils/csvUtils'
import TwitterFeed from './components/TwitterFeed'
import Dashboard from './components/Dashboard'
import ComparisonCharts from './components/ComparisonCharts'
import ContentTheme from './components/ContentTheme'
import TopPosts from './components/TopPosts'
import CalendarView from './components/CalendarView'
import ActivityChart from './components/ActivityChart'
import OwnPerformance from './components/OwnPerformance'
import Partnerships from './components/Partnerships'
import Mentions from './components/Mentions'
import DiscordDashboard from './components/DiscordDashboard'
import DateRangePicker from './components/DateRangePicker'

// Two-level navigation: groups + sub-tabs
const NAV = [
  {
    id:    'dashboard',
    label: 'Overview',
    tabs:  [], // direct — no sub-tabs
  },
  {
    id:    'competitive',
    label: 'Competitive',
    tabs: [
      { id: 'activity',   label: 'Activity' },
      { id: 'updates',    label: 'Feed' },
      { id: 'comparison', label: 'Charts' },
      { id: 'themes',     label: 'Themes' },
      { id: 'ecosystem',  label: 'Ecosystem' },
    ],
  },
  {
    id:    'rise',
    label: 'Our RISE',
    tabs: [
      { id: 'own',      label: 'Performance' },
      { id: 'mentions', label: 'Mentions' },
    ],
  },
  {
    id:    'data',
    label: 'Data',
    tabs: [
      { id: 'posts',    label: 'All Posts' },
      { id: 'calendar', label: 'Calendar' },
    ],
  },
]

// Flat map for lookup: tabId → groupId
const TAB_TO_GROUP = {}
NAV.forEach(g => {
  if (g.tabs.length === 0) TAB_TO_GROUP[g.id] = g.id
  g.tabs.forEach(t => { TAB_TO_GROUP[t.id] = g.id })
})

// All valid tab IDs for hash routing
const ALL_TABS = new Set(Object.keys(TAB_TO_GROUP))

function getHashTab() {
  const hash = window.location.hash.replace('#', '').toLowerCase()
  return ALL_TABS.has(hash) ? hash : 'dashboard'
}

export default function App() {
  const [platform, setPlatform] = useState('twitter')   // 'twitter' | 'discord'
  const [posts, setPosts] = useState([])
  const [activeTab, setActiveTab] = useState(getHashTab)
  const activeGroup = TAB_TO_GROUP[activeTab] || 'dashboard'
  const [importMsg, setImportMsg] = useState(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)
  const [discordRefreshing, setDiscordRefreshing] = useState(false)
  const [discordSyncMsg, setDiscordSyncMsg] = useState(null)
  const importRef = useRef(null)

  const clearDates = () => { setDateFrom(''); setDateTo('') }

  // Keep URL hash in sync with active tab
  const navigateTo = (tab) => {
    setActiveTab(tab)
    window.location.hash = tab
  }

  // Handle browser back/forward
  useEffect(() => {
    const handler = () => setActiveTab(getHashTab())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  const competitors = RISE_COMPETITORS

  // Sync posts from Firestore in real-time
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'posts'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ ...d.data(), _docId: d.id }))
      setPosts(data)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const filteredPosts = posts.filter(p => {
    if (!competitors.includes(p.competitor)) return false
    const postDate = new Date(p.postDate)
    if (dateFrom && postDate < new Date(dateFrom)) return false
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      if (postDate > to) return false
    }
    return true
  })

  const handleGroupClick = (groupId) => {
    const group = NAV.find(g => g.id === groupId)
    if (!group) return
    navigateTo(group.tabs.length > 0 ? group.tabs[0].id : group.id)
  }

  const handleTabClick = (tabId) => {
    navigateTo(tabId)
  }

  const handleLogin = () => {
    if (loginPassword !== 'deeznuts69@') {
      setLoginError('Wrong password')
      return
    }
    setIsLoggedIn(true)
    setShowLogin(false)
    setLoginPassword('')
    setLoginError('')
  }

  const handleAddPost = async (post) => {
    const newPost = { ...post, id: `post-${Date.now()}-${Math.random().toString(36).slice(2)}` }
    await addDoc(collection(db, 'posts'), newPost)
  }

  const handleDeletePost = async (id) => {
    const post = posts.find(p => p.id === id)
    if (post?._docId) await deleteDoc(doc(db, 'posts', post._docId))
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const resp = await fetch('/api/sync')
      const data = await resp.json()
      setSyncMsg(data.ok ? `Sync done — ${data.added} added, ${data.skipped} skipped` : `Sync failed: ${data.error}`)
    } catch {
      setSyncMsg('Sync failed: network error')
    }
    setSyncing(false)
    setTimeout(() => setSyncMsg(null), 5000)
  }

  const handleDiscordRefresh = async () => {
    setDiscordRefreshing(true)
    setDiscordSyncMsg(null)
    try {
      const resp = await fetch('/api/discord-sync', { method: 'POST' })
      const data = await resp.json()
      if (data.ok) {
        const summary = data.results
          .map(r => r.ok ? `${r.server}: ${r.members} members, ${r.messages24h} msgs` : `${r.server}: failed`)
          .join(' · ')
        setDiscordSyncMsg(`Discord synced — ${summary}`)
      } else {
        setDiscordSyncMsg(`Discord sync failed: ${data.error}`)
      }
    } catch {
      setDiscordSyncMsg('Discord sync failed: network error')
    }
    setDiscordRefreshing(false)
    setTimeout(() => setDiscordSyncMsg(null), 6000)
  }

  const handleExport = () => {
    if (posts.length === 0) return
    exportToCSV(posts)
  }

  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    importFromCSV(
      file,
      async (imported) => {
        const existingIds = new Set(posts.map(p => p.id))
        const newPosts = imported.filter(p => !existingIds.has(p.id))
        const batch = writeBatch(db)
        newPosts.forEach(p => {
          const ref = doc(collection(db, 'posts'))
          batch.set(ref, p)
        })
        await batch.commit()
        setImportMsg(`Imported ${newPosts.length} new posts (${imported.length - newPosts.length} duplicates skipped).`)
        setTimeout(() => setImportMsg(null), 4000)
      },
      (err) => {
        setImportMsg(`Import failed: ${err}`)
        setTimeout(() => setImportMsg(null), 4000)
      }
    )
    e.target.value = ''
  }

  // Dune-style design tokens
  const D = {
    bg:           '#1a1a1a',
    header:       '#141414',
    surface:      '#242424',
    border:       '#2d2d2d',
    accent:       '#00e676',
    accentBg:     'rgba(0,230,118,0.1)',
    accentBorder: 'rgba(0,230,118,0.3)',
    text:         '#e8e8e8',
    sub:          '#888888',
    muted:        '#555555',
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: D.bg, color: D.text }}>
      <header
        style={{
          background: D.header,
          borderBottom: `1px solid ${D.border}`,
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div className="max-w-screen-xl mx-auto px-6">
          <div className="flex items-center justify-between" style={{ height: 52 }}>
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div>
                <span className="font-semibold text-sm" style={{ color: D.text }}>RISE Intel</span>
                <span className="text-xs ml-2" style={{ color: D.muted }}>by Thaiji</span>
              </div>
              {posts.length > 0 && (
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ background: '#2a2a2a', color: D.sub, border: `1px solid ${D.border}` }}
                >
                  {posts.length} posts
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Platform toggle */}
              <div
                className="flex items-center p-0.5 rounded"
                style={{ background: '#1e1e1e', border: `1px solid ${D.border}` }}
              >
                <button
                  onClick={() => setPlatform('twitter')}
                  className="px-3 py-1.5 text-xs font-medium rounded transition-all"
                  style={
                    platform === 'twitter'
                      ? { background: D.accent, color: '#fff' }
                      : { color: D.muted }
                  }
                >
                  𝕏 Twitter
                </button>
                <button
                  onClick={() => setPlatform('discord')}
                  className="px-3 py-1.5 text-xs font-medium rounded transition-all"
                  style={
                    platform === 'discord'
                      ? { background: '#5865F2', color: '#fff' }
                      : { color: D.muted }
                  }
                >
                  Discord
                </button>
              </div>

              {/* Date range */}
              <DateRangePicker
                dateFrom={dateFrom}
                dateTo={dateTo}
                onFromChange={setDateFrom}
                onToChange={setDateTo}
                onClear={clearDates}
              />

              {/* Twitter admin controls */}
              {platform === 'twitter' && isLoggedIn && (
                <>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="px-3 py-1.5 text-xs font-medium rounded transition-all"
                    style={{ border: `1px solid ${D.border}`, color: syncing ? D.muted : D.sub, background: '#1e1e1e' }}
                  >
                    {syncing ? '⟳ Syncing…' : '⟳ Sync'}
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={posts.length === 0}
                    className="px-3 py-1.5 text-xs font-medium rounded"
                    style={{ border: `1px solid ${D.border}`, color: posts.length === 0 ? D.muted : D.sub, background: '#1e1e1e' }}
                  >
                    ↓ CSV
                  </button>
                  <label
                    className="px-3 py-1.5 text-xs font-medium rounded cursor-pointer"
                    style={{ border: `1px solid ${D.border}`, color: D.sub, background: '#1e1e1e' }}
                  >
                    ↑ CSV
                    <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
                  </label>
                </>
              )}

              <button
                onClick={() => isLoggedIn ? setIsLoggedIn(false) : (setShowLogin(true), setLoginPassword(''), setLoginError(''))}
                className="px-3 py-1.5 text-xs font-medium rounded transition-all"
                style={
                  isLoggedIn
                    ? { background: D.accentBg, border: `1px solid ${D.accentBorder}`, color: D.accent }
                    : { border: `1px solid ${D.border}`, color: D.muted, background: '#1e1e1e' }
                }
              >
                {isLoggedIn ? '● Admin' : 'Login'}
              </button>
            </div>
          </div>

          {platform === 'twitter' && (
            <>
              {/* Primary group tabs */}
              <div className="flex items-end gap-0" style={{ borderTop: `1px solid ${D.border}` }}>
                {NAV.map(group => (
                  <button
                    key={group.id}
                    onClick={() => handleGroupClick(group.id)}
                    className="px-5 py-3 text-xs font-medium relative whitespace-nowrap transition-colors"
                    style={
                      activeGroup === group.id
                        ? { color: D.text }
                        : { color: D.muted }
                    }
                  >
                    {group.label}
                    {activeGroup === group.id && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: 2,
                          background: D.accent,
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Sub-tab row */}
              {(() => {
                const group = NAV.find(g => g.id === activeGroup)
                if (!group || group.tabs.length === 0) return null
                return (
                  <div
                    className="flex items-center gap-1 px-1 py-2"
                    style={{ borderTop: `1px solid ${D.border}` }}
                  >
                    {group.tabs.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => handleTabClick(tab.id)}
                        className="px-3 py-1 text-xs font-medium rounded transition-all whitespace-nowrap"
                        style={
                          activeTab === tab.id
                            ? { background: D.accentBg, color: D.accent, border: `1px solid ${D.accentBorder}` }
                            : { color: D.sub, border: '1px solid transparent' }
                        }
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )
              })()}
            </>
          )}
        </div>
      </header>

      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <div className="rounded-lg p-6 w-80 flex flex-col gap-4" style={{ backgroundColor: D.surface, border: `1px solid ${D.border}` }}>
            <h3 className="font-semibold text-sm" style={{ color: D.text }}>Login</h3>
            <p className="text-xs" style={{ color: D.sub }}>Enter password to log or delete posts.</p>
            <input
              type="password"
              value={loginPassword}
              onChange={e => { setLoginPassword(e.target.value); setLoginError('') }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Password"
              autoFocus
              className="px-3 py-2 rounded text-sm"
              style={{ backgroundColor: '#1e1e1e', border: `1px solid ${D.border}`, color: D.text, outline: 'none' }}
            />
            {loginError && <p className="text-xs" style={{ color: '#ef4444' }}>{loginError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogin(false)}
                className="flex-1 py-2 rounded text-xs font-medium"
                style={{ border: `1px solid ${D.border}`, color: D.sub }}
              >
                Cancel
              </button>
              <button
                onClick={handleLogin}
                className="flex-1 py-2 rounded text-xs font-medium"
                style={{ backgroundColor: D.accent, color: '#fff' }}
              >
                Login
              </button>
            </div>
          </div>
        </div>
      )}

      {syncMsg && (
        <div className="max-w-screen-xl mx-auto px-6 pt-4">
          <div
            className="px-4 py-2.5 rounded text-xs"
            style={{
              backgroundColor: syncMsg.startsWith('Sync failed') ? 'rgba(239,68,68,0.1)' : 'rgba(0,230,118,0.08)',
              border: `1px solid ${syncMsg.startsWith('Sync failed') ? 'rgba(239,68,68,0.3)' : D.accentBorder}`,
              color: syncMsg.startsWith('Sync failed') ? '#f87171' : D.accent,
            }}
          >
            {syncMsg}
          </div>
        </div>
      )}

      {discordSyncMsg && (
        <div className="max-w-screen-xl mx-auto px-6 pt-4">
          <div
            className="px-4 py-2.5 rounded text-xs"
            style={{
              backgroundColor: discordSyncMsg.startsWith('Discord sync failed') ? 'rgba(239,68,68,0.1)' : 'rgba(88,101,242,0.1)',
              border: `1px solid ${discordSyncMsg.startsWith('Discord sync failed') ? 'rgba(239,68,68,0.3)' : 'rgba(88,101,242,0.4)'}`,
              color: discordSyncMsg.startsWith('Discord sync failed') ? '#f87171' : '#818cf8',
            }}
          >
            {discordSyncMsg}
          </div>
        </div>
      )}

      {importMsg && (
        <div className="max-w-screen-xl mx-auto px-6 pt-4">
          <div
            className="px-4 py-2.5 rounded text-xs"
            style={{
              backgroundColor: importMsg.startsWith('Import failed') ? 'rgba(239,68,68,0.1)' : 'rgba(0,230,118,0.08)',
              border: `1px solid ${importMsg.startsWith('Import failed') ? 'rgba(239,68,68,0.3)' : D.accentBorder}`,
              color: importMsg.startsWith('Import failed') ? '#f87171' : D.accent,
            }}
          >
            {importMsg}
          </div>
        </div>
      )}

      {platform === 'discord' ? (
        <main className="max-w-screen-xl mx-auto px-6 py-6">
          <DiscordDashboard
            isLoggedIn={isLoggedIn}
            onRefresh={handleDiscordRefresh}
            refreshing={discordRefreshing}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        </main>
      ) : loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-xs" style={{ color: '#555' }}>Loading...</div>
        </div>
      ) : (
        <main className="max-w-screen-xl mx-auto px-6 py-6">
          {activeTab === 'activity'   && <ActivityChart posts={posts} competitors={competitors} />}
          {activeTab === 'updates'    && <TwitterFeed posts={filteredPosts} competitors={competitors} isLoggedIn={isLoggedIn} />}
          {activeTab === 'dashboard'  && <Dashboard posts={filteredPosts} competitors={competitors} />}
          {activeTab === 'comparison' && <ComparisonCharts posts={filteredPosts} competitors={competitors} />}
          {activeTab === 'themes'     && <ContentTheme posts={filteredPosts} competitors={competitors} />}
          {activeTab === 'posts'      && <TopPosts posts={filteredPosts} allCompetitors={competitors} onDeletePost={handleDeletePost} isLoggedIn={isLoggedIn} />}
          {activeTab === 'calendar'   && <CalendarView posts={filteredPosts} competitors={competitors} />}
          {activeTab === 'own'        && <OwnPerformance allPosts={posts} competitors={competitors} />}
          {activeTab === 'ecosystem'  && <Partnerships allPosts={posts} competitors={competitors} />}
          {activeTab === 'mentions'   && <Mentions dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onClear={clearDates} />}
        </main>
      )}
    </div>
  )
}
