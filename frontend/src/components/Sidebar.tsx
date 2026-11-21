import { useState, type FormEvent } from 'react'
import { Cpu, Moon, Plus, RotateCw, Sun } from 'lucide-react'
import { ProjectAvatar } from './ProjectAvatar'

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

export const PROJECT_NAME = /^[a-zA-Z0-9]+$/

export function Sidebar(props: Props) {
  const { projects, active, health, theme, onSelect, onCreate, onRetry, onToggleTheme } = props
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const valid = PROJECT_NAME.test(name)

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
        <img src="/favicon.svg" alt="" width={30} height={30} />
        <div>
          <strong>MiniRAG</strong>
          <span>Ask your documents</span>
        </div>
      </div>

      <button className="new-project-btn" onClick={() => setCreating((c) => !c)} aria-expanded={creating}>
        <Plus size={15} strokeWidth={2.4} />
        New project
      </button>

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
            <button type="button" className="btn btn-side btn-sm" onClick={() => setCreating(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={!valid}>
              Create
            </button>
          </div>
        </form>
      )}

      <div className="sidebar-section">
        <div className="sidebar-heading">
          <span>Projects</span>
          {projects.length > 0 && <span className="sidebar-count">{projects.length}</span>}
        </div>

        <nav className="project-list">
          {projects.length === 0 && !creating && <p className="project-empty">No projects yet.</p>}
          {projects.map((p) => (
            <button
              key={p}
              className={`project-item ${p === active ? 'is-active' : ''}`}
              onClick={() => onSelect(p)}
              aria-current={p === active ? 'page' : undefined}
            >
              <ProjectAvatar name={p} size={22} />
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
            <Cpu size={12} /> Runs locally
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
