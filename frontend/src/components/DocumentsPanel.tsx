import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Database, FileText, Layers, Loader2, Settings2, UploadCloud, X, Zap } from 'lucide-react'
import { api, displayName, formatBytes, type IndexInfo, type ProjectFile } from '../api'
import type { Notify } from '../App'

interface Props {
  open: boolean
  projectId: string
  files: ProjectFile[]
  indexInfo: IndexInfo | null
  loading: boolean
  totalChunks: number
  request: { action: 'upload' | 'prepare'; n: number } | null
  notify: Notify
  onChanged: () => Promise<void>
  onClose: () => void
}

interface UploadItem {
  id: string
  name: string
  progress: number
}

const MAX_MB = 10
const ACCEPT = ['text/plain', 'application/pdf']

type Step = 'idle' | 'processing' | 'indexing'

export function DocumentsPanel(props: Props) {
  const { open, projectId, files, indexInfo, loading, totalChunks, request, notify, onChanged, onClose } = props
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [dragging, setDragging] = useState(false)
  const [step, setStep] = useState<Step>('idle')
  const [showSettings, setShowSettings] = useState(false)
  const [chunkSize, setChunkSize] = useState(600)
  const [overlap, setOverlap] = useState(80)
  const inputRef = useRef<HTMLInputElement>(null)

  const indexed = indexInfo?.points_count ?? 0
  const unprocessed = files.filter((f) => f.chunks === 0).length
  const stale = indexed > 0 && totalChunks > 0 && indexed !== totalChunks
  const needsWork = files.length > 0 && (unprocessed > 0 || indexed === 0 || stale)

  const handleFiles = async (list: FileList | null) => {
    if (!list?.length) return
    const accepted: File[] = []
    for (const f of Array.from(list)) {
      if (!ACCEPT.includes(f.type) && !/\.(pdf|txt)$/i.test(f.name)) notify('error', `${f.name}: only .txt and .pdf files are supported.`)
      else if (f.size > MAX_MB * 1024 * 1024) notify('error', `${f.name} is larger than ${MAX_MB} MB.`)
      else accepted.push(f)
    }
    if (!accepted.length) return

    const items = accepted.map((f) => ({ id: crypto.randomUUID(), name: f.name, progress: 0 }))
    setUploads((u) => [...u, ...items])

    let ok = 0
    // Sequential uploads keep the backend and progress bars simple
    for (const [i, file] of accepted.entries()) {
      const item = items[i]
      try {
        await api.upload(projectId, file, (p) =>
          setUploads((u) => u.map((x) => (x.id === item.id ? { ...x, progress: p } : x))),
        )
        ok++
      } catch (e) {
        notify('error', `${file.name}: ${(e as Error).message}`)
      } finally {
        setUploads((u) => u.filter((x) => x.id !== item.id))
      }
    }
    if (ok) {
      notify('success', `Uploaded ${ok} file${ok === 1 ? '' : 's'}. Process & index to use them.`)
      await onChanged()
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  // Re-chunking creates new chunk ids, so the index is rebuilt from scratch to avoid stale vectors.
  const processAndIndex = async () => {
    try {
      setStep('processing')
      const r = await api.process(projectId, { chunk_size: chunkSize, overlap_size: overlap, do_reset: 1 })
      if (r.failed_files.length) {
        notify('error', `Could not process: ${r.failed_files.map(displayName).join(', ')}`)
      }
      setStep('indexing')
      const p = await api.pushIndex(projectId, true)
      notify('success', `Ready — ${p.inserted_items} passages indexed from ${r.processed_files} file${r.processed_files === 1 ? '' : 's'}.`)
    } catch (e) {
      notify('error', (e as Error).message)
    } finally {
      setStep('idle')
      await onChanged()
    }
  }

  const busy = step !== 'idle'

  // Handle "Upload documents" / "Process & index" clicked from the chat's empty state
  const lastRequest = useRef(request?.n ?? 0)
  useEffect(() => {
    if (!request || request.n === lastRequest.current) return
    lastRequest.current = request.n
    if (request.action === 'upload') inputRef.current?.click()
    else if (!busy && files.length > 0) processAndIndex()
  }, [request])

  return (
    <>
      <div className={`docs-scrim ${open ? 'is-open' : ''}`} onClick={onClose} aria-hidden />
      <aside className={`docs ${open ? 'is-open' : ''}`} aria-label="Documents">
        <div className="docs-head">
          <div>
            <h2>Documents</h2>
            <p>Your sources for this project</p>
          </div>
          <button className="icon-btn docs-close" onClick={onClose} aria-label="Close documents panel">
            <X size={16} />
          </button>
        </div>

        <div className="docs-scroll">
          <div
            className={`dropzone ${dragging ? 'is-dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
          >
            <span className="dropzone-icon">
              <UploadCloud size={20} />
            </span>
            <strong>Drop files here or <u>browse</u></strong>
            <span>PDF or TXT · up to {MAX_MB} MB each</span>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.txt,application/pdf,text/plain"
              multiple
              hidden
              onChange={(e) => {
                handleFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </div>

          {uploads.length > 0 && (
            <ul className="upload-list">
              {uploads.map((u) => (
                <li key={u.id}>
                  <span className="upload-name">{u.name}</span>
                  <span className="progress">
                    <span style={{ width: `${Math.round(u.progress * 100)}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="docs-section">
            <div className="docs-section-head">
              <span>Files</span>
              <span className="count">{files.length}</span>
            </div>
            {loading ? (
              <div className="file-skeleton">
                <span />
                <span />
              </div>
            ) : files.length === 0 ? (
              <p className="muted small">No documents yet.</p>
            ) : (
              <ul className="file-list">
                {files.map((f) => (
                  <li key={f.asset_id} className="file-item">
                    <span className={`file-icon ${f.file_id.toLowerCase().endsWith('.pdf') ? 'is-pdf' : ''}`}>
                      <FileText size={15} />
                      <small>{f.file_id.toLowerCase().endsWith('.pdf') ? 'PDF' : 'TXT'}</small>
                    </span>
                    <span className="file-main">
                      <span className="file-name" title={displayName(f.file_id)}>
                        {displayName(f.file_id)}
                      </span>
                      <span className="file-meta">
                        {formatBytes(f.size)} · {new Date(f.uploaded_at).toLocaleDateString()}
                      </span>
                    </span>
                    {f.chunks > 0 ? (
                      <span className="pill pill-ok">{f.chunks} chunks</span>
                    ) : (
                      <span className="pill pill-muted">New</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="docs-section">
            <div className="docs-section-head">
              <span>Search index</span>
            </div>
            <div className={`index-card ${indexed > 0 ? (stale ? 'is-warn' : 'is-ready') : ''}`}>
              <div className="index-card-top">
                <span className="index-card-icon">
                  <Database size={16} />
                </span>
                <div>
                  <strong>{indexed.toLocaleString()}</strong>
                  <span>vectors indexed</span>
                </div>
                <span className="index-card-state">{indexed === 0 ? 'Empty' : stale ? 'Outdated' : 'Ready'}</span>
              </div>
              <div className="progress progress-lg" aria-label="Indexed share of chunks">
                <span style={{ width: `${totalChunks ? Math.min(100, (indexed / totalChunks) * 100) : 0}%` }} />
              </div>
              <dl className="stats">
                <div>
                  <dt>
                    <Layers size={12} /> Chunks
                  </dt>
                  <dd>{totalChunks.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Dimensions</dt>
                  <dd>{indexInfo?.vector_size ?? '—'}</dd>
                </div>
                <div>
                  <dt>Distance</dt>
                  <dd>{indexInfo?.distance ?? '—'}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <div className="docs-actions">
          {showSettings && (
            <div className="settings">
              <label>
                <span>Chunk size</span>
                <input
                  type="number"
                  min={100}
                  max={4000}
                  step={50}
                  value={chunkSize}
                  onChange={(e) => setChunkSize(Number(e.target.value))}
                />
                <small>characters</small>
              </label>
              <label>
                <span>Overlap</span>
                <input
                  type="number"
                  min={0}
                  max={Math.max(0, chunkSize - 1)}
                  step={10}
                  value={overlap}
                  onChange={(e) => setOverlap(Number(e.target.value))}
                />
                <small>characters</small>
              </label>
            </div>
          )}
          <div className="docs-actions-row">
            <button
              className="btn btn-primary btn-block"
              onClick={processAndIndex}
              disabled={busy || files.length === 0 || overlap >= chunkSize}
            >
              {busy ? <Loader2 size={15} className="spin" /> : <Zap size={15} />}
              {step === 'processing'
                ? 'Chunking documents…'
                : step === 'indexing'
                  ? 'Embedding & indexing…'
                  : needsWork
                    ? 'Process & index'
                    : 'Rebuild index'}
            </button>
            <button
              className={`icon-btn icon-btn-bordered ${showSettings ? 'is-on' : ''}`}
              onClick={() => setShowSettings((s) => !s)}
              aria-label="Chunking settings"
              aria-expanded={showSettings}
              title="Chunking settings"
            >
              <Settings2 size={16} />
            </button>
          </div>
          <p className="muted small center">
            {step === 'indexing'
              ? 'Embedding runs locally — large files can take a minute.'
              : needsWork
                ? `${unprocessed > 0 ? `${unprocessed} new file${unprocessed === 1 ? '' : 's'} · ` : ''}Run this after every upload.`
                : files.length
                  ? 'Everything is indexed and ready.'
                  : 'Upload documents to get started.'}
          </p>
        </div>
      </aside>
    </>
  )
}
