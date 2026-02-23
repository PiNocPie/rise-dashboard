import { useState } from 'react'
import { CONTENT_CATEGORIES, COMPETITOR_TWITTER } from '../data/constants'

const EMPTY_FORM = {
  competitor: '',
  postUrl: '',
  postDate: '',
  postText: '',
  likes: '',
  retweets: '',
  replies: '',
  views: '',
  category: '',
}

const inputBase = {
  backgroundColor: '#0d0d1a',
  border: '1px solid #1a1a2e',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '14px',
  color: '#e2e8f0',
  width: '100%',
  outline: 'none',
  transition: 'border-color 0.15s',
}

const inputError = { ...inputBase, borderColor: '#ef4444' }

function Field({ label, error, children }) {
  return (
    <div>
      <label
        className="block text-xs font-medium uppercase tracking-wider mb-1.5"
        style={{ color: '#6b7280' }}
      >
        {label}
      </label>
      {children}
      {error && <p className="text-xs mt-1" style={{ color: '#f87171' }}>{error}</p>}
    </div>
  )
}

export default function PostLogger({ competitors, onAddPost }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ ...EMPTY_FORM, competitor: competitors[0] || '', postDate: today })
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState(false)

  // Sync competitor when competitors list changes (group toggle)
  const competitorList = competitors

  const set = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }))
  }

  const validate = () => {
    const e = {}
    if (!form.competitor) e.competitor = 'Required'
    if (!form.postDate) e.postDate = 'Required'
    if (!form.category) e.category = 'Required'
    if (form.views === '' || form.views === null) e.views = 'Required'
    return e
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    onAddPost({
      ...form,
      likes: Number(form.likes) || 0,
      retweets: Number(form.retweets) || 0,
      replies: Number(form.replies) || 0,
      views: Number(form.views) || 0,
    })
    setForm({ ...EMPTY_FORM, competitor: competitors[0] || '', postDate: today })
    setErrors({})
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  const getStyle = (field) => errors[field] ? inputError : inputBase

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">Log Competitor Post</h2>
        <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
          Manually enter metrics from X/Twitter
        </p>
      </div>

      {success && (
        <div
          className="mb-5 px-4 py-3 rounded-lg text-sm font-medium"
          style={{ backgroundColor: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.25)', color: '#00e676' }}
        >
          ✓ Post logged successfully
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-xl p-6 space-y-5"
        style={{ backgroundColor: '#11111e', border: '1px solid #1a1a2e' }}
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Competitor *" error={errors.competitor}>
            <div className="flex gap-2">
              <select
                value={form.competitor}
                onChange={set('competitor')}
                style={{ ...getStyle('competitor'), flex: 1 }}
                onFocus={e => (e.target.style.borderColor = '#00e676')}
                onBlur={e => (e.target.style.borderColor = errors.competitor ? '#ef4444' : '#1a1a2e')}
              >
                <option value="">Select…</option>
                {competitorList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {form.competitor && COMPETITOR_TWITTER[form.competitor] && (
                <a
                  href={COMPETITOR_TWITTER[form.competitor]}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open ${form.competitor} on X`}
                  className="flex items-center justify-center px-2.5 rounded-lg text-xs font-medium flex-shrink-0 transition-colors"
                  style={{ backgroundColor: '#0d0d1a', border: '1px solid #1a1a2e', color: '#6b7280' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#e2e8f0'; e.currentTarget.style.borderColor = '#2a2a3e' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = '#1a1a2e' }}
                >
                  𝕏
                </a>
              )}
            </div>
          </Field>

          <Field label="Category *" error={errors.category}>
            <select
              value={form.category}
              onChange={set('category')}
              style={getStyle('category')}
              onFocus={e => (e.target.style.borderColor = '#00e676')}
              onBlur={e => (e.target.style.borderColor = errors.category ? '#ef4444' : '#1a1a2e')}
            >
              <option value="">Select…</option>
              {CONTENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Post Date *" error={errors.postDate}>
            <input
              type="date"
              value={form.postDate}
              onChange={set('postDate')}
              style={getStyle('postDate')}
              onFocus={e => (e.target.style.borderColor = '#00e676')}
              onBlur={e => (e.target.style.borderColor = errors.postDate ? '#ef4444' : '#1a1a2e')}
            />
          </Field>

          <Field label="Post URL">
            <input
              type="url"
              value={form.postUrl}
              onChange={set('postUrl')}
              placeholder="https://x.com/…"
              style={inputBase}
              onFocus={e => (e.target.style.borderColor = '#00e676')}
              onBlur={e => (e.target.style.borderColor = '#1a1a2e')}
            />
          </Field>
        </div>

        <Field label="Post Text">
          <textarea
            value={form.postText}
            onChange={set('postText')}
            rows={4}
            placeholder="Paste tweet content here…"
            style={{ ...inputBase, resize: 'vertical', minHeight: '96px' }}
            onFocus={e => (e.target.style.borderColor = '#00e676')}
            onBlur={e => (e.target.style.borderColor = '#1a1a2e')}
          />
        </Field>

        <div className="grid grid-cols-4 gap-3">
          {[
            { field: 'views', label: 'Views *' },
            { field: 'likes', label: 'Likes' },
            { field: 'retweets', label: 'Retweets' },
            { field: 'replies', label: 'Replies' },
          ].map(({ field, label }) => (
            <Field key={field} label={label} error={errors[field]}>
              <input
                type="number"
                min="0"
                value={form[field]}
                onChange={set(field)}
                placeholder="0"
                style={getStyle(field)}
                onFocus={e => (e.target.style.borderColor = '#00e676')}
                onBlur={e => (e.target.style.borderColor = errors[field] ? '#ef4444' : '#1a1a2e')}
              />
            </Field>
          ))}
        </div>

        <button
          type="submit"
          className="w-full font-semibold py-3 rounded-lg text-sm transition-opacity"
          style={{ backgroundColor: '#00e676', color: '#000' }}
          onMouseEnter={e => (e.target.style.opacity = '0.9')}
          onMouseLeave={e => (e.target.style.opacity = '1')}
        >
          Log Post
        </button>
      </form>
    </div>
  )
}
