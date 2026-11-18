import { useCallback, useEffect, useMemo, useState } from 'react'
import { PanelRight, X } from 'lucide-react'
import { api, ApiError, type IndexInfo, type ProjectFile } from './api'
import { Sidebar, type Health } from './components/Sidebar'
import { ChatPanel, type ChatMessage } from './components/ChatPanel'
import { DocumentsPanel } from './components/DocumentsPanel'
import { Pipeline } from './components/Pipeline'
import { Toasts, type Toast } from './components/Toasts'
import { storage } from './storage'

export type Notify = (kind: Toast['kind'], text: string) => void

export default function App() {
  const [health, setHealth] = useState<Health>('checking')
  const [projects, setProjects] = useState<string[]>([])
  const [drafts, setDrafts] = useState<string[]>([])
  const [active, setActive] = useState<string | null>(() => storage.get('activeProject'))
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [indexInfo, setIndexInfo] = useState<IndexInfo | null>(null)
  const [loadingProject, setLoadingProject] = useState(false)
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>(() => storage.getJSON('chats') ?? {})
  const [toasts, setToasts] = useState<Toast[]>([])
  const [docsOpen, setDocsOpen] = useState(false)
  // Lets the chat's empty state trigger an action that lives in the documents panel
  const [docsRequest, setDocsRequest] = useState<{ action: 'upload' | 'prepare'; n: number } | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = storage.get('theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    storage.set('theme', theme)
  }, [theme])

  useEffect(() => {
    // Keep only finished messages; a reload mid-request would otherwise show a stuck spinner.
    const finished = Object.fromEntries(
      Object.entries(chats).map(([k, msgs]) => [k, msgs.filter((m) => !m.pending)]),
    )
    storage.setJSON('chats', finished)
  }, [chats])

  useEffect(() => {
    if (active) storage.set('activeProject', active)
  }, [active])

  const notify: Notify = useCallback((kind, text) => {
    const id = crypto.randomUUID()
    setToasts((t) => [...t, { id, kind, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 4000)
  }, [])

  const loadProjects = useCallback(async () => {
    try {
      await api.health()
      setHealth('online')
      const list = await api.listProjects()
      setProjects(list)
      setDrafts((d) => d.filter((p) => !list.includes(p)))
      setActive((cur) => cur ?? list[0] ?? null)
    } catch {
      setHealth('offline')
    }
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const refreshProject = useCallback(
    async (projectId = active) => {
      if (!projectId) return
      try {
        const [f, info] = await Promise.all([
          api.listFiles(projectId).catch((e) => {
            // A draft project only exists in Mongo after its first upload
            if (e instanceof ApiError && e.status === 404) return [] as ProjectFile[]
            throw e
          }),
          api.indexInfo(projectId),
        ])
        setFiles(f)
        setIndexInfo(info)
      } catch (e) {
        if (e instanceof ApiError && e.status === 0) setHealth('offline')
      }
    },
    [active],
  )

  useEffect(() => {
    if (!active || health !== 'online') return
    setFiles([])
    setIndexInfo(null)
    setLoadingProject(true)
    refreshProject(active).finally(() => setLoadingProject(false))
  }, [active, health, refreshProject])

  const allProjects = useMemo(() => [...projects, ...drafts.filter((d) => !projects.includes(d))], [projects, drafts])

  const createProject = (id: string) => {
    if (!allProjects.includes(id)) setDrafts((d) => [...d, id])
    setActive(id)
    setDocsOpen(true)
  }

  const totalChunks = files.reduce((s, f) => s + f.chunks, 0)
  const indexed = indexInfo?.points_count ?? 0
  const ready = indexed > 0

  const setMessages = (projectId: string, update: (m: ChatMessage[]) => ChatMessage[]) =>
    setChats((c) => ({ ...c, [projectId]: update(c[projectId] ?? []) }))

  return (
    <div className="app">
      <Sidebar
        projects={allProjects}
        active={active}
        health={health}
        theme={theme}
        onSelect={(p) => setActive(p)}
        onCreate={createProject}
        onRetry={loadProjects}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />

      {active ? (
        <main className="workspace">
          <header className="topbar">
            <div className="topbar-title">
              <span className="eyebrow">Project</span>
              <h1>{active}</h1>
            </div>
            <Pipeline files={files.length} chunks={totalChunks} indexed={indexed} />
            <button
              className="btn btn-ghost docs-toggle"
              onClick={() => setDocsOpen((o) => !o)}
              aria-label="Toggle documents panel"
            >
              {docsOpen ? <X size={16} /> : <PanelRight size={16} />}
              <span>Documents</span>
            </button>
          </header>

          <div className="workspace-body">
            <ChatPanel
              key={active}
              projectId={active}
              ready={ready}
              hasFiles={files.length > 0}
              messages={chats[active] ?? []}
              setMessages={(u) => setMessages(active, u)}
              onPrepare={(action) => {
                setDocsOpen(true)
                setDocsRequest((r) => ({ action, n: (r?.n ?? 0) + 1 }))
              }}
            />
            <DocumentsPanel
              key={`docs-${active}`}
              open={docsOpen}
              projectId={active}
              files={files}
              indexInfo={indexInfo}
              loading={loadingProject}
              totalChunks={totalChunks}
              request={docsRequest}
              notify={notify}
              onChanged={async () => {
                await refreshProject(active)
                if (!projects.includes(active)) loadProjects()
              }}
              onClose={() => setDocsOpen(false)}
            />
          </div>
        </main>
      ) : (
        <main className="workspace workspace-empty">
          <div className="empty-hero">
            <div className="empty-mark" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <h1>Ask your documents anything</h1>
            <p>
              Create a project, upload PDFs or text files, and get answers grounded in your own sources. Everything
              runs locally — no paid APIs.
            </p>
            {health === 'offline' && (
              <p className="callout callout-warn">
                The backend is not reachable. Start it with <code>uvicorn main:app --port 5000</code> from{' '}
                <code>src/</code>.
              </p>
            )}
          </div>
        </main>
      )}

      <Toasts toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  )
}
