import { useState, useRef } from 'react'
import { useLocalStorage } from './hooks/useLocalStorage'
import { RISE_COMPETITORS } from './data/constants'
import { exportToCSV, importFromCSV } from './utils/csvUtils'
import PostLogger from './components/PostLogger'
import Dashboard from './components/Dashboard'
import ComparisonCharts from './components/ComparisonCharts'
import ContentTheme from './components/ContentTheme'
import TopPosts from './components/TopPosts'

const TABS = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'logger', label: 'Log Post' },
  { id: 'comparison', label: 'Comparisons' },
  { id: 'themes', label: 'Content Themes' },
  { id: 'posts', label: 'All Posts' },
]

export default function App() {
  const [posts, setPosts] = useLocalStorage('rise-intel-posts', [])
  const [activeTab, setActiveTab] = useState('dashboard')
  const [importMsg, setImportMsg] = useState(null)
  const importRef = useRef(null)

  const competitors = RISE_COMPETITORS
  const filteredPosts = posts.filter(p => competitors.includes(p.competitor))

  const handleAddPost = (post) => {
    setPosts(prev => [{ ...post, id: `post-${Date.now()}-${Math.random().toString(36).slice(2)}` }, ...prev])
  }

  const handleDeletePost = (id) => {
    setPosts(prev => prev.filter(p => p.id !== id))
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
      (imported) => {
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id))
          const newPosts = imported.filter(p => !existingIds.has(p.id))
          setImportMsg(`Imported ${newPosts.length} new posts (${imported.length - newPosts.length} duplicates skipped).`)
          setTimeout(() => setImportMsg(null), 4000)
          return [...prev, ...newPosts]
        })
      },
      (err) => {
        setImportMsg(`Import failed: ${err}`)
        setTimeout(() => setImportMsg(null), 4000)
      }
    )
    e.target.value = ''
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a12', color: '#e2e8f0' }}>
      {/* Header */}
      <header style={{ backgroundColor: '#0d0d1a', borderBottom: '1px solid #1a1a2e' }}>
        <div className="max-w-screen-xl mx-auto px-6">
          <div className="flex items-center justify-between py-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center w-8 h-8 rounded text-lg"
                style={{ backgroundColor: '#11111e', border: '1px solid #1a1a2e' }}
              >
                🔔
              </div>
              <div>
                <div className="font-bold text-base tracking-tight text-white">
                  RISE Intel Powered by Thaiji 🤖
                </div>
                <div className="text-xs" style={{ color: '#4b5563' }}>Competitor Content Tracker</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                disabled={posts.length === 0}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                style={{
                  border: '1px solid #1a1a2e',
                  color: posts.length === 0 ? '#374151' : '#9ca3af',
                  cursor: posts.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                ↓ Export CSV
              </button>
              <label
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer"
                style={{ border: '1px solid #1a1a2e', color: '#9ca3af' }}
              >
                ↑ Import CSV
                <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
              </label>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-5 py-3 text-sm font-medium border-b-2 transition-all"
                style={
                  activeTab === tab.id
                    ? { borderColor: '#00e676', color: '#00e676' }
                    : { borderColor: 'transparent', color: '#6b7280' }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Import feedback */}
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

      {/* Main content */}
      <main className="max-w-screen-xl mx-auto px-6 py-8">
        {activeTab === 'logger' && (
          <PostLogger competitors={competitors} onAddPost={handleAddPost} />
        )}
        {activeTab === 'dashboard' && (
          <Dashboard posts={filteredPosts} competitors={competitors} />
        )}
        {activeTab === 'comparison' && (
          <ComparisonCharts posts={filteredPosts} competitors={competitors} />
        )}
        {activeTab === 'themes' && (
          <ContentTheme posts={filteredPosts} competitors={competitors} />
        )}
        {activeTab === 'posts' && (
          <TopPosts
            posts={filteredPosts}
            allCompetitors={competitors}
            onDeletePost={handleDeletePost}
          />
        )}
      </main>
    </div>
  )
}
