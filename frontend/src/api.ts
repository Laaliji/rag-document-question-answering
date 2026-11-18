// Typed client for the FastAPI backend (proxied under /api by Vite).

export interface ProjectFile {
  file_id: string
  asset_id: string
  size: number
  uploaded_at: string
  chunks: number
}

export interface IndexInfo {
  status: string
  points_count: number
  vector_size: number
  distance: string
}

export interface Source {
  score: number
  text: string
  metadata: Record<string, unknown> | null
}

export interface AnswerResponse {
  answer: string
  full_prompt: string
  sources: Source[]
}

export interface ProcessResponse {
  inserted_chunks: number
  deleted_chunks: number
  processed_files: number
  failed_files: string[]
}

export class ApiError extends Error {
  status: number
  signal: string
  constructor(status: number, signal: string) {
    super(describeSignal(signal, status))
    this.status = status
    this.signal = signal
  }
}

// Backend responses carry a machine-readable `message` signal; map the
// common ones to sentences a person can act on.
const SIGNAL_TEXT: Record<string, string> = {
  project_not_found: 'This project does not exist yet. Upload a document to create it.',
  file_type_not_allowed: 'Only .txt and .pdf files are supported.',
  file_size_exceeded: 'This file is larger than the allowed size.',
  file_upload_failure: 'The file could not be uploaded.',
  no_files_found: 'Upload at least one document first.',
  file_processing_failure: 'None of the documents could be processed.',
  no_chunks_found: 'Process your documents before building the index.',
  insert_into_vectordb_error: 'Indexing failed. Is Ollama running with nomic-embed-text pulled?',
  vectordb_collection_not_found: 'This project has no index yet. Build the index first.',
  vectordb_search_error: 'Search failed. Is Ollama running with nomic-embed-text pulled?',
  no_relevant_documents: 'No relevant passages were found for this question.',
  rag_answer_error: 'The model could not answer. Is Ollama running with qwen2.5:3b pulled?',
}

function describeSignal(signal: string, status: number) {
  if (SIGNAL_TEXT[signal]) return SIGNAL_TEXT[signal]
  if (status === 0) return 'Cannot reach the backend. Is the API running on port 5000?'
  if (status === 422) return 'The request was rejected as invalid.'
  return signal || `Request failed (${status})`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/v1${path}`, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    })
  } catch {
    throw new ApiError(0, '')
  }
  // The Vite proxy answers 500/502/504 with an empty body when the backend is down
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(body ? res.status : 0, body?.message ?? '')
  return body as T
}

export const api = {
  health: () => request<{ app_name: string; app_version: string }>('/'),

  listProjects: () =>
    request<{ projects: string[] }>('/data/projects').then((r) => r.projects),

  listFiles: (projectId: string) =>
    request<{ files: ProjectFile[] }>(`/data/files/${projectId}`).then((r) => r.files),

  process: (projectId: string, opts: { chunk_size: number; overlap_size: number; do_reset: 0 | 1 }) =>
    request<ProcessResponse>(`/data/process/${projectId}`, {
      method: 'POST',
      body: JSON.stringify(opts),
    }),

  pushIndex: (projectId: string, doReset: boolean) =>
    request<{ inserted_items: number }>(`/nlp/index/push/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ do_reset: doReset ? 1 : 0 }),
    }),

  indexInfo: async (projectId: string): Promise<IndexInfo | null> => {
    try {
      const r = await request<{ collection_info: IndexInfo }>(`/nlp/index/info/${projectId}`)
      return r.collection_info
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null
      throw e
    }
  },

  answer: (projectId: string, text: string, limit: number) =>
    request<AnswerResponse>(`/nlp/index/answer/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ text, limit }),
    }),

  // XHR instead of fetch so we can report upload progress.
  upload: (projectId: string, file: File, onProgress: (fraction: number) => void) =>
    new Promise<{ file_id: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `/api/v1/data/upload/${projectId}`)
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
      xhr.onload = () => {
        let body: { message?: string; file_id?: string } | null = null
        try {
          body = JSON.parse(xhr.responseText)
        } catch {
          /* non-JSON error page */
        }
        if (xhr.status >= 200 && xhr.status < 300 && body?.file_id) resolve({ file_id: body.file_id })
        else reject(new ApiError(body ? xhr.status : 0, body?.message ?? ''))
      }
      xhr.onerror = () => reject(new ApiError(0, ''))
      const form = new FormData()
      form.append('file', file)
      xhr.send(form)
    }),
}

// Uploaded files are stored as "<12-char random key>_<clean name>".
export function displayName(fileId: string) {
  return fileId.replace(/^[A-Za-z0-9]{12}_/, '')
}

export function sourceLabel(meta: Source['metadata']) {
  const raw = typeof meta?.source === 'string' ? meta.source : ''
  const name = raw ? displayName(raw.split(/[\\/]/).pop() ?? raw) : 'Document'
  const page = typeof meta?.page === 'number' ? meta.page + 1 : null
  return page ? `${name} · p. ${page}` : name
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
