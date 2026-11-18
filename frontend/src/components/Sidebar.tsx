import { useState, type FormEvent } from 'react'
import { FolderClosed, Moon, Plus, RotateCw, Sun } from 'lucide-react'

export type Health = 'checking' | 'online' | 'offline'

interface Props {
  projects: string[]
  active: string | null
  health: Health
  theme: 'light' | 'dark'
  onSelect: (id: string) => void
  onCreate: (id: string) => void
  onRetry: () => void
  onToggleTheme: () => void
}

export function Sidebar({ projects, active, health, theme, onSelect, onCreate, onRetry, onToggleTheme }: Props) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const valid = /^[a-zA-Z0-9]+$/.test(name)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    onCreate(name)
    setName('')
    setCreating(false)
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/favicon.svg" alt="" width={26} height={26} />
        <div>
          <strong>MiniRAG</strong>
          <span>Document Q&amp;A</span>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-heading">
          <span>Projects</span>
          <button
            className="icon-btn"
            onClick={() => setCreating((c) => !c)}
            aria-label="New project"
            title="New project"
          >
            <Plus size={15} />
          </button>
        </div>

        {creating && (
          <form className="new-project" onSubmit={submit}>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setCreating(false)}
              placeholder="e.g. contracts2026"
              aria-label="Project name"
              aria-invalid={name.length > 0 && !valid}
            />
            <p className={`field-hint ${name && !valid ? 'is-error' : ''}`}>
              {name && !valid ? 'Letters and digits only, no spaces.' : 'Letters and digits only.'}
            </p>
            <div className="new-project-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={!valid}>
                Create
              </button>
            </div>
          </form>
        )}

        <nav className="project-list">
          {projects.length === 0 && !creating && (
            <button className="project-empty" onClick={() => setCreating(true)}>
              <Plus size={14} /> Create your first project
            </button>
          )}
          {projects.map((p) => (
            <button
              key={p}
              className={`project-item ${p === active ? 'is-active' : ''}`}
              onClick={() => onSelect(p)}
              aria-current={p === active ? 'page' : undefined}
            >
              <FolderClosed size={15} />
              <span>{p}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer">
        <div className={`status status-${health}`}>
          <span className="status-dot" />
          <span>
            {health === 'online' ? 'API connected' : health === 'offline' ? 'API offline' : 'Connecting…'}
          </span>
          {health === 'offline' && (
            <button className="icon-btn" onClick={onRetry} aria-label="Retry connection" title="Retry">
              <RotateCw size={13} />
            </button>
          )}
        </div>
        <div className="sidebar-footer-row">
          <span className="local-badge" title="Embeddings and answers run on your machine via Ollama">
            Local · Ollama
          </span>
          <button
            className="icon-btn"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>
    </aside>
  )
}
