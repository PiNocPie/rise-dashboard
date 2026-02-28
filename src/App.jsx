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

const TABS = [
  { id: 'dashboard',    label: 'Overview' },
  { id: 'activity',     label: 'Activity' },
  { id: 'own',          label: 'Our Posts' },
  { id: 'mentions',     label: 'Mentions' },
  { id: 'updates',      label: 'Updates' },
  { id: 'ecosystem',    label: 'Ecosystem' },
  { id: 'comparison',   label: 'Comparisons' },
  { id: 'themes',       label: 'Themes' },
  { id: 'posts',        label: 'All Posts' },
  { id: 'calendar',     label: 'Calendar' },
]

export default function App() {
  const [platform, setPlatform] = useState('twitter')   // 'twitter' | 'discord'
  const [posts, setPosts] = useState([])
  const [activeTab, setActiveTab] = useState('dashboard')
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

  const handleTabClick = (tabId) => {
    setActiveTab(tabId)
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000', color: '#f0f4ff' }}>
      <header
        style={{
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div className="max-w-screen-xl mx-auto px-6">
          <div className="flex items-center justify-between py-3.5">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center w-8 h-8 rounded-xl text-base font-bold"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,230,118,0.2) 0%, rgba(99,102,241,0.2) 100%)',
                  border: '1px solid rgba(0,230,118,0.25)',
                  color: '#00e676',
                }}
              >
                ⚡
              </div>
              <div>
                <div
                  className="font-bold text-sm tracking-tight"
                  style={{
                    background: 'linear-gradient(135deg, #f0f4ff 0%, #9ca3af 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  RISE Intel
                  <span className="ml-2 text-xs font-normal" style={{ WebkitTextFillColor: '#4b5563', color: '#4b5563' }}>
                    by Thaiji
                  </span>
                </div>
                <div className="text-xs" style={{ color: '#374151' }}>
                  {posts.length > 0 ? `${posts.length} posts tracked` : 'Competitor Intelligence'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Platform toggle */}
              <div
                className="flex items-center gap-0.5 p-0.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <button
                  onClick={() => setPlatform('twitter')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
                  style={
                    platform === 'twitter'
                      ? { background: 'linear-gradient(135deg, #00e676, #00c853)', color: '#000', boxShadow: '0 0 12px rgba(0,230,118,0.3)' }
                      : { color: '#6b7280' }
                  }
                >
                  𝕏 Twitter
                </button>
                <button
                  onClick={() => setPlatform('discord')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
                  style={
                    platform === 'discord'
                      ? { background: '#5865F2', color: '#fff', boxShadow: '0 0 12px rgba(88,101,242,0.3)' }
                      : { color: '#6b7280' }
                  }
                >
                  💬 Discord
                </button>
              </div>

              {/* Date/time range */}
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <input
                  type="datetime-local"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="text-xs"
                  style={{ background: 'transparent', border: 'none', color: dateFrom ? '#f0f4ff' : '#374151', outline: 'none', cursor: 'pointer', width: 140 }}
                />
                <span className="text-xs" style={{ color: '#374151' }}>→</span>
                <input
                  type="datetime-local"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="text-xs"
                  style={{ background: 'transparent', border: 'none', color: dateTo ? '#f0f4ff' : '#374151', outline: 'none', cursor: 'pointer', width: 140 }}
                />
                {(dateFrom || dateTo) && (
                  <button onClick={clearDates} className="text-xs ml-1" style={{ color: '#4b5563' }}>✕</button>
                )}
              </div>

              {/* Twitter controls */}
              {platform === 'twitter' && isLoggedIn && (
                <>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                    style={{ border: '1px solid rgba(255,255,255,0.08)', color: syncing ? '#374151' : '#9ca3af' }}
                  >
                    {syncing ? '⟳ Syncing…' : '⟳ Sync'}
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={posts.length === 0}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg"
                    style={{ border: '1px solid rgba(255,255,255,0.08)', color: posts.length === 0 ? '#374151' : '#9ca3af' }}
                  >
                    ↓ CSV
                  </button>
                  <label
                    className="px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer"
                    style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}
                  >
                    ↑ CSV
                    <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
                  </label>
                </>
              )}

              <button
                onClick={() => isLoggedIn ? setIsLoggedIn(false) : (setShowLogin(true), setLoginPassword(''), setLoginError(''))}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
                style={
                  isLoggedIn
                    ? { background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.2)', color: '#00e676' }
                    : { border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }
                }
              >
                {isLoggedIn ? '🔓 Logged in' : '🔒 Login'}
              </button>
            </div>
          </div>

          {platform === 'twitter' && (
            <div className="flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className="px-4 py-3 text-xs font-semibold whitespace-nowrap transition-all relative"
                  style={
                    activeTab === tab.id
                      ? { color: '#00e676' }
                      : { color: '#4b5563' }
                  }
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 12,
                        right: 12,
                        height: 2,
                        background: 'linear-gradient(90deg, #00e676, #00b4d8)',
                        borderRadius: 2,
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-xl p-6 w-80 flex flex-col gap-4" style={{ backgroundColor: '#11111e', border: '1px solid #1a1a2e' }}>
            <h3 className="text-white font-bold">Login Required</h3>
            <p className="text-xs" style={{ color: '#6b7280' }}>Enter password to log or delete posts.</p>
            <input
              type="password"
              value={loginPassword}
              onChange={e => { setLoginPassword(e.target.value); setLoginError('') }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Password"
              autoFocus
              className="px-3 py-2 rounded-lg text-sm"
              style={{ backgroundColor: '#0d0d1a', border: '1px solid #1a1a2e', color: '#e2e8f0', outline: 'none' }}
            />
            {loginError && <p className="text-xs" style={{ color: '#ef4444' }}>{loginError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogin(false)}
                className="flex-1 py-2 rounded-lg text-xs font-medium"
                style={{ border: '1px solid #1a1a2e', color: '#6b7280' }}
              >
                Cancel
              </button>
              <button
                onClick={handleLogin}
                className="flex-1 py-2 rounded-lg text-xs font-medium"
                style={{ backgroundColor: '#00e676', color: '#000' }}
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
            className="px-4 py-3 rounded-lg text-sm"
            style={{
              backgroundColor: syncMsg.startsWith('Sync failed') ? 'rgba(239,68,68,0.1)' : 'rgba(0,230,118,0.1)',
              border: `1px solid ${syncMsg.startsWith('Sync failed') ? 'rgba(239,68,68,0.3)' : 'rgba(0,230,118,0.3)'}`,
              color: syncMsg.startsWith('Sync failed') ? '#f87171' : '#00e676',
            }}
          >
            {syncMsg}
          </div>
        </div>
      )}

      {discordSyncMsg && (
        <div className="max-w-screen-xl mx-auto px-6 pt-4">
          <div
            className="px-4 py-3 rounded-lg text-sm"
            style={{
              backgroundColor: discordSyncMsg.startsWith('Discord sync failed') ? 'rgba(239,68,68,0.1)' : 'rgba(88,101,242,0.1)',
              border: `1px solid ${discordSyncMsg.startsWith('Discord sync failed') ? 'rgba(239,68,68,0.3)' : 'rgba(88,101,242,0.3)'}`,
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
            className="px-4 py-3 rounded-lg text-sm"
            style={{
              backgroundColor: importMsg.startsWith('Import failed') ? 'rgba(239,68,68,0.1)' : 'rgba(0,230,118,0.1)',
              border: `1px solid ${importMsg.startsWith('Import failed') ? 'rgba(239,68,68,0.3)' : 'rgba(0,230,118,0.3)'}`,
              color: importMsg.startsWith('Import failed') ? '#f87171' : '#00e676',
            }}
          >
            {importMsg}
          </div>
        </div>
      )}

      {platform === 'discord' ? (
        <main className="max-w-screen-xl mx-auto px-6 py-8">
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
          <div className="text-sm" style={{ color: '#6b7280' }}>Loading...</div>
        </div>
      ) : (
        <main className="max-w-screen-xl mx-auto px-6 py-8">
          {activeTab === 'activity'   && <ActivityChart posts={posts} competitors={competitors} />}
          {activeTab === 'updates'    && <TwitterFeed posts={filteredPosts} competitors={competitors} isLoggedIn={isLoggedIn} />}
          {activeTab === 'dashboard'  && <Dashboard posts={filteredPosts} competitors={competitors} />}
          {activeTab === 'comparison' && <ComparisonCharts posts={filteredPosts} competitors={competitors} />}
          {activeTab === 'themes'     && <ContentTheme posts={filteredPosts} competitors={competitors} />}
          {activeTab === 'posts'      && <TopPosts posts={filteredPosts} allCompetitors={competitors} onDeletePost={handleDeletePost} isLoggedIn={isLoggedIn} />}
          {activeTab === 'calendar'   && <CalendarView posts={filteredPosts} competitors={competitors} />}
          {activeTab === 'own'        && <OwnPerformance allPosts={posts} competitors={competitors} />}
          {activeTab === 'ecosystem'  && <Partnerships allPosts={posts} competitors={competitors} />}
          {activeTab === 'mentions'   && <Mentions dateFrom={dateFrom} dateTo={dateTo} />}
        </main>
      )}
    </div>
  )
}
